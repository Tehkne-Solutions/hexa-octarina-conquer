import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const interactionAuthority = readFileSync(
  new URL("./strategic-board-interaction-qa.css", import.meta.url),
  "utf8",
);
const worldAuthority = readFileSync(
  new URL("./strategic-world-foundation.css", import.meta.url),
  "utf8",
);

describe("META 09.1 living world foundation", () => {
  it("keeps the experimental authority dormant during META 09-R", () => {
    expect(interactionAuthority).not.toContain('@import "./strategic-world-foundation.css"');
  });

  it("preserves the experimental source for later architectural refactoring", () => {
    expect(worldAuthority).toContain(".strategic-cells::before");
    expect(worldAuthority).toContain(".strategic-edge.state-road .strategic-edge-asset");
    expect(worldAuthority).toContain(".strategic-edge.state-unbuilt .strategic-edge-asset");
  });

  it("keeps motion isolated from interactive hitboxes", () => {
    expect(worldAuthority).toContain("meta09-water-drift");
    expect(worldAuthority).toContain("meta09-unit-breathe");
    expect(worldAuthority).toContain("@media (prefers-reduced-motion: reduce)");
    expect(worldAuthority).not.toContain(".strategic-edge {\n  animation:");
    expect(worldAuthority).not.toContain(".strategic-cell {\n  animation:");
  });

  it("preserves the Tehkné Solutions signature", () => {
    expect(worldAuthority).toContain("Tehkné Solutions");
  });
});
