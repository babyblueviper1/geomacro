import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("canonical hybrid intelligence routing", () => {
  it("routes public Ask Geomacro through the hybrid server wrapper", () => {
    const ask = read("src/lib/ask-geomacro.functions.ts");
    expect(ask).toContain('from "./hybrid-ask-intelligence.server"');
    expect(ask).not.toContain('answerQuestion, type AskAnswer } from "./ask-intelligence.server"');
  });

  it("routes paid/testnet intelligence_query through the hybrid capability wrapper", () => {
    const service = read("src/lib/testnet-intelligence-service.server.ts");
    const capability = read("src/lib/testnet-intelligence-capability-hybrid.server.ts");

    expect(service).toContain('from "./testnet-intelligence-capability-hybrid.server"');
    expect(capability).toContain('request.capability !== "intelligence_query"');
    expect(capability).toContain('answerQuestion(question)');
    expect(capability).toContain('durable_live_storage_write: false');
    expect(capability).toContain('upstream_source_identity_exposed: false');
  });

  it("keeps live source identity and raw payloads out of the public runtime contract", () => {
    const runtime = read("global-intelligence/engine/intelligence-engine.mjs");
    expect(runtime).toContain('source_identity_exposed: false');
    expect(runtime).toContain('durable_live_storage_write: false');
    expect(runtime).toContain('Geomacro found these factors in real time based on your question.');
    expect(runtime).not.toContain('source_url: observation');
    expect(runtime).not.toContain('raw_payload: observation');
  });
});
