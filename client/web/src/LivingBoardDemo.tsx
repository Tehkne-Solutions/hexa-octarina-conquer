import { useEffect, useMemo, useState } from "react";

import {
  INITIAL_LIVING_UNITS,
  LIVING_BOARD_SIZE,
  TCG_CARDS,
  adjacentPositions,
  chooseEnemyCards,
  createLivingTiles,
  isPassableTerrain,
  orthogonalDistance,
  resolveCombatRound,
  selectedEnergy,
  tileId,
  type LivingTile,
  type LivingUnit,
  type TcgCard,
} from "./living-board-data";

interface LivingBoardDemoProps {
  playerName: string;
  onBack: () => void;
}

type DemoPhase = "story" | "player" | "enemy" | "battle" | "victory" | "defeat";
type BuildingType = "farm" | "tower" | null;

interface BattleState {
  playerUnitId: string;
  enemyUnitId: string;
  selectedCardIds: string[];
  enemyCardIds: string[];
  round: number;
  initiatedByEnemy: boolean;
  log: string[];
}

const STORY = [
  {
    speaker: "NARRADOR",
    title: "A Ponte das Cinzas",
    text: "O rio separou Orun do moinho que alimenta a vila. Saqueadores controlam a única ponte, e as runas do mapa estão despertando.",
    symbol: "🌧",
  },
  {
    speaker: "KAEL · GUARDIÃO RÚNICO",
    title: "Uma voz nas ruínas",
    text: "Lyra ainda está presa no observatório. Primeiro eu a liberto. Depois atravessamos a ponte juntos.",
    symbol: "🛡",
  },
  {
    speaker: "ORÁCULO DE CAMPO",
    title: "Seu primeiro comando",
    text: "Selecione Kael e mova-o para uma casa verde. Você tem 3 Pontos de Comando e encerra o turno quando decidir.",
    symbol: "⬡",
  },
];

const TERRAIN_ICON: Record<string, string> = {
  grass: "✦",
  forest: "♣",
  river: "≈",
  bridge: "═",
  ruins: "⌂",
  mill: "⚙",
  village: "⌂",
  mountain: "▲",
};

const TERRAIN_NAME: Record<string, string> = {
  grass: "Planície",
  forest: "Bosque",
  river: "Rio",
  bridge: "Ponte",
  ruins: "Ruínas",
  mill: "Moinho",
  village: "Vila",
  mountain: "Montanha",
};

function cloneInitialUnits(): LivingUnit[] {
  return INITIAL_LIVING_UNITS.map((unit) => ({ ...unit, deck: [...unit.deck] }));
}

function rarityLabel(card: TcgCard): string {
  return {
    common: "Comum",
    rare: "Rara",
    epic: "Épica",
    legendary: "Lendária",
  }[card.rarity];
}

