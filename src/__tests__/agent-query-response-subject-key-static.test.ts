import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/agent-query-response.server.ts", "utf8");

describe("agent query response subject key contract", () => {
  it("defines the helper used to map risk and hot-topic state by subject", () => {
    expect(source).toContain('function subjectKey(subject: AgentQueryPlan["subjects"][number])');
    expect(source).toContain('`country:${subject.country_iso3}`');
    expect(source).toContain('`corridor:${subject.origin_country_iso3}>${subject.destination_country_iso3}`');
    expect(source).toContain('riskObjects.map((entry) => [subjectKey(entry.subject), entry.object])');
    expect(source).toContain('hotTopics.map((result) => [subjectKey(result.subject), result])');
  });
});
