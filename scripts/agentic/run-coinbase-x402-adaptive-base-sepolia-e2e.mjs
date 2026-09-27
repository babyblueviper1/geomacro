#!/usr/bin/env node

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { const s = chunk.toString(); stdout += s; process.stdout.write(s); });
    child.stderr.on("data", (chunk) => { const s = chunk.toString(); stderr += s; process.stderr.write(s); });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function main() {
  const discovery = await run("node", ["scripts/agentic/discover-adaptive-x402-subject.mjs"]);
  if (discovery.code !== 0) {
    throw new Error("No currently deliverable country was found by the bounded no-charge availability scan. No payment was attempted.");
  }

  let result;
  try {
    result = JSON.parse(discovery.stdout.trim().split(/\n/).at(-1) ?? "{}");
  } catch {
    throw new Error("Deliverability discovery did not return valid JSON");
  }
  if (result?.ok !== true || !/^[A-Z]{3}$/.test(String(result.country_iso3 ?? ""))) {
    throw new Error("Deliverability discovery returned no usable country");
  }

  const sourcePath = "scripts/agentic/coinbase-x402-adaptive-base-sepolia-e2e.mjs";
  let source = await readFile(sourcePath, "utf8");
  const countryIso3 = String(result.country_iso3);
  const countryName = String(result.country_name ?? countryIso3).replace(/[\r\n`]/g, " ");

  const oldQuestion = "Should a treasury payment involving the United States proceed based on the current Geomacro Risk Gate?";
  const oldSubject = 'subjects: [{ type: "country", country_iso3: "USA" }],';
  if (!source.includes(oldQuestion) || !source.includes(oldSubject)) {
    throw new Error("Adaptive paid harness source contract changed; refusing runtime patch");
  }

  source = source
    .replace(oldQuestion, `Should a treasury payment involving ${countryName} proceed based on the current Geomacro Risk Gate?`)
    .replace(oldSubject, `subjects: [{ type: "country", country_iso3: "${countryIso3}" }],`);

  const dir = await mkdtemp(path.join(tmpdir(), "geomacro-adaptive-x402-"));
  const tempScript = path.join(dir, "adaptive-e2e.mjs");
  await writeFile(tempScript, source, { mode: 0o600 });

  console.log(`Selected deliverable country: ${countryIso3} (${countryName})`);
  console.log(`Discovery query plan: ${result.query_plan_hash ?? "n/a"}`);

  const execution = await run("node", [tempScript], { cwd: process.cwd() });
  if (execution.code !== 0) process.exit(execution.code);
}

main().catch((error) => {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
