import { useMemo, useState } from "react";

import { createMetaBoardModel, metaCellPolygon, metaIsoPoint, type MetaFaction } from "./meta-board-model";
import "./meta-board-foundation.css";

interface MetaBoardFoundationProps {
  playerName: string;
  onBack: () => void;
}

const FACTION_LABEL: Record<MetaFaction, string> = {
  blue: "Aliança de Orun",
  red: "Legião Rubra",
  violet: "Convergência Octarina",
};

export function MetaBoardFoundation({ playerName, onBack }: MetaBoardFoundationProps) {
  const board = useMemo(() => createMetaBoardModel(), []);
  const nodeIndex = useMemo(() => new Map(board.nodes.map((node) => [node.id, node])), [board.nodes]);
  const [selectedNodeId, setSelectedNodeId] = useState("n-1-3");

  return (
    <main className="meta-foundation-screen">
      <header className="meta-foundation-topbar">
        <button type="button" onClick={onBack} aria-label="Voltar ao menu">☰</button>
        <div><small>FUNDAÇÃO META 01</small><strong>Malha Estratégica de Orun</strong></div>
        <div className="meta-foundation-turn"><small>RODADA 1</small><strong>SEU TURNO</strong></div>
        <div className="meta-foundation-resources"><span>◈ 1870</span><span>◆ 660</span><span>✦ 640</span></div>
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
        </aside>

        <section className="meta-board-shell" aria-label="Tabuleiro estratégico isométrico">
          <div className="meta-board-terrain" />
          <svg className="meta-board-svg" viewBox="0 0 1080 620" role="img" aria-label="Nós, muros e territórios">
            <defs>
              <filter id="meta-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <g className="meta-territories">
              {board.cells.filter((cell) => cell.owner).map((cell) => <polygon key={cell.id} className={`owner-${cell.owner}`} points={metaCellPolygon(cell)} />)}
            </g>
            <g className="meta-walls">
              {board.edges.map((edge) => {
                const a = nodeIndex.get(edge.a)!;
                const b = nodeIndex.get(edge.b)!;
                const start = metaIsoPoint(a.col, a.row);
                const end = metaIsoPoint(b.col, b.row);
                return <line key={edge.id} className={edge.owner ? `owner-${edge.owner}` : "owner-neutral"} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
              })}
            </g>
          </svg>

          <div className="meta-node-layer">
            {board.nodes.map((node) => {
              const point = metaIsoPoint(node.col, node.row);
              const selected = selectedNodeId === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`meta-node kind-${node.kind} ${selected ? "is-selected" : ""}`}
                  style={{ left: `${point.x / 10.8}%`, top: `${point.y / 6.2}%` }}
                  onClick={() => setSelectedNodeId(node.id)}
                  aria-label={`Nó ${node.col + 1}, ${node.row + 1}`}
                >
                  <span className="meta-node-pillar"><i /><b /></span>
                  {selected ? <strong>SELECIONADO</strong> : null}
                </button>
              );
            })}
          </div>

          <div className="meta-board-landmark landmark-blue">Fortaleza de Orun</div>
          <div className="meta-board-landmark landmark-red">Cidadela Rubra</div>
          <div className="meta-board-landmark landmark-violet">Núcleo Octarino</div>
        </section>

        <aside className="meta-foundation-objectives">
          <small>OBJETIVO PRINCIPAL</small>
          <h3>Feche 3 territórios</h3>
          <p>Conecte quatro muros da mesma facção ao redor de uma célula.</p>
          <div className="meta-objective-progress"><span /><span /><span /></div>
          <small>LEITURA DO TABULEIRO</small>
          <ul><li>Pilares = pontos estratégicos</li><li>Muros = conexões controladas</li><li>Área colorida = território fechado</li></ul>
          <button type="button">ENCERRAR TURNO</button>
        </aside>
      </section>
    </main>
  );
}
