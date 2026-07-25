import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { TCG_CARDS, type TcgCard } from "./living-board-data";
import {
  LOADOUT_MAX_COPIES,
  LOADOUT_MAX_ENERGY,
  LOADOUT_SIZE,
  PLAYER_LOADOUT_CARD_IDS,
  activeLoadout,
  cardOrigin,
  createLoadout,
  currentUnlockedLoadoutCards,
  deleteLoadout,
  domainProgress,
  readLoadoutCollection,
  renameLoadout,
  setActiveLoadout,
  subscribeLoadouts,
  updateLoadoutCards,
  validateLoadout,
  type LoadoutCollection,
  type PlayerLoadout,
} from "./loadout-store";
import { TcgCardFrame } from "./TcgCardFrame";

interface PortalTargets {
  collection: HTMLElement | null;
  briefing: HTMLElement | null;
  multiplayer: HTMLElement | null;
  campaignPanel: HTMLElement | null;
}

function findTargets(): PortalTargets {
  return {
    collection: document.querySelector<HTMLElement>(".collection-heading"),
    briefing: document.querySelector<HTMLElement>(".campaign-briefing-screen .briefing-actions"),
    multiplayer: document.querySelector<HTMLElement>(".embedded-multiplayer .hero-card"),
    campaignPanel: document.querySelector<HTMLElement>(".campaign-selected-panel"),
  };
}

function sameTargets(left: PortalTargets, right: PortalTargets): boolean {
  return left.collection === right.collection
    && left.briefing === right.briefing
    && left.multiplayer === right.multiplayer
    && left.campaignPanel === right.campaignPanel;
}

function roleLabel(card: TcgCard): string {
  return card.unitRole === "guardian" ? "Kael · Guardião" : "Lyra · Arqueira";
}

function LoadoutBadge({ deck, onOpen, context }: { deck: PlayerLoadout; onOpen: () => void; context: string }) {
  const validation = validateLoadout(deck.cardIds, currentUnlockedLoadoutCards());
  return (
    <button type="button" className={`loadout-context-badge ${validation.valid ? "valid" : "invalid"}`} onClick={onOpen}>
      <span aria-hidden="true">◆</span>
      <div><small>{context}</small><strong>{deck.name}</strong><em>{validation.valid ? `${deck.cardIds.length} cartas · ${validation.totalEnergy} energia` : "Deck precisa de ajustes"}</em></div>
      <b>Editar</b>
    </button>
  );
}

