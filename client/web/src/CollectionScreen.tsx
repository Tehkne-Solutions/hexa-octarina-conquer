import { useMemo, useState } from "react";

import { FantasyUnitSprite } from "./FantasyUnitSprite";
import { INITIAL_LIVING_UNITS, TCG_CARDS, type LivingUnit, type TcgCard } from "./living-board-data";
import type { CampaignAchievement, CampaignCatalog } from "./protocol";
import { TcgCardFrame } from "./TcgCardFrame";
import {
  type LivingCampaignProgress,
  unlockedCardIds,
  unlockedUnitIds,
} from "./unified-progress";

type CollectionTab = "cards" | "units" | "rewards" | "achievements";

interface CollectionScreenProps {
  catalog: CampaignCatalog | null;
  progress: LivingCampaignProgress;
  onBack: () => void;
}

interface RewardEntry {
  id: string;
  title: string;
  type: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

const TAB_LABELS: Array<{ id: CollectionTab; label: string; icon: string }> = [
  { id: "cards", label: "Cartas TCG", icon: "◆" },
  { id: "units", label: "Unidades", icon: "♜" },
  { id: "rewards", label: "Relíquias", icon: "✦" },
  { id: "achievements", label: "Conquistas", icon: "⬡" },
];

function unitDescription(unit: LivingUnit): string {
  if (unit.id === "kael") return "Guardião de linha de frente. Fecha rotas, absorve impacto e converte defesa em contra-ataque.";
  if (unit.id === "lyra") return "Arqueira de alta mobilidade. Controla iniciativa, marca alvos e dispara rajadas prismáticas.";
  if (unit.id === "raider-mill") return "Capitão das Cinzas e guardião do Moinho do Norte. Registrado no bestiário após a vitória.";
  return "Saqueador da Ponte das Cinzas. Especialista em investidas rápidas e pressão territorial.";
}

function unitRoleLabel(unit: LivingUnit): string {
  return {
    guardian: "Guardião",
    archer: "Arqueira",
    raider: "Saqueador",
  }[unit.role];
}

export function CollectionScreen({ catalog, progress, onBack }: CollectionScreenProps) {
  const [tab, setTab] = useState<CollectionTab>("cards");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("kael-golpe-runico");

  const cardUnlocks = useMemo(() => unlockedCardIds(progress, catalog), [progress, catalog]);
  const unitUnlocks = useMemo(() => unlockedUnitIds(progress, catalog), [progress, catalog]);
  const cards = useMemo(() => Object.values(TCG_CARDS), []);
  const units = useMemo(() => INITIAL_LIVING_UNITS, []);
  const rewards = useMemo<RewardEntry[]>(() => [
    {
      id: "arco-prismatico",
      title: "Arco Prismático",
      type: "Arma de Lyra",
      description: "Recompensa de A Ponte das Cinzas. Amplifica ataques de Éter e reduz o custo da Chuva Prismática.",
      icon: "➶",
      unlocked: progress.status === "victory" || (catalog?.totals.completed ?? 0) > 0,
    },
    {
      id: "fazenda-arcana",
      title: "Fazenda Arcana",
      type: "Construção econômica",
      description: "Converte a célula do moinho em produção de alimento e recuperação entre confrontos.",
      icon: "🌾",
      unlocked: progress.building === "farm",
    },
    {
      id: "torre-runica",
      title: "Torre Rúnica",
      type: "Construção defensiva",
      description: "Protege trilhas adjacentes e fortalece o controle das fronteiras octarinas.",
      icon: "♜",
      unlocked: progress.building === "tower",
    },
  ], [progress, catalog]);

  const achievements = catalog?.achievements ?? [];
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredCards = cards.filter((card) => (
    !normalizedQuery
    || `${card.name} ${card.element} ${card.keywords.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
  ));
  const filteredUnits = units.filter((unit) => (
    !normalizedQuery
    || `${unit.name} ${unit.title} ${unit.element}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
  ));
  const filteredRewards = rewards.filter((reward) => (
    !normalizedQuery
    || `${reward.title} ${reward.type}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
  ));
  const filteredAchievements = achievements.filter((achievement) => (
    !normalizedQuery
    || `${achievement.title} ${achievement.description}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)
  ));

