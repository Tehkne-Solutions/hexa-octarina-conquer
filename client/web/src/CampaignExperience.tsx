import { useEffect, useRef } from "react";

import { GoDotsLivingBoardDemo } from "./GoDotsLivingBoardDemo";
import "./vertical-slice-battlefield.css";

interface CampaignExperienceProps {
  playerName: string;
  onBack: () => void;
}

function skipStory(root: HTMLElement): void {
  let attempts = 0;
  const advance = () => {
    const button = root.querySelector<HTMLButtonElement>(".story-scene .story-dialogue .living-primary");
    if (!button || attempts >= 6) return;
    attempts += 1;
    button.click();
    window.setTimeout(advance, 80);
  };
  advance();
}

export function CampaignExperience({ playerName, onBack }: CampaignExperienceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const timer = window.setTimeout(() => skipStory(root), 50);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="campaign-experience vertical-slice-battlefield" ref={rootRef}>
      <GoDotsLivingBoardDemo playerName={playerName} onBack={onBack} />
    </div>
  );
}
