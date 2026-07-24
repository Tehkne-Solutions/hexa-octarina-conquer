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
import {
  commandBudgetForTurn,
  currentObjectiveIndex,
  recommendedCombatCards,
} from "./living-board-guidance";

interface LivingBoardDemoProps {
  playerName: string;
  onBack: () => void;
}

type DemoPhase = "story" | "player" | "enemy" | "battle" | "victory" | "defeat";
type BuildingType = "farm" | "tower" | null;

interface BattleResolution {
  playerDamage: number;
  enemyDamage: number;
  playerDefeated: boolean;
  enemyDefeated: boolean;
  lines: string[];
}

interface BattleState {
  playerUnitId: string;
  enemyUnitId: string;
  selectedCardIds: string[];
  recommendedCardIds: string[];
  enemyCardIds: string[];
  round: number;
  initiatedByEnemy: boolean;
  log: string[];
  resolution: BattleResolution | null;
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
    title: "Um comando de cada vez",
    text: "No primeiro turno você terá apenas 1 Ponto de Comando. Mova Kael, encerre o turno e observe a resposta inimiga. Os próximos turnos liberarão mais ações.",
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

const OBJECTIVE_COPY = [
  {
    title: "PASSO 1 · LIBERTE LYRA",
    label: "Libertar Lyra nas ruínas",
    help: "Kael está selecionado. Mova-o pelas casas verdes até ficar ao lado das Ruínas do Observatório.",
  },
  {
    title: "PASSO 2 · ATRAVESSE A PONTE",
    label: "Atravessar a Ponte das Cinzas",
    help: "Escolha Kael ou Lyra e atravesse o único caminho sobre o rio. A casa recomendada pulsa em dourado.",
  },
  {
    title: "PASSO 3 · VENÇA O CONFRONTO",
    label: "Vencer um confronto de fronteira",
    help: "Aproxime uma unidade de Varg. Ao entrar na liberdade vermelha, a arena TCG será aberta.",
  },
  {
    title: "PASSO 4 · OCUPE O MOINHO",
    label: "Reivindicar o Moinho do Norte",
    help: "Derrote o capitão Brakk e mova uma unidade para a casa do moinho. Derrotar não é o mesmo que ocupar.",
  },
  {
    title: "PASSO 5 · CONSTRUA",
    label: "Construir Fazenda Arcana ou Torre Rúnica",
    help: "Escolha a primeira construção de Orun. Os materiais desta construção são fornecidos pela missão.",
  },
];

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
  recommended,
  order,
  disabled,
  onClick,
}: {
  card: TcgCard;
  selected?: boolean;
  recommended?: boolean;
  order?: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`living-card rarity-${card.rarity} role-${card.unitRole} ${selected ? "selected" : ""} ${recommended ? "recommended" : ""}`}
      data-element={card.element.toLowerCase()}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="card-corner top-left" />
      <span className="card-corner top-right" />
      <span className="card-corner bottom-left" />
      <span className="card-corner bottom-right" />
      <span className="living-card-cost">{card.cost}</span>
      {order ? <span className="card-order">{order}</span> : null}
      {recommended && !selected ? <span className="recommended-ribbon">SUGERIDA</span> : null}
      <div className="living-card-header">
        <strong>{card.name}</strong>
        <small>{rarityLabel(card)} · {card.element}</small>
      </div>
      <div className="living-card-art">
        <span className="cabal-ring ring-one" />
        <span className="cabal-ring ring-two" />
        <span className="cabal-star" />
        <span className="arcana-number">{card.arcana}</span>
        <span className="card-character-silhouette" />
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

function distanceToPoint(unit: Pick<LivingUnit, "x" | "y">, point: { x: number; y: number }): number {
  return Math.abs(unit.x - point.x) + Math.abs(unit.y - point.y);
}

