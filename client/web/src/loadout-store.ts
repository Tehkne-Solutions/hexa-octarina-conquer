import { campaignCacheScope, readCampaignCatalogSnapshot } from "./campaign-cache";
import { INITIAL_LIVING_UNITS, TCG_CARDS, type TcgCard } from "./living-board-data";
import { readLivingCampaignProgress, unlockedCardIds } from "./unified-progress";

export const LOADOUT_STORAGE_KEY = "hexa.loadouts.v1";
export const LOADOUT_EVENT = "hexa:loadouts-changed";
export const LOADOUT_SIZE = 5;
export const LOADOUT_MAX_COPIES = 2;
export const LOADOUT_MAX_ENERGY = 9;
export const FIXED_TACTIC_IDS = ["expansion", "fortify", "duel"] as const;

export const PLAYER_LOADOUT_CARD_IDS = Object.values(TCG_CARDS)
  .filter((card) => card.unitRole === "guardian" || card.unitRole === "archer")
  .map((card) => card.id);

const DEFAULT_CARD_IDS = [
  "kael-golpe-runico",
  "kael-guardiao-celeste",
  "lyra-flecha-eter",
  "lyra-passo-lunar",
  "lyra-marca-cacada",
];

export interface PlayerLoadout {
  id: string;
  name: string;
  cardIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LoadoutCollection {
  version: 1;
  activeId: string;
  decks: PlayerLoadout[];
}

export interface LoadoutValidation {
  valid: boolean;
  errors: string[];
  totalEnergy: number;
  guardianCards: number;
  archerCards: number;
  uniqueCards: number;
}

export interface CardOrigin {
  source: string;
  mission: string;
  requirement: string;
}

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `loadout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function starterCollection(now = Date.now()): LoadoutCollection {
  const id = "orun-balanced";
  return {
    version: 1,
    activeId: id,
    decks: [{ id, name: "Juramento de Orun", cardIds: [...DEFAULT_CARD_IDS], createdAt: now, updatedAt: now }],
  };
}

function sanitizeCardIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_CARD_IDS];
  return value.map(String).filter((id) => PLAYER_LOADOUT_CARD_IDS.includes(id)).slice(0, LOADOUT_SIZE);
}

function sanitizeCollection(value: unknown): LoadoutCollection {
  if (!value || typeof value !== "object") return starterCollection();
  const candidate = value as Partial<LoadoutCollection>;
  const now = Date.now();
  const decks = Array.isArray(candidate.decks)
    ? candidate.decks.slice(0, 6).map((entry, index) => {
      const deck = entry as Partial<PlayerLoadout>;
      return {
        id: String(deck.id || createId()),
        name: String(deck.name || `Deck ${index + 1}`).trim().slice(0, 32) || `Deck ${index + 1}`,
        cardIds: sanitizeCardIds(deck.cardIds),
        createdAt: Number(deck.createdAt) || now,
        updatedAt: Number(deck.updatedAt) || now,
      };
    })
    : [];
  const safeDecks = decks.length > 0 ? decks : starterCollection(now).decks;
  const activeId = safeDecks.some((deck) => deck.id === candidate.activeId) ? String(candidate.activeId) : safeDecks[0].id;
  return { version: 1, activeId, decks: safeDecks };
}

export function readLoadoutCollection(storage: Storage | null = browserStorage()): LoadoutCollection {
  if (!storage) return starterCollection();
  try {
    const raw = storage.getItem(LOADOUT_STORAGE_KEY);
    if (!raw) {
      const initial = starterCollection();
      storage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return sanitizeCollection(JSON.parse(raw));
  } catch {
    storage.removeItem(LOADOUT_STORAGE_KEY);
    const initial = starterCollection();
    storage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

export function saveLoadoutCollection(collection: LoadoutCollection, storage: Storage | null = browserStorage()): LoadoutCollection {
  const sanitized = sanitizeCollection(collection);
  storage?.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(sanitized));
  applyActiveLoadoutToLivingUnits(sanitized);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(LOADOUT_EVENT, { detail: sanitized }));
  return sanitized;
}

export function activeLoadout(collection = readLoadoutCollection()): PlayerLoadout {
  return collection.decks.find((deck) => deck.id === collection.activeId) ?? collection.decks[0];
}

export function activeLoadoutCardIds(): string[] {
  return [...activeLoadout().cardIds];
}

export function authoritativeHandPreview(cardIds = activeLoadoutCardIds()): string[] {
  return [...FIXED_TACTIC_IDS, ...cardIds];
}

export function validateLoadout(cardIds: string[], unlocked: Set<string> | null = null): LoadoutValidation {
  const cards = cardIds.map((id) => TCG_CARDS[id]).filter((card): card is TcgCard => Boolean(card));
  const errors: string[] = [];
  const counts = new Map<string, number>();
  for (const id of cardIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const totalEnergy = cards.reduce((total, card) => total + card.cost, 0);
  const guardianCards = cards.filter((card) => card.unitRole === "guardian").length;
  const archerCards = cards.filter((card) => card.unitRole === "archer").length;

  if (cardIds.length !== LOADOUT_SIZE) errors.push(`Escolha exatamente ${LOADOUT_SIZE} cartas de combate.`);
  if (cards.length !== cardIds.length || cardIds.some((id) => !PLAYER_LOADOUT_CARD_IDS.includes(id))) errors.push("O deck contém uma carta incompatível com os heróis atuais.");
  if ([...counts.values()].some((amount) => amount > LOADOUT_MAX_COPIES)) errors.push(`Use no máximo ${LOADOUT_MAX_COPIES} cópias da mesma carta.`);
  if (guardianCards < 2) errors.push("Inclua ao menos 2 cartas de Kael.");
  if (archerCards < 2) errors.push("Inclua ao menos 2 cartas de Lyra.");
  if (totalEnergy > LOADOUT_MAX_ENERGY) errors.push(`O custo total deve ser de até ${LOADOUT_MAX_ENERGY} de energia.`);
  if (unlocked && cardIds.some((id) => !unlocked.has(id))) errors.push("Remova cartas que ainda não foram desbloqueadas.");

  return {
    valid: errors.length === 0,
    errors,
    totalEnergy,
    guardianCards,
    archerCards,
    uniqueCards: counts.size,
  };
}

function currentAccountId(storage = browserStorage()): string | null {
  try {
    const raw = storage?.getItem("hexa.web.account-session.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { account?: { id?: string } };
    return parsed.account?.id ?? null;
  } catch {
    return null;
  }
}

export function currentUnlockedLoadoutCards(): Set<string> {
  const storage = browserStorage();
  const scope = campaignCacheScope(currentAccountId(storage));
  const catalog = storage ? readCampaignCatalogSnapshot(scope, storage)?.catalog ?? null : null;
  const unlocked = unlockedCardIds(readLivingCampaignProgress(), catalog);
  return new Set([...unlocked].filter((id) => PLAYER_LOADOUT_CARD_IDS.includes(id)));
}

export function createLoadout(name = "Novo deck"): LoadoutCollection {
  const current = readLoadoutCollection();
  if (current.decks.length >= 6) return current;
  const now = Date.now();
  const deck: PlayerLoadout = {
    id: createId(),
    name: name.trim().slice(0, 32) || "Novo deck",
    cardIds: [...activeLoadout(current).cardIds],
    createdAt: now,
    updatedAt: now,
  };
  return saveLoadoutCollection({ ...current, activeId: deck.id, decks: [...current.decks, deck] });
}

export function renameLoadout(id: string, name: string): LoadoutCollection {
  const current = readLoadoutCollection();
  return saveLoadoutCollection({
    ...current,
    decks: current.decks.map((deck) => deck.id === id ? { ...deck, name: name.trim().slice(0, 32) || deck.name, updatedAt: Date.now() } : deck),
  });
}

export function deleteLoadout(id: string): LoadoutCollection {
  const current = readLoadoutCollection();
  if (current.decks.length <= 1) return current;
  const decks = current.decks.filter((deck) => deck.id !== id);
  return saveLoadoutCollection({ ...current, decks, activeId: current.activeId === id ? decks[0].id : current.activeId });
}

export function setActiveLoadout(id: string): LoadoutCollection {
  const current = readLoadoutCollection();
  if (!current.decks.some((deck) => deck.id === id)) return current;
  return saveLoadoutCollection({ ...current, activeId: id });
}

export function updateLoadoutCards(id: string, cardIds: string[]): LoadoutCollection {
  const current = readLoadoutCollection();
  return saveLoadoutCollection({
    ...current,
    decks: current.decks.map((deck) => deck.id === id ? { ...deck, cardIds: sanitizeCardIds(cardIds), updatedAt: Date.now() } : deck),
  });
}

export function subscribeLoadouts(listener: (collection: LoadoutCollection) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<LoadoutCollection>).detail ?? readLoadoutCollection());
  const storageHandler = (event: StorageEvent) => {
    if (event.key === LOADOUT_STORAGE_KEY) listener(readLoadoutCollection());
  };
  window.addEventListener(LOADOUT_EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(LOADOUT_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

export function applyActiveLoadoutToLivingUnits(collection = readLoadoutCollection()): void {
  const selected = activeLoadout(collection).cardIds;
  const guardian = selected.filter((id) => TCG_CARDS[id]?.unitRole === "guardian");
  const archer = selected.filter((id) => TCG_CARDS[id]?.unitRole === "archer");
  for (const unit of INITIAL_LIVING_UNITS) {
    if (unit.id === "kael" && guardian.length > 0) unit.deck = [...guardian];
    if (unit.id === "lyra" && archer.length > 0) unit.deck = [...archer];
  }
}

export function cardOrigin(cardId: string): CardOrigin {
  const origins: Record<string, CardOrigin> = {
    "kael-golpe-runico": { source: "Grimório inicial", mission: "Prólogo", requirement: "Disponível desde o primeiro acesso" },
    "kael-guardiao-celeste": { source: "Juramento de Kael", mission: "Prólogo", requirement: "Disponível desde o primeiro acesso" },
    "lyra-flecha-eter": { source: "Eco do Observatório", mission: "Prólogo", requirement: "Disponível desde o primeiro acesso" },
    "lyra-passo-lunar": { source: "Libertação de Lyra", mission: "A Ponte das Cinzas", requirement: "Concluir o objetivo 1" },
    "kael-contra-selo": { source: "Runa da Ponte", mission: "A Ponte das Cinzas", requirement: "Concluir o objetivo 2" },
    "lyra-marca-cacada": { source: "Marca do Moinho", mission: "A Ponte das Cinzas", requirement: "Concluir o objetivo 4" },
    "kael-muralha-astral": { source: "Círculo de Orun", mission: "A Ponte das Cinzas", requirement: "Concluir a missão" },
    "lyra-chuva-prismatica": { source: "Arco Prismático", mission: "A Ponte das Cinzas", requirement: "Concluir a missão" },
  };
  return origins[cardId] ?? { source: "Bestiário", mission: "A Ponte das Cinzas", requirement: "Derrotar o adversário correspondente" };
}

export function domainProgress(unlocked: Set<string>) {
  const playerCards = PLAYER_LOADOUT_CARD_IDS.map((id) => TCG_CARDS[id]);
  return (["guardian", "archer"] as const).map((role) => {
    const cards = playerCards.filter((card) => card.unitRole === role);
    const amount = cards.filter((card) => unlocked.has(card.id)).length;
    return { role, amount, total: cards.length, percent: cards.length > 0 ? Math.round((amount / cards.length) * 100) : 0 };
  });
}

applyActiveLoadoutToLivingUnits();
