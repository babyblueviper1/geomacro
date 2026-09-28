#!/usr/bin/env bun
// One signed, expired GRO: B2-only bytes, immutable DB pointer, and live restore.
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";
import { canonicalRiskObjectJson, verifyRiskObjectSignature, type RiskObjectVerificationKeys } from "../../src/lib/risk-object-signing.server";
import { getRiskObjectByObjectId } from "../../src/lib/risk-object-store.server";

const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const url = process.env.APP_SUPABASE_URL;
const role = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
const activeSigningKeyId = String(process.env.RISK_OBJECT_SIGNING_KEY_ID ?? "").trim();
const suffix = String(process.env.GRO_ARCHIVE_SUFFIX ?? "").trim().toLowerCase();
if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !role || !activeSigningKeyId ||
    !/^[0-9a-f]$/.test(suffix)) throw new Error("B2_ONLY_GRO_CONFIG_INVALID");
const db = createClient(url, role, { auth: { persistSession: false, autoRefreshToken: false } });
const b2 = createB2Client({ endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID, secretKey: process.env.B2_APPLICATION_KEY,
  bucket: "geomacro-private-archive" });

async function archiveRead(id: string, part: "archive" | "proof") {
  const response = await fetch(`${url}/functions/v1/archive-verify-read`, {
    method: "POST",
    headers: { authorization: `Bearer ${role}`, "content-type": "application/json" },
    body: JSON.stringify({ kind: "gro", id, part }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`B2_ONLY_GRO_VERIFY_READ_FAILED_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 4_000_000) throw new Error("B2_ONLY_GRO_VERIFY_READ_TOO_LARGE");
  return bytes;
}

const keyResponse = await fetch("https://geomacro.live/api/risk-object-keys", { signal: AbortSignal.timeout(15_000) });
if (!keyResponse.ok) throw new Error("B2_ONLY_GRO_KEYS_UNAVAILABLE");
const keyBody = await keyResponse.json() as { keys?: Array<{ key_id: string; public_key_spki_b64: string; status: "active" | "retired" | "revoked"; not_before?: string | null; not_after?: string | null }> };
const keys: RiskObjectVerificationKeys = Object.fromEntries((keyBody.keys ?? [])
  .map(({ key_id, ...record }) => [key_id, record]));
if (!keys[activeSigningKeyId]) throw new Error("B2_ONLY_GRO_ACTIVE_KEY_NOT_PUBLISHED");

const { data: rows, error } = await db.rpc("geomacro_next_gro_archive_candidates", {
  p_suffix: suffix,
  p_signing_key_id: activeSigningKeyId,
  p_limit: 100,
});
if (error) throw error;
if (!rows?.length) {
  console.log(JSON.stringify({ ok: true, status: "complete", processed: 0,
    signing_key_id: activeSigningKeyId, shard_suffix: suffix }));
  process.exit(0);
}
const row = rows.find(candidate => /^gro_[A-Za-z0-9_]+$/.test(candidate.object_id) &&
  candidate.object_id.toLowerCase().endsWith(suffix) &&
  candidate.payload?.object_id === candidate.object_id &&
  candidate.payload?.integrity?.payload_hash === candidate.payload_hash &&
  candidate.payload?.integrity?.signing_key_id === candidate.signing_key_id &&
  verifyRiskObjectSignature(candidate.payload, keys).valid);
if (!row) throw new Error("B2_ONLY_GRO_NO_VALID_SIGNED_SOURCE");
const id = row.object_id;
const raw = Buffer.from(JSON.stringify(row.payload));
const compressed = gzipSync(raw, { level: 9 });
if (compressed.length > 2_000_000 || raw.length > 4_000_000) throw new Error("B2_ONLY_GRO_TOO_LARGE");
const archiveKey = `geomacro-evidence/v1/gro/${id}.json.gz`;
const proofKey = `geomacro-evidence/v1/index/gro/${id}.json`;
const pointer = `risk-object-archive/v1/${id}.json.gz`;
const storage = db.storage.from("geomacro-live-intelligence");
const { data: existingStorage, error: infoError } = await storage.info(pointer);
if (existingStorage || String(infoError?.statusCode ?? infoError?.status) !== "404") {
  throw new Error("B2_ONLY_GRO_STORAGE_NOT_CONFIRMED_ABSENT");
}
await b2.put(archiveKey, compressed);
const readback = await archiveRead(id, "archive");
if (sha(readback) !== sha(compressed) ||
    canonicalRiskObjectJson(JSON.parse(gunzipSync(readback).toString("utf8"))) !== canonicalRiskObjectJson(row.payload)) {
  throw new Error("B2_ONLY_GRO_READBACK_INVALID");
}
const proof = {
  schema: "geomacro.gro-archive-proof.v1", object_id: id,
  source_table: "public.geomacro_risk_objects", archive_key: archiveKey,
  signing_key_id: row.signing_key_id, signed_payload_hash: row.payload_hash,
  compressed_sha256: sha(compressed), payload_sha256: sha(raw),
  compressed_bytes: compressed.length, payload_bytes: raw.length,
  source_expires_at: row.expires_at, verified_at: new Date().toISOString(),
};
const proofBytes = Buffer.from(JSON.stringify(proof));
await b2.put(proofKey, proofBytes);
if (sha(await archiveRead(id, "proof")) !== sha(proofBytes)) throw new Error("B2_ONLY_GRO_PROOF_INVALID");
const { data: updated, error: updateError } = await db.from("geomacro_risk_objects")
  .update({ payload: null, archive_key: pointer, archive_sha256: sha(compressed) })
  .eq("object_id", id).is("archive_key", null).not("payload", "is", null)
  .select("object_id,payload,archive_key").single();
if (updateError || updated?.object_id !== id || updated.payload !== null || updated.archive_key !== pointer) {
  throw new Error("B2_ONLY_GRO_UPDATE_UNCONFIRMED");
}
try {
  const restored = await getRiskObjectByObjectId(id);
  if (!restored || restored.integrity?.payload_hash !== row.payload_hash ||
      !verifyRiskObjectSignature(restored, keys).valid ||
      canonicalRiskObjectJson(restored) !== canonicalRiskObjectJson(row.payload)) {
    throw new Error("B2_ONLY_GRO_RESTORE_INVALID");
  }
} catch (cause) {
  const rollback = await db.from("geomacro_risk_objects")
    .update({ payload: row.payload, archive_key: null, archive_sha256: null })
    .eq("object_id", id).eq("archive_key", pointer);
  if (rollback.error) throw new Error("B2_ONLY_GRO_ROLLBACK_FAILED", { cause });
  throw cause;
}
console.log(JSON.stringify({ ok: true, object_id: id, b2_only: true,
  source_row_retained: true, signed_restore_verified: true, signing_key_id: activeSigningKeyId,
  compressed_bytes: compressed.length, shard_suffix: suffix }));
