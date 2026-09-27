import assert from "node:assert/strict";
import { test } from "node:test";
import { recommendPilotFocus } from "./private-pilot-demand-policy.mjs";

test("private pilot ranks real repeat demand but cannot admit unlicensed sources", () => {
  const signals = [
    { category: "MACRO", topic: "macro_risk", buyer_id: "a", external: true, settled: true, delivered: true },
    { category: "MACRO", topic: "macro_risk", buyer_id: "b", external: true, settled: true, delivered: true },
    { category: "MACRO", topic: "macro_risk", buyer_id: "a", external: true, settled: true, delivered: true },
    { category: "GEOPOLITICS", topic: "hot_topics", buyer_id: "internal", external: false, settled: true, delivered: true },
    { category: "CRITICAL_MINERALS", topic: "critical_minerals", buyer_id: "c", external: true, unmet: true },
  ];
  const sources = [
    { id: "central_bank", certified: true, commercial_rights: true, live_eligible: true },
    { id: "imf_sdmx", certified: true, commercial_rights: false, live_eligible: true },
    { id: "gdelt_v2", certified: true, commercial_rights: true, live_eligible: true },
  ];
  const result = recommendPilotFocus(signals, sources);
  assert.equal(result[0].category, "MACRO");
  assert.equal(result[0].demand_validated, true);
  assert.deepEqual(result[0].eligible_source_ids, ["central_bank"]);
  assert.equal(result.find((item) => item.category === "GEOPOLITICS").successful_deliveries, 0);
  assert.equal(result.find((item) => item.category === "CRITICAL_MINERALS").action, "SOURCE_CERTIFICATION_REQUIRED");
});
