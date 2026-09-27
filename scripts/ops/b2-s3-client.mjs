import { createHash, createHmac } from "node:crypto";
import { parseB2Endpoint } from "./b2-archive-contract.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hmac = (key, value) => createHmac("sha256", key).update(value).digest();

export function createB2Client({ endpointUrl, accessKey, secretKey, bucket }) {
  const endpoint = parseB2Endpoint(endpointUrl);
  if (endpoint.endpoint !== "https://s3.us-east-005.backblazeb2.com" ||
      bucket !== "geomacro-private-archive" || !accessKey || !secretKey) throw new Error("B2_ARCHIVE_CONFIG_INVALID");

  async function request(method, key, body = Buffer.alloc(0)) {
    if (!/^geomacro-evidence\/v1\/[A-Za-z0-9_./-]+$/.test(key) || key.includes("..")) {
      throw new Error("B2_ARCHIVE_KEY_INVALID");
    }
    const path = `/${[bucket, ...key.split("/")].map(encodeURIComponent).join("/")}`;
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
    const result = await fetch(`${endpoint.endpoint}${path}`, {
      method,
      headers: {
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": timestamp,
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body: method === "PUT" ? body : undefined,
      signal: AbortSignal.timeout(60_000),
    });
    if (!result.ok) throw new Error(`B2_${method}_FAILED_${result.status}`);
    return Buffer.from(await result.arrayBuffer());
  }
  return { put: (key, bytes) => request("PUT", key, bytes), get: (key) => request("GET", key) };
}
