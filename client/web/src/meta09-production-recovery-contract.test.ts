import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const interaction = readFileSync(
  new URL("./strategic-board-interaction-qa.css", import.meta.url),
  "utf8",
);
const guard = readFileSync(
  new URL("./production-runtime-guard.ts", import.meta.url),
  "utf8",
);
const dockerfile = readFileSync(
  new URL("../../../Dockerfile", import.meta.url),
  "utf8",
);
const release = JSON.parse(readFileSync(
  new URL("../../../runtime/packs/PACK_99_RECOVERED/production-release.json", import.meta.url),
  "utf8",
)) as { required?: boolean; signature?: string };

describe("META 09-R production recovery", () => {
  it("restores the accepted META 08.9 visual authority", () => {
    expect(interaction.trimStart().startsWith("/*")).toBe(true);
    expect(interaction).not.toContain('@import "./strategic-world-foundation.css"');
    expect(html).not.toContain("strategic-territory-claim.css");
  });

  it("loads the production runtime guard and build identity", () => {
    expect(html).toContain("production-runtime-guard.ts");
    expect(html).toContain("hexa-release-sha");
    expect(guard).toContain("PACK 99 incompleto");
    expect(guard).toContain("data.productionBlocked");
    expect(guard).toContain("PACK 99 ${canonical ?? \"0\"}/1037");
  });

  it("refuses bootstrap runtime in production", () => {
    expect(release.required).toBe(true);
    expect(dockerfile).toContain("ARG PACK99_WEB_RUNTIME_REQUIRED=true");
    expect(dockerfile).toContain("PACK99_RELEASE_DOWNLOAD_FAILED");
    expect(dockerfile).toContain("PACK99_CANONICAL_ALIAS_MISSING");
  });

  it("preserves the Tehkné Solutions signature", () => {
    expect(release.signature).toBe("Tehkné Solutions");
    expect(guard).toContain("Tehkné Solutions");
  });
});
