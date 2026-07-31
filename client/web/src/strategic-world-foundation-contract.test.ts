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
  it("loads the living-world authority before interaction overrides", () => {
    expect(interactionAuthority.trimStart().startsWith('@import "./strategic-world-foundation.css";')).toBe(true);
  });

  it("keeps a continuous landmass and physical route hierarchy", () => {
    expect(worldAuthority).toContain(".strategic-cells::before");
    expect(worldAuthority).toContain("clip-path: polygon(50% 0, 98.5% 49.5%, 50% 100%, 1.5% 49.5%)");
    expect(worldAuthority).toContain(".strategic-edge.state-road .strategic-edge-asset");
    expect(worldAuthority).toContain("height: 58px !important");
    expect(worldAuthority).toContain(".strategic-edge.state-unbuilt .strategic-edge-asset");
    expect(worldAuthority).toContain("opacity: .035 !important");
  });

  it("adds life without moving interactive hitboxes", () => {
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
