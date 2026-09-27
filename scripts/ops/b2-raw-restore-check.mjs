#!/usr/bin/env node
// Prove a B2 archived raw snapshot can be restored from its immutable proof.
// Does not write Supabase or expose raw source bytes in logs.
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const id = process.argv[2];
if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(id ?? "") ||
    process.env.APP_SUPABASE_URL !== "https://ldpwajisioljyjtojvfx.supabase.co" ||
    !process.env.APP_SUPABASE_SERVICE_ROLE_KEY) throw new Error("RESTORE_CHECK_CONFIG_REQUIRED");
const db = createClient(process.env.APP_SUPABASE_URL, process.env.APP_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { data: snapshot, error } = await db.from("live_raw_source_snapshots")
  .select("snapshot_id,storage_bucket,object_path,byte_count,content_sha256")
  .eq("snapshot_id", id).single();
if (error || !snapshot) throw new Error("RESTORE_SNAPSHOT_MISSING");
const b2 = createB2Client({ endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID, secretKey: process.env.B2_APPLICATION_KEY,
  bucket: "geomacro-private-archive" });
const proofKey = `geomacro-evidence/v1/index/raw/${id}.json`;
const proof = JSON.parse((await b2.get(proofKey)).toString("utf8"));
if (proof.schema !== "geomacro.archive-proof.v1" || proof.snapshot_id !== id ||
    proof.source_bucket !== snapshot.storage_bucket || proof.source_path !== snapshot.object_path ||
    proof.archive_bucket !== "geomacro-private-archive" ||
    proof.archive_key !== `geomacro-evidence/v1/${snapshot.object_path}` ||
    proof.payload_sha256 !== snapshot.content_sha256 || proof.payload_bytes !== snapshot.byte_count) {
  throw new Error("RESTORE_PROOF_MISMATCH");
}
const compressed = await b2.get(proof.archive_key);
const payload = gunzipSync(compressed);
if (compressed.length !== proof.compressed_bytes || sha(compressed) !== proof.compressed_sha256 ||
    payload.length !== snapshot.byte_count || sha(payload) !== snapshot.content_sha256) {
  throw new Error("RESTORE_BYTES_MISMATCH");
}
console.log(JSON.stringify({ ok: true, snapshot_id: id, restored_bytes: payload.length,
  source_path: snapshot.object_path, archive_key: proof.archive_key, database_modified: false }));
