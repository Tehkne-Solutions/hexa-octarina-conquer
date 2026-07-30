import { useEffect, useMemo, useState } from "react";

import { MetaPack99World } from "./MetaPack99World";
import {
  canClaimEdge,
  claimEdge,
  connectedNodeIds,
  countFactionCells,
  createMetaBoardModel,
  metaCellPolygon,
  metaIsoPoint,
  type MetaBoardModel,
  type MetaEdge,
  type MetaFaction,
  type MetaNode,
} from "./meta-board-model";
import { runtimeAssetUrl } from "./runtime-assets";
import "./meta-board-foundation.css";
import "./meta-pack99-world.css";

interface MetaBoardFoundationProps {
  playerName: string;
  onBack: () => void;
}

interface MetaRuntimeVisuals {
  pillar: string | null;
  pillarSelected: string | null;
}

const FACTION_LABEL: Record<MetaFaction, string> = {
  blue: "Aliança de Orun",
  red: "Legião Rubra",
  violet: "Convergência Octarina",
};

const EMPTY_VISUALS: MetaRuntimeVisuals = { pillar: null, pillarSelected: null };
const PLAYER_FACTION: MetaFaction = "blue";
const START_NODE = "n-1-3";

function edgeGeometry(edge: MetaEdge, nodeIndex: Map<string, MetaNode>) {
  const a = nodeIndex.get(edge.a)!;
  const b = nodeIndex.get(edge.b)!;
  const start = metaIsoPoint(a.col, a.row);
  const end = metaIsoPoint(b.col, b.row);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    left: `${((start.x + end.x) / 2 / 10.8)}%`,
    top: `${((start.y + end.y) / 2 / 6.2)}%`,
    width: `${Math.hypot(dx, dy) / 10.8}%`,
    transform: `translate(-50%, -50%) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`,
  };
}

