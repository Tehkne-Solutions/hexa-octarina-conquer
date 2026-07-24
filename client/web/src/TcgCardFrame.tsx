import type { TcgCard } from "./living-board-data";

interface TcgCardFrameProps {
  card: TcgCard;
  selected?: boolean;
  recommended?: boolean;
  locked?: boolean;
  order?: number;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function rarityLabel(rarity: TcgCard["rarity"]): string {
  return {
    common: "Comum",
    rare: "Rara",
    epic: "Épica",
    legendary: "Lendária",
  }[rarity];
}

function roleLabel(role: TcgCard["unitRole"]): string {
  return {
    guardian: "Guardião",
    archer: "Arqueira",
    raider: "Saqueador",
  }[role];
}

export function TcgCardFrame({
  card,
  selected = false,
  recommended = false,
  locked = false,
  order,
  compact = false,
  disabled = false,
  onClick,
}: TcgCardFrameProps) {
  const className = [
    "tcg-card-frame",
    `rarity-${card.rarity}`,
    `role-${card.unitRole}`,
    selected ? "selected" : "",
    recommended ? "recommended" : "",
    locked ? "locked" : "",
    compact ? "compact" : "",
  ].filter(Boolean).join(" ");

  const content = (
    <>
      <span className="tcg-card-foil" aria-hidden="true" />
      <header className="tcg-card-header">
        <span className="tcg-card-cost" aria-label={`Custo ${card.cost}`}>{card.cost}</span>
        <div>
          <small>{roleLabel(card.unitRole)} · {rarityLabel(card.rarity)}</small>
          <strong>{card.name}</strong>
        </div>
        <span className="tcg-card-arcana">{card.arcana}</span>
      </header>

      <div className="tcg-card-art" data-element={card.element.toLowerCase()}>
        <span className="tcg-card-halo halo-one" />
        <span className="tcg-card-halo halo-two" />
        <span className="tcg-card-glyph">{card.art}</span>
        <span className="tcg-card-element">{card.element}</span>
      </div>

      <div className="tcg-card-keywords">
        {card.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
      </div>

      <p className="tcg-card-description">{card.description}</p>
      {!compact ? <blockquote>{card.flavor}</blockquote> : null}

      <footer className="tcg-card-stats">
        <span title="Ataque"><i>⚔</i><b>{card.attack}</b></span>
        <span title="Defesa"><i>◆</i><b>{card.defense}</b></span>
        <span title="Velocidade"><i>➤</i><b>{card.speed}</b></span>
      </footer>

      {recommended && !selected ? <span className="tcg-card-ribbon">Sugerida</span> : null}
      {order ? <span className="tcg-card-order">{order}</span> : null}
      {locked ? (
        <span className="tcg-card-lock">
          <b>◇</b>
          <small>Bloqueada</small>
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        data-element={card.element.toLowerCase()}
        disabled={disabled}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${card.name}${locked ? ", bloqueada" : ""}`}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={className} data-element={card.element.toLowerCase()}>
      {content}
    </article>
  );
}