function ComparisonPanel({ ids, onRemove }: { ids: string[]; onRemove: (id: string) => void }) {
  if (ids.length === 0) return (
    <section className="loadout-comparison empty">
      <span>◇</span><div><strong>Comparação de cartas</strong><p>Marque até duas cartas para comparar custo, ataque, defesa e velocidade.</p></div>
    </section>
  );
  const cards = ids.map((id) => TCG_CARDS[id]).filter(Boolean);
  const first = cards[0];
  return (
    <section className="loadout-comparison">
      <header><div><small>ANÁLISE TÁTICA</small><strong>Comparação lado a lado</strong></div><span>{cards.length}/2</span></header>
      <div className="comparison-grid">
        {cards.map((card, index) => {
          const other = cards[index === 0 ? 1 : 0];
          const delta = (value: number, key: "attack" | "defense" | "speed" | "cost") => other ? value - other[key] : 0;
          return (
            <article key={card.id}>
              <button type="button" onClick={() => onRemove(card.id)} aria-label={`Remover ${card.name} da comparação`}>×</button>
              <small>{roleLabel(card)}</small><strong>{card.name}</strong>
              <dl>
                <div><dt>Custo</dt><dd>{card.cost}<i data-tone={delta(card.cost, "cost") < 0 ? "good" : delta(card.cost, "cost") > 0 ? "bad" : "neutral"}>{other ? `${delta(card.cost, "cost") > 0 ? "+" : ""}${delta(card.cost, "cost")}` : "—"}</i></dd></div>
                <div><dt>Ataque</dt><dd>{card.attack}<i data-tone={delta(card.attack, "attack") > 0 ? "good" : delta(card.attack, "attack") < 0 ? "bad" : "neutral"}>{other ? `${delta(card.attack, "attack") > 0 ? "+" : ""}${delta(card.attack, "attack")}` : "—"}</i></dd></div>
                <div><dt>Defesa</dt><dd>{card.defense}<i data-tone={delta(card.defense, "defense") > 0 ? "good" : delta(card.defense, "defense") < 0 ? "bad" : "neutral"}>{other ? `${delta(card.defense, "defense") > 0 ? "+" : ""}${delta(card.defense, "defense")}` : "—"}</i></dd></div>
                <div><dt>Velocidade</dt><dd>{card.speed}<i data-tone={delta(card.speed, "speed") > 0 ? "good" : delta(card.speed, "speed") < 0 ? "bad" : "neutral"}>{other ? `${delta(card.speed, "speed") > 0 ? "+" : ""}${delta(card.speed, "speed")}` : "—"}</i></dd></div>
              </dl>
              <p>{card.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LoadoutEditor({ collection, onCollectionChange, onClose }: {
  collection: LoadoutCollection;
  onCollectionChange: (collection: LoadoutCollection) => void;
  onClose: () => void;
}) {
  const unlocked = useMemo(currentUnlockedLoadoutCards, [collection]);
  const [selectedId, setSelectedId] = useState(collection.activeId);
  const selectedDeck = collection.decks.find((deck) => deck.id === selectedId) ?? activeLoadout(collection);
  const [draftName, setDraftName] = useState(selectedDeck.name);
  const [draftCards, setDraftCards] = useState<string[]>(selectedDeck.cardIds);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const validation = validateLoadout(draftCards, unlocked);
  const domains = domainProgress(unlocked);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftName(selectedDeck.name);
    setDraftCards(selectedDeck.cardIds);
  }, [selectedDeck.id]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const selectDeck = (id: string) => {
    setSelectedId(id);
    const next = collection.decks.find((deck) => deck.id === id);
    if (next) { setDraftName(next.name); setDraftCards(next.cardIds); }
  };

  const toggleCard = (cardId: string) => {
    if (!unlocked.has(cardId)) return;
    const amount = draftCards.filter((id) => id === cardId).length;
    if (amount > 0) {
      const index = draftCards.lastIndexOf(cardId);
      setDraftCards(draftCards.filter((_, cardIndex) => cardIndex !== index));
      return;
    }
    if (draftCards.length >= LOADOUT_SIZE || amount >= LOADOUT_MAX_COPIES) return;
    setDraftCards([...draftCards, cardId]);
  };

  const addCopy = (cardId: string) => {
    const amount = draftCards.filter((id) => id === cardId).length;
    if (!unlocked.has(cardId) || draftCards.length >= LOADOUT_SIZE || amount >= LOADOUT_MAX_COPIES) return;
    setDraftCards([...draftCards, cardId]);
  };

  const toggleCompare = (cardId: string) => {
    setCompareIds((current) => current.includes(cardId)
      ? current.filter((id) => id !== cardId)
      : current.length < 2 ? [...current, cardId] : [current[1], cardId]);
  };

  const save = () => {
    if (!validation.valid) return;
    let next = updateLoadoutCards(selectedDeck.id, draftCards);
    next = renameLoadout(selectedDeck.id, draftName);
    next = setActiveLoadout(selectedDeck.id);
    onCollectionChange(next);
  };

  const createDeck = () => {
    const next = createLoadout(`Deck ${collection.decks.length + 1}`);
    onCollectionChange(next);
    selectDeck(next.activeId);
  };

  const removeDeck = () => {
    const next = deleteLoadout(selectedDeck.id);
    onCollectionChange(next);
    selectDeck(next.activeId);
  };

  return (
    <div className="loadout-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="loadout-editor" role="dialog" aria-modal="true" aria-labelledby="loadout-editor-title" tabIndex={-1} ref={dialogRef}>
        <header className="loadout-editor-header">
          <div><p className="fantasy-eyebrow">Arsenal persistente</p><h1 id="loadout-editor-title">Decks e loadouts</h1><p>Monte cinco cartas de combate. Expansão, Fortificação e Convocar Duelo entram automaticamente como táticas fixas.</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar editor">×</button>
        </header>

        <div className="loadout-editor-layout">
          <aside className="loadout-deck-list">
            <header><strong>Meus decks</strong><button type="button" onClick={createDeck} disabled={collection.decks.length >= 6}>＋</button></header>
            {collection.decks.map((deck) => {
              const status = validateLoadout(deck.cardIds, unlocked);
              return <button type="button" key={deck.id} className={`${selectedDeck.id === deck.id ? "selected" : ""} ${deck.id === collection.activeId ? "active" : ""}`} onClick={() => selectDeck(deck.id)}><span>◆</span><div><strong>{deck.name}</strong><small>{status.valid ? `${status.totalEnergy} energia` : "Incompleto"}</small></div>{deck.id === collection.activeId ? <em>ATIVO</em> : null}</button>;
            })}
            <section className="loadout-domain-progress">
              <small>EVOLUÇÃO POR DOMÍNIO</small>
              {domains.map((domain) => <div key={domain.role}><span><b>{domain.role === "guardian" ? "Kael" : "Lyra"}</b><em>{domain.amount}/{domain.total}</em></span><i><b style={{ width: `${domain.percent}%` }} /></i></div>)}
            </section>
          </aside>

          <main className="loadout-workbench">
            <section className="loadout-name-row">
              <label><span>Nome do deck</span><input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={32} /></label>
              <button type="button" onClick={removeDeck} disabled={collection.decks.length <= 1}>Excluir</button>
            </section>

            <section className="loadout-slots" aria-label="Cartas escolhidas">
              {Array.from({ length: LOADOUT_SIZE }, (_, index) => {
                const cardId = draftCards[index];
                const card = cardId ? TCG_CARDS[cardId] : null;
                return <button type="button" key={index} className={card ? `filled role-${card.unitRole}` : "empty"} onClick={() => card && setDraftCards(draftCards.filter((_, cardIndex) => cardIndex !== index))}>{card ? <><span>{card.art}</span><div><small>{index + 1}</small><strong>{card.name}</strong><em>{card.cost} energia</em></div><b>×</b></> : <><span>＋</span><small>Slot {index + 1}</small></>}</button>;
              })}
            </section>

            <section className={`loadout-validation ${validation.valid ? "valid" : "invalid"}`}>
              <div><span>{validation.valid ? "✓" : "!"}</span><p><strong>{validation.valid ? "Deck pronto para batalha" : "Composição incompleta"}</strong><small>{draftCards.length}/{LOADOUT_SIZE} cartas · {validation.totalEnergy}/{LOADOUT_MAX_ENERGY} energia · {validation.guardianCards} Kael · {validation.archerCards} Lyra</small></p></div>
              {validation.errors.length > 0 ? <ul>{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
            </section>

            <section className="loadout-fixed-tactics"><small>TÁTICAS FIXAS</small><span>⌁ Expansão Rúnica</span><span>⬢ Fortaleza Octarina</span><span>⚔ Convocar Duelo</span></section>

            <section className="loadout-card-library">
              <header><div><small>GRIMÓRIO DE COMBATE</small><strong>Escolha cartas desbloqueadas</strong></div><span>Máximo {LOADOUT_MAX_COPIES} cópias</span></header>
              <div>
                {PLAYER_LOADOUT_CARD_IDS.map((cardId) => {
                  const card = TCG_CARDS[cardId];
                  const locked = !unlocked.has(cardId);
                  const copies = draftCards.filter((id) => id === cardId).length;
                  const origin = cardOrigin(cardId);
                  return (
                    <article className={`loadout-library-card ${locked ? "locked" : ""}`} key={cardId}>
                      <TcgCardFrame card={card} compact locked={locked} selected={copies > 0} onClick={() => toggleCard(cardId)} />
                      <div className="loadout-card-actions">
                        <span>{copies}× no deck</span>
                        <button type="button" disabled={locked || copies >= LOADOUT_MAX_COPIES || draftCards.length >= LOADOUT_SIZE} onClick={() => addCopy(cardId)}>＋ cópia</button>
                        <button type="button" className={compareIds.includes(cardId) ? "active" : ""} onClick={() => toggleCompare(cardId)}>Comparar</button>
                      </div>
                      <p><b>{origin.source}</b><span>{origin.mission}</span><small>{origin.requirement}</small></p>
                    </article>
                  );
                })}
              </div>
            </section>

            <ComparisonPanel ids={compareIds} onRemove={(id) => setCompareIds((current) => current.filter((item) => item !== id))} />
          </main>
        </div>

        <footer className="loadout-editor-footer"><span>O loadout ativo será usado na campanha viva, campanha autoritativa e salas multiplayer.</span><div><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="primary" disabled={!validation.valid} onClick={save}>Salvar e ativar</button></div></footer>
      </div>
    </div>
  );
}

export function LoadoutManagerPortal() {
  const qaRequested = useMemo(() => {
    const params = new URL(window.location.href).searchParams;
    return params.get("qa") === "1" && params.get("screen") === "loadout";
  }, []);
  const [collection, setCollection] = useState(readLoadoutCollection);
  const [open, setOpen] = useState(qaRequested);
  const [targets, setTargets] = useState<PortalTargets>(findTargets);
  const deck = activeLoadout(collection);

  useEffect(() => subscribeLoadouts(setCollection), []);
  useEffect(() => {
    const refresh = () => setTargets((current) => {
      const next = findTargets();
      return sameTargets(current, next) ? current : next;
    });
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    refresh();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const appRoot = document.getElementById("root");
    document.documentElement.classList.toggle("loadout-editor-open", open);
    if (appRoot) {
      appRoot.inert = open;
      if (open) appRoot.setAttribute("aria-hidden", "true");
      else appRoot.removeAttribute("aria-hidden");
    }
    return () => {
      document.documentElement.classList.remove("loadout-editor-open");
      if (appRoot) { appRoot.inert = false; appRoot.removeAttribute("aria-hidden"); }
    };
  }, [open]);

  return (
    <>
      {targets.collection ? createPortal(<LoadoutBadge deck={deck} context="Deck ativo" onOpen={() => setOpen(true)} />, targets.collection) : null}
      {targets.briefing ? createPortal(<LoadoutBadge deck={deck} context="Loadout desta missão" onOpen={() => setOpen(true)} />, targets.briefing) : null}
      {targets.multiplayer ? createPortal(<LoadoutBadge deck={deck} context="Loadout multiplayer" onOpen={() => setOpen(true)} />, targets.multiplayer) : null}
      {targets.campaignPanel && !targets.briefing ? createPortal(<LoadoutBadge deck={deck} context="Pronto para a campanha" onOpen={() => setOpen(true)} />, targets.campaignPanel) : null}
      {open ? createPortal(<LoadoutEditor collection={collection} onCollectionChange={setCollection} onClose={() => setOpen(false)} />, document.body) : null}
    </>
  );
}
