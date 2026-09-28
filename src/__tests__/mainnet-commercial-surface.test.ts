import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("mainnet commercial website surface", () => {
  it("mounts customer care globally and escalates to the official email", () => {
    const root = read("src/routes/__root.tsx");
    const care = read("src/components/customer-care.tsx");

    expect(root).toContain("<CustomerCare />");
    expect(care).toContain('const EMAIL = "contact@geomacro.live"');
    expect(care).toContain("Customer Care");
    expect(care).toContain("What do machines get?");
  });

  it("keeps the commercial product identity separate from testnet proofs", () => {
    const home = read("src/components/home/commercial-home.tsx");
    const contact = read("src/routes/contact.tsx");
    const institution = read("src/routes/institutional.tsx");

    expect(home).toContain("For people");
    expect(home).toContain("For machines & agents");
    expect(home).toContain("Critical Minerals & Rare Earth Risk");
    expect(contact).toContain("Prediction Markets, Bridge and Swap remain separate testnet technical proofs");
    expect(institution).toContain("Prediction Markets, Bridge and Swap remain separate testnet technical proofs");
  });

  it("provides clear commercial conversion paths", () => {
    const home = read("src/components/home/commercial-home.tsx");
    const contact = read("src/routes/contact.tsx");
    const institution = read("src/routes/institutional.tsx");

    expect(home).toContain("Commercial access");
    expect(contact).toContain("Commercial access");
    expect(contact).toContain("Customer support");
    expect(institution).toContain("Discuss commercial access");
  });
});
