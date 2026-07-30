import { useEffect, useMemo, useState } from "react";

import {
  createStrategicBoard,
  strategicActionBudget,
  strategicAttack,
  strategicAttackTargets,
  strategicBuildStructure,
  strategicBuildTargets,
  strategicClaimEdge,
  strategicEnemyTurn,
  strategicMoveTargets,
  strategicMoveUnit,
  strategicOwnedCellCount,
  strategicResult,
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
} from "./pack99-strategic-catalog";
import "./strategic-board-slice.css";

interface StrategicBoardSliceProps {
  playerName: string;
  onBack: () => void;
}

type ActionMode = "wall" | "move" | "structure" | "attack";

const FRIENDLY_UNITS: StrategicUnitId[] = ["kael", "lyra"];
const UNIT_ASSET_KEY: Record<StrategicUnitId, "kael" | "lyra" | "varg" | "brakk"> = {
  kael: "kael",
  lyra: "lyra",
  varg: "varg",
  brakk: "brakk",
};

function nodePoint(node: StrategicNode): { left: string; top: string } {
  return {
    left: `${50 + (node.col - node.row) * 17}%`,
    top: `${15 + (node.col + node.row) * 16}%`,
  };
}

function cellPoint(cell: StrategicCell): { left: string; top: string } {
  return {
    left: `${50 + (cell.col - cell.row) * 17}%`,
    top: `${31 + (cell.col + cell.row) * 16}%`,
  };
}

function edgeStyle(edge: StrategicEdge, nodeIndex: Map<string, StrategicNode>): React.CSSProperties {
  const a = nodeIndex.get(edge.a)!;
  const b = nodeIndex.get(edge.b)!;
  const start = { x: 50 + (a.col - a.row) * 17, y: 15 + (a.col + a.row) * 16 };
  const end = { x: 50 + (b.col - b.row) * 17, y: 15 + (b.col + b.row) * 16 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    left: `${(start.x + end.x) / 2}%`,
    top: `${(start.y + end.y) / 2}%`,
    width: `${Math.hypot(dx, dy)}%`,
    transform: `translate(-50%, -50%) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`,
  };
}

function cellAsset(cell: StrategicCell, catalog: Pack99StrategicCatalog): string | null {
  if (cell.row === 0 && cell.col === 1) return catalog.forest ?? catalog.grass;
  if (cell.row === 1 && cell.col === 1) return catalog.water ?? catalog.grass;
  return catalog.grass;
}

function actionLabel(mode: ActionMode): string {
  if (mode === "wall") return "ERGUEr MURO";
  if (mode === "move") return "MOVER";
  if (mode === "structure") return "EDIFICAR";
  return "ATACAR";
}

function resultTitle(result: StrategicResult): string {
  if (result === "victory") return "Orun consolidou a fronteira";
  if (result === "defeat") return "A Legião rompeu a Convergência";
  return "";
}

