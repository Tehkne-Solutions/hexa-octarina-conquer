import { useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  createStrategicBoard,
  strategicActionBudget,
  strategicAttack,
  strategicAttackTargets,
  strategicBuildStructure,
  strategicBuildTargets,
  strategicCellRoadProgress,
  strategicClaimEdge,
  strategicEnemyTurn,
  strategicMoveTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicResult,
  strategicRoadCount,
  strategicStructureCount,
  strategicStructureTargets,
  strategicUnit,
  type StrategicBoard,
  type StrategicCell,
  type StrategicEdge,
  type StrategicNode,
  type StrategicResult,
  type StrategicUnitId,
} from "./strategic-board-model";
import {
  emptyPack99StrategicCatalog,
  loadPack99StrategicCatalog,
  type Pack99StrategicCatalog,
  type StrategicAssetKey,
} from "./pack99-strategic-catalog";
import "./strategic-board-slice.css";

interface StrategicBoardSliceProps {
  playerName: string;
  onBack: () => void;
}

type ActionMode = "road" | "move" | "structure" | "attack";

const FRIENDLY_UNITS: StrategicUnitId[] = ["kael", "lyra"];
const UNIT_ASSET_KEY: Record<StrategicUnitId, "kael" | "lyra" | "varg" | "brakk"> = {
  kael: "kael",
  lyra: "lyra",
  varg: "varg",
  brakk: "brakk",
};

function nodePoint(node: StrategicNode): CSSProperties {
  return {
    left: `${50 + (node.col - node.row) * 20}%`,
    top: `${14 + (node.col + node.row) * 17.5}%`,
  };
}

function cellPoint(cell: StrategicCell): CSSProperties {
  return {
    left: `${50 + (cell.col - cell.row) * 20}%`,
    top: `${31.5 + (cell.col + cell.row) * 17.5}%`,
  };
}

