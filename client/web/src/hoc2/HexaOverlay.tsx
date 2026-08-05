export type HexaFilter = "domain" | "influence" | "movement" | "construction" | "connections" | "resources" | "octarina";

const FILTERS: Array<{ id: HexaFilter; label: string; enabled: boolean }> = [
  { id: "domain", label: "Domínio", enabled: true },
  { id: "influence", label: "Influência", enabled: true },
  { id: "movement", label: "Movimento", enabled: false },
  { id: "construction", label: "Construção", enabled: false },
  { id: "connections", label: "Conexões", enabled: false },
  { id: "resources", label: "Recursos", enabled: false },
  { id: "octarina", label: "Octarina", enabled: false },
];

export function HexaOverlay({ active, filter, onToggle, onFilter }: {
  active: boolean;
  filter: HexaFilter;
  onToggle: () => void;
  onFilter: (filter: HexaFilter) => void;
}) {
  return (
    <div className="hoc2-hexa-controls" aria-label="Modo Hexa">
      <button type="button" className={`hoc2-hexa-toggle${active ? " is-active" : ""}`} onClick={onToggle} aria-pressed={active}>
        <span aria-hidden="true">⬡</span>{active ? "Mapa Vivo" : "Modo Hexa"}
      </button>
      {active ? (
        <nav className="hoc2-hexa-filters" aria-label="Filtros estratégicos">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!item.enabled}
              className={filter === item.id ? "is-active" : ""}
              onClick={() => item.enabled && onFilter(item.id)}
              title={item.enabled ? item.label : `${item.label} entra nas próximas etapas do VS01`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