export function StrategicBoardSlice({ playerName, onBack }: StrategicBoardSliceProps) {
  const initialBoard = useMemo(() => createStrategicBoard(), []);
  const [board, setBoard] = useState<StrategicBoard>(initialBoard);
  const [catalog, setCatalog] = useState<Pack99StrategicCatalog>(emptyPack99StrategicCatalog());
  const [selectedUnitId, setSelectedUnitId] = useState<StrategicUnitId>("kael");
  const [mode, setMode] = useState<ActionMode>("wall");
  const [round, setRound] = useState(1);
  const [actions, setActions] = useState(3);
  const [messages, setMessages] = useState<string[]>([
    "Kael está no nó central. Feche a célula azul erguendo o muro destacado.",
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
  const wallTargets = useMemo(() => new Set(strategicBuildTargets(board, selectedUnitId)), [board, selectedUnitId]);
  const moveTargets = useMemo(() => new Set(strategicMoveTargets(board, selectedUnitId)), [board, selectedUnitId]);
  const attackTargets = useMemo(() => new Set(strategicAttackTargets(board, selectedUnitId)), [board, selectedUnitId]);
  const structureTargets = useMemo(() => new Set(strategicStructureTargets(board, selectedUnitId)), [board, selectedUnitId]);
  const result = strategicResult(board);
  const blueCells = strategicOwnedCellCount(board, "blue");
  const redCells = strategicOwnedCellCount(board, "red");
  const blueStructures = strategicStructureCount(board, "blue");
  const resolvedAssets = Object.values(catalog).filter(Boolean).length;

  function pushMessage(message: string): void {
    setMessages((current) => [message, ...current].slice(0, 4));
  }

  function consumeAction(nextBoard: StrategicBoard): void {
    setBoard(nextBoard);
    setActions((value) => Math.max(0, value - 1));
  }

  function selectUnit(unitId: StrategicUnitId): void {
    const unit = strategicUnit(board, unitId);
    if (unit.hp <= 0 || result !== "playing") return;
    if (unit.faction === "red") {
      if (mode === "attack" && attackTargets.has(unitId) && actions > 0) {
        const next = strategicAttack(board, selectedUnitId, unitId);
        consumeAction(next);
        pushMessage(`${selectedUnit.name} atacou ${unit.name}.`);
      } else {
        pushMessage(`${unit.name} só pode ser atacado quando estiver adjacente ao herói selecionado.`);
      }
      return;
    }
    setSelectedUnitId(unitId);
    setMode("wall");
    pushMessage(`${unit.name} selecionado. Escolha uma ação e um alvo iluminado.`);
  }

  function clickNode(nodeId: string): void {
    if (result !== "playing" || actions <= 0) return;
    if (mode === "wall" && wallTargets.has(nodeId)) {
      const next = strategicClaimEdge(board, selectedUnitId, nodeId);
      consumeAction(next);
      const nextStructures = strategicStructureTargets(next, selectedUnitId);
      if (nextStructures.length > 0) {
        setMode("structure");
        pushMessage("Célula dominada. Agora clique no território azul para erguer um Bastião.");
      } else {
        setMode("move");
        pushMessage("Muralha concluída. Use MOVER para atravessar a conexão azul.");
      }
      return;
    }
    if (mode === "move" && moveTargets.has(nodeId)) {
      const next = strategicMoveUnit(board, selectedUnitId, nodeId);
      consumeAction(next);
      pushMessage(`${selectedUnit.name} ocupou um novo nó estratégico.`);
      return;
    }
    pushMessage("Esse nó não é um alvo válido para a ação atual.");
  }

  function clickCell(cellId: string): void {
    if (result !== "playing" || actions <= 0) return;
    if (mode !== "structure" || !structureTargets.has(cellId)) {
      pushMessage("Primeiro feche os quatro lados da célula e mantenha um herói em um de seus nós.");
      return;
    }
    const next = strategicBuildStructure(board, selectedUnitId, cellId, "bastion");
    consumeAction(next);
    setMode("move");
    pushMessage("Bastião erguido. Ele concederá +1 ação nas próximas rodadas.");
  }

  function endTurn(): void {
    if (result !== "playing") return;
    const enemy = strategicEnemyTurn(board);
    setBoard(enemy.board);
    setRound((value) => value + 1);
    setActions(strategicActionBudget(enemy.board, "blue"));
    const survivor = FRIENDLY_UNITS.find((id) => strategicUnit(enemy.board, id).hp > 0) ?? "kael";
    setSelectedUnitId(survivor);
    setMode("wall");
    pushMessage(`${enemy.message} Rodada ${round + 1}: ${strategicActionBudget(enemy.board, "blue")} ações.`);
  }

  function restart(): void {
    setBoard(initialBoard);
    setSelectedUnitId("kael");
    setMode("wall");
    setRound(1);
    setActions(3);
    setMessages(["Nova campanha iniciada. Feche a primeira célula azul."]);
  }

  return <main className="strategic-slice">
    <header className="strategic-topbar">
      <button type="button" className="strategic-menu" onClick={onBack} aria-label="Voltar">☰</button>
      <div className="strategic-title"><small>META 07 · VERTICAL SLICE ESTRATÉGICO</small><strong>Fronteira da Convergência</strong></div>
      <div className="strategic-turn"><small>RODADA {round}</small><strong>{result === "playing" ? "SEU TURNO" : result === "victory" ? "VITÓRIA" : "DERROTA"}</strong></div>
      <div className="strategic-resources"><span>◈ 1870</span><span>◆ 660</span><span>✦ {actions}/{strategicActionBudget(board, "blue")}</span></div>
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
          {(["wall", "move", "structure", "attack"] as ActionMode[]).map((action) => {
            const targetCount = action === "wall" ? wallTargets.size : action === "move" ? moveTargets.size : action === "structure" ? structureTargets.size : attackTargets.size;
            return <button
              key={action}
              type="button"
              disabled={result !== "playing" || actions <= 0 || selectedUnit.faction !== "blue"}
              className={mode === action ? "is-active" : ""}
              onClick={() => { setMode(action); pushMessage(`${actionLabel(action)} selecionado: escolha um alvo iluminado.`); }}
            >
              <b>{actionLabel(action)}</b><span>{targetCount}</span>
            </button>;
          })}
        </div>

        <div className="strategic-help">
          <small>AÇÃO ATUAL</small>
          <b>{actionLabel(mode)}</b>
          <p>{messages[0]}</p>
        </div>
      </aside>

      <section className="strategic-board" aria-label="Tabuleiro estratégico META 07">
        <div className="strategic-world-light" />

        <div className="strategic-cells">
          {board.cells.map((cell) => {
            const asset = cellAsset(cell, catalog);
            const canBuild = mode === "structure" && structureTargets.has(cell.id) && actions > 0;
            return <button
              key={cell.id}
              type="button"
              className={`strategic-cell owner-${cell.owner ?? "neutral"} ${canBuild ? "is-build-target" : ""}`}
              style={{ ...cellPoint(cell), ...(asset ? { backgroundImage: `url(${asset})` } : {}) }}
              onClick={() => clickCell(cell.id)}
              aria-label={canBuild ? "Construir Bastião nesta célula" : `Célula ${cell.id}`}
            >
              <span className="strategic-cell-tint" />
              {cell.owner ? <small>{cell.owner === "blue" ? "ORUN" : "RUBRA"}</small> : null}
              {canBuild ? <b>EDIFICAR</b> : null}
            </button>;
          })}
        </div>

        <div className="strategic-edges">
          {board.edges.map((edge) => {
            const a = nodeIndex.get(edge.a)!;
            const b = nodeIndex.get(edge.b)!;
            const rising = (a.col - b.col) === 0;
            const edgeAsset = rising ? catalog.edgeNeSw : catalog.edgeNwSe;
            const active = edge.owner === null && wallTargets.has(edge.a === selectedUnit.nodeId ? edge.b : edge.a);
            return <span
              key={edge.id}
              className={`strategic-edge owner-${edge.owner ?? "neutral"} ${active ? "is-wall-target" : ""}`}
              style={edgeStyle(edge, nodeIndex)}
            >{edgeAsset ? <img src={edgeAsset} alt="" draggable={false} /> : null}</span>;
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
          <div className="strategic-sanctuary" style={cellPoint(board.cells[0])} aria-hidden="true">
            {catalog.sanctuary ? <img src={catalog.sanctuary} alt="" draggable={false} /> : null}
          </div>
        </div>

        <div className="strategic-nodes">
          {board.nodes.map((node) => {
            const unit = board.units.find((entry) => entry.hp > 0 && entry.nodeId === node.id);
            const wallTarget = mode === "wall" && wallTargets.has(node.id) && actions > 0;
            const moveTarget = mode === "move" && moveTargets.has(node.id) && actions > 0;
            return <button
              key={node.id}
              type="button"
              className={`strategic-node ${wallTarget ? "is-wall-target" : ""} ${moveTarget ? "is-move-target" : ""} ${unit ? "is-occupied" : ""}`}
              style={nodePoint(node)}
              onClick={() => clickNode(node.id)}
              aria-label={wallTarget ? "Erguer muralha" : moveTarget ? "Mover unidade" : "Nó estratégico"}
            >
              {catalog.pillar ? <img src={wallTarget || moveTarget ? catalog.pillarSelected ?? catalog.pillar : catalog.pillar} alt="" draggable={false} /> : <span />}
              {wallTarget ? <b>MURO</b> : moveTarget ? <b>MOVER</b> : null}
            </button>;
          })}
        </div>

        <div className="strategic-units">
          {board.units.filter((unit) => unit.hp > 0).map((unit) => {
            const node = nodeIndex.get(unit.nodeId)!;
            const source = catalog[UNIT_ASSET_KEY[unit.id]];
            const attackable = unit.faction === "red" && mode === "attack" && attackTargets.has(unit.id) && actions > 0;
            return <button
              key={unit.id}
              type="button"
              className={`strategic-unit owner-${unit.faction} ${selectedUnitId === unit.id ? "is-selected" : ""} ${attackable ? "is-attack-target" : ""}`}
              style={nodePoint(node)}
              onClick={() => selectUnit(unit.id)}
              aria-label={`${unit.name}, ${unit.hp} de vida`}
            >
              <span className="strategic-unit-ring" />
              {source ? <span className="strategic-unit-sprite" style={{ backgroundImage: `url(${source})` }} /> : <span className="strategic-unit-fallback">{unit.name.slice(0, 1)}</span>}
              <b>{unit.name}</b>
              <small><i style={{ width: `${unit.hp / unit.maxHp * 100}%` }} />{unit.hp}/{unit.maxHp}</small>
              {attackable ? <em>ATACAR</em> : null}
            </button>;
          })}
        </div>

        <div className="strategic-board-status">PACK 99 · {resolvedAssets}/{Object.keys(catalog).length}</div>

        {result !== "playing" ? <div className={`strategic-result is-${result}`}>
          <small>CONFRONTO ENCERRADO</small>
          <h2>{resultTitle(result)}</h2>
          <p>{result === "victory" ? "Duas células foram dominadas e a fronteira recebeu um Bastião." : "A Legião Rubra consolidou a fronteira."}</p>
          <button type="button" onClick={restart}>JOGAR NOVAMENTE</button>
        </div> : null}
      </section>

      <aside className="strategic-objectives">
        <small>OBJETIVO PRINCIPAL</small>
        <h2>Consolidar a Fronteira</h2>
        <p>Domine duas células e erga ao menos um Bastião.</p>

        <div className="strategic-progress">
          <div><span style={{ width: `${Math.min(100, blueCells / 2 * 100)}%` }} /><b>Células {blueCells}/2</b></div>
          <div><span style={{ width: `${Math.min(100, blueStructures * 100)}%` }} /><b>Bastiões {blueStructures}/1</b></div>
        </div>

        <div className="strategic-score"><span className="owner-blue">Orun <b>{blueCells}</b></span><span className="owner-red">Rubra <b>{redCells}</b></span></div>

        <small>REGISTRO DE TURNO</small>
        <ol>{messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ol>

        <button type="button" className="strategic-end-turn" onClick={endTurn} disabled={result !== "playing"}>ENCERRAR TURNO</button>
      </aside>
    </section>
  </main>;
}
