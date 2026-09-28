// Private, bounded export of Supabase platform logs to B2 before Free retention expires.
// Deploy with JWT verification ON. Call only with the service-role JWT.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const sha = async (bytes: Uint8Array | string) => hex(new Uint8Array(await crypto.subtle.digest(
  "SHA-256", typeof bytes === "string" ? encoder.encode(bytes) : bytes)));
async function hmac(key: Uint8Array | string, value: string): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey("raw", typeof key === "string" ? encoder.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", material, encoder.encode(value)));
}
async function b2(method: "GET" | "PUT", key: string, access: string, secret: string,
  body = new Uint8Array()): Promise<Uint8Array> {
  if (!/^geomacro-evidence\/v1\/logs\/[0-9TZ./-]+\.json(?:\.gz)?$/.test(key) || key.includes("..")) {
    throw Error("ARCHIVE_KEY_INVALID");
  }
  const host = "s3.us-east-005.backblazeb2.com";
  const path = `/geomacro-private-archive/${key}`;
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = stamp.slice(0, 8);
  const digest = await sha(method === "PUT" ? body : "");
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${digest}\nx-amz-date:${stamp}\n`;
  const scope = `${day}/us-east-005/s3/aws4_request`;
  const names = "host;x-amz-content-sha256;x-amz-date";
  const canonical = [method, path, "", canonicalHeaders, names, digest].join("\n");
  const signing = await hmac(await hmac(await hmac(await hmac(`AWS4${secret}`, day), "us-east-005"), "s3"), "aws4_request");
  const signature = hex(await hmac(signing, ["AWS4-HMAC-SHA256", stamp, scope, await sha(canonical)].join("\n")));
  const result = await fetch(`https://${host}${path}`, {
    method,
    headers: { "x-amz-content-sha256": digest, "x-amz-date": stamp,
      authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${names}, Signature=${signature}` },
    body: method === "PUT" ? body : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  if (!result.ok) throw Error(`B2_${method}_${result.status}`);
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (bytes.length > 5_000_000) throw Error("B2_RESPONSE_TOO_LARGE");
  return bytes;
}
const windowStart = (now: number) => new Date(Math.floor((now - 2 * 3_600_000) / 300_000) * 300_000);
const keyFor = (start: Date, ext: string) => `geomacro-evidence/v1/logs/${start.toISOString().slice(0, 10)}/${start.toISOString().replace(/[:.]/g, "-")}.${ext}`;
const validStart = (value: unknown, now: number, archive: boolean) => {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:00\.000Z$/.test(value)) throw Error("WINDOW_INVALID");
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value || time % 300_000 !== 0 ||
      time > now - 3_600_000 || (archive && time < now - 20 * 3_600_000)) throw Error("WINDOW_OUTSIDE_LIVE_RETENTION");
  return new Date(time);
};
const gzip = async (bytes: Uint8Array) => new Uint8Array(await new Response(
  new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
const gunzip = async (bytes: Uint8Array) => new Uint8Array(await new Response(
  new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || token.split(".").length !== 3) return new Response("Unauthorized", { status: 401 });
  let role: unknown;
  try { role = JSON.parse(atob(token.split(".")[1])).role; } catch { return new Response("Unauthorized", { status: 401 }); }
  // JWT signature verification is enforced by the Supabase gateway on deployment.
  if (role !== "service_role") return new Response("Forbidden", { status: 403 });
  const url = Deno.env.get("SUPABASE_URL");
  const manager = Deno.env.get("SUPABASE_LOGS_ACCESS_TOKEN")?.trim();
  const readAccess = Deno.env.get("B2_ARCHIVE_READ_KEY_ID")?.trim();
  const readSecret = Deno.env.get("B2_ARCHIVE_READ_APPLICATION_KEY")?.trim();
  const writeAccess = Deno.env.get("B2_ARCHIVE_WRITE_KEY_ID")?.trim();
  const writeSecret = Deno.env.get("B2_ARCHIVE_WRITE_APPLICATION_KEY")?.trim();
  if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !readAccess || !readSecret) {
    return new Response("Archive configuration unavailable", { status: 503 });
  }
  let input: { action?: string; start?: string };
  try { input = await request.json(); } catch { return new Response("Invalid request", { status: 400 }); }
  const now = Date.now();
  const start = input.start === undefined ? windowStart(now) : validStart(input.start, now, input.action === "archive");
  const dataKey = keyFor(start, "json.gz");
  const proofKey = keyFor(start, "json");
  try {
    if (input.action === "read") {
      const proof = JSON.parse(decoder.decode(await b2("GET", proofKey, readAccess, readSecret)));
      if (proof.schema !== "geomacro.supabase-log-archive.v1" || proof.start !== start.toISOString() ||
          proof.end !== new Date(start.getTime() + 300_000).toISOString() || proof.key !== dataKey ||
          !Number.isSafeInteger(proof.events) || proof.events < 0 || proof.events > 3000 ||
          !Number.isSafeInteger(proof.bytes) || proof.bytes < 0 || proof.bytes > 5_000_000 ||
          !/^[a-f0-9]{64}$/.test(proof.sha256) ||
          !/^[a-f0-9]{64}$/.test(proof.raw_sha256) || !Number.isSafeInteger(proof.raw_bytes) ||
          proof.raw_bytes < 0 || proof.raw_bytes > 16_000_000) throw Error("LOG_PROOF_INVALID");
      const compressed = await b2("GET", dataKey, readAccess, readSecret);
      if (compressed.length !== proof.bytes || await sha(compressed) !== proof.sha256) throw Error("LOG_ARCHIVE_HASH_MISMATCH");
      const raw = await gunzip(compressed);
      if (raw.length !== proof.raw_bytes || await sha(raw) !== proof.raw_sha256) throw Error("LOG_RAW_HASH_MISMATCH");
      const lines = raw.length ? decoder.decode(raw).split("\n") : [""];
      if (lines.pop() !== "" || lines.length !== proof.events) throw Error("LOG_COUNT_MISMATCH");
      return new Response(raw, { headers: { "content-type": "application/x-ndjson", "cache-control": "private, no-store" } });
    }
    if (input.action !== "archive") return new Response("Invalid action", { status: 400 });
    if (!manager || !writeAccess || !writeSecret) return new Response("Archive writer unavailable", { status: 503 });
    const end = new Date(start.getTime() + 300_000);
    async function query(sql: string): Promise<unknown[]> {
      const api = new URL("https://api.supabase.com/v1/projects/ldpwajisioljyjtojvfx/analytics/endpoints/logs");
      api.search = new URLSearchParams({ sql, iso_timestamp_start: start.toISOString(),
        iso_timestamp_end: end.toISOString() }).toString();
      const response = await fetch(api, { headers: { authorization: `Bearer ${manager}` },
        signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw Error(`LOG_QUERY_${response.status}`);
      const payload = await response.text();
      if (payload.length > 16_000_000) throw Error("LOG_WINDOW_TOO_LARGE");
      const parsed = JSON.parse(payload);
      if (parsed.error || !Array.isArray(parsed.result)) throw Error("LOG_QUERY_INVALID");
      return parsed.result;
    }
    // The API may cap results below the SQL LIMIT. Count independently and page
    // in small slices; a silent cap, changing window, or missing page fails closed.
    const countRows = await query("select count() as n from logs");
    const count = Number((countRows[0] as { n?: number })?.n);
    if (countRows.length !== 1 || !Number.isSafeInteger(count) || count < 0 || count > 3000) {
      throw Error("LOG_WINDOW_COUNT_INVALID");
    }
    const events: unknown[] = [];
    for (let offset = 0; offset < count; offset += 500) {
      const page = await query(`select timestamp,id,source,event_message,log_attributes from logs order by timestamp,id limit 500 offset ${offset}`);
      if (page.length !== Math.min(500, count - offset)) throw Error("LOG_PAGE_INCOMPLETE");
      events.push(...page);
    }
    if (events.length !== count) throw Error("LOG_WINDOW_INCOMPLETE");
    const raw = encoder.encode(events.length ? events.map(event => JSON.stringify(event)).join("\n") + "\n" : "");
    if (raw.length > 16_000_000) throw Error("LOG_WINDOW_TOO_LARGE");
    const compressed = await gzip(raw);
    if (compressed.length > 5_000_000) throw Error("LOG_COMPRESSED_TOO_LARGE");
    await b2("PUT", dataKey, writeAccess, writeSecret, compressed);
    if (await sha(await b2("GET", dataKey, readAccess, readSecret)) !== await sha(compressed)) {
      throw Error("LOG_READBACK_MISMATCH");
    }
    const proof = { schema: "geomacro.supabase-log-archive.v1", start: start.toISOString(), end: end.toISOString(),
      key: dataKey, events: count, bytes: compressed.length, sha256: await sha(compressed),
      raw_bytes: raw.length, raw_sha256: await sha(raw), verified_at: new Date().toISOString() };
    const proofBytes = encoder.encode(JSON.stringify(proof));
    await b2("PUT", proofKey, writeAccess, writeSecret, proofBytes);
    if (await sha(await b2("GET", proofKey, readAccess, readSecret)) !== await sha(proofBytes)) {
      throw Error("LOG_PROOF_READBACK_MISMATCH");
    }
    return Response.json({ ok: true, start: proof.start, events: proof.events, archive_sha256: proof.sha256 });
  } catch (error) {
    console.error("LOG_ARCHIVE_FAILED", error instanceof Error ? error.message.replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]") : "unknown");
    return new Response("Log archive unavailable", { status: 502 });
  }
});
