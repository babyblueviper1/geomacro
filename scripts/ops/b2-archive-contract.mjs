import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function parseB2Endpoint(value) {
  const url = new URL(value);
  const match = /^s3\.(us-east-\d{3})\.backblazeb2\.com$/.exec(url.hostname);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" ||
      url.search || url.hash || !match) throw new Error("B2_US_EAST_S3_ENDPOINT_REQUIRED");
  return { endpoint: url.origin, region: match[1] };
}

export function archiveObjectPlan({ bucket, objectPath, compressedBytes, compressedSha256, payloadSha256 }) {
  if (bucket !== "geomacro-private-archive" || !/^(raw|fragments|live|fanout)\/v1\//.test(objectPath) ||
      objectPath.includes("..") || objectPath.startsWith("/")) throw new Error("ARCHIVE_SCOPE_INVALID");
  const compressed = Buffer.from(compressedBytes);
  if (sha256(compressed) !== compressedSha256) throw new Error("ARCHIVE_COMPRESSED_HASH_MISMATCH");
  if (sha256(gunzipSync(compressed)) !== payloadSha256) throw new Error("ARCHIVE_PAYLOAD_HASH_MISMATCH");
  return Object.freeze({
    bucket, original_path: objectPath, archive_key: `geomacro-evidence/v1/${objectPath}`,
    compressed_bytes: compressed.length, compressed_sha256: compressedSha256, payload_sha256: payloadSha256,
    content_type: "application/gzip",
  });
}

export function verifyArchiveReadback(plan, downloadedBytes) {
  const bytes = Buffer.from(downloadedBytes);
  if (bytes.length !== plan.compressed_bytes || sha256(bytes) !== plan.compressed_sha256 ||
      sha256(gunzipSync(bytes)) !== plan.payload_sha256) throw new Error("ARCHIVE_READBACK_MISMATCH");
  return true;
}
