export type BoardThemeId = "orun-mill" | "prismatic-ruins" | "ash-fortress";

export interface BoardThemeDefinition {
  id: BoardThemeId;
  title: string;
  region: string;
  atmosphere: string;
  emblem: string;
}

export const BOARD_THEMES: Record<BoardThemeId, BoardThemeDefinition> = {
  "orun-mill": {
    id: "orun-mill",
    title: "Moinho de Orun",
    region: "Vale de Orun",
    atmosphere: "Madeira antiga, água corrente e runas de proteção.",
    emblem: "✦",
  },
  "prismatic-ruins": {
    id: "prismatic-ruins",
    title: "Ruínas Prismáticas",
    region: "Delta Prismático",
    atmosphere: "Cristais instáveis e trilhas de energia octarina.",
    emblem: "◇",
  },
  "ash-fortress": {
    id: "ash-fortress",
    title: "Fortaleza de Cinzas",
    region: "Bastião Magitech",
    atmosphere: "Ferro escuro, brasas e muralhas de cerco.",
    emblem: "⬡",
  },
};

export function isBoardThemeId(value: unknown): value is BoardThemeId {
  return value === "orun-mill" || value === "prismatic-ruins" || value === "ash-fortress";
}

export function boardThemeForMission(
  missionId?: string | null,
  chapterId?: string | null,
  mode?: "campaign" | "multiplayer" | null,
): BoardThemeId {
  const mission = String(missionId ?? "").toLowerCase();
  const chapter = String(chapterId ?? "").toLowerCase();

  if (chapter.includes("3") || mission.startsWith("c3-") || mission.includes("fortress")) return "ash-fortress";
  if (chapter.includes("2") || mission.startsWith("c2-") || mission.includes("prism")) return "prismatic-ruins";
  if (chapter.includes("1") || mission.startsWith("c1-") || mission.includes("bridge") || mission.includes("living")) return "orun-mill";
  return mode === "multiplayer" ? "ash-fortress" : "orun-mill";
}

export function boardThemeFromUrl(url: URL): BoardThemeId | null {
  const requested = url.searchParams.get("board-theme") ?? url.searchParams.get("theme");
  if (isBoardThemeId(requested)) return requested;

  const scene = url.searchParams.get("screen") ?? "";
  if (scene.includes("orun")) return "orun-mill";
  if (scene.includes("prismatic") || scene.includes("ruins")) return "prismatic-ruins";
  if (scene.includes("ash") || scene.includes("fortress")) return "ash-fortress";
  return null;
}

export function boardThemeFromSelectedMission(storage: Pick<Storage, "getItem">): BoardThemeId {
  const missionId = storage.getItem("hexa.campaign.selected-mission");
  return boardThemeForMission(missionId, null, "campaign");
}

export function applyBoardTheme(element: HTMLElement, themeId: BoardThemeId): void {
  const theme = BOARD_THEMES[themeId];
  element.dataset.boardTheme = themeId;
  element.dataset.boardRegion = theme.region;
  element.style.setProperty("--board-theme-emblem", `"${theme.emblem}"`);
  element.setAttribute("data-board-theme-label", theme.title);
}
