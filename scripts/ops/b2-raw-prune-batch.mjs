#!/usr/bin/env node
// Bounded, resumable Storage prune. Immutable Supabase manifest rows remain.
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const offset = Number(process.env.PRUNE_BATCH_OFFSET);
const limit = Number(process.env.PRUNE_BATCH_LIMIT);
if (process.env.APP_SUPABASE_URL !== "https://ldpwajisioljyjtojvfx.supabase.co" ||
    !process.env.APP_SUPABASE_SERVICE_ROLE_KEY ||
    !Number.isInteger(offset) || offset < 0 || offset > 100_000 ||
    !Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error("PRUNE_CONFIG_INVALID");
const db = createClient(process.env.APP_SUPABASE_URL, process.env.APP_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const b2 = createB2Client({ endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID, secretKey: process.env.B2_APPLICATION_KEY,
  bucket: "geomacro-private-archive" });
const cutoff = new Date(Date.now() - 72 * 3_600_000).toISOString();
const { data: rows, error } = await db.from("live_raw_source_snapshots")
  .select("snapshot_id,storage_bucket,object_path,byte_count,content_sha256,fetched_at")
  .lt("fetched_at", cutoff).order("fetched_at", { ascending: true })
  .order("snapshot_id", { ascending: true }).range(offset, offset + limit - 1);
if (error || rows?.length !== limit) throw new Error("PRUNE_RANGE_INCOMPLETE");
const isMissing = (error) => String(error?.statusCode ?? error?.status) === "404";
let removed = 0;
let previouslyRemoved = 0;
for (const row of rows) {
  if (row.storage_bucket !== "geomacro-live-intelligence" ||
      !row.object_path.startsWith("raw/v1/") ||
      Date.now() - Date.parse(row.fetched_at) < 72 * 3_600_000) throw new Error("PRUNE_MANIFEST_INVALID");
  const { count, error: countError } = await db.from("live_raw_source_snapshots")
    .select("snapshot_id", { count: "exact", head: true }).eq("object_path", row.object_path);
  if (countError || count !== 1) throw new Error("PRUNE_SHARED_SOURCE");
  const proofKey = `geomacro-evidence/v1/index/raw/${row.snapshot_id}.json`;
  const deletionKey = `geomacro-evidence/v1/index/raw-deleted/${row.snapshot_id}.json`;
  const proof = JSON.parse((await b2.get(proofKey)).toString("utf8"));
  if (proof.schema !== "geomacro.archive-proof.v1" || proof.snapshot_id !== row.snapshot_id ||
      proof.source_bucket !== row.storage_bucket || proof.source_path !== row.object_path ||
      proof.archive_bucket !== "geomacro-private-archive" ||
      proof.archive_key !== `geomacro-evidence/v1/${row.object_path}` ||
      proof.payload_sha256 !== row.content_sha256 || proof.payload_bytes !== row.byte_count) {
    throw new Error(`PRUNE_PROOF_MISMATCH_${row.snapshot_id}`);
  }
  const archived = await b2.get(proof.archive_key);
  const payload = gunzipSync(archived);
  if (archived.length !== proof.compressed_bytes || sha(archived) !== proof.compressed_sha256 ||
      payload.length !== row.byte_count || sha(payload) !== row.content_sha256) {
    throw new Error(`PRUNE_ARCHIVE_BYTES_MISMATCH_${row.snapshot_id}`);
  }
  const storage = db.storage.from(row.storage_bucket);
  const { data: metadata, error: metadataError } = await storage.info(row.object_path);
  if (metadata) {
    const { data: source, error: sourceError } = await storage.download(row.object_path);
    if (sourceError || !source || sha(Buffer.from(await source.arrayBuffer())) !== sha(archived)) {
      throw new Error(`PRUNE_SOURCE_BYTES_MISMATCH_${row.snapshot_id}`);
    }
    const { data: result, error: removeError } = await storage.remove([row.object_path]);
    if (removeError || result?.length !== 1 || result[0]?.name !== row.object_path) {
      throw new Error(`PRUNE_REMOVE_UNCONFIRMED_${row.snapshot_id}`);
    }
    removed += 1;
  } else if (!isMissing(metadataError)) {
    throw new Error(`PRUNE_SOURCE_STATUS_UNKNOWN_${row.snapshot_id}`);
  }
  const { data: residual, error: residualError } = await storage.info(row.object_path);
  if (residual || !isMissing(residualError)) throw new Error(`PRUNE_SOURCE_STILL_PRESENT_${row.snapshot_id}`);
  if (!metadata) {
    const existing = JSON.parse((await b2.get(deletionKey)).toString("utf8"));
    if (existing.schema !== "geomacro.archive-source-deletion.v1" ||
        existing.snapshot_id !== row.snapshot_id || existing.source_path !== row.object_path ||
        existing.archive_proof_key !== proofKey || existing.archive_key !== proof.archive_key ||
        existing.payload_sha256 !== row.content_sha256) {
      throw new Error(`PRUNE_DELETION_PROOF_MISMATCH_${row.snapshot_id}`);
    }
    previouslyRemoved += 1;
  } else {
    const deletion = { schema: "geomacro.archive-source-deletion.v1", snapshot_id: row.snapshot_id,
      source_bucket: row.storage_bucket, source_path: row.object_path, archive_key: proof.archive_key,
      archive_proof_key: proofKey, payload_sha256: row.content_sha256,
      deleted_at: new Date().toISOString() };
    const bytes = Buffer.from(JSON.stringify(deletion));
    await b2.put(deletionKey, bytes);
    if (sha(await b2.get(deletionKey)) !== sha(bytes)) throw new Error(`PRUNE_DELETION_PROOF_FAILED_${row.snapshot_id}`);
  }
  console.log(JSON.stringify({ snapshot_id: row.snapshot_id, source_absent: true,
    archive_verified: true, deletion_proof_verified: true }));
}
console.log(JSON.stringify({ ok: true, removed, previously_removed: previouslyRemoved,
  offset, limit, database_modified: false }));
