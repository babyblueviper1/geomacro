#!/usr/bin/env node
// One-time integration check of the read-only Edge restore using an already pruned snapshot.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.APP_SUPABASE_URL;
const service = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !service) throw Error("AUTHORITATIVE_SUPABASE_REQUIRED");
const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: rows, error } = await db.from("live_raw_source_snapshots")
  .select("snapshot_id,storage_bucket,object_path,content_sha256,byte_count")
  .order("fetched_at", { ascending: true }).limit(40);
if (error || !rows?.length) throw error ?? Error("NO_RAW_SNAPSHOTS");
let candidate;
for (const row of rows) {
  if (row.storage_bucket !== "geomacro-live-intelligence" || !row.object_path.startsWith("raw/v1/")) continue;
  const { data, error: infoError } = await db.storage.from(row.storage_bucket).info(row.object_path);
  if (!data && String(infoError?.statusCode ?? infoError?.status) === "404") { candidate = row; break; }
}
if (!candidate) throw Error("NO_PREVIOUSLY_PRUNED_RAW_SNAPSHOT_IN_BOUNDED_SCAN");
const response = await fetch(`${url}/functions/v1/raw-snapshot-read`, {
  method: "POST", headers: { authorization: `Bearer ${service}`, apikey: service, "content-type": "application/json" },
  body: JSON.stringify({ snapshot_id: candidate.snapshot_id }), signal: AbortSignal.timeout(45_000),
});
if (!response.ok) throw Error(`EDGE_RAW_RESTORE_FAILED_${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const hash = createHash("sha256").update(bytes).digest("hex");
if (bytes.length !== candidate.byte_count || hash !== candidate.content_sha256) throw Error("EDGE_RAW_RESTORE_HASH_MISMATCH");
console.log(JSON.stringify({ ok: true, snapshot_id: candidate.snapshot_id,
  source_storage_absent: true, edge_b2_restore_verified: true, bytes: bytes.length }));
