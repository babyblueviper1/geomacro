#!/usr/bin/env node
// Bounded old observation raw payloads to private B2, then nullable DB payload only.
// No row deletion; normalized fields and hashes remain available.
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";

const sha = (x) => createHash("sha256").update(x).digest("hex");
const url = process.env.APP_SUPABASE_URL;
const role = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
const limit = Number(process.env.OBS_ARCHIVE_LIMIT ?? 1);
const suffix = String(process.env.OBS_ARCHIVE_SUFFIX ?? "").trim().toLowerCase();
if (url !== "https://ldpwajisioljyjtojvfx.supabase.co" || !role ||
    !Number.isInteger(limit) || limit < 1 || limit > 10 ||
    (suffix && !/^[0-9a-f]$/.test(suffix))) throw new Error("OBS_ARCHIVE_CONFIG_INVALID");
const db = createClient(url, role, { auth: { persistSession: false, autoRefreshToken: false } });
const b2 = createB2Client({ endpointUrl: process.env.B2_S3_ENDPOINT,
  accessKey: process.env.B2_KEY_ID, secretKey: process.env.B2_APPLICATION_KEY,
  bucket: "geomacro-private-archive" });
const cutoff = new Date(Date.now() - 72 * 3_600_000).toISOString();

async function selectRows() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    let query = db.from("live_external_observations")
      .select("observation_id,raw_payload,raw_hash,ingested_at")
      .not("raw_payload", "is", null).lt("ingested_at", cutoff);
    if (suffix) query = query.like("observation_id", `%${suffix}`);
    const result = await query.order("ingested_at", { ascending: true }).limit(limit);
    if (!result.error) return result.data ?? [];
    const transient = result.error.code === "57014" || /statement timeout/i.test(result.error.message ?? "");
    if (!transient || attempt === 4) throw result.error;
    const delayMs = 1500 * (2 ** (attempt - 1));
    console.warn(JSON.stringify({ warning: "OBS_ARCHIVE_SELECT_RETRY", attempt, delay_ms: delayMs,
      code: result.error.code ?? null, shard_suffix: suffix || null }));
    await sleep(delayMs);
  }
  return [];
}

const rows = await selectRows();
let archived = 0;
for (const row of rows) {
  if (!row.observation_id || (suffix && !String(row.observation_id).toLowerCase().endsWith(suffix)) ||
      !/^[a-f0-9]{64}$/.test(row.raw_hash) || !row.raw_payload ||
      Date.now() - Date.parse(row.ingested_at) < 72 * 3_600_000) {
    throw new Error("OBS_ARCHIVE_SOURCE_INVALID");
  }
  const raw = Buffer.from(JSON.stringify(row.raw_payload));
  if (raw.length > 2_000_000) throw new Error("OBS_ARCHIVE_PAYLOAD_TOO_LARGE");
  const compressed = gzipSync(raw, { level: 9 });
  if (sha(gunzipSync(compressed)) !== sha(raw)) throw new Error("OBS_ARCHIVE_LOCAL_ROUNDTRIP_INVALID");
  const idHash = sha(Buffer.from(row.observation_id));
  const archiveKey = `geomacro-evidence/v1/observations/${idHash}.json.gz`;
  const proofKey = `geomacro-evidence/v1/index/observations/${idHash}.json`;

  const archivePut = await b2.put(archiveKey, compressed);
  if (archivePut?.payload_sha256 !== sha(compressed) || archivePut?.bytes !== compressed.length) {
    throw new Error("OBS_ARCHIVE_PUT_INVALID");
  }
  const proof = {
    schema: "geomacro.observation-raw-archive.v1",
    observation_id: row.observation_id,
    source_table: "public.live_external_observations",
    source_raw_hash: row.raw_hash,
    archive_key: archiveKey,
    archive_version_id: archivePut.version_id,
    archive_etag: archivePut.etag,
    payload_sha256: sha(raw),
    compressed_sha256: sha(compressed),
    payload_bytes: raw.length,
    compressed_bytes: compressed.length,
    source_ingested_at: row.ingested_at,
    verification_mode: "s3_put_etag_md5",
    verified_at: new Date().toISOString(),
  };
  const proofBytes = Buffer.from(JSON.stringify(proof));
  const proofPut = await b2.put(proofKey, proofBytes);
  if (proofPut?.payload_sha256 !== sha(proofBytes) || proofPut?.bytes !== proofBytes.length) {
    throw new Error("OBS_ARCHIVE_PROOF_INVALID");
  }

  const { data: current, error: checkError } = await db.from("live_external_observations")
    .select("raw_payload,raw_hash").eq("observation_id", row.observation_id).single();
  if (checkError || current?.raw_hash !== row.raw_hash ||
      sha(Buffer.from(JSON.stringify(current?.raw_payload))) !== sha(raw)) {
    throw new Error("OBS_ARCHIVE_SOURCE_CHANGED");
  }
  const { data: updated, error: updateError } = await db.from("live_external_observations")
    .update({ raw_payload: null }).eq("observation_id", row.observation_id)
    .eq("raw_hash", row.raw_hash).not("raw_payload", "is", null)
    .select("observation_id,raw_payload,raw_hash").single();
  if (updateError || updated?.observation_id !== row.observation_id ||
      updated.raw_payload !== null || updated.raw_hash !== row.raw_hash) {
    throw new Error("OBS_ARCHIVE_UPDATE_UNCONFIRMED");
  }

  archived++;
  console.log(JSON.stringify({
    observation_id: row.observation_id,
    archive_verified: true,
    verification_mode: "s3_put_etag_md5",
    source_row_retained: true,
    normalized_hash_retained: true,
    raw_payload_externalized: true,
    b2_class_b_readback_used: false,
    shard_suffix: suffix || null,
  }));
}
console.log(JSON.stringify({
  ok: true,
  archived,
  limit,
  older_hours: 72,
  shard_suffix: suffix || null,
  b2_class_b_readback_used: false,
}));
