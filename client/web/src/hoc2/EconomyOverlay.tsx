import type { HexaFilter } from "./HexaOverlay";

export function EconomyOverlay({ filter }: { filter: HexaFilter }) {
  if (filter === "resources") {
    return (
      <aside className="hoc2-economy-panel" aria-label="Recursos">
        <strong>Economia</strong>
        <div className="hoc2-resource-grid">
          <div><span>Ouro</span><b>200</b><small>+12/turno</small></div>
          <div><span>Suprimento</span><b>120</b><small>+8/turno</small></div>
          <div><span>Materiais</span><b>100</b><small>+6/turno</small></div>
          <div><span>Octarina</span><b>10</b><small>+2/turno</small></div>
        </div>
        <p>Mina de Velmar: +5 Materiais · supply conectado</p>
      </aside>
    );
  }
  if (filter === "construction") {
    return (
      <aside className="hoc2-economy-panel" aria-label="Construção">
        <strong>Construção</strong>
        <p><b>Posto Avançado</b> · 40 Materiais · 20 Ouro · 1 turno</p>
        <p><b>Estrada</b> · 20 Materiais · rota Aldor → Velmar</p>
        <p><b>Condutor Octarina</b> · 30 Materiais · 3 Octarina</p>
      </aside>
    );
  }
  return null;
}
