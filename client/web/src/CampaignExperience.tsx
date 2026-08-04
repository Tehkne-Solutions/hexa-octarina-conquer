import { StrategicBoardSlice } from "./StrategicBoardSlice";
import "./strategic-board-mode-authority.css";
import "./meta10-gameplay-clarity.css";
import "./meta10-map-first-hud.css";
import "./vs51-gameplay-quality.css";

interface CampaignExperienceProps {
  playerName: string;
  onBack: () => void;
}

export function CampaignExperience({ playerName, onBack }: CampaignExperienceProps) {
  return <StrategicBoardSlice playerName={playerName} onBack={onBack} />;
}
