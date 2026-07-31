import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const entrypoint = readFileSync(resolve(currentDirectory, "main.tsx"), "utf8");
const stylesheet = readFileSync(
  resolve(currentDirectory, "strategic-board-territorial-world.css"),
  "utf8",
);

describe("META 08.7 territorial world contract", () => {
  it("loads the canonical token layer and the territorial authority from the entrypoint", () => {
    const canonicalImport = entrypoint.indexOf("strategic-board-canonical-units.css");
    const territorialImport = entrypoint.indexOf("strategic-board-territorial-world.css");

    expect(canonicalImport).toBeGreaterThan(-1);
    expect(territorialImport).toBeGreaterThan(canonicalImport);
  });

  it("composes the four regions over one physical landmass", () => {
    expect(stylesheet).toContain(".strategic-cells::before");
    expect(stylesheet).toContain("width: 44.8% !important");
    expect(stylesheet).toContain("height: 41.8% !important");
    expect(stylesheet).toContain("filter: drop-shadow(0 25px 22px");
  });

  it("keeps roads dominant while empty corridors recede", () => {
    expect(stylesheet).toContain(".strategic-edge.state-road .strategic-edge-asset");
    expect(stylesheet).toContain("height: 50px !important");
    expect(stylesheet).toContain(".strategic-edge.state-unbuilt .strategic-edge-asset");
    expect(stylesheet).toContain("opacity: .055 !important");
  });

  it("preserves deterministic unit tokens after lazy slice CSS injection", () => {
    expect(stylesheet).toContain("clip-path: polygon(");
    expect(stylesheet).toContain("mix-blend-mode: normal !important");
    expect(stylesheet).toContain("animation: none !important");
    expect(stylesheet).not.toContain("mix-blend-mode: multiply");
    expect(stylesheet).not.toContain("mix-blend-mode: screen");
  });
});
