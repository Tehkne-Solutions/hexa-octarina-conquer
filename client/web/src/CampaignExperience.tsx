import { useEffect, useRef } from "react";

import { GoDotsLivingBoardDemo } from "./GoDotsLivingBoardDemo";
import {
  beginLivingCampaignAttempt,
  updateLivingCampaignProgress,
} from "./unified-progress";

interface CampaignExperienceProps {
  playerName: string;
  onBack: () => void;
}

function readTurn(root: HTMLElement): number {
  const label = root.querySelector(".phase-banner small")?.textContent ?? "";
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function synchronizeCampaignDom(root: HTMLElement): void {
  const victory = Boolean(root.querySelector(".outcome-screen.victory"));
  const defeat = Boolean(root.querySelector(".outcome-screen.defeat"));
  const completedObjectives = root.querySelectorAll(".compact-objectives .completed").length;
  const currentObjective = root.querySelector(".compact-objectives .current");
  const constructionOpen = Boolean(root.querySelector(".construction-overlay"));
  const battleOpen = Boolean(root.querySelector(".living-battle-overlay"));
  const storyDots = root.querySelectorAll(".story-progress i.active").length;
  const outcomeText = root.querySelector(".outcome-screen p:nth-of-type(2)")?.textContent ?? "";
  const building = outcomeText.includes("Fazenda Arcana")
    ? "farm"
    : outcomeText.includes("Torre Rúnica")
      ? "tower"
      : null;

  let percent = 4;
  if (storyDots > 0) percent = Math.min(10, storyDots * 3);
  if (currentObjective) percent = Math.max(percent, 12 + completedObjectives * 16);
  if (battleOpen) percent = Math.max(percent, 52);
  if (constructionOpen) percent = Math.max(percent, 88);
  if (victory) percent = 100;

  updateLivingCampaignProgress({
    status: victory ? "victory" : defeat ? "defeat" : "active",
    percent,
    completedObjectives: victory ? 5 : completedObjectives,
    lastTurn: readTurn(root),
    building,
    rewards: victory
      ? ["Arco Prismático", ...(building ? [building === "tower" ? "Torre Rúnica" : "Fazenda Arcana"] : [])]
      : [],
  });
}

export function CampaignExperience({ playerName, onBack }: CampaignExperienceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    beginLivingCampaignAttempt();
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = 0;
    const sync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => synchronizeCampaignDom(root));
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    sync();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="campaign-experience" ref={rootRef}>
      <GoDotsLivingBoardDemo playerName={playerName} onBack={onBack} />
    </div>
  );
}
