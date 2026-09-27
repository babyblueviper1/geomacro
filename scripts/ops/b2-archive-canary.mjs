#!/usr/bin/env node
// Copy one verified fragment to B2 and read it back. Never deletes or edits Supabase.
import { createHash, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { archiveObjectPlan, parseB2Endpoint, verifyArchiveReadback } from "./b2-archive-contract.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hmac = (key, value) => createHmac("sha256", key).update(value).digest();
const endpoint = parseB2Endpoint(process.env.B2_S3_ENDPOINT ?? "");
if (endpoint.endpoint !== "https://s3.us-east-005.backblazeb2.com") throw new Error("UNEXPECTED_B2_ENDPOINT");
const bucket = "geomacro-private-archive";
const accessKey = process.env.B2_KEY_ID;
const secretKey = process.env.B2_APPLICATION_KEY;
const supabaseUrl = process.env.APP_SUPABASE_URL;
const supabaseKey = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
const fragmentId = process.argv[2];
if (!accessKey || !secretKey || !supabaseKey ||
    supabaseUrl !== "https://ldpwajisioljyjtojvfx.supabase.co" ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(fragmentId ?? "")) {
  throw new Error("ARCHIVE_CANARY_CONFIG_REQUIRED");
}

function signedRequest(method, key, body = Buffer.alloc(0)) {
  const encodedPath = [bucket, ...key.split("/")].map(encodeURIComponent).join("/");
  const path = `/${encodedPath}`;
  const host = new URL(endpoint.endpoint).host;
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = timestamp.slice(0, 8);
  const payloadHash = sha(body);
  const headers = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": timestamp };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonical = [method, path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${day}/${endpoint.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, sha(canonical)].join("\n");
  const signatureKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), endpoint.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signatureKey).update(stringToSign).digest("hex");
  return {
    url: `${endpoint.endpoint}${path}`,
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": timestamp,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

async function b2Request(method, key, body) {
  const signed = signedRequest(method, key, body);
  const result = await fetch(signed.url, { method, headers: signed.headers, body: method === "PUT" ? body : undefined,
    signal: AbortSignal.timeout(60_000) });
  if (!result.ok) throw new Error(`B2_${method}_FAILED_${result.status}`);
  return Buffer.from(await result.arrayBuffer());
}

const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: manifest, error } = await db.from("live_fragment_manifest")
  .select("id,storage_bucket,object_path,compression,payload_sha256,compressed_sha256,compressed_bytes")
  .eq("id", fragmentId).single();
if (error || !manifest || manifest.compression !== "gzip" || manifest.storage_bucket !== "geomacro-live-intelligence") {
  throw new Error("CANARY_MANIFEST_NOT_VERIFIED");
}
const { data: blob, error: downloadError } = await db.storage.from(manifest.storage_bucket).download(manifest.object_path);
if (downloadError || !blob) throw new Error("CANARY_SOURCE_DOWNLOAD_FAILED");
const compressed = Buffer.from(await blob.arrayBuffer());
const plan = archiveObjectPlan({ bucket, objectPath: manifest.object_path, compressedBytes: compressed,
  compressedSha256: manifest.compressed_sha256, payloadSha256: manifest.payload_sha256 });
if (compressed.length !== manifest.compressed_bytes) throw new Error("CANARY_SOURCE_LENGTH_MISMATCH");
await b2Request("PUT", plan.archive_key, compressed);
verifyArchiveReadback(plan, await b2Request("GET", plan.archive_key));
console.log(JSON.stringify({ ok: true, source_fragment_id: manifest.id, archive_bucket: bucket,
  archive_key: plan.archive_key, compressed_bytes: plan.compressed_bytes,
  compressed_sha256: plan.compressed_sha256, payload_sha256: plan.payload_sha256,
  source_preserved: true, database_modified: false }));
