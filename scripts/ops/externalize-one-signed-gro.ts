#!/usr/bin/env bun
// Explicit one-object operator canary. Run only after the archived reader is live.
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";
import { canonicalRiskObjectJson, verifyRiskObjectSignature } from "../../src/lib/risk-object-signing.server";
import { getRiskObjectByObjectId } from "../../src/lib/risk-object-store.server";

const id = "gro_country_USA_86797d816341dba19a1b1298";
const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
if (process.env.EXTERNALIZE_GRO_ID !== id ||
    process.env.APP_SUPABASE_URL !== "https://ldpwajisioljyjtojvfx.supabase.co" ||
    !process.env.APP_SUPABASE_SERVICE_ROLE_KEY) throw new Error("GRO_EXTERNALIZE_CONFIG_REQUIRED");
const db = createClient(process.env.APP_SUPABASE_URL, process.env.APP_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { data: row, error } = await db.from("geomacro_risk_objects")
  .select("object_id,payload,payload_hash,signature,signing_key_id,expires_at,archive_key")
  .eq("object_id", id).single();
if (error || !row || !row.payload || row.archive_key || !row.signature ||
    row.signing_key_id !== "geomacro-risk-2026-03" ||
    Date.now() - Date.parse(row.expires_at) < 72 * 3_600_000) throw new Error("GRO_EXTERNALIZE_SOURCE_INVALID");
const b2 = createB2Client({ endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID, secretKey: process.env.B2_APPLICATION_KEY,
  bucket: "geomacro-private-archive" });
const proofKey = `geomacro-evidence/v1/index/gro/${id}.json`;
const proof = JSON.parse((await b2.get(proofKey)).toString("utf8"));
if (proof.schema !== "geomacro.gro-archive-proof.v1" || proof.object_id !== id ||
    proof.source_table !== "public.geomacro_risk_objects" ||
    proof.archive_key !== `geomacro-evidence/v1/gro/${id}.json.gz` ||
    proof.signed_payload_hash !== row.payload_hash || proof.signing_key_id !== row.signing_key_id) {
  throw new Error("GRO_EXTERNALIZE_B2_PROOF_INVALID");
}
const compressed = await b2.get(proof.archive_key);
const decoded = gunzipSync(compressed);
if (sha(compressed) !== proof.compressed_sha256 || compressed.length !== proof.compressed_bytes ||
    sha(decoded) !== proof.payload_sha256 || decoded.length !== proof.payload_bytes ||
    canonicalRiskObjectJson(JSON.parse(decoded.toString("utf8"))) !== canonicalRiskObjectJson(row.payload)) {
  throw new Error("GRO_EXTERNALIZE_B2_BYTES_INVALID");
}
const object = JSON.parse(decoded.toString("utf8"));
if (object.integrity?.payload_hash !== row.payload_hash ||
    !verifyRiskObjectSignature(object).valid) throw new Error("GRO_EXTERNALIZE_SIGNATURE_INVALID");
const path = `risk-object-archive/v1/${id}.json.gz`;
const storage = db.storage.from("geomacro-live-intelligence");
const { error: uploadError } = await storage.upload(path, compressed,
  { contentType: "application/gzip", upsert: false, cacheControl: "31536000" });
if (uploadError && !String(uploadError.message).includes("already exists")) throw uploadError;
const { data: stored, error: downloadError } = await storage.download(path, {}, { cache: "no-store" });
if (downloadError || !stored || sha(Buffer.from(await stored.arrayBuffer())) !== sha(compressed)) {
  throw new Error("GRO_EXTERNALIZE_STORAGE_READBACK_FAILED");
}
const { data: updated, error: updateError } = await db.from("geomacro_risk_objects")
  .update({ payload: null, archive_key: path, archive_sha256: sha(compressed) })
  .eq("object_id", id).is("archive_key", null).not("payload", "is", null)
  .select("object_id,archive_key,payload").single();
if (updateError || updated?.object_id !== id || updated.archive_key !== path || updated.payload !== null) {
  throw new Error("GRO_EXTERNALIZE_UPDATE_UNCONFIRMED");
}
try {
  const restored = await getRiskObjectByObjectId(id);
  if (!restored || restored.integrity?.payload_hash !== row.payload_hash ||
      !verifyRiskObjectSignature(restored).valid) throw new Error("GRO_EXTERNALIZE_READBACK_FAILED");
} catch (cause) {
  const rollback = await db.from("geomacro_risk_objects")
    .update({ payload: row.payload, archive_key: null, archive_sha256: null })
    .eq("object_id", id).eq("archive_key", path);
  if (rollback.error) throw new Error("GRO_EXTERNALIZE_ROLLBACK_FAILED", { cause });
  throw cause;
}
console.log(JSON.stringify({ ok: true, object_id: id, archive_key: path,
  source_row_retained: true, signed_restore_verified: true }));
