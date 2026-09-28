import fs from "node:fs";
import { describe, expect, it } from "vitest";

const response = fs.readFileSync("src/lib/agent-query-response.server.ts", "utf8");
const decision = fs.readFileSync("src/lib/decision-intelligence-output.ts", "utf8");

describe("Geomacro paid decision intelligence integration", () => {
  it("assembles the decision intelligence layer from governed current state", () => {
    expect(response).toContain('import { buildDecisionIntelligence } from "./decision-intelligence-output"');
    expect(response).toContain("const decisionIntelligence = currentStates.map");
    expect(response).toContain("decision_intelligence: decisionIntelligence");
    expect(response).toContain('customer_facing_output: "decision_intelligence_v1"');
  });

  it("keeps the customer-facing object concise, causal and derived-only", () => {
    expect(decision).toContain('cause: `Geomacro detects this because ${primaryCause}.`');
    expect(decision).toContain('delivery_boundary: "DERIVED_DECISION_INTELLIGENCE_ONLY"');
    expect(decision).toContain("raw_data_delivered: false");
    expect(decision).toContain("watch_next: drivers.map");
    expect(decision).toContain("material_change:");
  });

  it("does not weaken the existing execution boundary", () => {
    expect(response).toContain("execution_authorized: false");
    expect(decision).toContain("execution_authorized: false");
  });
});