function edgeStyle(edge: StrategicEdge, nodeIndex: Map<string, StrategicNode>): CSSProperties {
  const a = nodeIndex.get(edge.a)!;
  const b = nodeIndex.get(edge.b)!;
  const start = { x: 50 + (a.col - a.row) * 20, y: 14 + (a.col + a.row) * 17.5 };
  const end = { x: 50 + (b.col - b.row) * 20, y: 14 + (b.col + b.row) * 17.5 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return {
    left: `${(start.x + end.x) / 2}%`,
    top: `${(start.y + end.y) / 2}%`,
    width: `${Math.hypot(dx, dy)}%`,
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
    "--edge-rotation": `${angle}deg`,
  } as CSSProperties;
}

function actionLabel(mode: ActionMode): string {
  if (mode === "road") return "CONSTRUIR ESTRADA";
  if (mode === "move") return "MOVER";
  if (mode === "structure") return "EDIFICAR";
  return "ATACAR";
}

function resultTitle(result: StrategicResult): string {
  if (result === "victory") return "Orun consolidou a fronteira";
  if (result === "defeat") return "A Legião rompeu a Convergência";
  return "";
}

function otherEdgeNode(edge: StrategicEdge, originNodeId: string): string | null {
  if (edge.a === originNodeId) return edge.b;
  if (edge.b === originNodeId) return edge.a;
  return null;
}

function recommendedAction(board: StrategicBoard, unitId: StrategicUnitId): ActionMode {
  const unit = strategicUnit(board, unitId);
  if (unit.faction !== "blue" || unit.hp <= 0) return "road";
  if (strategicStructureTargets(board, unitId).length > 0) return "structure";
  if (strategicAttackTargets(board, unitId).length > 0) return "attack";
  if (strategicBuildTargets(board, unitId).length > 0) return "road";
  if (strategicMoveTargets(board, unitId).length > 0) return "move";
  return "road";
}

function cellAsset(cell: StrategicCell, catalog: Pack99StrategicCatalog): string | null {
  if (cell.biome === "forest") return catalog.forest ?? catalog.grass;
  if (cell.biome === "water") return catalog.water ?? catalog.grass;
  return catalog.grass;
}

function sceneryAsset(cell: StrategicCell): StrategicAssetKey {
  if (cell.biome === "water") return "bridge";
  if (cell.biome === "forest") return "rocks";
  if (cell.biome === "rock") return "ruins";
  return "sanctuary";
}

export function StrategicBoardSlice({ playerName, onBack }: StrategicBoardSliceProps) {
  const initialBoard = useMemo(() => createStrategicBoard(), []);
  const [board, setBoard] = useState<StrategicBoard>(initialBoard);
  const [catalog, setCatalog] = useState<Pack99StrategicCatalog>(emptyPack99StrategicCatalog());
  const [selectedUnitId, setSelectedUnitId] = useState<StrategicUnitId>("kael");
  const [mode, setMode] = useState<ActionMode>("road");
  const [round, setRound] = useState(1);
  const [actions, setActions] = useState(3);
  const [messages, setMessages] = useState<string[]>([
    "Kael está no Entroncamento Central. Construa a estrada dourada até o Vau Octarino.",
  ]);

  useEffect(() => {
    let active = true;
    void loadPack99StrategicCatalog().then((next) => {
      if (active) setCatalog(next);
    });
    return () => { active = false; };
  }, []);

  const nodeIndex = useMemo(() => new Map(board.nodes.map((node) => [node.id, node])), [board.nodes]);
  const selectedUnit = strategicUnit(board, selectedUnitId);
  const selectedNode = nodeIndex.get(selectedUnit.nodeId)!;
  const roadTargets = useMemo(() => new Set(strategicBuildTargets(board, selectedUnitId)), [board, selectedUnitId]);
  const moveTargets = useMemo(() => new Set(strategicMoveTargets(board, selectedUnitId)), [board, selectedUnitId]);
  const attackTargets = useMemo(() => new Set(strategicAttackTargets(board, selectedUnitId)), [board, selectedUnitId]);
  const structureTargets = useMemo(() => new Set(strategicStructureTargets(board, selectedUnitId)), [board, selectedUnitId]);

  const result = strategicResult(board);
  const blueCells = strategicOwnedCellCount(board, "blue");
  const redCells = strategicOwnedCellCount(board, "red");
  const blueStructures = strategicStructureCount(board, "blue");
  const blueRoads = strategicRoadCount(board, "blue");
  const defeatedEnemies = board.units.filter((unit) => unit.faction === "red" && unit.hp <= 0).length;
  const resolvedAssets = Object.values(catalog).filter(Boolean).length;
  const assetTotal = Object.keys(catalog).length;

  function pushMessage(message: string): void {
    setMessages((current) => [message, ...current].slice(0, 3));
  }

  function consumeAction(nextBoard: StrategicBoard): void {
    setBoard(nextBoard);
    setActions((value) => Math.max(0, value - 1));
  }

  function targetCount(action: ActionMode): number {
    if (action === "road") return roadTargets.size;
    if (action === "move") return moveTargets.size;
    if (action === "structure") return structureTargets.size;
    return attackTargets.size;
  }

  function selectUnit(unitId: StrategicUnitId): void {
    const unit = strategicUnit(board, unitId);
    if (unit.hp <= 0 || result !== "playing") return;

    if (unit.faction === "red") {
      if (mode === "attack" && attackTargets.has(unitId) && actions > 0) {
        const next = strategicAttack(board, selectedUnitId, unitId);
        consumeAction(next);
        setMode(recommendedAction(next, selectedUnitId));
        pushMessage(`${selectedUnit.name} atacou ${unit.name} pela estrada que liga os dois postos.`);
      } else {
        pushMessage(`${unit.name} só pode ser atacado por uma estrada construída entre os dois postos.`);
      }
      return;
    }

    setSelectedUnitId(unitId);
    const nextMode = recommendedAction(board, unitId);
    setMode(nextMode);
    pushMessage(`${unit.name} selecionado em ${nodeIndex.get(unit.nodeId)?.name}. ${actionLabel(nextMode)} está disponível.`);
  }

  function clickNode(nodeId: string): void {
    if (result !== "playing" || actions <= 0) return;

    if (mode === "road" && roadTargets.has(nodeId)) {
      const next = strategicClaimEdge(board, selectedUnitId, nodeId);
      consumeAction(next);

      const closedRegions = strategicStructureTargets(next, selectedUnitId);
      if (closedRegions.length > 0) {
        setMode("structure");
        pushMessage("A rede fechou uma região. O slot de edificação foi liberado no centro do território.");
      } else if (strategicMoveTargets(next, selectedUnitId).includes(nodeId)) {
        setMode("move");
        pushMessage(`Estrada concluída até ${nodeIndex.get(nodeId)?.name}. Clique nela novamente para mover.`);
      } else {
        const nextMode = recommendedAction(next, selectedUnitId);
        setMode(nextMode);
        pushMessage(`Estrada concluída até ${nodeIndex.get(nodeId)?.name}.`);
      }
      return;
    }

    if (mode === "move" && moveTargets.has(nodeId)) {
      const next = strategicMoveUnit(board, selectedUnitId, nodeId);
      consumeAction(next);
      const nextMode = recommendedAction(next, selectedUnitId);
      setMode(nextMode);
      pushMessage(`${selectedUnit.name} percorreu a estrada e ocupou ${nodeIndex.get(nodeId)?.name}.`);
      return;
    }

    const node = nodeIndex.get(nodeId);
    pushMessage(`${node?.name ?? "Esse posto"} não é um destino válido para ${actionLabel(mode).toLowerCase()}.`);
  }

  function clickCell(cellId: string): void {
    if (result !== "playing" || actions <= 0) return;

    if (mode !== "structure" || !structureTargets.has(cellId)) {
      const cell = board.cells.find((entry) => entry.id === cellId);
      pushMessage(`${cell?.name ?? "A região"} precisa de quatro estradas da mesma facção e de um herói em um de seus postos.`);
      return;
    }

    const next = strategicBuildStructure(board, selectedUnitId, cellId, "bastion");
    consumeAction(next);
    setMode(recommendedAction(next, selectedUnitId));
    pushMessage("Bastião erguido. A região agora gera +1 ação no início das próximas rodadas.");
  }

  function endTurn(): void {
    if (result !== "playing") return;

    const enemy = strategicEnemyTurn(board);
    setBoard(enemy.board);
    setRound((value) => value + 1);
    setActions(strategicActionBudget(enemy.board, "blue"));

    const survivor = FRIENDLY_UNITS.find((id) => strategicUnit(enemy.board, id).hp > 0) ?? "kael";
    setSelectedUnitId(survivor);
    setMode(recommendedAction(enemy.board, survivor));
    pushMessage(`${enemy.message} Rodada ${round + 1}: ${strategicActionBudget(enemy.board, "blue")} ações.`);
  }

  function restart(): void {
    setBoard(initialBoard);
    setSelectedUnitId("kael");
    setMode("road");
    setRound(1);
    setActions(3);
    setMessages(["Nova campanha iniciada. Construa a estrada dourada até o Vau Octarino."]);
  }

  return <main className="strategic-slice meta08-roads">
    <header className="strategic-topbar">
      <button type="button" className="strategic-menu" onClick={onBack} aria-label="Voltar">☰</button>
      <div className="strategic-title">
        <small>META 08 · REDE E TERRITÓRIO</small>
        <strong>Fronteira da Convergência</strong>
      </div>
      <div className="strategic-turn">
        <small>RODADA {round}</small>
        <strong>{result === "playing" ? "SEU TURNO" : result === "victory" ? "VITÓRIA" : "DERROTA"}</strong>
      </div>
      <div className="strategic-resources">
        <span>◈ 1870</span><span>◆ 660</span><span>✦ {actions}/{strategicActionBudget(board, "blue")}</span>
      </div>
    </header>

    <section className="strategic-layout">
      <aside className="strategic-roster">
        <h2>{playerName}</h2>
        {board.units.map((unit) => <button
          key={unit.id}
          type="button"
          disabled={unit.hp <= 0}
          className={`strategic-roster-card owner-${unit.faction} ${selectedUnitId === unit.id ? "is-selected" : ""}`}
          onClick={() => selectUnit(unit.id)}
        >
          <span className="strategic-roster-icon">{unit.name.slice(0, 1)}</span>
          <span><b>{unit.name}</b><small>{unit.role}</small></span>
          <em>{unit.hp}/{unit.maxHp}</em>
        </button>)}

        <div className="strategic-actions" role="group" aria-label="Ações estratégicas">
          {(["road", "move", "structure", "attack"] as ActionMode[]).map((action) => {
            const count = targetCount(action);
            const unavailable = result !== "playing"
              || actions <= 0
              || selectedUnit.faction !== "blue"
              || count <= 0;
            return <button
              key={action}
              type="button"
              disabled={unavailable}
              className={mode === action ? "is-active" : ""}
              onClick={() => {
                setMode(action);
                pushMessage(`${actionLabel(action)}: escolha um alvo iluminado no mapa.`);
              }}
            >
              <b>{actionLabel(action)}</b><span>{count}</span>
            </button>;
          })}
        </div>

        <div className="strategic-help">
          <small>UNIDADE ATIVA</small>
          <b>{selectedUnit.name} · {selectedNode.name}</b>
          <small>AÇÃO ATUAL</small>
          <strong>{actionLabel(mode)}</strong>
          <p>{messages[0]}</p>
        </div>
      </aside>

      <section className="strategic-board" aria-label="Tabuleiro estratégico META 08">
        <div className="strategic-world-light" />
        <div className="strategic-map-key">
          <span className="key-unbuilt">CORREDOR</span>
          <span className="key-road">ESTRADA</span>
          <span className="key-wall">FRONTEIRA FECHADA</span>
        </div>

        <div className="strategic-cells">
          {board.cells.map((cell, index) => {
            const asset = cellAsset(cell, catalog);
            const canBuild = mode === "structure" && structureTargets.has(cell.id) && actions > 0;
            const blueProgress = strategicCellRoadProgress(board, cell.id, "blue");
            const redProgress = strategicCellRoadProgress(board, cell.id, "red");
            const progress = Math.max(blueProgress, redProgress);
            const progressOwner = blueProgress >= redProgress ? "blue" : "red";

            return <button
              key={cell.id}
              type="button"
              className={`strategic-cell biome-${cell.biome} owner-${cell.owner ?? "neutral"} ${canBuild ? "is-build-target" : ""}`}
              style={{ ...cellPoint(cell), ...(asset ? { backgroundImage: `url(${asset})` } : {}) }}
              onClick={() => clickCell(cell.id)}
              aria-label={canBuild ? `Construir Bastião em ${cell.name}` : cell.name}
            >
              <span className="strategic-cell-tint" />
              {cell.owner ? <span className={`strategic-territory-wall owner-${cell.owner}`} /> : null}
              <small>REGIÃO {String.fromCharCode(65 + index)}</small>
              <strong>{cell.name}</strong>
              <span className={`strategic-region-progress owner-${progressOwner}`}>{progress}/4 estradas</span>
              {!cell.structure && cell.owner ? <i className="strategic-building-slot">SLOT DE EDIFICAÇÃO</i> : null}
              {canBuild ? <b>ERGUEr BASTIÃO</b> : null}
            </button>;
          })}
        </div>

        <div className="strategic-scenery" aria-hidden="true">
          {board.cells.map((cell) => {
            const source = catalog[sceneryAsset(cell)];
            return source ? <span
              key={cell.id}
              className={`strategic-scenery-prop biome-${cell.biome}`}
              style={cellPoint(cell)}
            >
              <img src={source} alt="" draggable={false} />
            </span> : null;
          })}
        </div>

        <div className="strategic-edges">
          {board.edges.map((edge) => {
            const targetNode = otherEdgeNode(edge, selectedUnit.nodeId);
            const roadTarget = edge.state === "unbuilt" && Boolean(targetNode && roadTargets.has(targetNode));
            const moveRoute = edge.state === "road"
              && Boolean(targetNode && moveTargets.has(targetNode));

            return <button
              key={edge.id}
              type="button"
              className={[
                "strategic-edge",
                `state-${edge.state}`,
                `owner-${edge.owner ?? "neutral"}`,
                roadTarget ? "is-road-target" : "",
                moveRoute ? "is-move-route" : "",
              ].filter(Boolean).join(" ")}
              style={edgeStyle(edge, nodeIndex)}
              onClick={() => {
                if ((roadTarget || moveRoute) && targetNode) clickNode(targetNode);
              }}
              disabled={!roadTarget && !moveRoute}
              aria-label={roadTarget
                ? `Construir estrada até ${targetNode ? nodeIndex.get(targetNode)?.name : "o posto"}`
                : moveRoute
                  ? `Mover para ${targetNode ? nodeIndex.get(targetNode)?.name : "o posto"}`
                  : edge.state === "road" ? "Estrada construída" : "Corredor sem estrada"}
            >
              <span className="strategic-road-shadow" />
              <span className="strategic-road-bed" />
              <span className="strategic-road-stones" />
              {roadTarget ? <b>CONSTRUIR</b> : moveRoute ? <b>MOVER</b> : null}
            </button>;
          })}
        </div>

        <div className="strategic-structures">
          {board.cells.map((cell) => {
            if (!cell.structure) return null;
            const source = cell.structure.type === "bastion" ? catalog.bastion : catalog.watchtower;
            return <div key={cell.id} className={`strategic-structure owner-${cell.structure.owner}`} style={cellPoint(cell)}>
              {source ? <img src={source} alt="" draggable={false} /> : <span>⌂</span>}
              <b>{cell.structure.type === "bastion" ? "Bastião" : "Torre Rubra"}</b>
            </div>;
          })}
        </div>

        <div className="strategic-nodes">
          {board.nodes.map((node, index) => {
            const unit = board.units.find((entry) => entry.hp > 0 && entry.nodeId === node.id);
            const roadTarget = mode === "road" && roadTargets.has(node.id) && actions > 0;
            const moveTarget = mode === "move" && moveTargets.has(node.id) && actions > 0;
            const isOrigin = selectedUnit.nodeId === node.id;

            return <button
              key={node.id}
              type="button"
              title={node.name}
              className={[
                "strategic-node",
                roadTarget ? "is-road-target" : "",
                moveTarget ? "is-move-target" : "",
                unit ? "is-occupied" : "",
                isOrigin ? "is-origin" : "",
              ].filter(Boolean).join(" ")}
              style={nodePoint(node)}
              onClick={() => clickNode(node.id)}
              aria-label={roadTarget
                ? `Construir estrada até ${node.name}`
                : moveTarget ? `Mover para ${node.name}` : node.name}
            >
              <span className="strategic-node-pad" />
              {catalog.pillar ? <img
                src={roadTarget || moveTarget || isOrigin ? catalog.pillarSelected ?? catalog.pillar : catalog.pillar}
                alt=""
                draggable={false}
              /> : <span className="strategic-node-fallback" />}
              <small>P{index + 1}</small>
              <em>{node.name}</em>
              {roadTarget ? <b>DESTINO</b> : moveTarget ? <b>MOVER</b> : isOrigin ? <b>ORIGEM</b> : null}
            </button>;
          })}
        </div>

        <div className="strategic-units">
          {board.units.filter((unit) => unit.hp > 0).map((unit) => {
            const node = nodeIndex.get(unit.nodeId)!;
            const source = catalog[UNIT_ASSET_KEY[unit.id]];
            const attackable = unit.faction === "red"
              && mode === "attack"
              && attackTargets.has(unit.id)
              && actions > 0;

            return <button
              key={unit.id}
              type="button"
              className={`strategic-unit owner-${unit.faction} ${selectedUnitId === unit.id ? "is-selected" : ""} ${attackable ? "is-attack-target" : ""}`}
              style={nodePoint(node)}
              onClick={() => selectUnit(unit.id)}
              aria-label={`${unit.name}, ${unit.hp} de vida`}
            >
              <span className="strategic-unit-ring" />
              {source
                ? <img className="strategic-unit-image" src={source} alt="" draggable={false} />
                : <span className="strategic-unit-fallback">{unit.name.slice(0, 1)}</span>}
              <b>{unit.name}</b>
              <small><i style={{ width: `${unit.hp / unit.maxHp * 100}%` }} />{unit.hp}/{unit.maxHp}</small>
              {attackable ? <em>ATACAR</em> : null}
            </button>;
          })}
        </div>

        <div className={`strategic-board-status ${resolvedAssets === assetTotal ? "is-ready" : "is-incomplete"}`}>
          PACK 99 · {resolvedAssets}/{assetTotal}
        </div>

        {result !== "playing" ? <div className={`strategic-result is-${result}`}>
          <small>CONFRONTO ENCERRADO</small>
          <h2>{resultTitle(result)}</h2>
          <p>{result === "victory"
            ? "A rede foi consolidada, um Bastião foi erguido e a força Rubra sofreu uma baixa."
            : "A Legião Rubra consolidou a fronteira."}</p>
          <button type="button" onClick={restart}>JOGAR NOVAMENTE</button>
        </div> : null}
      </section>

      <aside className="strategic-objectives">
        <small>OBJETIVO PRINCIPAL</small>
        <h2>Formar a Fronteira</h2>
        <p>Construa a rede, domine duas regiões, erga um Bastião e derrote uma unidade Rubra.</p>

        <div className="strategic-progress">
          <div><span style={{ width: `${Math.min(100, blueRoads / 6 * 100)}%` }} /><b>Estradas {blueRoads}/6</b></div>
          <div><span style={{ width: `${Math.min(100, blueCells / 2 * 100)}%` }} /><b>Regiões {blueCells}/2</b></div>
          <div><span style={{ width: `${Math.min(100, blueStructures * 100)}%` }} /><b>Bastiões {blueStructures}/1</b></div>
          <div><span style={{ width: `${Math.min(100, defeatedEnemies * 100)}%` }} /><b>Baixas Rubras {defeatedEnemies}/1</b></div>
        </div>

        <div className="strategic-score">
          <span className="owner-blue">Orun <b>{blueCells}</b></span>
          <span className="owner-red">Rubra <b>{redCells}</b></span>
        </div>

        <small>REGISTRO DE TURNO</small>
        <ol>{messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ol>

        <button
          type="button"
          className="strategic-end-turn"
          onClick={endTurn}
          disabled={result !== "playing"}
        >
          ENCERRAR TURNO
        </button>
      </aside>
    </section>
  </main>;
}
