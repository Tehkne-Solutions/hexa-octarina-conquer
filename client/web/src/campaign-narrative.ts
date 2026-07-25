import type { CampaignCatalog, CampaignMission } from "./protocol";

export type CampaignThemeId = "ashes" | "runes" | "alchemy" | "magitech";

export interface CampaignNarrativeTheme {
  id: CampaignThemeId;
  chapterId: string;
  region: string;
  shortRegion: string;
  atmosphere: string;
  accent: string;
  accentSoft: string;
  shadow: string;
  keyArt: string;
  alt: string;
  glyphs: readonly string[];
}

const THEMES: Record<string, CampaignNarrativeTheme> = {
  "living-prologue": {
    id: "ashes",
    chapterId: "living-prologue",
    region: "Ponte das Cinzas · Vale de Orun",
    shortRegion: "Vale de Orun",
    atmosphere: "Cinzas suspensas, água fria e runas despertando sob a ponte.",
    accent: "#d9a657",
    accentSoft: "#f4d69b",
    shadow: "#171914",
    keyArt: "/assets/chapters/living-prologue.svg",
    alt: "A Ponte das Cinzas atravessando o vale de Orun sob uma lua dourada.",
    glyphs: ["✦", "♜", "➶", "◇"],
  },
  "chapter-1": {
    id: "runes",
    chapterId: "chapter-1",
    region: "Fundamentos Rúnicos · Planícies do Primeiro Selo",
    shortRegion: "Planícies Rúnicas",
    atmosphere: "Monólitos antigos, linhas luminosas e fortalezas de basalto.",
    accent: "#75b7b0",
    accentSoft: "#bce5dc",
    shadow: "#111d1c",
    keyArt: "/assets/chapters/chapter-1.svg",
    alt: "Planícies rúnicas com monólitos de basalto e linhas de energia turquesa.",
    glyphs: ["Ⅰ", "◇", "⬢", "⌁"],
  },
  "chapter-2": {
    id: "alchemy",
    chapterId: "chapter-2",
    region: "Convergência Alquímica · Delta Prismático",
    shortRegion: "Delta Prismático",
    atmosphere: "Marés violeta, laboratórios vivos e canais de energia alquímica.",
    accent: "#b889dc",
    accentSoft: "#ead2ff",
    shadow: "#1c1328",
    keyArt: "/assets/chapters/chapter-2.svg",
    alt: "Delta prismático com torres alquímicas, água violeta e cristais luminosos.",
    glyphs: ["Ⅱ", "✷", "⚗", "◈"],
  },
  "chapter-3": {
    id: "magitech",
    chapterId: "chapter-3",
    region: "Ascensão Magitech · Fortaleza de Cinzas",
    shortRegion: "Fortaleza Magitech",
    atmosphere: "Engrenagens solares, muralhas rubras e um núcleo octarino instável.",
    accent: "#e16f57",
    accentSoft: "#ffc3a8",
    shadow: "#271411",
    keyArt: "/assets/chapters/chapter-3.svg",
    alt: "Fortaleza magitech cercada por engrenagens solares e luz vermelha.",
    glyphs: ["Ⅲ", "⚙", "⬡", "◆"],
  },
};

export function campaignNarrativeTheme(chapterId: string): CampaignNarrativeTheme {
  return THEMES[chapterId] ?? THEMES["living-prologue"];
}

export function campaignMissionGlyph(chapterId: string, order: number): string {
  const theme = campaignNarrativeTheme(chapterId);
  return theme.glyphs[Math.abs(order - 1) % theme.glyphs.length] ?? theme.glyphs[0];
}

export function campaignThemeStyle(theme: CampaignNarrativeTheme): Record<string, string> {
  return {
    "--chapter-accent": theme.accent,
    "--chapter-accent-soft": theme.accentSoft,
    "--chapter-shadow": theme.shadow,
  };
}

function qaMission(input: Partial<CampaignMission> & Pick<CampaignMission, "id" | "chapterId" | "order" | "title" | "briefing">): CampaignMission {
  return {
    boardSize: input.order >= 9 ? 7 : input.order >= 5 ? 6 : 5,
    difficulty: input.order >= 9 ? "master" : input.order >= 5 ? "adept" : "novice",
    aiName: "Guardião do Capítulo",
    rewardXp: 100 + input.order * 20,
    primary: { type: "cells", target: 3, label: "Controle o núcleo regional" },
    bonus: [
      { type: "turns_max", target: 18, label: "Conclua com eficiência" },
      { type: "hp_min", target: 14, label: "Preserve seus heróis" },
    ],
    failure: { turnLimit: 30, botCells: 10 },
    unlocked: true,
    progress: null,
    ...input,
  };
}

export function visualQaCampaignCatalog(): CampaignCatalog {
  return {
    chapters: [
      { id: "chapter-1", order: 1, title: "Fundamentos Rúnicos", subtitle: "Aprenda a fechar territórios e erguer suas primeiras fortalezas." },
      { id: "chapter-2", order: 2, title: "A Convergência Alquímica", subtitle: "Combine províncias, cartas e duelos para controlar o fluxo da batalha." },
      { id: "chapter-3", order: 3, title: "Ascensão Magitech", subtitle: "Enfrente comandantes agressivos e conquiste a Octarina absoluta." },
    ],
    missions: [
      qaMission({ id: "c1-m1", chapterId: "chapter-1", order: 1, title: "A Primeira Linha", briefing: "O Cartógrafo Cinzento bloqueia a passagem entre os monólitos. Reative o primeiro selo antes que as planícies se fechem." }),
      qaMission({ id: "c2-m1", chapterId: "chapter-2", order: 5, title: "Maré e Trovão", briefing: "A Alquimista Abissal canaliza o delta prismático. Atravesse as marés e interrompa a convergência antes do colapso." }),
      qaMission({ id: "c3-m1", chapterId: "chapter-3", order: 9, title: "Pressão Mecânica", briefing: "A Máquina de Cerco desperta a Fortaleza de Cinzas. Controle o núcleo antes que as engrenagens encerrem todas as rotas." }),
    ],
    achievements: [],
    totals: { stars: 0, cells: 0, duelsWon: 0, fortifications: 0, attempts: 0, completed: 0 },
  };
}