  const selectedCard = cards.find((card) => card.id === selectedId) ?? null;
  const selectedUnit = units.find((unit) => unit.id === selectedId) ?? null;
  const selectedReward = rewards.find((reward) => reward.id === selectedId) ?? null;
  const selectedAchievement = achievements.find((achievement) => achievement.id === selectedId) ?? null;

  const selectTab = (next: CollectionTab) => {
    setTab(next);
    const firstId = next === "cards"
      ? cards[0]?.id
      : next === "units"
        ? units[0]?.id
        : next === "rewards"
          ? rewards[0]?.id
          : achievements[0]?.id;
    if (firstId) setSelectedId(firstId);
  };

  return (
    <main className="collection-screen">
      <header className="screen-heading collection-heading">
        <div>
          <p className="fantasy-eyebrow">Compêndio persistente</p>
          <h1>Arquivo Octarino</h1>
          <p>Cartas, unidades, relíquias e conquistas ligadas ao progresso real da campanha.</p>
        </div>
        <button className="fantasy-button compact" onClick={onBack}>Voltar</button>
      </header>

      <section className="collection-summary" aria-label="Resumo da coleção">
        <span><b>{cardUnlocks.size}</b><small>de {cards.length} cartas</small></span>
        <span><b>{unitUnlocks.size}</b><small>de {units.length} unidades</small></span>
        <span><b>{rewards.filter((item) => item.unlocked).length}</b><small>relíquias</small></span>
        <span><b>{achievements.filter((item) => item.unlockedAt !== null).length}</b><small>conquistas</small></span>
      </section>

      <div className="collection-toolbar">
        <div className="collection-tabs" role="tablist" aria-label="Categorias da coleção">
          {TAB_LABELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => selectTab(item.id)}
            >
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <label className="collection-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar no arquivo"
            aria-label="Buscar na coleção"
          />
        </label>
      </div>

      <section className="collection-layout">
        <div className="collection-grid" role="tabpanel">
          {tab === "cards" && filteredCards.map((card) => {
            const unlocked = cardUnlocks.has(card.id);
            return (
              <TcgCardFrame
                key={card.id}
                card={card}
                compact
                locked={!unlocked}
                selected={selectedId === card.id}
                onClick={() => setSelectedId(card.id)}
              />
            );
          })}

          {tab === "units" && filteredUnits.map((unit) => {
            const unlocked = unitUnlocks.has(unit.id);
            return (
              <button
                key={unit.id}
                type="button"
                className={`collection-unit-card ${selectedId === unit.id ? "selected" : ""} ${unlocked ? "" : "locked"}`}
                onClick={() => setSelectedId(unit.id)}
              >
                <FantasyUnitSprite unit={unit} compact selected={selectedId === unit.id} />
                <span>
                  <small>{unitRoleLabel(unit)} · {unit.element}</small>
                  <strong>{unit.name}</strong>
                  <em>{unlocked ? "Registrada" : "Silhueta bloqueada"}</em>
                </span>
              </button>
            );
          })}

          {tab === "rewards" && filteredRewards.map((reward) => (
            <button
              key={reward.id}
              type="button"
              className={`collection-reward-card ${selectedId === reward.id ? "selected" : ""} ${reward.unlocked ? "" : "locked"}`}
              onClick={() => setSelectedId(reward.id)}
            >
              <span>{reward.icon}</span>
              <div><small>{reward.type}</small><strong>{reward.title}</strong><p>{reward.unlocked ? "Desbloqueada" : "Continue a campanha"}</p></div>
            </button>
          ))}

          {tab === "achievements" && filteredAchievements.map((achievement) => (
            <button
              key={achievement.id}
              type="button"
              className={`collection-achievement-card ${selectedId === achievement.id ? "selected" : ""} ${achievement.unlockedAt ? "" : "locked"}`}
              onClick={() => setSelectedId(achievement.id)}
            >
              <span>{achievement.icon}</span>
              <div><strong>{achievement.title}</strong><p>{achievement.description}</p></div>
              <em>{achievement.unlockedAt ? "Conquistada" : "Bloqueada"}</em>
            </button>
          ))}

          {((tab === "cards" && filteredCards.length === 0)
            || (tab === "units" && filteredUnits.length === 0)
            || (tab === "rewards" && filteredRewards.length === 0)
            || (tab === "achievements" && filteredAchievements.length === 0)) ? (
              <div className="collection-empty">Nenhum registro corresponde à busca.</div>
            ) : null}
        </div>

        <aside className="collection-detail" aria-live="polite">
          {selectedCard ? <CardDetail card={selectedCard} unlocked={cardUnlocks.has(selectedCard.id)} /> : null}
          {selectedUnit ? <UnitDetail unit={selectedUnit} unlocked={unitUnlocks.has(selectedUnit.id)} /> : null}
          {selectedReward ? <RewardDetail reward={selectedReward} /> : null}
          {selectedAchievement ? <AchievementDetail achievement={selectedAchievement} /> : null}
        </aside>
      </section>
    </main>
  );
}

