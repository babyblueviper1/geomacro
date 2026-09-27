#!/usr/bin/env bun
// Copy-only signed GRO archive. No Supabase mutation or expiry-based deletion.
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";
import { verifyRiskObjectSignature, type RiskObjectVerificationKeys } from "../../src/lib/risk-object-signing.server";

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const url = process.env.APP_SUPABASE_URL;
const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !key) throw new Error("GRO_ARCHIVE_CONFIG_REQUIRED");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const b2 = createB2Client({ endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID, secretKey: process.env.B2_APPLICATION_KEY,
  bucket: "geomacro-private-archive" });
const keysResponse = await fetch("https://geomacro.live/api/risk-object-keys", { signal: AbortSignal.timeout(15_000) });
if (!keysResponse.ok) throw new Error("GRO_VERIFICATION_KEYS_UNAVAILABLE");
const keysBody = await keysResponse.json() as { keys?: Array<{ key_id: string; public_key_spki_b64: string; status: string }> };
const verificationKeys: RiskObjectVerificationKeys = Object.fromEntries(
  (keysBody.keys ?? []).map((entry) => [entry.key_id, {
    public_key_spki_b64: entry.public_key_spki_b64, status: entry.status as "active" | "retired" | "revoked",
  }]),
);
if (!verificationKeys["geomacro-risk-2026-03"]) throw new Error("GRO_CURRENT_PUBLIC_KEY_UNAVAILABLE");
const cutoff = new Date(Date.now() - 72 * 3_600_000).toISOString();
const { data: rows, error } = await db.from("geomacro_risk_objects")
  .select("object_id,subject_type,subject_id,generated_at,expires_at,payload,payload_hash,signing_key_id")
  .eq("signing_key_id", "geomacro-risk-2026-03")
  .lt("generated_at", cutoff).lt("expires_at", cutoff)
  .order("generated_at", { ascending: true }).limit(5);
if (error || !rows?.length) throw new Error("GRO_ARCHIVE_SOURCE_UNAVAILABLE");
let copied = 0;
for (const row of rows) {
  if (!/^gro_[A-Za-z0-9_]+$/.test(row.object_id) ||
      row.payload?.object_id !== row.object_id || row.payload?.integrity?.payload_hash !== row.payload_hash ||
      row.payload?.integrity?.signing_key_id !== row.signing_key_id ||
      !verifyRiskObjectSignature(row.payload, verificationKeys).valid) {
    throw new Error(`GRO_SOURCE_SIGNATURE_MISMATCH_${row.object_id}`);
  }
  const uncompressed = Buffer.from(JSON.stringify(row.payload));
  const compressed = gzipSync(uncompressed, { level: 9 });
  const archiveKey = `geomacro-evidence/v1/gro/${row.object_id}.json.gz`;
  const proofKey = `geomacro-evidence/v1/index/gro/${row.object_id}.json`;
  await b2.put(archiveKey, compressed);
  const readback = await b2.get(archiveKey);
  if (sha(readback) !== sha(compressed) ||
      !verifyRiskObjectSignature(JSON.parse(gunzipSync(readback).toString("utf8")), verificationKeys).valid) {
    throw new Error(`GRO_ARCHIVE_READBACK_MISMATCH_${row.object_id}`);
  }
  const proof = { schema: "geomacro.gro-archive-proof.v1", object_id: row.object_id,
    source_table: "public.geomacro_risk_objects", archive_key: archiveKey,
    signing_key_id: row.signing_key_id, signed_payload_hash: row.payload_hash,
    compressed_sha256: sha(compressed), payload_sha256: sha(uncompressed),
    compressed_bytes: compressed.length, payload_bytes: uncompressed.length,
    source_generated_at: row.generated_at, source_expires_at: row.expires_at,
    verified_at: new Date().toISOString() };
  const proofBytes = Buffer.from(JSON.stringify(proof));
  await b2.put(proofKey, proofBytes);
  if (sha(await b2.get(proofKey)) !== sha(proofBytes)) throw new Error(`GRO_PROOF_READBACK_MISMATCH_${row.object_id}`);
  copied += 1;
  console.log(JSON.stringify({ object_id: row.object_id, signed_archive_verified: true,
    compressed_bytes: compressed.length, proof_key: proofKey }));
}
console.log(JSON.stringify({ ok: true, copied, source_preserved: true, database_modified: false }));
