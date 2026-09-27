#!/usr/bin/env node

import { createHash, createPublicKey, verify as verifyBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const DEFAULT_REGISTRY = "https://geomacro.live/api/risk-object-keys";
const EXPECTED_SCHEMA = "gro-1.1";
const EXPECTED_CANONICALIZATION = "geomacro-canonical-json-v1";
const EXPECTED_SIGNATURE_SCHEME = "Ed25519";

function fail(message, details = {}) {
  process.stdout.write(`${JSON.stringify({ ok: false, status: "INVALID", error: message, ...details }, null, 2)}\n`);
  process.exit(1);
}

function canonicalize(value) {
  if (value === null) return "null";

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non_finite_number");
    // Normative GRO rule: ECMAScript Number::toString as used by JSON.stringify.
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    // JS default string ordering is UTF-16 code-unit ordering, matching GRO v1.
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }

  throw new Error(`unsupported_json_type:${typeof value}`);
}

function signableObject(object) {
  return {
    ...object,
    integrity: {
      ...object.integrity,
      payload_hash: null,
      signature: null,
    },
  };
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function parseTimestamp(value, field) {
  const ms = Date.parse(String(value ?? ""));
  if (!Number.isFinite(ms)) throw new Error(`invalid_${field}`);
  return ms;
}

function parseCanonicalBase64(value, field) {
  const text = String(value ?? "").trim();
  if (!text || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    throw new Error(`invalid_${field}`);
  }
  const bytes = Buffer.from(text, "base64");
  if (bytes.toString("base64").replace(/=+$/u, "") !== text.replace(/=+$/u, "")) {
    throw new Error(`noncanonical_${field}`);
  }
  return bytes;
}

async function loadRegistry(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "user-agent": "geomacro-independent-gro-verifier/1" },
  });
  if (!response.ok) throw new Error(`registry_http_${response.status}`);
  const body = await response.json();
  if (body?.ok !== true || !Array.isArray(body?.keys)) throw new Error("invalid_registry_response");
  return body.keys;
}

function verifyWithKey(object, keyRecord, nowMs = Date.now()) {
  if (object?.schema_version !== EXPECTED_SCHEMA) throw new Error("unsupported_schema_version");

  const integrity = object?.integrity;
  if (!integrity || typeof integrity !== "object") throw new Error("missing_integrity");
  if (integrity.canonicalization !== EXPECTED_CANONICALIZATION) throw new Error("unsupported_canonicalization");
  if (integrity.signature_scheme !== EXPECTED_SIGNATURE_SCHEME) throw new Error("unsupported_signature_scheme");
  if (!integrity.signing_key_id || !integrity.payload_hash || !integrity.signature) throw new Error("missing_signing_metadata");

  if (!keyRecord) throw new Error("unknown_signing_key");
  if (keyRecord.status === "revoked") throw new Error("signing_key_revoked");

  const generatedAt = parseTimestamp(object.generated_at, "generated_at");
  const expiresAt = parseTimestamp(object.expires_at, "expires_at");
  if (keyRecord.not_before && generatedAt < parseTimestamp(keyRecord.not_before, "key_not_before")) {
    throw new Error("signing_key_not_yet_valid");
  }
  if (keyRecord.not_after && generatedAt > parseTimestamp(keyRecord.not_after, "key_not_after")) {
    throw new Error("signing_key_outside_validity_window");
  }

  const canonical = canonicalize(signableObject(object));
  const recomputedHash = sha256Hex(canonical);
  if (recomputedHash !== String(integrity.payload_hash).toLowerCase()) {
    throw new Error("payload_hash_mismatch");
  }

  const publicKey = createPublicKey({
    key: parseCanonicalBase64(keyRecord.public_key_spki_b64, "public_key_spki_b64"),
    format: "der",
    type: "spki",
  });
  if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("registry_key_not_ed25519");

  const signatureValid = verifyBytes(
    null,
    Buffer.from(canonical, "utf8"),
    publicKey,
    parseCanonicalBase64(integrity.signature, "signature"),
  );
  if (!signatureValid) throw new Error("signature_invalid");

  return {
    ok: true,
    status: nowMs > expiresAt ? "EXPIRED" : "VERIFIED",
    signature_valid: true,
    payload_hash_valid: true,
    payload_hash: recomputedHash,
    signing_key_id: integrity.signing_key_id,
    generated_at: object.generated_at,
    expires_at: object.expires_at,
  };
}

async function selfTest() {
  const vector = JSON.parse(await readFile("docs/examples/gro-1.1-canonical-v1-test-vector.json", "utf8"));
  const signable = JSON.parse(vector.canonical_signable_json);
  const canonical = canonicalize(signable);
  if (canonical !== vector.canonical_signable_json) throw new Error("signed_vector_canonical_mismatch");
  if (sha256Hex(canonical) !== vector.expected_payload_hash) throw new Error("signed_vector_hash_mismatch");

  const key = createPublicKey({
    key: Buffer.from(vector.public_key_spki_b64, "base64"),
    format: "der",
    type: "spki",
  });
  if (!verifyBytes(null, Buffer.from(canonical, "utf8"), key, Buffer.from(vector.signature_b64, "base64"))) {
    throw new Error("signed_vector_signature_mismatch");
  }

  const edge = JSON.parse(await readFile("docs/examples/gro-1.1-canonical-v1-edge-vectors.json", "utf8"));
  const edgeCanonical = canonicalize(edge.input);
  if (edgeCanonical !== edge.canonical_json) throw new Error("edge_vector_canonical_mismatch");
  if (sha256Hex(edgeCanonical) !== edge.sha256) throw new Error("edge_vector_hash_mismatch");

  process.stdout.write(`${JSON.stringify({ ok: true, status: "PASS", signed_vector: vector.expected_payload_hash, edge_vector: edge.sha256 }, null, 2)}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) return selfTest();

  const objectPath = args[0];
  const registryUrl = args[1] || DEFAULT_REGISTRY;
  if (!objectPath) {
    throw new Error("usage: node scripts/verify-gro-independent.mjs <risk-object.json> [registry-url] | --self-test");
  }

  const object = JSON.parse(await readFile(objectPath, "utf8"));
  const keys = await loadRegistry(registryUrl);
  const keyId = object?.integrity?.signing_key_id;
  const keyRecord = keys.find((entry) => entry?.key_id === keyId);
  const result = verifyWithKey(object, keyRecord);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