function TcgCardView({
  card,
  selected,
  disabled,
  onClick,
}: {
  card: TcgCard;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`living-card rarity-${card.rarity} ${selected ? "selected" : ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="living-card-cost">{card.cost}</span>
      <div className="living-card-header">
        <strong>{card.name}</strong>
        <small>{rarityLabel(card)} · {card.element}</small>
      </div>
      <div className="living-card-art">
        <span className="cabal-ring ring-one" />
        <span className="cabal-ring ring-two" />
        <span className="arcana-number">{card.arcana}</span>
        <b>{card.art}</b>
      </div>
      <div className="living-card-keywords">{card.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
      <p>{card.description}</p>
      <blockquote>{card.flavor}</blockquote>
      <div className="living-card-stats">
        <span title="Ataque">⚔ <b>{card.attack}</b></span>
        <span title="Defesa">◆ <b>{card.defense}</b></span>
        <span title="Velocidade">➤ <b>{card.speed}</b></span>
      </div>
    </button>
  );
}

function UnitFigure({ unit, selected = false }: { unit: LivingUnit; selected?: boolean }) {
  const glyph = unit.role === "guardian" ? "♜" : unit.role === "archer" ? "➶" : "⚔";
  return (
    <div className={`living-unit faction-${unit.faction} role-${unit.role} ${selected ? "selected" : ""} ${unit.active ? "" : "captive"}`}>
      <span className="unit-shadow" />
      <span className="unit-aura" />
      <span className="unit-body">{glyph}</span>
      <span className="unit-level">Nv.{unit.level}</span>
      <span className="unit-hp"><i style={{ width: `${Math.max(0, unit.hp / unit.maxHp) * 100}%` }} />{unit.hp}/{unit.maxHp}</span>
      {!unit.active && <span className="captive-lock">🔒</span>}
    </div>
  );
}

export function LivingBoardDemo({ playerName, onBack }: LivingBoardDemoProps) {
  const tiles = useMemo(() => createLivingTiles(), []);
  const [units, setUnits] = useState<LivingUnit[]>(cloneInitialUnits);
  const [phase, setPhase] = useState<DemoPhase>("story");
  const [storyIndex, setStoryIndex] = useState(0);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>("kael");
  const [commandPoints, setCommandPoints] = useState(3);
  const [turn, setTurn] = useState(1);
  const [resources, setResources] = useState({ wood: 1, food: 0, crystal: 0 });
  const [collectedTiles, setCollectedTiles] = useState<string[]>([]);
  const [rescuedLyra, setRescuedLyra] = useState(false);
  const [crossedBridge, setCrossedBridge] = useState(false);
  const [enemiesDefeated, setEnemiesDefeated] = useState(0);
  const [millCaptured, setMillCaptured] = useState(false);
  const [building, setBuilding] = useState<BuildingType>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [notice, setNotice] = useState("Selecione Kael e escolha uma casa verde.");
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>(["A chuva começou sobre a Ponte das Cinzas."]);

  const aliveUnits = units.filter((unit) => !unit.defeated && unit.hp > 0);
  const selectedUnit = aliveUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  const playerUnits = aliveUnits.filter((unit) => unit.faction === "player" && unit.active);
  const enemyUnits = aliveUnits.filter((unit) => unit.faction === "enemy");

  const occupied = useMemo(() => new Map(aliveUnits.map((unit) => [tileId(unit.x, unit.y), unit])), [aliveUnits]);
  const tileById = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles]);

  const validMoveIds = useMemo(() => {
    if (!selectedUnit || selectedUnit.faction !== "player" || phase !== "player" || commandPoints <= 0) return new Set<string>();
    return new Set(adjacentPositions(selectedUnit.x, selectedUnit.y)
      .filter((position) => {
        const tile = tileById.get(tileId(position.x, position.y));
        const unit = occupied.get(tileId(position.x, position.y));
        return Boolean(tile && isPassableTerrain(tile.terrain) && (!unit || unit.faction === "enemy"));
      })
      .map((position) => tileId(position.x, position.y)));
  }, [selectedUnit, phase, commandPoints, tileById, occupied]);

  const objectives = [
    { label: "Libertar Lyra nas ruínas", completed: rescuedLyra },
    { label: "Atravessar a Ponte das Cinzas", completed: crossedBridge },
    { label: "Vencer um confronto de fronteira", completed: enemiesDefeated >= 1 },
    { label: "Reivindicar o Moinho do Norte", completed: millCaptured },
    { label: "Construir Fazenda Arcana ou Torre Rúnica", completed: Boolean(building) },
  ];

  const addLog = (message: string) => {
    setEventLog((current) => [message, ...current].slice(0, 8));
    setNotice(message);
  };

  const collectTile = (tile: LivingTile, unit: LivingUnit) => {
    if (!tile.resource || collectedTiles.includes(tile.id)) return;
    const amount = tile.resourceAmount ?? 1;
    setCollectedTiles((current) => [...current, tile.id]);
    setResources((current) => ({ ...current, [tile.resource!]: current[tile.resource!] + amount }));
    addLog(`${unit.name} coletou ${amount} ${tile.resource === "wood" ? "madeira" : tile.resource === "food" ? "alimento" : "cristal"}.`);
  };

  const beginBattle = (playerUnit: LivingUnit, enemyUnit: LivingUnit, initiatedByEnemy = false) => {
    setBattle({
      playerUnitId: playerUnit.id,
      enemyUnitId: enemyUnit.id,
      selectedCardIds: [],
      enemyCardIds: chooseEnemyCards(enemyUnit, 0),
      round: 1,
      initiatedByEnemy,
      log: [`${playerUnit.name} e ${enemyUnit.name} entram em uma liberdade contestada.`],
    });
    setPhase("battle");
    setNotice("CONFRONTO DE FRONTEIRA — escolha cartas até o limite de 3 de energia.");
  };

  const moveOrAttack = (tile: LivingTile) => {
    if (phase !== "player" || !selectedUnit || selectedUnit.faction !== "player" || !selectedUnit.active) return;
    if (!validMoveIds.has(tile.id)) {
      setNotice("Escolha uma casa verde adjacente à unidade selecionada.");
      return;
    }
    const target = occupied.get(tile.id);
    if (target?.faction === "enemy") {
      setCommandPoints((value) => Math.max(0, value - 1));
      beginBattle(selectedUnit, target);
      return;
    }

    const movedUnit = { ...selectedUnit, x: tile.x, y: tile.y };
    setUnits((current) => current.map((unit) => unit.id === movedUnit.id ? movedUnit : unit));
    setCommandPoints((value) => Math.max(0, value - 1));
    collectTile(tile, movedUnit);

    const lyra = units.find((unit) => unit.id === "lyra");
    if (!rescuedLyra && lyra && orthogonalDistance(movedUnit, lyra) <= 1) {
      setRescuedLyra(true);
      setUnits((current) => current.map((unit) => unit.id === "lyra" ? { ...unit, active: true } : unit));
      addLog("Kael rompeu o selo das ruínas. Lyra entrou no grupo!");
    } else if (tile.terrain === "bridge") {
      addLog(`${movedUnit.name} alcançou a Ponte das Cinzas.`);
    } else {
      addLog(`${movedUnit.name} moveu-se para ${tile.landmark ?? TERRAIN_NAME[tile.terrain]}.`);
    }

    if (tile.x >= 4) setCrossedBridge(true);
    if (tile.terrain === "mill" && !occupied.get(tile.id)) {
      setMillCaptured(true);
      addLog("O Moinho do Norte foi reivindicado. Agora escolha uma construção.");
    }
  };

  const toggleBattleCard = (cardId: string) => {
    if (!battle) return;
    const alreadySelected = battle.selectedCardIds.includes(cardId);
    const next = alreadySelected ? battle.selectedCardIds.filter((id) => id !== cardId) : [...battle.selectedCardIds, cardId];
    if (selectedEnergy(next) > 3) {
      setNotice("A combinação ultrapassa os 3 pontos de energia disponíveis.");
      return;
    }
    setBattle({ ...battle, selectedCardIds: next });
  };

  const resolveBattle = () => {
    if (!battle || battle.selectedCardIds.length === 0) {
      setNotice("Escolha ao menos uma carta antes de confirmar a rodada.");
      return;
    }
    const playerUnit = units.find((unit) => unit.id === battle.playerUnitId);
    const enemyUnit = units.find((unit) => unit.id === battle.enemyUnitId);
    if (!playerUnit || !enemyUnit) return;

    const result = resolveCombatRound(playerUnit, enemyUnit, battle.selectedCardIds, battle.enemyCardIds);
    const nextPlayerHp = Math.max(0, playerUnit.hp - result.enemyDamage);
    const nextEnemyHp = Math.max(0, enemyUnit.hp - result.playerDamage);
    const playerDefeated = nextPlayerHp <= 0;
    const enemyDefeated = nextEnemyHp <= 0;

    setUnits((current) => current.map((unit) => {
      if (unit.id === playerUnit.id) return { ...unit, hp: nextPlayerHp, defeated: playerDefeated };
      if (unit.id === enemyUnit.id) return { ...unit, hp: nextEnemyHp, defeated: enemyDefeated };
      return unit;
    }));

    const roundLog = [
      ...result.log,
      `${playerUnit.name} causa ${result.playerDamage} de dano.`,
      `${enemyUnit.name} causa ${result.enemyDamage} de dano.`,
    ];

    if (enemyDefeated) {
      setEnemiesDefeated((value) => value + 1);
      if (enemyUnit.id === "raider-mill") {
        setMillCaptured(true);
        roundLog.push("O capitão caiu. O Moinho do Norte está livre para ser ocupado.");
      }
      addLog(`${enemyUnit.name} foi derrotado. A fronteira está aberta.`);
      setBattle(null);
      setPhase("player");
      return;
    }

    if (playerDefeated) {
      const remaining = playerUnits.filter((unit) => unit.id !== playerUnit.id && !unit.defeated);
      addLog(`${playerUnit.name} caiu no confronto.`);
      setBattle(null);
      if (remaining.length === 0) setPhase("defeat");
      else {
        setSelectedUnitId(remaining[0]?.id ?? null);
        setPhase("player");
      }
      return;
    }

    const nextRound = battle.round + 1;
    setBattle({
      ...battle,
      round: nextRound,
      selectedCardIds: [],
      enemyCardIds: chooseEnemyCards(enemyUnit, nextRound),
      log: roundLog,
    });
    setNotice(`Rodada ${battle.round} resolvida. Escolha a próxima combinação.`);
  };

  const buildAtMill = (type: Exclude<BuildingType, null>) => {
    const cost = type === "farm" ? { wood: 2, crystal: 0 } : { wood: 2, crystal: 1 };
    if (!millCaptured) {
      setNotice("Primeiro derrote o capitão e ocupe o moinho.");
      return;
    }
    if (commandPoints < 2) {
      setNotice("Construir exige 2 Pontos de Comando.");
      return;
    }
    if (resources.wood < cost.wood || resources.crystal < cost.crystal) {
      setNotice("Recursos insuficientes. Explore o bosque e as ruínas.");
      return;
    }
    setResources((current) => ({ ...current, wood: current.wood - cost.wood, crystal: current.crystal - cost.crystal }));
    setCommandPoints((value) => value - 2);
    setBuilding(type);
    addLog(type === "farm" ? "Fazenda Arcana construída. Orun voltará a produzir alimento." : "Torre Rúnica construída. A ponte está protegida.");
    window.setTimeout(() => setPhase("victory"), 600);
  };

  const nearestPlayer = (enemy: LivingUnit, candidates: LivingUnit[]): LivingUnit | null => {
    return [...candidates].sort((left, right) => orthogonalDistance(enemy, left) - orthogonalDistance(enemy, right))[0] ?? null;
  };

  useEffect(() => {
    if (phase !== "enemy") return;
    const currentEnemies = units.filter((unit) => unit.faction === "enemy" && !unit.defeated && unit.hp > 0);
    const currentPlayers = units.filter((unit) => unit.faction === "player" && unit.active && !unit.defeated && unit.hp > 0);
    if (currentEnemies.length === 0 || currentPlayers.length === 0) {
      setPhase(currentPlayers.length === 0 ? "defeat" : "player");
      return;
    }

    const enemy = currentEnemies[turn % currentEnemies.length];
    const target = nearestPlayer(enemy, currentPlayers);
    if (!target) return;
    setAiAction(`${enemy.name} avalia o terreno...`);

    const timer = window.setTimeout(() => {
      if (orthogonalDistance(enemy, target) === 1) {
        setAiAction(`${enemy.name} invade a liberdade de ${target.name}.`);
        beginBattle(target, enemy, true);
        return;
      }

      const options = adjacentPositions(enemy.x, enemy.y)
        .map((point) => ({ ...point, tile: tileById.get(tileId(point.x, point.y)) }))
        .filter((option) => option.tile && isPassableTerrain(option.tile.terrain) && !occupied.has(tileId(option.x, option.y)))
        .sort((left, right) => (
          Math.abs(left.x - target.x) + Math.abs(left.y - target.y)
          - (Math.abs(right.x - target.x) + Math.abs(right.y - target.y))
        ));
      const destination = options[0];
      if (destination) {
        setUnits((current) => current.map((unit) => unit.id === enemy.id ? { ...unit, x: destination.x, y: destination.y } : unit));
        setAiAction(`${enemy.name} moveu-se em direção a ${target.name}.`);
      } else {
        setAiAction(`${enemy.name} manteve posição defensiva.`);
      }

      window.setTimeout(() => {
        setTurn((value) => value + 1);
        setCommandPoints(3);
        setPhase("player");
        setAiAction(null);
        addLog(`Turno ${turn + 1}: você recebeu 3 Pontos de Comando.`);
      }, 900);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [phase]);

  const endTurn = () => {
    if (phase !== "player") return;
    setSelectedUnitId(null);
    setPhase("enemy");
    setAiAction("TURNO DA IA — acompanhe cada ação.");
    addLog(`Turno ${turn} encerrado por ${playerName}.`);
  };

  const resetDemo = () => {
    setUnits(cloneInitialUnits());
    setPhase("story");
    setStoryIndex(0);
    setSelectedUnitId("kael");
    setCommandPoints(3);
    setTurn(1);
    setResources({ wood: 1, food: 0, crystal: 0 });
    setCollectedTiles([]);
    setRescuedLyra(false);
    setCrossedBridge(false);
    setEnemiesDefeated(0);
    setMillCaptured(false);
    setBuilding(null);
    setBattle(null);
    setNotice("Selecione Kael e escolha uma casa verde.");
    setEventLog(["A chuva começou sobre a Ponte das Cinzas."]);
  };

  if (phase === "story") {
    const frame = STORY[storyIndex];
    return (
      <main className="living-demo story-scene">
        <button className="living-back-button" onClick={onBack}>← Voltar</button>
        <section className="story-diorama">
          <div className="story-rain" />
          <div className="story-river" />
          <div className="story-bridge">╬</div>
          <div className="story-symbol">{frame.symbol}</div>
        </section>
        <section className="story-dialogue glass">
          <small>{frame.speaker}</small>
          <h1>{frame.title}</h1>
          <p>{frame.text}</p>
          <div className="story-progress">{STORY.map((_, index) => <i key={index} className={index <= storyIndex ? "active" : ""} />)}</div>
          <button className="living-primary" onClick={() => {
            if (storyIndex < STORY.length - 1) setStoryIndex((value) => value + 1);
            else setPhase("player");
          }}>{storyIndex < STORY.length - 1 ? "Continuar" : "Assumir o comando"}</button>
        </section>
      </main>
    );
  }

  if (phase === "victory" || phase === "defeat") {
    return (
      <main className={`living-demo outcome-screen ${phase}`}>
        <div className="outcome-rune">{phase === "victory" ? "✦" : "◇"}</div>
        <p className="living-eyebrow">{phase === "victory" ? "MISSÃO CONCLUÍDA" : "A PONTE PERMANECE CERCADA"}</p>
        <h1>{phase === "victory" ? "Orun voltou a respirar" : "Reagrupe suas unidades"}</h1>
        <p>{phase === "victory"
          ? `${building === "farm" ? "A Fazenda Arcana" : "A Torre Rúnica"} agora domina o Moinho do Norte. Lyra recebeu o Arco Prismático como recompensa.`
          : "Revise o posicionamento, preserve as liberdades de suas unidades e combine cartas defensivas com ataques rápidos."}</p>
        {phase === "victory" && <div className="reward-card"><span>➶</span><div><small>NOVA ARMA</small><strong>Arco Prismático</strong><p>+1 Ataque · Chuva Prismática custa menos 1 energia.</p></div></div>}
        <div className="outcome-actions">
          <button className="living-secondary" onClick={onBack}>Voltar ao menu</button>
          <button className="living-primary" onClick={resetDemo}>Jogar novamente</button>
        </div>
      </main>
    );
  }

  const battlePlayer = battle ? units.find((unit) => unit.id === battle.playerUnitId) ?? null : null;
  const battleEnemy = battle ? units.find((unit) => unit.id === battle.enemyUnitId) ?? null : null;
  const battleCards = battlePlayer ? battlePlayer.deck.map((id) => TCG_CARDS[id]).filter(Boolean) : [];
  const selectedCost = battle ? selectedEnergy(battle.selectedCardIds) : 0;

  return (
    <main className="living-demo">
      <header className="living-topbar">
        <button className="living-back-button" onClick={onBack}>← Menu</button>
        <div className="mission-identity"><small>VERTICAL SLICE · GDD 2.0</small><strong>A Ponte das Cinzas</strong></div>
        <div className="resource-strip">
          <span>🪵 {resources.wood}</span><span>◈ {resources.crystal}</span><span>🌾 {resources.food}</span>
        </div>
      </header>

      <section className="living-layout">
        <aside className="living-mission-panel glass">
          <div className="phase-banner">
            <small>RODADA {turn}</small>
            <strong>{phase === "enemy" ? "TURNO DA IA" : phase === "battle" ? "CONFLITO DIRETO" : "SEU TURNO"}</strong>
          </div>
          <div className="command-points">
            <span>PONTOS DE COMANDO</span>
            <div>{[0, 1, 2].map((index) => <i key={index} className={index < commandPoints ? "active" : ""}>✦</i>)}</div>
            <small>Você decide quando encerrar o turno.</small>
          </div>
          <div className="objective-list">
            <h3>Objetivos</h3>
            {objectives.map((objective, index) => (
              <div key={objective.label} className={objective.completed ? "completed" : index === objectives.findIndex((item) => !item.completed) ? "current" : ""}>
                <span>{objective.completed ? "✓" : index + 1}</span><p>{objective.label}</p>
              </div>
            ))}
          </div>
          <div className="living-notice"><b>ORÁCULO</b><p>{aiAction ?? notice}</p></div>
          <button className="end-turn-button" disabled={phase !== "player"} onClick={endTurn}>Encerrar turno</button>
        </aside>

        <section className="living-map-wrap">
          <div className="living-map" style={{ gridTemplateColumns: `repeat(${LIVING_BOARD_SIZE}, 1fr)` }}>
            {tiles.map((tile) => {
              const unit = occupied.get(tile.id);
              const valid = validMoveIds.has(tile.id);
              const selected = selectedUnit?.x === tile.x && selectedUnit?.y === tile.y;
              const controlled = tile.terrain === "mill" && millCaptured;
              return (
                <button
                  key={tile.id}
                  className={`living-tile terrain-${tile.terrain} ${valid ? "valid-move" : ""} ${selected ? "selected-tile" : ""} ${controlled ? "controlled" : ""}`}
                  onClick={() => {
                    if (unit?.faction === "player" && unit.active && phase === "player") {
                      setSelectedUnitId(unit.id);
                      setNotice(`${unit.name} selecionado. Casas verdes mostram movimentos válidos.`);
                    } else moveOrAttack(tile);
                  }}
                  title={tile.landmark ?? TERRAIN_NAME[tile.terrain]}
                >
                  <span className="tile-height" />
                  <span className="terrain-art">{TERRAIN_ICON[tile.terrain]}</span>
                  {tile.landmark && <small>{tile.landmark}</small>}
                  <span className="invocation-node" />
                  {building && tile.terrain === "mill" && <span className={`map-building ${building}`}>{building === "farm" ? "♨" : "♜"}</span>}
                  {unit && <UnitFigure unit={unit} selected={selectedUnitId === unit.id} />}
                </button>
              );
            })}
          </div>
          <div className="map-legend"><span><i className="node-sample" /> Nó de invocação</span><span className="green-sample" /> Movimento válido<span className="red-sample" /> Liberdade inimiga</div>
        </section>

        <aside className="unit-command-panel glass">
          {selectedUnit ? (
            <>
              <div className="selected-unit-card">
                <UnitFigure unit={selectedUnit} selected />
                <div><small>{selectedUnit.title}</small><h2>{selectedUnit.name}</h2><p>{selectedUnit.element} · Nível {selectedUnit.level}</p></div>
              </div>
              <div className="unit-stats"><span>⚔ {selectedUnit.attack}</span><span>◆ {selectedUnit.defense}</span><span>➤ {selectedUnit.speed}</span></div>
              <p className="unit-help">Clique numa casa verde para mover. Clique num inimigo adjacente para iniciar o confronto por cartas.</p>
            </>
          ) : <div className="empty-command"><span>⬡</span><p>Selecione uma unidade viva no mapa.</p></div>}

          {millCaptured && !building && (
            <div className="build-choice">
              <h3>Reivindicar território</h3>
              <p>Escolha o que o moinho produzirá para Orun.</p>
              <button onClick={() => buildAtMill("farm")}><span>🌾</span><div><b>Fazenda Arcana</b><small>2 madeira · gera alimento</small></div></button>
              <button onClick={() => buildAtMill("tower")}><span>♜</span><div><b>Torre Rúnica</b><small>2 madeira + 1 cristal · defesa</small></div></button>
            </div>
          )}

          <div className="event-timeline"><h3>Crônica do turno</h3>{eventLog.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}</div>
        </aside>
      </section>

      {battle && battlePlayer && battleEnemy && (
        <section className="living-battle-overlay">
          <div className="living-battle-stage">
            <header><div><small>CONFRONTO DE FRONTEIRA</small><h2>{battlePlayer.name} × {battleEnemy.name}</h2></div><div className="battle-energy">ENERGIA <b>{selectedCost}/3</b></div></header>
            <div className="fighters">
              <div className="fighter player-fighter"><UnitFigure unit={battlePlayer} /><strong>{battlePlayer.title}</strong><span>HP {battlePlayer.hp}/{battlePlayer.maxHp}</span></div>
              <div className="battle-sigil"><span>VS</span><i>Rodada {battle.round}</i></div>
              <div className="fighter enemy-fighter"><UnitFigure unit={battleEnemy} /><strong>{battleEnemy.title}</strong><span>HP {battleEnemy.hp}/{battleEnemy.maxHp}</span></div>
            </div>
            <div className="enemy-intent"><span>INTENÇÃO INIMIGA</span><div className="enemy-card-back">☿</div><small>{battle.enemyCardIds.length} carta preparada</small></div>
            {battle.log.length > 1 && <div className="battle-log-line">{battle.log.slice(-2).join(" ")}</div>}
            <div className="tcg-hand">
              {battleCards.map((card) => <TcgCardView key={card.id} card={card} selected={battle.selectedCardIds.includes(card.id)} onClick={() => toggleBattleCard(card.id)} />)}
            </div>
            <div className="battle-actions"><p>Combine cartas até 3 de energia. Ataque, defesa e velocidade são somados aos atributos da unidade.</p><button className="living-primary" onClick={resolveBattle}>Confirmar combinação</button></div>
          </div>
        </section>
      )}
    </main>
  );
}
