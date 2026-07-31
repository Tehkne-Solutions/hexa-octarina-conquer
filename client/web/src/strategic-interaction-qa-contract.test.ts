import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const entrypoint = readFileSync(resolve(currentDirectory, "main.tsx"), "utf8");
const boardSlice = readFileSync(resolve(currentDirectory, "StrategicBoardSlice.tsx"), "utf8");
const stylesheet = readFileSync(
  resolve(currentDirectory, "strategic-board-interaction-qa.css"),
  "utf8",
);

describe("META 08.8 strategic interaction QA contract", () => {
  it("loads the interaction authority after the territorial world authority", () => {
    const territorialIndex = entrypoint.indexOf("strategic-board-territorial-world.css");
    const interactionIndex = entrypoint.indexOf("strategic-board-interaction-qa.css");

    expect(territorialIndex).toBeGreaterThan(-1);
    expect(interactionIndex).toBeGreaterThan(territorialIndex);
  });

  it("keeps decorative layers out of board hit testing", () => {
    expect(stylesheet).toContain(".strategic-cells {");
    expect(stylesheet).toContain(".strategic-cell.is-build-target");
    expect(stylesheet).toContain(".strategic-edge:not(:disabled)");
    expect(stylesheet).toContain(".strategic-node.is-road-target");
    expect(stylesheet).toContain(".strategic-node.is-move-target");
    expect(stylesheet).toContain(".strategic-unit {");
    expect(stylesheet).toContain("pointer-events: none !important");
    expect(stylesheet).toContain("pointer-events: auto !important");
  });

  it("removes inactive nodes from keyboard interaction", () => {
    expect(boardSlice).toContain("const nodeActionable = roadTarget || moveTarget");
    expect(boardSlice).toContain("disabled={!nodeActionable}");
    expect(boardSlice).toContain("tabIndex={nodeActionable ? 0 : -1}");
    expect(boardSlice).toContain("aria-disabled={!nodeActionable}");
  });

  it("provides larger actionable targets and keyboard focus", () => {
    expect(stylesheet).toContain("min-height: 62px");
    expect(stylesheet).toContain("min-width: 104px");
    expect(stylesheet).toContain("min-width: 118px");
    expect(stylesheet).toContain(":focus-visible");
    expect(stylesheet).toContain("touch-action: manipulation");
  });

  it("fits notebook viewports without cutting the board or command panels", () => {
    expect(stylesheet).toContain("height: 100dvh !important");
    expect(stylesheet).toContain("height: calc(100dvh - 58px)");
    expect(stylesheet).toContain("@media (max-width: 1366px) and (min-width: 901px)");
    expect(stylesheet).toContain("@media (max-height: 800px) and (min-width: 901px)");
    expect(stylesheet).toContain("@media (max-width: 900px)");
  });
});
