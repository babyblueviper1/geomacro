import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { archiveObjectPlan, parseB2Endpoint, verifyArchiveReadback } from "./b2-archive-contract.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("accepts only the exact US East S3 endpoint format", () => {
  assert.deepEqual(parseB2Endpoint("https://s3.us-east-005.backblazeb2.com"),
    { endpoint: "https://s3.us-east-005.backblazeb2.com", region: "us-east-005" });
  assert.throws(() => parseB2Endpoint("https://evil.example.com"));
});

test("plans immutable gzip copy and verifies both hashes on readback", () => {
  const raw = Buffer.from('{"evidence":true}\n');
  const gzip = gzipSync(raw);
  const plan = archiveObjectPlan({ bucket: "geomacro-private-archive", objectPath: "fragments/v1/USA/macro/test.ndjson.gz",
    compressedBytes: gzip, compressedSha256: hash(gzip), payloadSha256: hash(raw) });
  assert.equal(verifyArchiveReadback(plan, gzip), true);
  assert.throws(() => verifyArchiveReadback(plan, gzipSync(Buffer.from("other"))));
  assert.throws(() => archiveObjectPlan({ bucket: plan.bucket, objectPath: "fragments/v1/../bad", compressedBytes: gzip,
    compressedSha256: hash(gzip), payloadSha256: hash(raw) }));
});
