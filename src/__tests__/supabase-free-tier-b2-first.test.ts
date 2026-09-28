import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Supabase free-tier B2-first storage contract", () => {
  const contract = read("scripts/ops/sql/geomacro-free-tier-budget-and-b2-raw-candidates.sql");
  const worker = read("scripts/ops/b2-raw-storage-maintenance.mjs");
  const workflow = read(".github/workflows/b2-raw-storage-maintenance.yml");
  const budget = read("scripts/ops/supabase-free-tier-budget.mjs");

  it("freezes bulk Supabase writes before the hard free-tier ceiling", () => {
    expect(contract).toContain("'target_bytes', 367001600");
    expect(contract).toContain("'warn_bytes', 419430400");
    expect(contract).toContain("'freeze_bytes', 471859200");
    expect(contract).toContain("'bulk_write_allowed'");
    expect(budget).toContain("compact_operational_control_plane");
    expect(budget).toContain("raw_archive_historical_large_payloads");
  });

  it("keeps storage cleanup on the Storage API and never SQL-deletes storage.objects", () => {
    expect(worker).toContain('storage.remove([path])');
    expect(worker).toContain("geomacro_raw_storage_paths_present");
    expect(worker).not.toMatch(/delete\s+from\s+storage\.objects/i);
    expect(contract).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });

  it("requires B2 readback and both archive and deletion proofs before declaring progress", () => {
    expect(worker).toContain("B2_RAW_ARCHIVE_READBACK_INVALID");
    expect(worker).toContain("geomacro.archive-proof.v1");
    expect(worker).toContain("geomacro.archive-source-deletion.v1");
    expect(worker).toContain("supabase_source_absent: true");
  });

  it("runs bounded hourly maintenance with production-scoped B2 secrets", () => {
    expect(workflow).toContain('cron: "17 * * * *"');
    expect(workflow).toContain('B2_RAW_MAINTENANCE_LIMIT: "100"');
    expect(workflow).toContain("B2_APPLICATION_KEY");
    expect(workflow).toContain("environment: production");
  });
});
