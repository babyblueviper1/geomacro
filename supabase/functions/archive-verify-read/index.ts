// Service-role-only B2 archive verification bridge for maintenance workers.
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: Uint8Array | string) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", typeof value === "string" ? encoder.encode(value) : value)));
async function hmac(key: Uint8Array | string, value: string): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", typeof key === "string" ? encoder.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", material, encoder.encode(value)));
}
async function b2Get(key: string) {
  const access = Deno.env.get("B2_ARCHIVE_READ_KEY_ID")?.trim();
  const secret = Deno.env.get("B2_ARCHIVE_READ_APPLICATION_KEY")?.trim();
  if (!access || !secret) throw new Error("ARCHIVE_READ_CONFIG_UNAVAILABLE");
  const host = "s3.us-east-005.backblazeb2.com";
  const path = `/geomacro-private-archive/${key.split("/").map(encodeURIComponent).join("/")}`;
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = stamp.slice(0, 8);
  const emptyHash = await sha256("");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const headers = `host:${host}\nx-amz-content-sha256:${emptyHash}\nx-amz-date:${stamp}\n`;
  const canonical = ["GET", path, "", headers, signedHeaders, emptyHash].join("\n");
  const scope = `${day}/us-east-005/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", stamp, scope, await sha256(canonical)].join("\n");
  const signingKey = await hmac(await hmac(await hmac(await hmac(`AWS4${secret}`, day), "us-east-005"), "s3"), "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));
  const upstream = await fetch(`https://${host}${path}`, { headers: {
    "x-amz-content-sha256": emptyHash,
    "x-amz-date": stamp,
    authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }, signal: AbortSignal.timeout(15_000) });
  if (!upstream.ok) throw new Error(`ARCHIVE_READ_UPSTREAM_${upstream.status}`);
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.length > 4_000_000) throw new Error("ARCHIVE_READ_TOO_LARGE");
  return bytes;
}
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });
  let role: unknown;
  try { role = JSON.parse(atob(token.split(".")[1])).role; } catch { return new Response("Unauthorized", { status: 401 }); }
  if (role !== "service_role") return new Response("Forbidden", { status: 403 });
  try {
    const body = await request.json();
    const kind = String(body?.kind ?? "");
    const part = String(body?.part ?? "");
    const id = String(body?.id ?? "");
    let key = "";
    if (kind === "gro" && /^gro_[A-Za-z0-9_]+$/.test(id)) {
      key = part === "archive" ? `geomacro-evidence/v1/gro/${id}.json.gz` :
        part === "proof" ? `geomacro-evidence/v1/index/gro/${id}.json` : "";
    } else if (kind === "observation" && id.length >= 1 && id.length <= 512) {
      const idHash = await sha256(id);
      key = part === "archive" ? `geomacro-evidence/v1/observations/${idHash}.json.gz` :
        part === "proof" ? `geomacro-evidence/v1/index/observations/${idHash}.json` : "";
    }
    if (!key) return new Response("Invalid request", { status: 400 });
    const bytes = await b2Get(key);
    return new Response(bytes, { headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store" } });
  } catch {
    return new Response("Archive unavailable", { status: 502 });
  }
});
