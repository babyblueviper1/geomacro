#!/usr/bin/env node
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const url = String(process.env.APP_SUPABASE_URL ?? "").trim();
const role = String(process.env.APP_SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const limit = Number(process.env.B2_RAW_MAINTENANCE_LIMIT ?? 25);

if (
  url !== "https://ldpwajisioljyjtojvfx.supabase.co" ||
  !role ||
  !Number.isInteger(limit) ||
  limit < 1 ||
  limit > 100
) {
  throw new Error("B2_RAW_MAINTENANCE_CONFIG_INVALID");
}

const db = createClient(url, role, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const b2 = createB2Client({
  endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID,
  secretKey: process.env.B2_APPLICATION_KEY,
  bucket: "geomacro-private-archive",
});

const { data: budget, error: budgetError } = await db.rpc(
  "geomacro_free_tier_budget_state",
);
if (budgetError || !budget) throw budgetError ?? new Error("SUPABASE_BUDGET_STATE_UNAVAILABLE");

const { data: rows, error } = await db.rpc(
  "geomacro_next_raw_storage_candidates",
  { p_limit: limit },
);
if (error) throw error;

if (!rows?.length) {
  console.log(JSON.stringify({
    ok: true,
    status: "complete",
    processed: 0,
    budget,
    note: "No eligible Supabase raw Storage objects remain older than 72 hours.",
  }));
  process.exit(0);
}

const storage = db.storage.from("geomacro-live-intelligence");
let processed = 0;
let archivedBytes = 0;

for (const row of rows) {
  const id = String(row.snapshot_id ?? "");
  const path = String(row.object_path ?? "");
  const payloadHash = String(row.content_sha256 ?? "");
  const payloadBytes = Number(row.byte_count);
  const fetchedAt = String(row.fetched_at ?? "");

  if (
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(id) ||
    row.storage_bucket !== "geomacro-live-intelligence" ||
    !/^raw\/v1\/[A-Za-z0-9_./-]+\.gz$/.test(path) ||
    path.includes("..") ||
    !/^[a-f0-9]{64}$/.test(payloadHash) ||
    !Number.isInteger(payloadBytes) ||
    payloadBytes < 0 ||
    payloadBytes > 20_000_000 ||
    !Number.isFinite(Date.parse(fetchedAt)) ||
    Date.now() - Date.parse(fetchedAt) < 72 * 3_600_000
  ) {
    throw new Error(`B2_RAW_CANDIDATE_INVALID_${id || "unknown"}`);
  }

  const { data: blob, error: downloadError } = await storage.download(path);
  if (downloadError || !blob) {
    throw new Error(`B2_RAW_SOURCE_DOWNLOAD_FAILED_${id}`, { cause: downloadError });
  }

  const compressed = Buffer.from(await blob.arrayBuffer());
  const compressedHash = sha(compressed);
  const raw = gunzipSync(compressed);
  if (raw.length !== payloadBytes || sha(raw) !== payloadHash) {
    throw new Error(`B2_RAW_SOURCE_PAYLOAD_MISMATCH_${id}`);
  }

  const archiveKey = `geomacro-evidence/v1/${path}`;
  const proofKey = `geomacro-evidence/v1/index/raw/${id}.json`;
  const deletionKey = `geomacro-evidence/v1/index/raw-deleted/${id}.json`;

  const archivePut = await b2.put(archiveKey, compressed);
  if (archivePut?.payload_sha256 !== compressedHash || archivePut?.bytes !== compressed.length) {
    throw new Error(`B2_RAW_ARCHIVE_PUT_INVALID_${id}`);
  }

  const proof = {
    schema: "geomacro.archive-proof.v1",
    snapshot_id: id,
    source_bucket: "geomacro-live-intelligence",
    source_path: path,
    archive_bucket: "geomacro-private-archive",
    archive_key: archiveKey,
    archive_version_id: archivePut.version_id,
    archive_etag: archivePut.etag,
    compressed_bytes: compressed.length,
    compressed_sha256: compressedHash,
    payload_sha256: payloadHash,
    payload_bytes: payloadBytes,
    source_fetched_at: fetchedAt,
    verification_mode: "s3_put_etag_md5",
    verified_at: new Date().toISOString(),
  };
  const proofBytes = Buffer.from(JSON.stringify(proof));
  const proofPut = await b2.put(proofKey, proofBytes);
  if (proofPut?.payload_sha256 !== sha(proofBytes) || proofPut?.bytes !== proofBytes.length) {
    throw new Error(`B2_RAW_ARCHIVE_PROOF_INVALID_${id}`);
  }

  const { data: removed, error: removeError } = await storage.remove([path]);
  if (
    removeError ||
    !Array.isArray(removed) ||
    removed.length !== 1 ||
    removed[0]?.name !== path
  ) {
    throw new Error(`B2_RAW_SOURCE_REMOVE_UNCONFIRMED_${id}`, { cause: removeError });
  }

  const { data: present, error: presenceError } = await db.rpc(
    "geomacro_raw_storage_paths_present",
    { p_paths: [path] },
  );
  if (presenceError || !Array.isArray(present) || present.length !== 0) {
    throw new Error(`B2_RAW_SOURCE_STILL_PRESENT_${id}`, { cause: presenceError });
  }

  const deletion = {
    schema: "geomacro.archive-source-deletion.v1",
    snapshot_id: id,
    source_bucket: "geomacro-live-intelligence",
    source_path: path,
    archive_key: archiveKey,
    archive_proof_key: proofKey,
    archive_version_id: archivePut.version_id,
    payload_sha256: payloadHash,
    verification_mode: "s3_put_etag_md5",
    deleted_at: new Date().toISOString(),
  };
  const deletionBytes = Buffer.from(JSON.stringify(deletion));
  const deletionPut = await b2.put(deletionKey, deletionBytes);
  if (deletionPut?.payload_sha256 !== sha(deletionBytes) || deletionPut?.bytes !== deletionBytes.length) {
    throw new Error(`B2_RAW_DELETION_PROOF_INVALID_${id}`);
  }

  processed += 1;
  archivedBytes += compressed.length;
  console.log(JSON.stringify({
    snapshot_id: id,
    archive_verified: true,
    verification_mode: "s3_put_etag_md5",
    supabase_source_absent: true,
    restore_contract_preserved: true,
    compressed_bytes: compressed.length,
  }));
}

console.log(JSON.stringify({
  ok: true,
  status: "progress",
  processed,
  archived_compressed_bytes: archivedBytes,
  budget,
  source_manifest_rows_preserved: true,
  storage_deletion_via_api_only: true,
  b2_class_b_readback_used: false,
}));