export function MetaBoardFoundation({ playerName, onBack }: MetaBoardFoundationProps) {
  const initialBoard = useMemo(() => createMetaBoardModel(), []);
  const [board, setBoard] = useState<MetaBoardModel>(initialBoard);
  const nodeIndex = useMemo(() => new Map(board.nodes.map((node) => [node.id, node])), [board.nodes]);
  const [selectedNodeId, setSelectedNodeId] = useState(START_NODE);
  const [runtimeVisuals, setRuntimeVisuals] = useState<MetaRuntimeVisuals>(EMPTY_VISUALS);
  const [actions, setActions] = useState(2);
  const [round, setRound] = useState(1);
  const [notice, setNotice] = useState("Selecione um ponto dourado vizinho para construir uma rota.");

  const reachableNodeIds = useMemo(() => new Set(
    connectedNodeIds(board, selectedNodeId).filter((nodeId) => canClaimEdge(board, selectedNodeId, nodeId)),
  ), [board, selectedNodeId]);
  const blueCells = countFactionCells(board, PLAYER_FACTION);

  useEffect(() => {
    let active = true;
    void Promise.all([
      runtimeAssetUrl("PILLAR_NEUTRAL_01"),
      runtimeAssetUrl("PILLAR_SELECTED_01"),
    ]).then(([pillar, pillarSelected]) => {
      if (active) setRuntimeVisuals({ pillar, pillarSelected });
    });
    return () => { active = false; };
  }, []);

  function handleNodeClick(nodeId: string): void {
    if (nodeId === selectedNodeId) {
      setNotice("Ponto de comando selecionado. Escolha uma conexão livre ao redor dele.");
      return;
    }

    if (actions > 0 && reachableNodeIds.has(nodeId)) {
      setBoard((current) => claimEdge(current, selectedNodeId, nodeId, PLAYER_FACTION));
      setSelectedNodeId(nodeId);
      setActions((current) => current - 1);
      setNotice("Rota construída. O comando avançou para o novo ponto estratégico.");
      return;
    }

    setSelectedNodeId(nodeId);
    setNotice(actions > 0
      ? "Ponto selecionado. Conexões livres vizinhas foram destacadas."
      : "Sem ações nesta rodada. Encerre o turno para recuperar o comando.");
  }

  function endTurn(): void {
    setRound((current) => current + 1);
    setActions(2);
    setNotice("Nova rodada iniciada. Você recebeu 2 ações de comando.");
  }

  return (
    <main className="meta-foundation-screen meta-world-board-screen">
      <header className="meta-foundation-topbar">
        <button type="button" onClick={onBack} aria-label="Voltar ao menu">☰</button>
        <div><small>META 03 · ROTAS E MURALHAS</small><strong>Convergência de Orun</strong></div>
        <div className="meta-foundation-turn"><small>RODADA {round}</small><strong>SEU TURNO</strong></div>
        <div className="meta-foundation-resources"><span>◈ 1870</span><span>◆ 660</span><span>✦ {actions}/2 ações</span></div>
      </header>

      <section className="meta-foundation-layout">
        <aside className="meta-foundation-roster">
          <h2>{playerName}</h2>
          <div className="meta-roster-card is-active"><b>KAEL</b><span>Guardião</span><em>18/18</em></div>
          <div className="meta-roster-card"><b>LYRA</b><span>Arqueira</span><em>14/14</em></div>
          <div className="meta-roster-card enemy"><b>BRAKK</b><span>Campeão</span><em>16/16</em></div>
          <div className="meta-faction-legend">
            {(Object.keys(FACTION_LABEL) as MetaFaction[]).map((faction) => <span key={faction} className={`owner-${faction}`}><i />{FACTION_LABEL[faction]}</span>)}
          </div>
          <div className="meta-play-status"><small>COMANDO</small><b>{actions}/2 ações</b><p>{notice}</p></div>
        </aside>

        <section className="meta-board-shell" aria-label="Mundo estratégico isométrico jogável">
          <MetaPack99World />

          <svg className="meta-board-svg" viewBox="0 0 1080 620" role="img" aria-label="Territórios controlados">
            <g className="meta-territories">
              {board.cells.filter((cell) => cell.owner).map((cell) => <polygon key={cell.id} className={`owner-${cell.owner}`} points={metaCellPolygon(cell)} />)}
            </g>
          </svg>

          <div className="meta-physical-links" aria-hidden="true">
            {board.edges.map((edge) => (
              <span
                key={edge.id}
                className={`meta-physical-link ${edge.owner ? `owner-${edge.owner} is-wall` : "owner-neutral is-road"}`}
                style={edgeGeometry(edge, nodeIndex)}
              >
                <i /><b /><em />
              </span>
            ))}
          </div>

          <div className="meta-node-layer">
            {board.nodes.map((node) => {
              const point = metaIsoPoint(node.col, node.row);
              const selected = selectedNodeId === node.id;
              const reachable = reachableNodeIds.has(node.id) && actions > 0;
              const runtimePillar = selected ? runtimeVisuals.pillarSelected ?? runtimeVisuals.pillar : runtimeVisuals.pillar;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`meta-node kind-${node.kind} ${selected ? "is-selected" : ""} ${reachable ? "is-reachable" : ""} ${runtimePillar ? "has-pack99-pillar" : "is-fallback"}`}
                  style={{ left: `${point.x / 10.8}%`, top: `${point.y / 6.2}%` }}
                  onClick={() => handleNodeClick(node.id)}
                  aria-label={`${reachable ? "Construir rota até" : "Selecionar"} nó ${node.col + 1}, ${node.row + 1}`}
                  data-runtime-asset={runtimePillar ? (selected ? "PILLAR_SELECTED_01" : "PILLAR_NEUTRAL_01") : undefined}
                >
                  <span className="meta-node-pillar"><i /><b />{runtimePillar ? <img src={runtimePillar} alt="" aria-hidden="true" /> : null}</span>
                  {selected ? <strong>COMANDO</strong> : reachable ? <strong>CONECTAR</strong> : null}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="meta-foundation-objectives">
          <small>OBJETIVO PRINCIPAL</small>
          <h3>Domine a Convergência</h3>
          <p>Construa rotas, feche três territórios azuis e avance até o Santuário Octarino.</p>
          <div className="meta-objective-progress">
            {[0, 1, 2].map((index) => <span key={index} className={blueCells > index ? "is-complete" : ""} />)}
          </div>
          <small>LEITURA DO MUNDO</small>
          <ul><li>Clique em um ponto para selecioná-lo</li><li>Pontos dourados permitem construir rota</li><li>Cada conexão consome 1 ação</li><li>Quatro muralhas fecham um território</li></ul>
          <button type="button" onClick={endTurn}>ENCERRAR TURNO</button>
        </aside>
      </section>
    </main>
  );
}
