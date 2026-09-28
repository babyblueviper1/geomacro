#!/usr/bin/env node
// Archive old observation payloads to private B2, verify one complete restore,
// then clear only the verified Supabase payload. Normalized fields remain.
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { createB2Client } from "./b2-s3-client.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TRANSIENT_READ_STATUSES = new Set([429, 500, 502, 503, 504]);
const READ_ATTEMPTS = 4;
const url = process.env.APP_SUPABASE_URL;
const role = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
const limit = Number(process.env.OBS_ARCHIVE_LIMIT ?? 1);
const suffix = String(process.env.OBS_ARCHIVE_SUFFIX ?? "").trim().toLowerCase();

if (
  url !== "https://ldpwajisioljyjtojvfx.supabase.co" ||
  !role ||
  !Number.isInteger(limit) ||
  limit < 1 ||
  limit > 10 ||
  !/^[0-9a-f]$/.test(suffix)
) {
  throw new Error("OBS_ARCHIVE_CONFIG_INVALID");
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

async function archiveRead(id) {
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${url}/functions/v1/archive-verify-read`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${role}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ kind: "observation", id, part: "archive" }),
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 4_000_000) {
          throw new Error("OBS_ARCHIVE_VERIFY_READ_TOO_LARGE");
        }
        return bytes;
      }
      if (!TRANSIENT_READ_STATUSES.has(response.status) || attempt === READ_ATTEMPTS) {
        throw new Error(`OBS_ARCHIVE_VERIFY_READ_FAILED_${response.status}`);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message === "OBS_ARCHIVE_VERIFY_READ_TOO_LARGE" || /^OBS_ARCHIVE_VERIFY_READ_FAILED_\d+$/.test(message) || attempt === READ_ATTEMPTS) {
        throw cause;
      }
    }
    await sleep(500 * 2 ** (attempt - 1));
  }
  throw new Error("OBS_ARCHIVE_VERIFY_READ_RETRY_EXHAUSTED");
}

const { data: rows, error } = await db.rpc(
  "geomacro_next_observation_archive_candidates",
  { p_suffix: suffix, p_limit: limit },
);
if (error) throw error;

let archived = 0;
for (const row of rows ?? []) {
  if (
    !row.observation_id ||
    !String(row.observation_id).toLowerCase().endsWith(suffix) ||
    !/^[a-f0-9]{64}$/.test(row.raw_hash) ||
    !row.raw_payload ||
    Date.now() - Date.parse(row.ingested_at) < 72 * 3_600_000
  ) {
    throw new Error("OBS_ARCHIVE_SOURCE_INVALID");
  }

  const raw = Buffer.from(JSON.stringify(row.raw_payload));
  if (raw.length > 2_000_000) throw new Error("OBS_ARCHIVE_PAYLOAD_TOO_LARGE");
  const compressed = gzipSync(raw, { level: 9 });
  const idHash = sha(Buffer.from(row.observation_id));
  const archiveKey = `geomacro-evidence/v1/observations/${idHash}.json.gz`;
  const proofKey = `geomacro-evidence/v1/index/observations/${idHash}.json`;

  await b2.put(archiveKey, compressed);

  // This is the only successful B2 GET needed for this object. Transient
  // gateway failures may be retried, but cleanup only follows a full readback.
  const readback = await archiveRead(row.observation_id);
  const restored = JSON.parse(gunzipSync(readback).toString("utf8"));
  if (
    sha(readback) !== sha(compressed) ||
    sha(Buffer.from(JSON.stringify(restored))) !== sha(raw)
  ) {
    throw new Error("OBS_ARCHIVE_READBACK_INVALID");
  }

  const proof = {
    schema: "geomacro.observation-raw-archive.v1",
    observation_id: row.observation_id,
    source_table: "public.live_external_observations",
    source_raw_hash: row.raw_hash,
    archive_key: archiveKey,
    payload_sha256: sha(raw),
    compressed_sha256: sha(compressed),
    payload_bytes: raw.length,
    compressed_bytes: compressed.length,
    source_ingested_at: row.ingested_at,
    verified_at: new Date().toISOString(),
  };
  await b2.put(proofKey, Buffer.from(JSON.stringify(proof)));

  const { data: current, error: checkError } = await db
    .from("live_external_observations")
    .select("raw_payload,raw_hash")
    .eq("observation_id", row.observation_id)
    .single();
  if (
    checkError ||
    current?.raw_hash !== row.raw_hash ||
    sha(Buffer.from(JSON.stringify(current?.raw_payload))) !== sha(raw)
  ) {
    throw new Error("OBS_ARCHIVE_SOURCE_CHANGED");
  }

  const { data: updated, error: updateError } = await db
    .from("live_external_observations")
    .update({ raw_payload: null })
    .eq("observation_id", row.observation_id)
    .eq("raw_hash", row.raw_hash)
    .not("raw_payload", "is", null)
    .select("observation_id,raw_payload,raw_hash")
    .single();
  if (
    updateError ||
    updated?.observation_id !== row.observation_id ||
    updated.raw_payload !== null ||
    updated.raw_hash !== row.raw_hash
  ) {
    throw new Error("OBS_ARCHIVE_UPDATE_UNCONFIRMED");
  }

  try {
    if (sha(Buffer.from(JSON.stringify(restored))) !== proof.payload_sha256) {
      throw new Error("OBS_ARCHIVE_POST_UPDATE_RESTORE_FAILED");
    }
  } catch (cause) {
    const rollback = await db
      .from("live_external_observations")
      .update({ raw_payload: row.raw_payload })
      .eq("observation_id", row.observation_id)
      .eq("raw_hash", row.raw_hash)
      .is("raw_payload", null);
    if (rollback.error) throw new Error("OBS_ARCHIVE_ROLLBACK_FAILED", { cause });
    throw cause;
  }

  archived += 1;
  console.log(JSON.stringify({
    observation_id: row.observation_id,
    archive_verified: true,
    source_row_retained: true,
    normalized_hash_retained: true,
    raw_payload_externalized: true,
    b2_gets_per_object: 1,
    shard_suffix: suffix,
  }));
}

console.log(JSON.stringify({
  ok: true,
  archived,
  limit,
  older_hours: 72,
  shard_suffix: suffix,
  verification_mode: "one-full-archive-readback-before-cleanup",
}));
