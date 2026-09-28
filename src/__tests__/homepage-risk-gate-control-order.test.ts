import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HOME = readFileSync("src/components/home/commercial-home.tsx", "utf8");
const RISK_GATE = readFileSync("src/routes/risk-gate.tsx", "utf8");
const INSTITUTIONAL = readFileSync("src/routes/institutional.tsx", "utf8");

describe("Risk Gate commercial control ordering", () => {
  it("keeps detailed Risk Gate mechanics off the launch homepage", () => {
    expect(HOME).toContain("Roadmap, not launch promise");
    expect(HOME).toContain("Signed Risk Objects and Risk Gate");
    expect(HOME).toContain("Paid agent and x402 production access");
    expect(HOME).not.toContain("Risk Gate recommendation returned");
    expect(HOME).not.toContain("Customer policy decides what happens next");
    expect(HOME).not.toContain("execution_authorized");
  });

  it("keeps Risk Gate non-authorizing while institutional launch copy treats it as roadmap", () => {
    expect(INSTITUTIONAL).toContain("Signed Risk Objects and Risk Gate");
    expect(INSTITUTIONAL).toContain("Risk Gate, paid agent/x402 production access and broader machine delivery remain roadmap or controlled capabilities until separately promoted");
    expect(INSTITUTIONAL).not.toContain("Risk Gate returns bounded decision context");
    expect(INSTITUTIONAL).not.toContain("CONTINUE");
    expect(RISK_GATE).toContain("execution_authorized = false");
    expect(RISK_GATE).toContain("A risk recommendation is not permission to move money");
  });
});
