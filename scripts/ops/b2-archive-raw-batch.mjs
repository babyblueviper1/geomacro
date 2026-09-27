#!/usr/bin/env node
// Copy bounded old raw snapshots into B2 with an independently readable proof.
// This job never deletes or updates Supabase rows/objects.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { archiveObjectPlan, verifyArchiveReadback } from "./b2-archive-contract.mjs";
import { createB2Client } from "./b2-s3-client.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const url = process.env.APP_SUPABASE_URL;
const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !key) throw new Error("AUTHORITATIVE_SUPABASE_REQUIRED");
const limit = Number(process.env.ARCHIVE_BATCH_LIMIT ?? 10);
const olderHours = Number(process.env.ARCHIVE_OLDER_HOURS ?? 72);
const offset = Number(process.env.ARCHIVE_BATCH_OFFSET ?? 0);
if (!Number.isInteger(limit) || limit < 1 || limit > 25 ||
    !Number.isInteger(olderHours) || olderHours < 72 ||
    !Number.isInteger(offset) || offset < 0 || offset > 100_000) throw new Error("ARCHIVE_BOUNDS_INVALID");
const bucket = "geomacro-private-archive";
const b2 = createB2Client({ endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID, secretKey: process.env.B2_APPLICATION_KEY, bucket });
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const cutoff = new Date(Date.now() - olderHours * 3_600_000).toISOString();
const { data: snapshots, error } = await db.from("live_raw_source_snapshots")
  .select("snapshot_id,storage_bucket,object_path,content_sha256,byte_count,fetched_at")
  .lt("fetched_at", cutoff).order("fetched_at", { ascending: true })
  .order("snapshot_id", { ascending: true }).range(offset, offset + limit - 1);
if (error) throw error;
let copied = 0;
for (const snapshot of snapshots ?? []) {
  if (snapshot.storage_bucket !== "geomacro-live-intelligence") throw new Error("UNEXPECTED_SOURCE_BUCKET");
  const { data: blob, error: downloadError } = await db.storage.from(snapshot.storage_bucket).download(snapshot.object_path);
  if (downloadError || !blob) throw new Error(`SOURCE_DOWNLOAD_FAILED_${snapshot.snapshot_id}`);
  const compressed = Buffer.from(await blob.arrayBuffer());
  const plan = archiveObjectPlan({ bucket, objectPath: snapshot.object_path, compressedBytes: compressed,
    compressedSha256: sha(compressed), payloadSha256: snapshot.content_sha256 });
  await b2.put(plan.archive_key, compressed);
  verifyArchiveReadback(plan, await b2.get(plan.archive_key));
  const proof = {
    schema: "geomacro.archive-proof.v1", snapshot_id: snapshot.snapshot_id,
    source_bucket: snapshot.storage_bucket, source_path: snapshot.object_path,
    archive_bucket: bucket, archive_key: plan.archive_key,
    compressed_bytes: plan.compressed_bytes, compressed_sha256: plan.compressed_sha256,
    payload_sha256: plan.payload_sha256, payload_bytes: snapshot.byte_count,
    source_fetched_at: snapshot.fetched_at, verified_at: new Date().toISOString(),
  };
  const proofBytes = Buffer.from(JSON.stringify(proof));
  const proofKey = `geomacro-evidence/v1/index/raw/${snapshot.snapshot_id}.json`;
  await b2.put(proofKey, proofBytes);
  if (sha(await b2.get(proofKey)) !== sha(proofBytes)) throw new Error("ARCHIVE_PROOF_READBACK_MISMATCH");
  copied += 1;
  console.log(JSON.stringify({ snapshot_id: snapshot.snapshot_id, copied_and_verified: true,
    archive_key: plan.archive_key, proof_key: proofKey, compressed_bytes: plan.compressed_bytes }));
}
console.log(JSON.stringify({ ok: true, copied, source_preserved: true, database_modified: false,
  older_hours: olderHours, limit, offset }));
