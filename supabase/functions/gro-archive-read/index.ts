// Private B2 archive bridge for server-side GRO restore only.
// The caller must present the authoritative project's service-role key.
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: Uint8Array | string) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", typeof value === "string" ? encoder.encode(value) : value)));
async function hmac(key: Uint8Array | string, value: string): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", typeof key === "string" ? encoder.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", material, encoder.encode(value)));
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });
  // JWT signature is validated by the Supabase gateway (verify_jwt=true).
  let role: unknown;
  try { role = JSON.parse(atob(token.split(".")[1])).role; } catch { return new Response("Unauthorized", { status: 401 }); }
  if (role !== "service_role") return new Response("Forbidden", { status: 403 });
  try {
    const { object_id: id } = await request.json();
    if (typeof id !== "string" || !/^gro_[A-Za-z0-9_]+$/.test(id)) {
      return new Response("Invalid object ID", { status: 400 });
    }
    const access = Deno.env.get("B2_ARCHIVE_READ_KEY_ID")?.trim();
    const secret = Deno.env.get("B2_ARCHIVE_READ_APPLICATION_KEY")?.trim();
    if (!access || !secret) throw new Error("Archive read credentials unavailable");
    const host = "s3.us-east-005.backblazeb2.com";
    const path = `/geomacro-private-archive/geomacro-evidence/v1/gro/${id}.json.gz`;
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
    const upstream = await fetch(`https://${host}${path}`, {
      headers: {
        "x-amz-content-sha256": emptyHash,
        "x-amz-date": stamp,
        authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) return new Response("Archive unavailable", { status: 502 });
    const length = Number(upstream.headers.get("content-length") ?? "0");
    if (length > 2_000_000) return new Response("Archive too large", { status: 502 });
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.length > 2_000_000) return new Response("Archive too large", { status: 502 });
    return new Response(bytes, { headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store" } });
  } catch {
    return new Response("Archive unavailable", { status: 502 });
  }
});
