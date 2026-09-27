#!/usr/bin/env node
// One-object Storage deletion canary. The database manifest stays intact.
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";

const id = "d69a09c6-b82b-4be5-96de-13e2d5d09236";
const sha = (value) => createHash("sha256").update(value).digest("hex");
if (process.env.APP_SUPABASE_URL !== "https://ldpwajisioljyjtojvfx.supabase.co" ||
    !process.env.APP_SUPABASE_SERVICE_ROLE_KEY || process.env.DELETE_CANARY_ID !== id) {
  throw new Error("CANARY_CONFIG_REQUIRED");
}
const db = createClient(process.env.APP_SUPABASE_URL, process.env.APP_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { data: row, error } = await db.from("live_raw_source_snapshots")
  .select("snapshot_id,storage_bucket,object_path,byte_count,content_sha256,fetched_at")
  .eq("snapshot_id", id).single();
if (error || !row || row.storage_bucket !== "geomacro-live-intelligence" ||
    !row.object_path.startsWith("raw/v1/") ||
    Date.now() - Date.parse(row.fetched_at) < 72 * 3_600_000) throw new Error("CANARY_MANIFEST_INVALID");
const { count, error: countError } = await db.from("live_raw_source_snapshots")
  .select("snapshot_id", { count: "exact", head: true }).eq("object_path", row.object_path);
if (countError || count !== 1) throw new Error("CANARY_SOURCE_SHARED");
const b2 = createB2Client({ endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID, secretKey: process.env.B2_APPLICATION_KEY,
  bucket: "geomacro-private-archive" });
const proofKey = `geomacro-evidence/v1/index/raw/${id}.json`;
const proof = JSON.parse((await b2.get(proofKey)).toString("utf8"));
if (proof.schema !== "geomacro.archive-proof.v1" || proof.snapshot_id !== id ||
    proof.source_bucket !== row.storage_bucket || proof.source_path !== row.object_path ||
    proof.archive_bucket !== "geomacro-private-archive" ||
    proof.archive_key !== `geomacro-evidence/v1/${row.object_path}` ||
    proof.payload_sha256 !== row.content_sha256 || proof.payload_bytes !== row.byte_count) {
  throw new Error("CANARY_PROOF_MISMATCH");
}
async function verifyArchive() {
  const compressed = await b2.get(proof.archive_key);
  const payload = gunzipSync(compressed);
  if (compressed.length !== proof.compressed_bytes || sha(compressed) !== proof.compressed_sha256 ||
      payload.length !== row.byte_count || sha(payload) !== row.content_sha256) {
    throw new Error("CANARY_ARCHIVE_BYTES_MISMATCH");
  }
  return compressed;
}
const archived = await verifyArchive();
const { data: source, error: sourceError } = await db.storage.from(row.storage_bucket).download(row.object_path);
if (sourceError || !source || sha(Buffer.from(await source.arrayBuffer())) !== sha(archived)) {
  throw new Error("CANARY_SOURCE_MISMATCH");
}
const { data: removed, error: removeError } = await db.storage.from(row.storage_bucket).remove([row.object_path]);
if (removeError || removed?.length !== 1 || removed[0]?.name !== row.object_path) {
  throw new Error("CANARY_STORAGE_REMOVE_UNCONFIRMED");
}
await verifyArchive();
const { data: residual } = await db.storage.from(row.storage_bucket).download(row.object_path);
if (residual) throw new Error("CANARY_SOURCE_STILL_PRESENT");
const deletionProof = { schema: "geomacro.archive-source-deletion.v1", snapshot_id: id,
  source_bucket: row.storage_bucket, source_path: row.object_path,
  archive_key: proof.archive_key, archive_proof_key: proofKey,
  payload_sha256: row.content_sha256, deleted_at: new Date().toISOString() };
const deletionKey = `geomacro-evidence/v1/index/raw-deleted/${id}.json`;
const bytes = Buffer.from(JSON.stringify(deletionProof));
await b2.put(deletionKey, bytes);
if (sha(await b2.get(deletionKey)) !== sha(bytes)) throw new Error("CANARY_DELETION_PROOF_READBACK_MISMATCH");
console.log(JSON.stringify({ ok: true, snapshot_id: id, source_removed: true,
  archive_restore_verified: true, database_modified: false, deletion_proof_key: deletionKey }));
