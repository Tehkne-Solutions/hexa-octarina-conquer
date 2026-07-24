import { useEffect, useMemo, useState } from "react";

import { FantasyUnitSprite } from "./FantasyUnitSprite";
import { GoDotsBoard } from "./GoDotsBoard";
import {
  deriveClaimedCells,
  registerInfluenceEdge,
  type InfluenceEdge,
} from "./go-dots-logic";
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

interface GoDotsLivingBoardDemoProps {
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
    text: "O mundo não é um tabuleiro de casas. As runas formam uma rede viva: pontos de invocação, trilhas de influência e territórios que só existem quando suas fronteiras são fechadas.",
    symbol: "⬡",
  },
  {
    speaker: "KAEL · GUARDIÃO RÚNICO",
    title: "Uma voz nas ruínas",
    text: "Lyra está presa no observatório. Vou avançar de nó em nó. Cada movimento deixa uma trilha rúnica; quatro fronteiras fechadas reivindicam uma célula.",
    symbol: "🛡",
  },
  {
    speaker: "ORÁCULO DE CAMPO",
    title: "Go + Dots + RPG",
    text: "Selecione Kael e toque no nó dourado. Os círculos são liberdades, as linhas são rotas e muralhas, e as áreas entre elas são territórios com recursos e construções.",
    symbol: "✦",
  },
];