function CardDetail({ card, unlocked }: { card: TcgCard; unlocked: boolean }) {
  return (
    <>
      <p className="fantasy-eyebrow">Carta selecionada</p>
      <h2>{card.name}</h2>
      <span className={`detail-unlock ${unlocked ? "unlocked" : ""}`}>{unlocked ? "Disponível no grimório" : "Ainda bloqueada"}</span>
      <p>{card.description}</p>
      <blockquote>{card.flavor}</blockquote>
      <dl>
        <div><dt>Elemento</dt><dd>{card.element}</dd></div>
        <div><dt>Custo</dt><dd>{card.cost} energia</dd></div>
        <div><dt>Ataque</dt><dd>{card.attack}</dd></div>
        <div><dt>Defesa</dt><dd>{card.defense}</dd></div>
        <div><dt>Velocidade</dt><dd>{card.speed}</dd></div>
      </dl>
      <div className="detail-keywords">{card.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
    </>
  );
}

function UnitDetail({ unit, unlocked }: { unit: LivingUnit; unlocked: boolean }) {
  return (
    <>
      <p className="fantasy-eyebrow">{unit.faction === "player" ? "Herói" : "Bestiário"}</p>
      <h2>{unit.name}</h2>
      <span className={`detail-unlock ${unlocked ? "unlocked" : ""}`}>{unlocked ? "Registro completo" : "Informações ocultas"}</span>
      <p>{unitDescription(unit)}</p>
      <dl>
        <div><dt>Função</dt><dd>{unitRoleLabel(unit)}</dd></div>
        <div><dt>Elemento</dt><dd>{unit.element}</dd></div>
        <div><dt>HP</dt><dd>{unit.maxHp}</dd></div>
        <div><dt>Ataque</dt><dd>{unit.attack}</dd></div>
        <div><dt>Defesa</dt><dd>{unit.defense}</dd></div>
        <div><dt>Velocidade</dt><dd>{unit.speed}</dd></div>
      </dl>
    </>
  );
}

function RewardDetail({ reward }: { reward: RewardEntry }) {
  return (
    <>
      <p className="fantasy-eyebrow">{reward.type}</p>
      <div className="detail-reward-icon">{reward.icon}</div>
      <h2>{reward.title}</h2>
      <span className={`detail-unlock ${reward.unlocked ? "unlocked" : ""}`}>{reward.unlocked ? "Desbloqueada" : "Bloqueada"}</span>
      <p>{reward.description}</p>
    </>
  );
}

function AchievementDetail({ achievement }: { achievement: CampaignAchievement }) {
  return (
    <>
      <p className="fantasy-eyebrow">Conquista</p>
      <div className="detail-reward-icon">{achievement.icon}</div>
      <h2>{achievement.title}</h2>
      <span className={`detail-unlock ${achievement.unlockedAt ? "unlocked" : ""}`}>
        {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString("pt-BR") : "Ainda bloqueada"}
      </span>
      <p>{achievement.description}</p>
    </>
  );
}
