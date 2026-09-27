#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { verifyRiskObjectSignature } from "../../src/lib/risk-object-signing.server";

const id = "gro_country_USA_86797d816341dba19a1b1298";
const url = process.env.APP_SUPABASE_URL;
const role = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !role) throw new Error("GRO_EDGE_VERIFY_CONFIG_REQUIRED");
const db = createClient(url, role, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: row, error: rowError } = await db.from("geomacro_risk_objects")
  .select("object_id,payload_hash,archive_sha256,archive_key,payload")
  .eq("object_id", id).single();
if (rowError || row?.payload !== null || row?.archive_key !== `risk-object-archive/v1/${id}.json.gz`) {
  throw new Error("GRO_EDGE_VERIFY_POINTER_INVALID");
}
const { data, error } = await db.functions.invoke("gro-archive-read", { body: { object_id: id } });
if (error || !(data instanceof Blob)) throw new Error(`GRO_EDGE_VERIFY_FETCH_FAILED_${error?.context?.status ?? "NO_HTTP"}_${data?.constructor?.name ?? "NULL"}`);
const compressed = Buffer.from(await data.arrayBuffer());
if (compressed.length > 2_000_000 ||
    createHash("sha256").update(compressed).digest("hex") !== row.archive_sha256) {
  throw new Error("GRO_EDGE_VERIFY_COMPRESSED_HASH_INVALID");
}
const object = JSON.parse(gunzipSync(compressed, { maxOutputLength: 4_000_000 }).toString("utf8"));
if (object.object_id !== id || object.integrity?.payload_hash !== row.payload_hash ||
    !verifyRiskObjectSignature(object).valid) throw new Error("GRO_EDGE_VERIFY_SIGNATURE_INVALID");
console.log(JSON.stringify({ ok: true, object_id: id, source: "private_b2_via_edge", bytes: compressed.length,
  sha256_verified: true, signature_verified: true }));
