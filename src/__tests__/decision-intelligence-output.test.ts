import { describe, expect, it } from "vitest";
import { buildDecisionIntelligence } from "../lib/decision-intelligence-output";

describe("Geomacro decision intelligence output", () => {
  it("returns concise derived decision intelligence without raw data", () => {
    const result = buildDecisionIntelligence({
      subject: { type: "corridor", origin_country_iso3: "IND", destination_country_iso3: "ARE" },
      state_version: "gstate_test",
      risk: {
        score: 56.4,
        label: "MODERATE",
        previous_score: 49.9,
        delta: 6.5,
        direction: "escalating",
      },
      confidence: 0.91,
      observed_at: "2026-09-28T05:00:00.000Z",
      attribution: [
        { driver: "FX pressure", delta_contribution: 4.1 },
        { driver: "energy import exposure", delta_contribution: 1.7 },
      ],
      structural: {
        available_dimensions: ["external_fx", "macro_monetary"],
        latest_observed_at: "2026-09-28T05:00:00.000Z",
      },
      live: {
        current_event_signal: true,
        event_count: 2,
        checked_at: "2026-09-28T05:15:00.000Z",
      },
      risk_gate_decision: null,
      as_of: "2026-09-28T05:30:00.000Z",
    });

    expect(result.schema_version).toBe("geomacro.decision-intelligence.v1");
    expect(result.decision.action).toBe("PROCEED_WITH_GUARDRAILS");
    expect(result.cause.startsWith("Geomacro detects this because")).toBe(true);
    expect(result.geomacro_detected[0]).toContain("FX pressure");
    expect(result.change.material_change).toBe(true);
    expect(result.watch_next).toEqual(["FX pressure", "energy import exposure"]);
    expect(result.raw_data_delivered).toBe(false);
    expect(result.execution_authorized).toBe(false);
    expect(result.delivery_boundary).toBe("DERIVED_DECISION_INTELLIGENCE_ONLY");
  });

  it("fails closed when verified decision-grade state is missing", () => {
    const result = buildDecisionIntelligence({
      subject: { type: "country", country_iso3: "IND" },
      state_version: null,
      risk: null,
      confidence: null,
      observed_at: null,
      attribution: [],
      structural: null,
      live: null,
      risk_gate_decision: null,
      as_of: "2026-09-28T05:30:00.000Z",
    });

    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.decision.action).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.decision.guardrail).toContain("Do not charge or act");
    expect(result.raw_data_delivered).toBe(false);
  });
});
