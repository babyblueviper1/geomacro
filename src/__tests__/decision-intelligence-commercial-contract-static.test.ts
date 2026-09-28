import fs from "node:fs";
import { describe, expect, it } from "vitest";

const contract = fs.readFileSync("src/lib/geomacro-intelligence-contract.ts", "utf8");
const commercial = JSON.parse(
  fs.readFileSync("config/decision-intelligence-commercial-contract.json", "utf8"),
);

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

  it("keeps the machine-readable commercial contract aligned with runtime enforcement", () => {
    expect(commercial.schema_version).toBe(
      "geomacro.decision-intelligence-commercial-contract.v1",
    );
    expect(commercial.response_schema).toBe("geomacro.decision-intelligence.v1");
    expect(commercial.customer_facing_output).toBe("decision_intelligence_v1");
    expect(commercial.delivery_boundary).toBe("DERIVED_DECISION_INTELLIGENCE_ONLY");
    expect(commercial.raw_data_delivered).toBe(false);
    expect(commercial.execution_authorized).toBe(false);
    expect(commercial.cause_prefix).toBe("Geomacro detects this because ");
    expect(commercial.required_fields).toEqual(
      expect.arrayContaining([
        "answer",
        "cause",
        "geomacro_detected",
        "why_it_matters",
        "decision",
        "change",
        "watch_next",
        "evidence_quality",
        "state_version",
      ]),
    );
    expect(commercial.decision_actions).toEqual([
      "PROCEED",
      "PROCEED_WITH_GUARDRAILS",
      "REVIEW",
      "PAUSE",
      "INSUFFICIENT_EVIDENCE",
    ]);
    expect(commercial.public_openapi_update_state).toBe("HELD_BY_WEBSITE_LOCK");
    expect(commercial.public_openapi_unlock_required).toBe(true);
    expect(commercial.commercial_rules.availability_first).toBe(true);
    expect(commercial.commercial_rules.unavailable_is_not_payable).toBe(true);
    expect(commercial.commercial_rules.raw_upstream_redistribution).toBe(false);
    expect(commercial.commercial_rules.state_continuity_preferred_over_warehouse_growth).toBe(true);
  });
});
