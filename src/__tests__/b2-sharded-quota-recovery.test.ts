import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const observationWorker = read("scripts/ops/b2-archive-observation-payload-batch.mjs");
const observationWorkflow = read(".github/workflows/b2-observation-payload-maintenance.yml");
const groWorker = read("scripts/ops/b2-only-gro-externalize-canary.ts");
const groWorkflow = read(".github/workflows/b2-only-gro-externalize-canary.yml");

const suffixMatrix = 'suffix: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"]';

describe("sharded B2 quota recovery", () => {
  it("partitions observation candidates by a validated hexadecimal suffix", () => {
    expect(observationWorker).toContain("OBS_ARCHIVE_SUFFIX");
    expect(observationWorker).toContain("/^[0-9a-f]$/");
    expect(observationWorker).toContain('query.like("observation_id", `%${suffix}`)');
    expect(observationWorker).toContain("endsWith(suffix)");
    expect(observationWorkflow).toContain(suffixMatrix);
    expect(observationWorkflow).toContain("max-parallel: 8");
    expect(observationWorkflow).toContain("fail-fast: false");
  });

  it("partitions GRO candidates by the same non-overlapping suffix rule", () => {
    expect(groWorker).toContain("GRO_ARCHIVE_SUFFIX");
    expect(groWorker).toContain("/^[0-9a-f]$/");
    expect(groWorker).toContain('query.like("object_id", `%${suffix}`)');
    expect(groWorker).toContain("endsWith(suffix)");
    expect(groWorkflow).toContain(suffixMatrix);
    expect(groWorkflow).toContain("max-parallel: 8");
    expect(groWorkflow).toContain("fail-fast: false");
  });

  it("preserves the fail-closed archive and rollback contracts", () => {
    expect(observationWorker).toContain("OBS_ARCHIVE_READBACK_INVALID");
    expect(observationWorker).toContain("OBS_ARCHIVE_ROLLBACK_FAILED");
    expect(groWorker).toContain("B2_ONLY_GRO_READBACK_INVALID");
    expect(groWorker).toContain("B2_ONLY_GRO_ROLLBACK_FAILED");
  });
});