const OBJECTIVE_COPY = [
  {
    title: "PASSO 1 · LIBERTE LYRA",
    label: "Libertar Lyra no Observatório",
    help: "Kael está selecionado. Avance pelos nós dourados até ficar ao lado das ruínas onde Lyra está selada.",
  },
  {
    title: "PASSO 2 · ATRAVESSE A PONTE",
    label: "Atravessar a Ponte das Cinzas",
    help: "Use os nós da rede para atravessar o rio. Cada movimento deixa uma trilha rúnica visível.",
  },
  {
    title: "PASSO 3 · VENÇA O CONFRONTO",
    label: "Vencer um confronto de fronteira",
    help: "Invada um nó ocupado pelo saqueador. O conflito direto abre a arena TCG da unidade.",
  },
  {
    title: "PASSO 4 · OCUPE O MOINHO",
    label: "Reivindicar o Moinho do Norte",
    help: "Derrote Brakk e mova uma unidade até o nó do moinho. Eliminar o defensor não significa controlar o território.",
  },
  {
    title: "PASSO 5 · CONSTRUA",
    label: "Construir Fazenda Arcana ou Torre Rúnica",
    help: "Escolha a função econômica ou defensiva da célula reivindicada.",
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

function distanceToPoint(unit: Pick<LivingUnit, "x" | "y">, point: { x: number; y: number }): number {
  return Math.abs(unit.x - point.x) + Math.abs(unit.y - point.y);
}

export function GoDotsLivingBoardDemo({ playerName, onBack }: GoDotsLivingBoardDemoProps) {
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
  const [notice, setNotice] = useState("Kael está selecionado. Toque no nó dourado recomendado.");
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>(["As runas do mapa começaram a pulsar."]);
  const [influenceEdges, setInfluenceEdges] = useState<InfluenceEdge[]>([]);

  const aliveUnits = units.filter((unit) => !unit.defeated && unit.hp > 0);
  const selectedUnit = aliveUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  const playerUnits = aliveUnits.filter((unit) => unit.faction === "player" && unit.active);
  const enemyUnits = aliveUnits.filter((unit) => unit.faction === "enemy");
  const maxCommandPoints = commandBudgetForTurn(turn);
  const claimedCells = useMemo(() => deriveClaimedCells(influenceEdges, LIVING_BOARD_SIZE), [influenceEdges]);
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

  const registerTrail = (from: Pick<LivingUnit, "x" | "y">, to: Pick<LivingUnit, "x" | "y">, owner: "player" | "enemy") => {
    setInfluenceEdges((current) => registerInfluenceEdge(current, { x: from.x, y: from.y }, { x: to.x, y: to.y }, owner));
  };

  const collectTile = (tile: LivingTile, unit: LivingUnit) => {
    if (!tile.resource || collectedTiles.includes(tile.id)) return;
    const amount = tile.resourceAmount ?? 1;
    setCollectedTiles((current) => [...current, tile.id]);
    setResources((current) => ({ ...current, [tile.resource!]: current[tile.resource!] + amount }));
    addLog(`${unit.name} ativou o recurso do nó e coletou ${amount} ${tile.resource === "wood" ? "madeira" : tile.resource === "food" ? "alimento" : "cristal"}.`);
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
      log: [`${playerUnit.name} e ${enemyUnit.name} disputam o mesmo nó de liberdade.`],
      resolution: null,
    });
    setPhase("battle");
    setNotice("CONFRONTO DE NÓ — revise a combinação sugerida e confirme.");
  };

  const moveOrAttack = (tile: LivingTile) => {
    if (phase !== "player") return;
    if (!selectedUnit || selectedUnit.faction !== "player" || !selectedUnit.active) {
      const suggested = playerUnits[0];
      if (suggested) setSelectedUnitId(suggested.id);
      setNotice("Escolha Kael ou Lyra no painel. Depois toque em uma liberdade verde.");
      return;
    }
    if (!validMoveIds.has(tile.id)) {
      setNotice("Esse nó não é uma liberdade válida. Use um círculo verde; o dourado indica a rota sugerida.");
      return;
    }

    const target = occupied.get(tile.id);
    const nextPoints = Math.max(0, commandPoints - 1);
    setCommandPoints(nextPoints);
    registerTrail(selectedUnit, tile, "player");

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
      addLog("Kael rompeu o selo do Observatório. Lyra foi invocada na rede!");
    } else if (tile.terrain === "bridge") {
      addLog(`${movedUnit.name} ativou o nó central da Ponte das Cinzas.`);
    } else {
      addLog(`${movedUnit.name} avançou para ${tile.landmark ?? `o nó ${tile.x + 1},${tile.y + 1}`}.`);
    }

    if (rescuedLyra && tile.x >= 4) setCrossedBridge(true);
    if (tile.terrain === "mill") {
      if (!captainDefeated) {
        setNotice("Brakk ainda controla o nó do moinho. Derrote o capitão antes de reivindicá-lo.");
      } else {
        setMillCaptured(true);
        addLog("O nó do Moinho do Norte foi ocupado. Escolha uma construção para a célula reivindicada.");
      }
    } else if (nextPoints === 0) {
      setNotice("A trilha foi criada. Seus Pontos de Comando acabaram: encerre o turno.");
    } else {
      setNotice(`Trilha rúnica criada. Você ainda pode agir ${nextPoints} ${nextPoints === 1 ? "vez" : "vezes"}.`);
    }
  };

  const toggleBattleCard = (cardId: string) => {
    if (!battle || battle.resolution) return;
    const alreadySelected = battle.selectedCardIds.includes(cardId);
    const next = alreadySelected ? battle.selectedCardIds.filter((id) => id !== cardId) : [...battle.selectedCardIds, cardId];
    if (selectedEnergy(next) > 3) {
      setNotice("A combinação ultrapassa os 3 pontos de energia.");
      return;
    }
    setBattle({ ...battle, selectedCardIds: next });
  };

  const resolveBattle = () => {
    if (!battle || battle.resolution) return;
    if (battle.selectedCardIds.length === 0) {
      setNotice("Escolha ao menos uma carta antes de confirmar.");
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
      resolution: { playerDamage: result.playerDamage, enemyDamage: result.enemyDamage, playerDefeated, enemyDefeated, lines },
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
        addLog("Brakk caiu. O nó do moinho está livre, mas ainda precisa ser ocupado.");
      } else {
        addLog(`${enemyUnit.name} foi derrotado. A liberdade está aberta.`);
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
  };

  const buildAtMill = (type: Exclude<BuildingType, null>) => {
    if (!millCaptured) return;
    setBuilding(type);
    addLog(type === "farm"
      ? "Fazenda Arcana construída. A célula agora produz alimento."
      : "Torre Rúnica construída. A célula agora protege as trilhas adjacentes.");
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
    setAiAction(`1/2 · ${enemy.name} escolheu uma liberdade para pressionar.`);

    let finishTimer = 0;
    const actionTimer = window.setTimeout(() => {
      if (orthogonalDistance(enemy, target) === 1) {
        registerTrail(enemy, target, "enemy");
        setAiAction(`2/2 · ${enemy.name} invadiu o nó de ${target.name}.`);
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
        registerTrail(enemy, destination, "enemy");
        setUnits((current) => current.map((unit) => unit.id === enemy.id ? { ...unit, x: destination.x, y: destination.y } : unit));
        setAiAction(`2/2 · ${enemy.name} criou uma trilha em direção a ${target.name}.`);
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
        addLog(`Rodada ${nextTurn}: você recebeu ${nextBudget} ${nextBudget === 1 ? "Ponto" : "Pontos"} de Comando.`);
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
    setAiAction("TURNO DA IA · acompanhe as trilhas inimigas sendo formadas.");
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
    setInfluenceEdges([]);
    setNotice("Kael está selecionado. Toque no nó dourado recomendado.");
    setEventLog(["As runas do mapa começaram a pulsar."]);
  };

  if (phase === "story") {
    const frame = STORY[storyIndex];
    return (
      <main className="living-demo story-scene go-dots-story">
        <button className="living-back-button" onClick={onBack}>← Voltar</button>
        <section className="story-diorama">
          <div className="story-rain" />
          <div className="story-river" />
          <div className="go-story-network"><i /><i /><i /><i /><i /><i /><b /><b /><b /></div>
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
          }}>{storyIndex < STORY.length - 1 ? "Continuar" : "Entrar na rede"}</button>
        </section>
      </main>
    );
  }

  if (phase === "victory" || phase === "defeat") {
    return (
      <main className={`living-demo outcome-screen ${phase}`}>
        <div className="outcome-rune">{phase === "victory" ? "✦" : "◇"}</div>
        <p className="living-eyebrow">{phase === "victory" ? "MISSÃO CONCLUÍDA" : "A REDE FOI ROMPIDA"}</p>
        <h1>{phase === "victory" ? "Orun voltou a respirar" : "Reagrupe suas unidades"}</h1>
        <p>{phase === "victory"
          ? `${building === "farm" ? "A Fazenda Arcana" : "A Torre Rúnica"} ocupa a célula do moinho. ${claimedCells.length} territórios foram fechados por trilhas durante a missão.`
          : "Preserve as liberdades, feche células e combine cartas de ataque e defesa."}</p>
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
  const enemyIntentCard = battle?.enemyCardIds[0] ? TCG_CARDS[battle.enemyCardIds[0]] : null;
  const battlePreview = battle && battlePlayer && battleEnemy && battle.selectedCardIds.length > 0
    ? resolveCombatRound(battlePlayer, battleEnemy, battle.selectedCardIds, battle.enemyCardIds)
    : null;

  return (
    <main className="living-demo go-dots-demo">
      <header className="living-topbar">
        <button className="living-back-button" onClick={onBack}>← Menu</button>
        <div className="mission-identity"><small>VERTICAL SLICE · GO + DOTS + RPG</small><strong>A Ponte das Cinzas</strong></div>
        <div className="resource-strip">
          <span>🪵 {resources.wood}</span><span>◈ {resources.crystal}</span><span>🌾 {resources.food}</span><span>⬡ {claimedCells.length}</span>
        </div>
      </header>

      <section className="living-layout go-dots-layout">
        <aside className="living-mission-panel glass">
          <div className="phase-banner">
            <small>RODADA {turn}</small>
            <strong>{phase === "enemy" ? "TURNO DA IA" : phase === "battle" ? "CONFLITO DE NÓ" : "SEU TURNO"}</strong>
          </div>
          <div className="command-points">
            <span>PONTOS DE COMANDO</span>
            <div>{Array.from({ length: maxCommandPoints }, (_, index) => <i key={index} className={index < commandPoints ? "active" : ""}>✦</i>)}</div>
            <small>{maxCommandPoints - commandPoints} ações usadas · {commandPoints} restantes</small>
          </div>
          <div className="current-objective-card">
            <small>{currentObjective.title}</small>
            <strong>{currentObjective.label}</strong>
            <p>{currentObjective.help}</p>
          </div>
          <div className="objective-list compact-objectives">
            {OBJECTIVE_COPY.map((objective, index) => (
              <div key={objective.label} className={index < objectiveIndex ? "completed" : index === objectiveIndex ? "current" : "locked"}>
                <span>{index < objectiveIndex ? "✓" : index + 1}</span><p>{objective.label}</p>
              </div>
            ))}
          </div>
          <div className="living-notice"><b>ORÁCULO</b><p>{aiAction ?? notice}</p></div>
          <button className={`end-turn-button ${commandPoints === 0 ? "urgent" : ""}`} disabled={phase !== "player"} onClick={endTurn}>
            {commandPoints === 0 ? "Passar para a IA" : "Encerrar turno"}
          </button>
        </aside>

        <GoDotsBoard
          tiles={tiles}
          units={aliveUnits}
          selectedUnitId={selectedUnitId}
          validNodeIds={validMoveIds}
          recommendedNodeId={recommendedMoveId}
          objectiveTargetId={objectiveTargetId}
          influenceEdges={influenceEdges}
          claimedCells={claimedCells}
          building={building}
          disabled={phase !== "player"}
          onNodeClick={(tile) => {
            const unit = occupied.get(tile.id);
            if (unit?.faction === "player" && unit.active && phase === "player") {
              setSelectedUnitId(unit.id);
              setNotice(`${unit.name} selecionado. As liberdades verdes estão disponíveis.`);
            } else moveOrAttack(tile);
          }}
        />

        <aside className="unit-command-panel glass go-unit-panel">
          <div className="unit-roster">
            <h3>Unidades invocadas</h3>
            {units.filter((unit) => unit.faction === "player").map((unit) => (
              <button
                key={unit.id}
                className={`${selectedUnitId === unit.id ? "selected" : ""} ${unit.active ? "" : "locked"}`}
                disabled={!unit.active || unit.defeated || phase !== "player"}
                onClick={() => {
                  setSelectedUnitId(unit.id);
                  setNotice(`${unit.name} selecionado. Escolha uma liberdade verde.`);
                }}
              >
                <FantasyUnitSprite unit={unit} selected={selectedUnitId === unit.id} compact />
                <div><strong>{unit.name}</strong><small>{unit.title}</small><span>HP {unit.hp}/{unit.maxHp}</span></div>
              </button>
            ))}
          </div>

          {selectedUnit ? (
            <div className="selected-unit-card go-selected-unit">
              <FantasyUnitSprite unit={selectedUnit} selected />
              <div><small>{selectedUnit.title}</small><h2>{selectedUnit.name}</h2><p>{selectedUnit.element} · Nível {selectedUnit.level}</p></div>
            </div>
          ) : <div className="empty-command"><span>⬡</span><p>Selecione uma unidade invocada.</p></div>}

          {selectedUnit && <div className="unit-stats"><span>⚔ {selectedUnit.attack}</span><span>◆ {selectedUnit.defense}</span><span>➤ {selectedUnit.speed}</span></div>}
          <p className="unit-help">Mova entre pontos adjacentes. Cada movimento desenha uma trilha. Quatro trilhas da mesma facção fecham uma célula territorial.</p>
          <div className="event-timeline"><h3>Crônica do turno</h3>{eventLog.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}</div>
        </aside>
      </section>

      {phase === "enemy" && <div className="ai-turn-curtain"><span className="ai-eye">◉</span><small>FASE INIMIGA</small><strong>{aiAction ?? "A IA está lendo a rede..."}</strong><i /></div>}

      {millCaptured && !building && (
        <section className="construction-overlay">
          <div className="construction-modal glass">
            <small>TERRITÓRIO REIVINDICADO</small>
            <h2>O que será construído na célula do moinho?</h2>
            <p>A primeira construção é fornecida pela missão.</p>
            <div className="construction-options">
              <button onClick={() => buildAtMill("farm")}><span className="construction-art farm-art"><i /><b /><em /></span><div><strong>Fazenda Arcana</strong><small>Produção de alimento e recuperação.</small></div></button>
              <button onClick={() => buildAtMill("tower")}><span className="construction-art tower-art"><i /><b /><em /></span><div><strong>Torre Rúnica</strong><small>Defesa e controle de trilhas.</small></div></button>
            </div>
          </div>
        </section>
      )}

      {battle && battlePlayer && battleEnemy && (
        <section className="living-battle-overlay">
          <div className="living-battle-stage">
            <header><div><small>CONFLITO DIRETO · NÓ CONTESTADO</small><h2>{battlePlayer.name} × {battleEnemy.name}</h2></div><div className="battle-energy">ENERGIA <b>{selectedCost}/3</b></div></header>
            <div className="battle-instruction-strip"><span>1 · Leia a intenção</span><span>2 · Escolha cartas</span><span>3 · Confirme</span></div>
            <div className="fighters">
              <div className="fighter player-fighter"><FantasyUnitSprite unit={battlePlayer} /><strong>{battlePlayer.title}</strong><span>HP {battlePlayer.hp}/{battlePlayer.maxHp}</span></div>
              <div className="battle-sigil"><span>VS</span><i>Rodada {battle.round}</i></div>
              <div className="fighter enemy-fighter"><FantasyUnitSprite unit={battleEnemy} /><strong>{battleEnemy.title}</strong><span>HP {battleEnemy.hp}/{battleEnemy.maxHp}</span></div>
            </div>
            <div className="enemy-intent revealed">
              <span>INTENÇÃO INIMIGA</span>
              <div className="intent-card-mini"><b>{enemyIntentCard?.name ?? "Ataque básico"}</b><small>⚔ {enemyIntentCard?.attack ?? 0} · ◆ {enemyIntentCard?.defense ?? 0} · ➤ {enemyIntentCard?.speed ?? 0}</small></div>
            </div>
            {battlePreview && !battle.resolution && <div className="combat-preview"><span>Você causará aproximadamente <b>{battlePreview.playerDamage}</b></span><span>Você receberá aproximadamente <b>{battlePreview.enemyDamage}</b></span></div>}
            {battle.resolution ? (
              <div className="battle-resolution-panel">
                <small>RESULTADO DA RODADA</small>
                <div><span className="damage-dealt">-{battle.resolution.playerDamage} HP inimigo</span><span className="damage-taken">-{battle.resolution.enemyDamage} HP aliado</span></div>
                {battle.resolution.lines.map((line) => <p key={line}>{line}</p>)}
                <button className="living-primary" onClick={continueBattle}>{battle.resolution.enemyDefeated || battle.resolution.playerDefeated ? "Voltar ao mapa" : "Preparar próxima rodada"}</button>
              </div>
            ) : (
              <>
                <div className="tcg-hand">
                  {battleCards.map((card) => <TcgCardView key={card.id} card={card} selected={battle.selectedCardIds.includes(card.id)} recommended={battle.recommendedCardIds.includes(card.id)} order={battle.selectedCardIds.indexOf(card.id) + 1 || undefined} onClick={() => toggleBattleCard(card.id)} />)}
                </div>
                <div className="battle-actions"><p>As cartas pertencem à unidade. Combine ataque, defesa e velocidade dentro de 3 de energia.</p><button className="living-primary" onClick={resolveBattle}>Confirmar combinação</button></div>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
