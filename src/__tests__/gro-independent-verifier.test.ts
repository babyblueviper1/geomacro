import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("standalone GRO verifier", () => {
  it("matches signed and canonical edge vectors without importing app code", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/verify-gro-independent.mjs", "--self-test"],
      { encoding: "utf8" },
    );

    const result = JSON.parse(output) as {
      ok?: boolean;
      status?: string;
      signed_vector?: string;
      edge_vector?: string;
    };

    expect(result.ok).toBe(true);
    expect(result.status).toBe("PASS");
    expect(result.signed_vector).toBe(
      "cd1b162452fbcb78d599a2ea6e1b00eabda7276807d5b1e7b78134f46acead39",
    );
    expect(result.edge_vector).toBe(
      "31e5621fc0e2cca45a9e9b4c0eac9e0c748b2dcbb03bcfd7c093580626eb8caf",
    );
  });
});
