// Bounded, fail-closed signed GRO archival. Invoke from Supabase Cron every 5 minutes.
// Requires a B2 key scoped to geomacro-private-archive and service-role JWT at the gateway.
const enc = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const sha = async (bytes: Uint8Array | string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", typeof bytes === "string" ? enc.encode(bytes) : bytes)));
const unbase64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function hmac(key: Uint8Array | string, value: string): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, enc.encode(value)));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

type Row = { object_id: string; payload: Record<string, unknown>; payload_hash: string;
  signature: string; signing_key_id: string; expires_at: string; archive_key: string | null };
type Key = { key_id: string; public_key_spki_b64: string; status: string;
  not_before: string | null; not_after: string | null };

async function signedRowValid(row: Row, keys: Key[]): Promise<boolean> {
  const body = row.payload;
  const integrity = body?.integrity as Record<string, unknown> | undefined;
  const key = keys.find(k => k.key_id === row.signing_key_id && k.status !== "revoked");
  const generated = Date.parse(String(body?.generated_at));
  if (!key || !Number.isFinite(generated) ||
      (key.not_before && generated < Date.parse(key.not_before)) ||
      (key.not_after && generated > Date.parse(key.not_after)) ||
      body?.object_id !== row.object_id || integrity?.payload_hash !== row.payload_hash ||
      integrity?.signature !== row.signature || integrity?.signing_key_id !== row.signing_key_id ||
      integrity?.canonicalization !== "geomacro-canonical-json-v1" ||
      integrity?.signature_scheme !== "Ed25519" ||
      typeof row.signature !== "string" || !/^[a-f0-9]{64}$/.test(row.payload_hash)) return false;
  const signable = { ...body, integrity: { ...integrity, payload_hash: null, signature: null } };
  const bytes = enc.encode(canonical(signable));
  if (await sha(bytes) !== row.payload_hash) return false;
  try {
    const imported = await crypto.subtle.importKey("spki", unbase64(key.public_key_spki_b64), "Ed25519", false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", imported, unbase64(row.signature), bytes);
  } catch { return false; }
}

async function b2(method: "PUT" | "GET", key: string, access: string, secret: string, body = new Uint8Array()): Promise<Uint8Array> {
  if (!/^geomacro-evidence\/v1\/[A-Za-z0-9_./-]+$/.test(key) || key.includes("..")) throw Error("INVALID_ARCHIVE_KEY");
  const host = "s3.us-east-005.backblazeb2.com";
  const path = `/geomacro-private-archive/${key}`;
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = stamp.slice(0, 8);
  const digest = await sha(method === "PUT" ? body : "");
  const headers = `host:${host}\nx-amz-content-sha256:${digest}\nx-amz-date:${stamp}\n`;
  const scope = `${day}/us-east-005/s3/aws4_request`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const request = [method, path, "", headers, signedHeaders, digest].join("\n");
  const signingKey = await hmac(await hmac(await hmac(await hmac(`AWS4${secret}`, day), "us-east-005"), "s3"), "aws4_request");
  const signature = hex(await hmac(signingKey, ["AWS4-HMAC-SHA256", stamp, scope, await sha(request)].join("\n")));
  const response = await fetch(`https://${host}${path}`, {
    method, headers: { "x-amz-content-sha256": digest, "x-amz-date": stamp,
      authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` },
    body: method === "PUT" ? body : undefined, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw Error(`B2_${method}_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 2_000_000) throw Error("B2_RESPONSE_TOO_LARGE");
  return bytes;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });
  let role: unknown;
  try { role = JSON.parse(atob(token.split(".")[1])).role; } catch { return new Response("Unauthorized", { status: 401 }); }
  // Supabase gateway must verify the JWT signature (verify_jwt=true).
  if (role !== "service_role") return new Response("Forbidden", { status: 403 });
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const access = Deno.env.get("B2_ARCHIVE_WRITE_KEY_ID")?.trim();
  const secret = Deno.env.get("B2_ARCHIVE_WRITE_APPLICATION_KEY")?.trim();
  const missing = [!url && "SUPABASE_URL", !service && "SUPABASE_SERVICE_ROLE_KEY",
    !access && "B2_ARCHIVE_WRITE_KEY_ID", !secret && "B2_ARCHIVE_WRITE_APPLICATION_KEY"].filter(Boolean);
  if (missing.length || !url || new URL(url).hostname !== "ldpwajisioljyjtojvfx.supabase.co") {
    return Response.json({ error: "ARCHIVE_CONFIG_UNAVAILABLE", missing_names: missing }, { status: 503 });
  }
  const headers = { apikey: service, authorization: `Bearer ${service}` };
  try {
    const cutoff = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const params = new URLSearchParams({ select: "object_id,payload,payload_hash,signature,signing_key_id,expires_at,archive_key",
      archive_key: "is.null", payload: "not.is.null", signing_key_id: "eq.geomacro-risk-2026-03",
      signature: "not.is.null", expires_at: `lt.${cutoff}`, order: "generated_at.asc", limit: "8" });
    const source = await fetch(`${url}/rest/v1/geomacro_risk_objects?${params}`, { headers, signal: AbortSignal.timeout(15_000) });
    if (!source.ok) throw Error(`SOURCE_${source.status}`);
    const rows = await source.json() as Row[];
    if (!rows.length) return Response.json({ ok: true, processed: 0 });
    const registry = await fetch("https://geomacro.live/api/risk-object-keys", { signal: AbortSignal.timeout(10_000) });
    if (!registry.ok) throw Error("KEY_REGISTRY_UNAVAILABLE");
    const { keys } = await registry.json() as { keys: Key[] };
    if (!Array.isArray(keys)) throw Error("KEY_REGISTRY_INVALID");
    let processed = 0;
    for (const row of rows) {
      if (processed >= 2) break;
      const id = row.object_id;
      if (!/^gro_[A-Za-z0-9_]+$/.test(id) || !await signedRowValid(row, keys)) continue;
      const raw = enc.encode(JSON.stringify(row.payload));
      if (raw.length > 4_000_000) continue;
      const packed = await gzip(raw);
      if (packed.length > 2_000_000) continue;
      const pointer = `risk-object-archive/v1/${id}.json.gz`;
      const info = await fetch(`${url}/storage/v1/object/info/geomacro-live-intelligence/${pointer}`, { headers, signal: AbortSignal.timeout(10_000) });
      // Storage may use HTTP 400 with a structured 404 statusCode for missing objects.
      const storageError = info.ok ? null : await info.json().catch(() => null) as { statusCode?: string | number; error?: string } | null;
      const absent = info.status === 404 ||
        (info.status === 400 && String(storageError?.statusCode) === "404" &&
          /not.?found|no.?such.?key/i.test(String(storageError?.error ?? "")));
      if (!absent) throw Error(`STORAGE_ABSENCE_UNCONFIRMED_${info.status}_${String(storageError?.statusCode ?? "UNKNOWN").replace(/[^A-Za-z0-9]/g, "").slice(0, 20)}`);
      const key = `geomacro-evidence/v1/gro/${id}.json.gz`;
      const proofKey = `geomacro-evidence/v1/index/gro/${id}.json`;
      await b2("PUT", key, access, secret, packed);
      const readback = await b2("GET", key, access, secret);
      const packedHash = await sha(packed);
      if (await sha(readback) !== packedHash) throw Error("ARCHIVE_READBACK_MISMATCH");
      const proof = enc.encode(JSON.stringify({ schema: "geomacro.gro-archive-proof.v1", object_id: id,
        source_table: "public.geomacro_risk_objects", archive_key: key,
        signing_key_id: row.signing_key_id, signed_payload_hash: row.payload_hash,
        compressed_sha256: packedHash, payload_sha256: await sha(raw),
        compressed_bytes: packed.length, payload_bytes: raw.length,
        source_expires_at: row.expires_at, verified_at: new Date().toISOString() }));
      await b2("PUT", proofKey, access, secret, proof);
      if (await sha(await b2("GET", proofKey, access, secret)) !== await sha(proof)) throw Error("PROOF_READBACK_MISMATCH");
      const filter = new URLSearchParams({ object_id: `eq.${id}`, archive_key: "is.null", payload: "not.is.null" });
      const updated = await fetch(`${url}/rest/v1/geomacro_risk_objects?${filter}`, {
        method: "PATCH", headers: { ...headers, "content-type": "application/json", prefer: "return=representation" },
        body: JSON.stringify({ payload: null, archive_key: pointer, archive_sha256: packedHash }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!updated.ok) throw Error(`POINTER_UPDATE_${updated.status}`);
      const results = await updated.json() as Row[];
      if (results.length !== 1 || results[0].archive_key !== pointer || results[0].payload !== null) throw Error("POINTER_UPDATE_UNCONFIRMED");
      processed++;
    }
    return Response.json({ ok: true, processed });
  } catch (error) {
    const code = error instanceof Error && /^(?:SOURCE|KEY|B2|STORAGE|ARCHIVE|PROOF|POINTER)_[A-Z0-9_]+$/.test(error.message)
      ? error.message : "UNEXPECTED_ERROR";
    console.error("GRO_ARCHIVE_MAINTENANCE_FAILED", code);
    return Response.json({ ok: false, error: code }, { status: 502 });
  }
});
