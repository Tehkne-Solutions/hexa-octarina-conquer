import { MetaBoardFoundation } from "./MetaBoardFoundation";
import "./meta-board-gameplay.css";

interface CampaignExperienceProps {
  playerName: string;
  onBack: () => void;
}

export function CampaignExperience({ playerName, onBack }: CampaignExperienceProps) {
  return <MetaBoardFoundation playerName={playerName} onBack={onBack} />;
}
