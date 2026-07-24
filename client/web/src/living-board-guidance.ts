import { TCG_CARDS, type TcgCard } from "./living-board-data";

export interface LivingObjectiveFlags {
  rescuedLyra: boolean;
  crossedBridge: boolean;
  enemiesDefeated: number;
  millCaptured: boolean;
  buildingPlaced: boolean;
}

export function commandBudgetForTurn(turn: number): number {
  if (turn <= 1) return 1;
  if (turn === 2) return 2;
  return 3;
}

export function currentObjectiveIndex(flags: LivingObjectiveFlags): number {
  if (!flags.rescuedLyra) return 0;
  if (!flags.crossedBridge) return 1;
  if (flags.enemiesDefeated < 1) return 2;
  if (!flags.millCaptured) return 3;
  if (!flags.buildingPlaced) return 4;
  return 5;
}

function cardScore(card: TcgCard): number {
  return card.attack * 2 + card.defense + card.speed;
}

export function recommendedCombatCards(deck: string[], energy = 3): string[] {
  const cards = deck
    .map((id) => TCG_CARDS[id])
    .filter((card): card is TcgCard => Boolean(card));
  let bestIds: string[] = [];
  let bestScore = -1;

  const visit = (index: number, selected: TcgCard[], spent: number) => {
    if (spent > energy) return;
    const score = selected.reduce((total, card) => total + cardScore(card), 0);
    if (selected.length > 0 && score > bestScore) {
      bestScore = score;
      bestIds = selected.map((card) => card.id);
    }
    for (let next = index; next < cards.length; next += 1) {
      visit(next + 1, [...selected, cards[next]], spent + cards[next].cost);
    }
  };

  visit(0, [], 0);
  return bestIds;
}
