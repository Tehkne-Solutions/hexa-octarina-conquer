export type BattleCoachStepId =
  | "story"
  | "movement"
  | "bridge"
  | "combat"
  | "capture"
  | "construction";

export interface BattleCoachSnapshot {
  storyActive: boolean;
  objectiveIndex: number;
  battleOpen: boolean;
  constructionOpen: boolean;
  victory: boolean;
  defeat: boolean;
  aiActive: boolean;
  aiMessage: string | null;
}

export interface BattleCoachStep {
  id: BattleCoachStepId;
  eyebrow: string;
  title: string;
  description: string;
  targetSelector: string;
  actionLabel: string;
}

export const BATTLE_COACH_STEPS: Record<BattleCoachStepId, BattleCoachStep> = {
  story: {
    id: "story",
    eyebrow: "Prólogo guiado",
    title: "Leia o campo antes de agir",
    description: "A introdução apresenta pontos de invocação, trilhas e territórios. Avance no seu ritmo ou pule a cena se já conhecer a missão.",
    targetSelector: ".story-dialogue",
    actionLabel: "Continuar história",
  },
  movement: {
    id: "movement",
    eyebrow: "Regra 1 · Movimento",
    title: "Use as liberdades da rede",
    description: "Selecione Kael e toque em um nó verde adjacente. O nó dourado indica a rota recomendada para libertar Lyra.",
    targetSelector: ".go-dots-board, .living-board-stage, .current-objective-card",
    actionLabel: "Entendi o movimento",
  },
  bridge: {
    id: "bridge",
    eyebrow: "Regra 2 · Trilhas",
    title: "Cada passo desenha influência",
    description: "Atravesse a ponte usando nós adjacentes. As trilhas permanecem no mapa e quatro fronteiras da mesma facção fecham uma célula.",
    targetSelector: ".go-dots-board, .living-board-stage, .resource-strip",
    actionLabel: "Entendi as trilhas",
  },
  combat: {
    id: "combat",
    eyebrow: "Regra 3 · Confronto TCG",
    title: "Monte uma sequência de até 3 de energia",
    description: "Leia a intenção inimiga, combine ataque, defesa e velocidade e confirme a ordem das cartas antes de resolver a rodada.",
    targetSelector: ".living-battle-stage, .tcg-hand",
    actionLabel: "Entendi o combate",
  },
  capture: {
    id: "capture",
    eyebrow: "Regra 4 · Ocupação",
    title: "Derrotar não significa controlar",
    description: "Depois de vencer Brakk, mova uma unidade até o nó do moinho para reivindicar o território.",
    targetSelector: ".current-objective-card, .go-dots-board, .living-board-stage",
    actionLabel: "Entendi a ocupação",
  },
  construction: {
    id: "construction",
    eyebrow: "Regra 5 · Construção",
    title: "Dê uma função ao território",
    description: "Escolha Fazenda Arcana para economia e recuperação ou Torre Rúnica para defesa e controle das trilhas.",
    targetSelector: ".construction-modal, .current-objective-card",
    actionLabel: "Entendi a construção",
  },
};

export function resolveBattleCoachStep(snapshot: BattleCoachSnapshot): BattleCoachStepId | null {
  if (snapshot.victory || snapshot.defeat) return null;
  if (snapshot.storyActive) return "story";
  if (snapshot.constructionOpen || snapshot.objectiveIndex >= 4) return "construction";
  if (snapshot.battleOpen || snapshot.objectiveIndex === 2) return "combat";
  if (snapshot.objectiveIndex === 3) return "capture";
  if (snapshot.objectiveIndex === 1) return "bridge";
  return "movement";
}

export function appendUniqueAiMessage(messages: string[], message: string | null, limit = 4): string[] {
  const normalized = message?.trim();
  if (!normalized || messages[messages.length - 1] === normalized) return messages;
  return [...messages, normalized].slice(-limit);
}

export function parseStoredCoachSteps(raw: string | null): Set<BattleCoachStepId> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const valid = new Set<BattleCoachStepId>();
    for (const value of parsed) {
      if (typeof value === "string" && value in BATTLE_COACH_STEPS) valid.add(value as BattleCoachStepId);
    }
    return valid;
  } catch {
    return new Set();
  }
}

export function serializeCoachSteps(steps: Set<BattleCoachStepId>): string {
  return JSON.stringify([...steps]);
}
