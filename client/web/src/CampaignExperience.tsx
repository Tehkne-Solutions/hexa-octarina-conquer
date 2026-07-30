import { useEffect, useRef } from "react";

import { GoDotsLivingBoardDemo } from "./GoDotsLivingBoardDemo";
import "./vertical-slice-battlefield.css";
import "./vertical-slice-polish.css";

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
    document.body.classList.add("hoc-vertical-slice-active");
    const root = rootRef.current;
    const timer = root ? window.setTimeout(() => skipStory(root), 50) : null;

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.body.classList.remove("hoc-vertical-slice-active");
    };
  }, []);

  return (
    <div className="campaign-experience vertical-slice-battlefield" ref={rootRef}>
      <GoDotsLivingBoardDemo playerName={playerName} onBack={onBack} />
    </div>
  );
}
