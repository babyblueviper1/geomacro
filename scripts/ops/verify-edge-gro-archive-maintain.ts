#!/usr/bin/env bun
// One-time production gate: invoke bounded Edge writer and restore the newly archived GRO.
import { createClient } from "@supabase/supabase-js";
import { getRiskObjectByObjectId } from "../../src/lib/risk-object-store.server";
import { verifyRiskObjectSignature, canonicalRiskObjectJson, type RiskObjectVerificationKeys } from "../../src/lib/risk-object-signing.server";

const url = process.env.APP_SUPABASE_URL;
const service = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !service) throw Error("AUTHORITATIVE_SUPABASE_REQUIRED");
const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: beforeRows, error: beforeError } = await db.from("geomacro_risk_objects")
  .select("object_id").not("archive_key", "is", null).is("payload", null);
if (beforeError) throw beforeError;
const before = new Set((beforeRows ?? []).map(row => row.object_id));
const result = await fetch(`${url}/functions/v1/gro-archive-maintain`, {
  method: "POST", headers: { authorization: `Bearer ${service}`, apikey: service,
    "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(100_000),
});
if (!result.ok) {
  const details = result.status === 503 ? await result.json() as { missing_names?: string[] } : null;
  throw Error(`GRO_ARCHIVE_EDGE_${result.status}:${details?.missing_names?.join(",") ?? ""}`);
}
const outcome = await result.json() as { ok: boolean; processed: number };
if (!outcome.ok || outcome.processed < 1 || outcome.processed > 2) throw Error("GRO_ARCHIVE_NO_VERIFIED_WRITE");
const { data: afterRows, error: afterError } = await db.from("geomacro_risk_objects")
  .select("object_id,payload,payload_hash,archive_key,archive_sha256,signature,signing_key_id")
  .not("archive_key", "is", null).is("payload", null);
if (afterError) throw afterError;
const changed = (afterRows ?? []).filter(row => !before.has(row.object_id));
if (changed.length !== outcome.processed) throw Error("GRO_ARCHIVE_ROW_COUNT_MISMATCH");
const keysResponse = await fetch("https://geomacro.live/api/risk-object-keys", { signal: AbortSignal.timeout(15_000) });
if (!keysResponse.ok) throw Error("GRO_KEY_REGISTRY_UNAVAILABLE");
const body = await keysResponse.json() as { keys: Array<{ key_id: string; public_key_spki_b64: string; status: "active" | "retired" | "revoked" }> };
const keys: RiskObjectVerificationKeys = Object.fromEntries(body.keys.map(({ key_id, ...record }) => [key_id, record]));
for (const row of changed) {
  if (row.payload !== null || row.archive_key !== `risk-object-archive/v1/${row.object_id}.json.gz` ||
      !/^[a-f0-9]{64}$/.test(row.archive_sha256 ?? "")) throw Error("GRO_ARCHIVE_POINTER_INVALID");
  const restored = await getRiskObjectByObjectId(row.object_id);
  if (!restored || restored.object_id !== row.object_id || restored.integrity.payload_hash !== row.payload_hash ||
      restored.integrity.signature !== row.signature || restored.integrity.signing_key_id !== row.signing_key_id ||
      !verifyRiskObjectSignature(restored, keys).valid || !canonicalRiskObjectJson(restored)) {
    throw Error("GRO_ARCHIVE_RESTORE_INVALID");
  }
}
console.log(JSON.stringify({ ok: true, processed: changed.length,
  ids: changed.map(row => row.object_id), edge_writer: true, signed_b2_restore: true }));
