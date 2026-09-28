import fs from "node:fs";
import { describe, expect, it } from "vitest";

const contract = fs.readFileSync("src/lib/geomacro-intelligence-contract.ts", "utf8");
const openapi = JSON.parse(fs.readFileSync("public/openapi-x402.json", "utf8"));

describe("Decision Intelligence commercial contract", () => {
  it("requires canonical decision intelligence before paid delivery is valid", () => {
    expect(contract).toContain('"decision_intelligence"');
    expect(contract).toContain("INTELLIGENCE_RESPONSE_DECISION_INTELLIGENCE_SUBJECT_COUNT_MISMATCH");
    expect(contract).toContain('row.schema_version !== "geomacro.decision-intelligence.v1"');
    expect(contract).toContain('row.delivery_boundary !== "DERIVED_DECISION_INTELLIGENCE_ONLY"');
    expect(contract).toContain("row.raw_data_delivered !== false");
    expect(contract).toContain('row.cause.startsWith("Geomacro detects this because ")');
    expect(contract).toContain('payload.methodology.customer_facing_output !== "decision_intelligence_v1"');
  });

  it("publishes the same contract in the public x402 OpenAPI document", () => {
    const response = openapi.components.schemas.AdaptiveResponse;
    const decision = openapi.components.schemas.DecisionIntelligence;

    expect(response.required).toContain("decision_intelligence");
    expect(response.properties.decision_intelligence.items.$ref).toBe(
      "#/components/schemas/DecisionIntelligence",
    );
    expect(decision.properties.schema_version.const).toBe("geomacro.decision-intelligence.v1");
    expect(decision.properties.delivery_boundary.const).toBe("DERIVED_DECISION_INTELLIGENCE_ONLY");
    expect(decision.properties.raw_data_delivered.const).toBe(false);
    expect(decision.properties.execution_authorized.const).toBe(false);
    expect(decision.properties.cause.pattern).toBe("^Geomacro detects this because ");
    expect(decision.properties.decision.properties.execution_authorized.const).toBe(false);
  });
});
