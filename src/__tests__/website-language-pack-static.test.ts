import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const expectedCodes = [
  "en", "es", "fr", "de", "pt", "zh-CN", "zh-TW", "ja", "ko", "hi", "bn", "ar", "ru", "tr", "id",
];

describe("website language pack", () => {
  it("keeps one shared controller with every supported language", () => {
    const source = read("public/geomacro-language.js");
    for (const code of expectedCodes) expect(source).toContain(`[\"${code}\",`);
    expect(source).toContain("geomacro.website_language");
    expect(source).toContain("translate.google.com/translate?sl=en");
    expect(source).toContain(".translate.goog");
    expect(source).toContain("window.GeomacroLanguage");
  });

  it("loads the shared controller across the primary application", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).toContain('<script src="/geomacro-language.js" defer />');

    const shell = read("src/components/site-shell.tsx");
    for (const code of expectedCodes) expect(shell).toContain(`code: \"${code}\"`);
    expect(shell).toContain("Choose website language");
  });

  it("keeps standalone Testnet surfaces language-enabled", () => {
    for (const path of ["server/routes/testnet-access.get.ts", "server/routes/testnet-console.get.ts"]) {
      const source = read(path);
      expect(source).toContain('id="languageSelect"');
      for (const code of expectedCodes) expect(source).toContain(`value=\"${code}\"`);
    }
  });

  it("adds shared language behavior to the Arc mainnet proof surface", () => {
    const source = read("public/arc-microgrant.html");
    expect(source).toContain('<script src="/geomacro-language.js" defer></script>');
    expect(source).toContain("GEOMACRO_ARC_MAINNET_V2");
  });
});
