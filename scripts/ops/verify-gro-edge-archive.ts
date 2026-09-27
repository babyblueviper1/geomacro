#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { verifyRiskObjectSignature, type RiskObjectVerificationKeys } from "../../src/lib/risk-object-signing.server";

const id = "gro_country_USA_86797d816341dba19a1b1298";
const url = process.env.APP_SUPABASE_URL;
const role = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !role) throw new Error("GRO_EDGE_VERIFY_CONFIG_REQUIRED");
const db = createClient(url, role, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.functions.invoke("gro-archive-read", { body: { object_id: id } });
if (error || !(data instanceof Blob)) throw new Error(`GRO_EDGE_VERIFY_FETCH_FAILED_${error?.context?.status ?? "NO_HTTP"}_${data?.constructor?.name ?? "NULL"}`);
console.log(JSON.stringify({ edge_response_verified: true, object_id: id }));
const compressed = Buffer.from(await data.arrayBuffer());
if (compressed.length > 2_000_000 ||
    createHash("sha256").update(compressed).digest("hex") !== "c8845b65c86f2fa69a3bddef8b933a63ddfd34f4d6663d28694f36c28dbce784") {
  throw new Error("GRO_EDGE_VERIFY_COMPRESSED_HASH_INVALID");
}
const object = JSON.parse(gunzipSync(compressed, { maxOutputLength: 4_000_000 }).toString("utf8"));
const keysResponse = await fetch("https://geomacro.live/api/risk-object-keys", { signal: AbortSignal.timeout(15_000) });
if (!keysResponse.ok) throw new Error("GRO_EDGE_VERIFY_KEYS_UNAVAILABLE");
const keysBody = await keysResponse.json() as { keys?: Array<{ key_id: string; public_key_spki_b64: string; status: "active" | "retired" | "revoked"; not_before?: string | null; not_after?: string | null }> };
const verificationKeys: RiskObjectVerificationKeys = Object.fromEntries(
  (keysBody.keys ?? []).map(({ key_id, ...record }) => [key_id, record]),
);
if (object.object_id !== id || !verifyRiskObjectSignature(object, verificationKeys).valid) throw new Error("GRO_EDGE_VERIFY_SIGNATURE_INVALID");
console.log(JSON.stringify({ ok: true, object_id: id, source: "private_b2_via_edge", bytes: compressed.length,
  sha256_verified: true, signature_verified: true }));
