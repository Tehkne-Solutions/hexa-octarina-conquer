import { Board } from "./Board";
import { BOARD_THEMES, type BoardThemeId } from "./board-theme";
import { GoDotsBoard } from "./GoDotsBoard";
import type { ClaimedCell, InfluenceEdge } from "./go-dots-logic";
import { createLivingTiles, INITIAL_LIVING_UNITS } from "./living-board-data";
import { buildReplayFrames, createQaReplayRecord } from "./replay-state";

const livingEdges: InfluenceEdge[] = [
  { id: "1,3|2,3", start: { x: 1, y: 3 }, end: { x: 2, y: 3 }, owner: "player" },
  { id: "2,3|3,3", start: { x: 2, y: 3 }, end: { x: 3, y: 3 }, owner: "player" },
  { id: "4,2|5,2", start: { x: 4, y: 2 }, end: { x: 5, y: 2 }, owner: "enemy" },
  { id: "5,1|5,2", start: { x: 5, y: 1 }, end: { x: 5, y: 2 }, owner: "enemy" },
  { id: "1,4|2,4", start: { x: 1, y: 4 }, end: { x: 2, y: 4 }, owner: "player" },
  { id: "1,3|1,4", start: { x: 1, y: 3 }, end: { x: 1, y: 4 }, owner: "player" },
  { id: "2,3|2,4", start: { x: 2, y: 3 }, end: { x: 2, y: 4 }, owner: "player" },
];

const livingCells: ClaimedCell[] = [{ id: "1,3", x: 1, y: 3, owner: "player" }];
const replaySnapshot = buildReplayFrames(createQaReplayRecord()).at(-1)?.snapshot;

function QaHeader({ theme, context }: { theme: BoardThemeId; context: string }) {
  const definition = BOARD_THEMES[theme];
  return (
    <header className="ui13-qa-header">
      <div>
        <small>SPRINT UI 13 · {context}</small>
        <h1>{definition.title}</h1>
        <p>{definition.region} · {definition.atmosphere}</p>
      </div>
      <span>{definition.emblem} Tehkné Solutions</span>
    </header>
  );
}

function LivingBoardScene({ theme }: { theme: BoardThemeId }) {
  return (
    <main className="ui13-qa-scene" data-board-theme={theme}>
      <QaHeader theme={theme} context="COMBATE VIVO" />
      <section className="ui13-board-stage living-stage" data-board-theme={theme}>
        <GoDotsBoard
          tiles={createLivingTiles()}
          units={INITIAL_LIVING_UNITS.map((unit) => ({ ...unit, deck: [...unit.deck] }))}
          selectedUnitId="kael"
          validNodeIds={new Set(["2,2", "2,4", "1,3"])}
          recommendedNodeId="2,2"
          objectiveTargetId="5,1"
          influenceEdges={livingEdges}
          claimedCells={livingCells}
          building={theme === "ash-fortress" ? "tower" : theme === "prismatic-ruins" ? "farm" : null}
          disabled
          onNodeClick={() => undefined}
        />
      </section>
    </main>
  );
}

function ReplayBoardScene({ theme }: { theme: BoardThemeId }) {
  if (!replaySnapshot) return null;
  return (
    <main className="ui13-qa-scene replay-scene" data-board-theme={theme}>
      <QaHeader theme={theme} context="REPLAY PÚBLICO" />
      <section className="ui13-replay-frame">
        <div className="ui13-replay-meta"><span>REVISÃO 5</span><strong>Território confirmado</strong><small>Visão pública · mãos protegidas</small></div>
        <div className="ui13-board-stage replay-stage" data-board-theme={theme}>
          <Board
            snapshot={replaySnapshot}
            localPlayerId={null}
            disabled
            onPlayEdge={() => undefined}
            onSelectProvince={() => undefined}
            selectedProvinceId="province-1"
          />
        </div>
      </section>
    </main>
  );
}

export function SprintUi13BoardQa({ scene }: { scene: string }) {
  if (scene.includes("prismatic")) return <ReplayBoardScene theme="prismatic-ruins" />;
  if (scene.includes("ash")) return <LivingBoardScene theme="ash-fortress" />;
  return <LivingBoardScene theme="orun-mill" />;
}
