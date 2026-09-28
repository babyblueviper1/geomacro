#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

function fail(message) {
  console.error(`PARTNER_COMMERCIAL_READINESS_FAIL: ${message}`);
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const discoveryPath = "public/.well-known/geomacro-partner-verification.json";
const positiveControlPath = "test-vectors/federico-strict-positive-control-v1.json";
const preflightPath = "scripts/invinoveritas-risk-object-preflight.ts";
const docsPath = "docs/PARTNER_VERIFICATION_AND_COMMERCIAL_INTEGRATION.md";
const positiveControlWorkflow = ".github/workflows/federico-strict-positive-control.yml";
const partnerWorkflow = ".github/workflows/partner-commercial-readiness.yml";

for (const path of [
  discoveryPath,
  positiveControlPath,
  preflightPath,
  docsPath,
  positiveControlWorkflow,
  partnerWorkflow,
]) {
  if (!existsSync(path)) fail(`missing required partner artifact: ${path}`);
}

const discovery = readJson(discoveryPath);
const positiveControl = readJson(positiveControlPath);
const preflight = readFileSync(preflightPath, "utf8");
const docs = readFileSync(docsPath, "utf8");
const positiveWorkflow = readFileSync(positiveControlWorkflow, "utf8");

if (discovery.schema_version !== "geomacro-partner-verification-v1") {
  fail("unexpected partner discovery schema_version");
}
if (discovery.risk_object?.schema !== "gro-1.1") fail("risk-object schema mismatch");
if (discovery.risk_object?.signature_scheme !== "Ed25519") fail("signature scheme mismatch");
if (discovery.risk_object?.canonicalization !== "geomacro-canonical-json-v1") {
  fail("canonicalization mismatch");
}
if (discovery.federation?.supported_profile !== "federico-strict-evidence-v1") {
  fail("Federico strict profile missing from partner discovery");
}
if (Number(discovery.federation?.minimum_independent_source_families ?? 0) < 2) {
  fail("partner federation minimum independent source families is below 2");
}
if (discovery.federation?.fail_closed !== true) fail("partner federation must fail closed");
if (discovery.federation?.receiver_side_verification_required !== true) {
  fail("receiver-side verification must be required");
}
if (discovery.security?.no_execution_authority !== true) {
  fail("partner verification must not grant execution authority");
}
if (discovery.commercial_path?.production_pilot !== "contract_required") {
  fail("production pilot must require a contract");
}
if (discovery.commercial_path?.data_redistribution !== "derived-output-only unless separately licensed") {
  fail("derived-only redistribution boundary missing");
}

if (positiveControl?.profile !== "FEDERICO_STRICT") fail("positive control profile mismatch");
if (!Array.isArray(positiveControl?.events) || positiveControl.events.length < 1) {
  fail("positive control contains no events");
}

for (const required of [
  "external_evidence",
  "record_sha256",
  "sign: true",
  "partial_disclosure",
  "proof_verification",
  "independent_node",
  "execution_authorized: false",
]) {
  if (!preflight.includes(required)) fail(`preflight missing required contract marker: ${required}`);
}

for (const required of [
  "Commercial progression",
  "Technical evaluation",
  "production partner agreement",
  "Raw third-party source material must not be redistributed",
]) {
  if (!docs.includes(required)) fail(`commercial partner docs missing section/guardrail: ${required}`);
}

if (!positiveWorkflow.includes("persist-credentials: false")) {
  fail("positive-control workflow must disable persisted Git credentials");
}
if (!positiveWorkflow.includes("check-federico-positive-control.ts")) {
  fail("positive-control workflow does not execute the known-good verifier");
}

console.log(JSON.stringify({
  ok: true,
  contract: "geomacro-partner-commercial-readiness-v1",
  risk_object_schema: discovery.risk_object.schema,
  federation_profile: discovery.federation.supported_profile,
  positive_control: "present",
  external_review_binding: discovery.partner_handoff.external_evidence_binding,
  independent_proof_verification_required:
    discovery.partner_handoff.independent_proof_verification_required,
  production_pilot: discovery.commercial_path.production_pilot,
  paid_api: discovery.commercial_path.paid_api,
  fail_closed: discovery.federation.fail_closed,
}, null, 2));
