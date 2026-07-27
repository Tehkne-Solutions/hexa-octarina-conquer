import { useEffect, useMemo, useState } from "react";

import type { TcgCard } from "./living-board-data";
import { pack99PublicUrl, resolvePack99Asset } from "./pack99-runtime";

interface Pack99CardArtProps {
  card: TcgCard;
}

function cardQuery(card: TcgCard): { required: string[]; preferred: string[] } {
  const base = ["card"];
  if (card.unitRole === "guardian") base.push("guardian");
  if (card.unitRole === "archer") base.push("ranger");
  if (card.unitRole === "raider") base.push("raider");

  const preferred = [
    card.element,
    ...card.keywords,
    card.name,
    card.rarity,
    "art",
    "illustration",
    "base",
  ];

  return { required: base, preferred };
}

export function Pack99CardArt({ card }: Pack99CardArtProps) {
  const query = useMemo(() => cardQuery(card), [card]);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void resolvePack99Asset(query.required, query.preferred)
      .then((asset) => {
        if (active) setSource(pack99PublicUrl(asset));
      })
      .catch(() => {
        if (active) setSource(null);
      });
    return () => { active = false; };
  }, [query]);

  return (
    <div className="pack99-card-art" data-card-id={card.id} data-card-element={card.element.toLowerCase()}>
      {source ? <img src={source} alt="" draggable={false} /> : null}
      <span className="pack99-card-art-fallback" aria-hidden="true">
        <i className="pack99-card-cabal-ring ring-a" />
        <i className="pack99-card-cabal-ring ring-b" />
        <b>{card.art}</b>
      </span>
      <span className="pack99-card-arcana">{card.arcana}</span>
      <span className="pack99-card-element">{card.element}</span>
    </div>
  );
}
