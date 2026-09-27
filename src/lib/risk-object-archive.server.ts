import { createHash, createHmac } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { requireRiskSupabase } from "./risk-supabase.server";
import { verifyRiskObjectSignature } from "./risk-object-signing.server";
import type { GeomacroRiskObject } from "./risk-object-contract";

type ArchivedRiskObjectRow = {
  object_id: string;
  payload: unknown;
  payload_hash?: string | null;
  archive_key?: string | null;
  archive_sha256?: string | null;
};

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) =>
  createHmac("sha256", key).update(value).digest();

async function downloadPrivateB2Archive(objectId: string): Promise<Buffer> {
  const accessKey = process.env.B2_ARCHIVE_READ_KEY_ID;
  const secretKey = process.env.B2_ARCHIVE_READ_APPLICATION_KEY;
  if (!accessKey || !secretKey) throw new Error("RISK_OBJECT_ARCHIVE_UNAVAILABLE");

  // Pin the endpoint, bucket and path. The object ID is checked by the caller.
  const host = "s3.us-east-005.backblazeb2.com";
  const region = "us-east-005";
  const path = `/geomacro-private-archive/geomacro-evidence/v1/gro/${objectId}.json.gz`;
  const timestamp = new Date().toISOString().replace(/[:-]|\\.\\d{3}/g, "");
  const day = timestamp.slice(0, 8);
  const payloadHash = sha256("");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = `host:${host}\\nx-amz-content-sha256:${payloadHash}\\nx-amz-date:${timestamp}\\n`;
  const canonical = ["GET", path, "", canonicalHeaders, signedHeaders, payloadHash].join("\\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, sha256(canonical)].join("\\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const response = await fetch(`https://${host}${path}`, {
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": timestamp,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("RISK_OBJECT_ARCHIVE_UNAVAILABLE");
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 2_000_000) throw new Error("RISK_OBJECT_ARCHIVE_TOO_LARGE");
  return Buffer.from(await response.arrayBuffer());
}

export async function loadRiskObjectPayload(row: ArchivedRiskObjectRow): Promise<GeomacroRiskObject> {
  if (row.payload) return row.payload as GeomacroRiskObject;
  if (!/^gro_[A-Za-z0-9_]+$/.test(row.object_id) ||
      row.archive_key !== `risk-object-archive/v1/${row.object_id}.json.gz` ||
      !/^[a-f0-9]{64}$/.test(row.payload_hash ?? "") ||
      !/^[a-f0-9]{64}$/.test(row.archive_sha256 ?? "")) {
    throw new Error("RISK_OBJECT_ARCHIVE_POINTER_INVALID");
  }
  const db = requireRiskSupabase();
  const { data, error } = await db.storage.from("geomacro-live-intelligence").download(row.archive_key);
  const compressed = error || !data
    ? await downloadPrivateB2Archive(row.object_id)
    : Buffer.from(await data.arrayBuffer());
  if (compressed.length > 2_000_000) throw new Error("RISK_OBJECT_ARCHIVE_TOO_LARGE");
  if (sha256(compressed) !== row.archive_sha256) {
    throw new Error("RISK_OBJECT_ARCHIVE_HASH_MISMATCH");
  }
  const decoded = gunzipSync(compressed, { maxOutputLength: 4_000_000 });
  const object = JSON.parse(decoded.toString("utf8")) as GeomacroRiskObject;
  if (object.object_id !== row.object_id ||
      object.integrity?.payload_hash !== row.payload_hash ||
      !verifyRiskObjectSignature(object).valid) {
    throw new Error("RISK_OBJECT_ARCHIVE_INTEGRITY_FAILED");
  }
  return object;
}