export function LivingBoardDemo({ playerName, onBack }: LivingBoardDemoProps) {
  const tiles = useMemo(() => createLivingTiles(), []);
  const [units, setUnits] = useState<LivingUnit[]>(cloneInitialUnits);
  const [phase, setPhase] = useState<DemoPhase>("story");
  const [storyIndex, setStoryIndex] = useState(0);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>("kael");
  const [commandPoints, setCommandPoints] = useState(commandBudgetForTurn(1));
  const [turn, setTurn] = useState(1);
  const [resources, setResources] = useState({ wood: 1, food: 0, crystal: 0 });
  const [collectedTiles, setCollectedTiles] = useState<string[]>([]);
  const [rescuedLyra, setRescuedLyra] = useState(false);
  const [crossedBridge, setCrossedBridge] = useState(false);
  const [enemiesDefeated, setEnemiesDefeated] = useState(0);
  const [captainDefeated, setCaptainDefeated] = useState(false);
  const [millCaptured, setMillCaptured] = useState(false);
  const [building, setBuilding] = useState<BuildingType>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [notice, setNotice] = useState("Kael já está selecionado. Toque na casa dourada recomendada.");
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>(["A chuva começou sobre a Ponte das Cinzas."]);

  const aliveUnits = units.filter((unit) => !unit.defeated && unit.hp > 0);
  const selectedUnit = aliveUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  const playerUnits = aliveUnits.filter((unit) => unit.faction === "player" && unit.active);
  const enemyUnits = aliveUnits.filter((unit) => unit.faction === "enemy");
  const maxCommandPoints = commandBudgetForTurn(turn);
  const objectiveIndex = currentObjectiveIndex({
    rescuedLyra,
    crossedBridge,
    enemiesDefeated,
    millCaptured,
    buildingPlaced: Boolean(building),
  });
  const currentObjective = OBJECTIVE_COPY[Math.min(objectiveIndex, OBJECTIVE_COPY.length - 1)];

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

  const objectiveTarget = useMemo(() => {
    if (objectiveIndex === 0) return { x: 2, y: 3 };
    if (objectiveIndex === 1) return { x: 3, y: 3 };
    if (objectiveIndex === 2) {
      const enemy = [...enemyUnits].sort((left, right) => (
        selectedUnit ? orthogonalDistance(selectedUnit, left) - orthogonalDistance(selectedUnit, right) : 0
      ))[0];
      return enemy ? { x: enemy.x, y: enemy.y } : { x: 4, y: 3 };
    }
    return { x: 5, y: 1 };
  }, [objectiveIndex, enemyUnits, selectedUnit]);

  const recommendedMoveId = useMemo(() => {
    if (!selectedUnit || validMoveIds.size === 0 || objectiveIndex >= 4) return null;
    return [...validMoveIds].sort((leftId, rightId) => {
      const left = tileById.get(leftId);
      const right = tileById.get(rightId);
      if (!left || !right) return 0;
      return distanceToPoint(left, objectiveTarget) - distanceToPoint(right, objectiveTarget);
    })[0] ?? null;
  }, [selectedUnit, validMoveIds, objectiveIndex, tileById, objectiveTarget]);

  const objectiveTargetId = tileId(objectiveTarget.x, objectiveTarget.y);

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
    const recommended = recommendedCombatCards(playerUnit.deck, 3);
    setBattle({
      playerUnitId: playerUnit.id,
      enemyUnitId: enemyUnit.id,
      selectedCardIds: recommended,
      recommendedCardIds: recommended,
      enemyCardIds: chooseEnemyCards(enemyUnit, 0),
      round: 1,
      initiatedByEnemy,
      log: [`${playerUnit.name} e ${enemyUnit.name} entram em uma liberdade contestada.`],
      resolution: null,
    });
    setPhase("battle");
    setNotice("CONFRONTO DE FRONTEIRA — uma combinação segura já foi sugerida. Revise e confirme.");
  };

  const moveOrAttack = (tile: LivingTile) => {
    if (phase !== "player") return;
    if (!selectedUnit || selectedUnit.faction !== "player" || !selectedUnit.active) {
      const suggested = playerUnits[0];
      if (suggested) setSelectedUnitId(suggested.id);
      setNotice("Escolha Kael ou Lyra no painel de unidades. Depois toque numa casa verde.");
      return;
    }
    if (!validMoveIds.has(tile.id)) {
      setNotice("Essa casa não é uma liberdade válida. Use uma casa verde; a dourada é a rota sugerida.");
      return;
    }

    const target = occupied.get(tile.id);
    const nextPoints = Math.max(0, commandPoints - 1);
    setCommandPoints(nextPoints);

    if (target?.faction === "enemy") {
      beginBattle(selectedUnit, target);
      return;
    }

    const movedUnit = { ...selectedUnit, x: tile.x, y: tile.y };
    setUnits((current) => current.map((unit) => unit.id === movedUnit.id ? movedUnit : unit));
    collectTile(tile, movedUnit);

    const lyra = units.find((unit) => unit.id === "lyra");
    if (!rescuedLyra && lyra && orthogonalDistance(movedUnit, lyra) <= 1) {
      setRescuedLyra(true);
      setUnits((current) => current.map((unit) => unit.id === "lyra" ? { ...unit, active: true } : unit));
      addLog("Kael rompeu o selo das ruínas. Lyra entrou no grupo e agora aparece no painel de unidades.");
    } else if (tile.terrain === "bridge") {
      addLog(`${movedUnit.name} alcançou a Ponte das Cinzas.`);
    } else {
      addLog(`${movedUnit.name} moveu-se para ${tile.landmark ?? TERRAIN_NAME[tile.terrain]}.`);
    }

    if (rescuedLyra && tile.x >= 4) setCrossedBridge(true);
    if (tile.terrain === "mill") {
      if (!captainDefeated) {
        setNotice("Brakk ainda controla o moinho. Derrote o capitão antes de reivindicar esta casa.");
      } else {
        setMillCaptured(true);
        addLog("O Moinho do Norte foi ocupado. Escolha agora a construção de Orun.");
      }
    } else if (nextPoints === 0) {
      setNotice("Ação concluída. Seus Pontos de Comando acabaram: toque em Encerrar turno.");
    } else {
      setNotice(`Ação concluída. Você ainda pode agir ${nextPoints} ${nextPoints === 1 ? "vez" : "vezes"} ou encerrar o turno.`);
    }
  };

  const toggleBattleCard = (cardId: string) => {
    if (!battle || battle.resolution) return;
    const alreadySelected = battle.selectedCardIds.includes(cardId);
    const next = alreadySelected ? battle.selectedCardIds.filter((id) => id !== cardId) : [...battle.selectedCardIds, cardId];
    if (selectedEnergy(next) > 3) {
      setNotice("A combinação ultrapassa os 3 pontos de energia. Retire uma carta antes de adicionar outra.");
      return;
    }
    setBattle({ ...battle, selectedCardIds: next });
  };

  const resolveBattle = () => {
    if (!battle || battle.resolution) return;
    if (battle.selectedCardIds.length === 0) {
      setNotice("Escolha ao menos uma carta. A combinação sugerida é um ponto de partida seguro.");
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

    const lines = [
      ...result.log,
      `${playerUnit.name} causou ${result.playerDamage} de dano.`,
      `${enemyUnit.name} causou ${result.enemyDamage} de dano.`,
    ];

    setBattle({
      ...battle,
      log: lines,
      resolution: {
        playerDamage: result.playerDamage,
        enemyDamage: result.enemyDamage,
        playerDefeated,
        enemyDefeated,
        lines,
      },
    });
  };

  const continueBattle = () => {
    if (!battle?.resolution) return;
    const playerUnit = units.find((unit) => unit.id === battle.playerUnitId);
    const enemyUnit = units.find((unit) => unit.id === battle.enemyUnitId);
    if (!playerUnit || !enemyUnit) return;

    if (battle.resolution.enemyDefeated) {
      setEnemiesDefeated((value) => value + 1);
      if (enemyUnit.id === "raider-mill") {
        setCaptainDefeated(true);
        addLog("Brakk foi derrotado. O moinho está livre, mas ainda precisa ser ocupado por uma unidade.");
      } else {
        addLog(`${enemyUnit.name} foi derrotado. A fronteira está aberta.`);
      }
      setBattle(null);
      setPhase("player");
      setSelectedUnitId(playerUnit.id);
      return;
    }

    if (battle.resolution.playerDefeated) {
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
    const recommended = recommendedCombatCards(playerUnit.deck, 3);
    setBattle({
      ...battle,
      round: nextRound,
      selectedCardIds: recommended,
      recommendedCardIds: recommended,
      enemyCardIds: chooseEnemyCards(enemyUnit, nextRound),
      resolution: null,
    });
    setNotice(`Rodada ${nextRound}: revise a combinação sugerida e confirme quando estiver pronto.`);
  };

  const buildAtMill = (type: Exclude<BuildingType, null>) => {
    if (!millCaptured) return;
    setBuilding(type);
    addLog(type === "farm"
      ? "Fazenda Arcana construída com os suprimentos de Orun. O moinho voltou a produzir alimento."
      : "Torre Rúnica construída com os suprimentos de Orun. A ponte está protegida.");
    window.setTimeout(() => setPhase("victory"), 900);
  };

  const nearestPlayer = (enemy: LivingUnit, candidates: LivingUnit[]): LivingUnit | null => (
    [...candidates].sort((left, right) => orthogonalDistance(enemy, left) - orthogonalDistance(enemy, right))[0] ?? null
  );

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
    setAiAction(`1/2 · ${enemy.name} foi selecionado pela IA.`);

    let finishTimer = 0;
    const actionTimer = window.setTimeout(() => {
      if (orthogonalDistance(enemy, target) === 1) {
        setAiAction(`2/2 · ${enemy.name} invadiu a liberdade de ${target.name}. O confronto será aberto.`);
        window.setTimeout(() => beginBattle(target, enemy, true), 650);
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
        setAiAction(`2/2 · ${enemy.name} moveu uma casa em direção a ${target.name}.`);
      } else {
        setAiAction(`2/2 · ${enemy.name} manteve posição defensiva.`);
      }

      finishTimer = window.setTimeout(() => {
        const nextTurn = turn + 1;
        const nextBudget = commandBudgetForTurn(nextTurn);
        setTurn(nextTurn);
        setCommandPoints(nextBudget);
        setSelectedUnitId(currentPlayers[0]?.id ?? null);
        setPhase("player");
        setAiAction(null);
        addLog(`Rodada ${nextTurn}: seu turno começou com ${nextBudget} ${nextBudget === 1 ? "Ponto" : "Pontos"} de Comando.`);
      }, 1200);
    }, 900);

    return () => {
      window.clearTimeout(actionTimer);
      window.clearTimeout(finishTimer);
    };
  }, [phase]);

  const endTurn = () => {
    if (phase !== "player") return;
    setSelectedUnitId(null);
    setPhase("enemy");
    setAiAction("TURNO DA IA · acompanhe as duas etapas no painel.");
    addLog(`Rodada ${turn}: ${playerName} encerrou o turno com ${commandPoints} PC restantes.`);
  };

  const resetDemo = () => {
    setUnits(cloneInitialUnits());
    setPhase("story");
    setStoryIndex(0);
    setSelectedUnitId("kael");
    setCommandPoints(commandBudgetForTurn(1));
    setTurn(1);
    setResources({ wood: 1, food: 0, crystal: 0 });
    setCollectedTiles([]);
    setRescuedLyra(false);
    setCrossedBridge(false);
    setEnemiesDefeated(0);
    setCaptainDefeated(false);
    setMillCaptured(false);
    setBuilding(null);
    setBattle(null);
    setNotice("Kael já está selecionado. Toque na casa dourada recomendada.");
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
  const battlePreview = battle && battlePlayer && battleEnemy && battle.selectedCardIds.length > 0
    ? resolveCombatRound(battlePlayer, battleEnemy, battle.selectedCardIds, battle.enemyCardIds)
    : null;
  const enemyIntentCards = battle ? battle.enemyCardIds.map((id) => TCG_CARDS[id]).filter(Boolean) : [];

  return (
    <main className="living-demo playtest-v2">
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

          <div className="command-points command-points-v2">
            <span>PONTOS DE COMANDO</span>
            <div>{Array.from({ length: maxCommandPoints }, (_, index) => <i key={index} className={index < commandPoints ? "active" : ""}>✦</i>)}</div>
            <strong>{maxCommandPoints - commandPoints}/{maxCommandPoints} ações usadas</strong>
            <small>{commandPoints > 0 ? "Você pode agir novamente ou encerrar o turno." : "Sem ações: passe o turno para a IA."}</small>
          </div>

          <div className="current-objective-card">
            <small>{currentObjective.title}</small>
            <strong>{currentObjective.label}</strong>
            <p>{currentObjective.help}</p>
          </div>

          <div className="objective-list compact-objectives">
            {OBJECTIVE_COPY.map((objective, index) => (
              <div
                key={objective.label}
                className={index < objectiveIndex ? "completed" : index === objectiveIndex ? "current" : "locked"}
              >
                <span>{index < objectiveIndex ? "✓" : index === objectiveIndex ? "◆" : "·"}</span>
                <p>{objective.label}</p>
              </div>
            ))}
          </div>

          <div className="living-notice"><b>{phase === "enemy" ? "AÇÃO DA IA" : "PRÓXIMA AÇÃO"}</b><p>{aiAction ?? notice}</p></div>
          <button className={`end-turn-button ${commandPoints === 0 ? "urgent" : ""}`} disabled={phase !== "player"} onClick={endTurn}>
            {commandPoints === 0 ? "Passar para a IA" : "Encerrar turno agora"}
          </button>
        </aside>

        <section className="living-map-wrap">
          <div className="living-map" style={{ gridTemplateColumns: `repeat(${LIVING_BOARD_SIZE}, 1fr)` }}>
            {tiles.map((tile) => {
              const unit = occupied.get(tile.id);
              const valid = validMoveIds.has(tile.id);
              const selected = selectedUnit?.x === tile.x && selectedUnit?.y === tile.y;
              const controlled = tile.terrain === "mill" && millCaptured;
              const recommended = tile.id === recommendedMoveId;
              const objectiveTargetTile = tile.id === objectiveTargetId && objectiveIndex < 4;
              return (
                <button
                  key={tile.id}
                  className={`living-tile terrain-${tile.terrain} ${valid ? "valid-move" : ""} ${recommended ? "recommended-move" : ""} ${objectiveTargetTile ? "objective-target" : ""} ${selected ? "selected-tile" : ""} ${controlled ? "controlled" : ""}`}
                  onClick={() => {
                    if (unit?.faction === "player" && unit.active && phase === "player") {
                      setSelectedUnitId(unit.id);
                      setNotice(`${unit.name} selecionado. Casas verdes mostram movimentos; a dourada é a sugestão.`);
                    } else moveOrAttack(tile);
                  }}
                  title={tile.landmark ?? TERRAIN_NAME[tile.terrain]}
                >
                  <span className="tile-height" />
                  <span className="terrain-art">{TERRAIN_ICON[tile.terrain]}</span>
                  {tile.landmark && <small>{tile.landmark}</small>}
                  <span className="invocation-node" />
                  {recommended && <span className="next-step-marker">PRÓXIMO</span>}
                  {objectiveTargetTile && <span className="objective-beacon" />}
                  {building && tile.terrain === "mill" && <span className={`map-building ${building}`}>{building === "farm" ? "♨" : "♜"}</span>}
                  {unit && <UnitFigure unit={unit} selected={selectedUnitId === unit.id} />}
                </button>
              );
            })}
          </div>
          <div className="map-legend">
            <span><i className="node-sample" /> Nó de invocação</span>
            <span className="gold-sample" /> Próxima ação sugerida
            <span className="green-sample" /> Movimento válido
            <span className="red-sample" /> Liberdade inimiga
          </div>
        </section>

        <aside className="unit-command-panel glass">
          <div className="unit-roster">
            <h3>Suas unidades</h3>
            {units.filter((unit) => unit.faction === "player").map((unit) => (
              <button
                key={unit.id}
                disabled={!unit.active || unit.defeated || unit.hp <= 0 || phase !== "player"}
                className={selectedUnitId === unit.id ? "selected" : ""}
                onClick={() => {
                  setSelectedUnitId(unit.id);
                  setNotice(`${unit.name} selecionado. Agora escolha uma casa verde.`);
                }}
              >
                <UnitFigure unit={unit} selected={selectedUnitId === unit.id} />
                <div><strong>{unit.name}</strong><small>{unit.active ? unit.title : "Prisioneira nas ruínas"}</small></div>
              </button>
            ))}
          </div>

          {selectedUnit ? (
            <>
              <div className="selected-unit-card">
                <UnitFigure unit={selectedUnit} selected />
                <div><small>{selectedUnit.title}</small><h2>{selectedUnit.name}</h2><p>{selectedUnit.element} · Nível {selectedUnit.level}</p></div>
              </div>
              <div className="unit-stats"><span>⚔ {selectedUnit.attack}</span><span>◆ {selectedUnit.defense}</span><span>➤ {selectedUnit.speed}</span></div>
              <p className="unit-help">1. Selecione a unidade. 2. Toque numa casa verde. 3. Use Encerrar turno quando terminar.</p>
            </>
          ) : <div className="empty-command"><span>⬡</span><p>Escolha Kael ou Lyra acima. A seleção não será mais perdida silenciosamente.</p></div>}

          <div className="event-timeline"><h3>Crônica do turno</h3>{eventLog.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}</div>
        </aside>
      </section>

      {phase === "enemy" && (
        <section className="ai-turn-overlay" aria-live="assertive">
          <div><small>RODADA {turn}</small><strong>TURNO DA IA</strong><p>{aiAction ?? "A IA está selecionando uma unidade..."}</p></div>
        </section>
      )}

      {millCaptured && !building && (
        <section className="build-modal-backdrop">
          <div className="build-modal glass">
            <p className="living-eyebrow">TERRITÓRIO REIVINDICADO</p>
            <h2>O que o Moinho do Norte produzirá?</h2>
            <p>Esta é a primeira construção da campanha. Os suprimentos de Orun cobrem integralmente o custo — nenhuma ação ou recurso adicional é necessário.</p>
            <div className="build-options">
              <button onClick={() => buildAtMill("farm")}>
                <span>🌾</span><div><strong>Fazenda Arcana</strong><small>Produz alimento a cada rodada</small><em>GRÁTIS NESTE TUTORIAL</em></div>
              </button>
              <button onClick={() => buildAtMill("tower")}>
                <span>♜</span><div><strong>Torre Rúnica</strong><small>Protege a ponte e amplia defesa</small><em>GRÁTIS NESTE TUTORIAL</em></div>
              </button>
            </div>
          </div>
        </section>
      )}

      {battle && battlePlayer && battleEnemy && (
        <section className="living-battle-overlay">
          <div className="living-battle-stage battle-stage-v2">
            <header>
              <div><small>CONFRONTO DE FRONTEIRA · RODADA {battle.round}</small><h2>{battlePlayer.name} × {battleEnemy.name}</h2></div>
              <div className="battle-energy">ENERGIA <b>{selectedCost}/3</b></div>
            </header>

            <div className="battle-tutorial-strip">
              <span className="done">1 · Leia a intenção</span>
              <span className={battle.selectedCardIds.length > 0 ? "done" : "active"}>2 · Escolha cartas</span>
              <span className={battle.selectedCardIds.length > 0 ? "active" : ""}>3 · Confirme</span>
            </div>

            <div className="fighters">
              <div className="fighter player-fighter"><UnitFigure unit={battlePlayer} /><strong>{battlePlayer.title}</strong><span>HP {battlePlayer.hp}/{battlePlayer.maxHp}</span></div>
              <div className="battle-sigil"><span>VS</span><i>Liberdade contestada</i></div>
              <div className="fighter enemy-fighter"><UnitFigure unit={battleEnemy} /><strong>{battleEnemy.title}</strong><span>HP {battleEnemy.hp}/{battleEnemy.maxHp}</span></div>
            </div>

            {battle.resolution ? (
              <div className="round-resolution">
                <p className="living-eyebrow">RESULTADO DA RODADA</p>
                <div className="resolution-damage">
                  <span><small>VOCÊ CAUSOU</small><strong>{battle.resolution.playerDamage}</strong></span>
                  <span><small>VOCÊ RECEBEU</small><strong>{battle.resolution.enemyDamage}</strong></span>
                </div>
                <div className="resolution-log">{battle.resolution.lines.slice(-3).map((line) => <p key={line}>{line}</p>)}</div>
                <button className="living-primary" onClick={continueBattle}>
                  {battle.resolution.enemyDefeated ? "Voltar ao mapa" : battle.resolution.playerDefeated ? "Continuar com a unidade restante" : "Preparar próxima rodada"}
                </button>
              </div>
            ) : (
              <>
                <div className="enemy-intent enemy-intent-v2">
                  <span>INTENÇÃO INIMIGA REVELADA</span>
                  <div>
                    {enemyIntentCards.map((card) => (
                      <article key={card.id}><b>{card.name}</b><small>⚔ {card.attack} · ◆ {card.defense} · ➤ {card.speed}</small></article>
                    ))}
                  </div>
                </div>

                {battlePreview && (
                  <div className="combat-preview">
                    <span><small>DANO PREVISTO</small><strong>{battlePreview.playerDamage}</strong></span>
                    <span><small>DANO RECEBIDO</small><strong>{battlePreview.enemyDamage}</strong></span>
                    <p>{battlePreview.playerTotal >= battlePreview.enemyTotal ? "Sua combinação possui vantagem total." : "A combinação inimiga é mais forte; adicione defesa ou velocidade."}</p>
                  </div>
                )}

                <div className="tcg-hand">
                  {battleCards.map((card) => (
                    <TcgCardView
                      key={card.id}
                      card={card}
                      selected={battle.selectedCardIds.includes(card.id)}
                      recommended={battle.recommendedCardIds.includes(card.id)}
                      order={battle.selectedCardIds.indexOf(card.id) + 1 || undefined}
                      onClick={() => toggleBattleCard(card.id)}
                    />
                  ))}
                </div>
                <div className="battle-actions">
                  <p>Uma combinação segura já vem selecionada. Você pode alterá-la. O painel acima mostra o dano antes da confirmação.</p>
                  <button className="living-primary" onClick={resolveBattle}>Resolver esta rodada</button>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
