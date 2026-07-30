import { MetaBoardFoundation } from "./MetaBoardFoundation";

interface CampaignExperienceProps {
  playerName: string;
  onBack: () => void;
}

export function CampaignExperience({ playerName, onBack }: CampaignExperienceProps) {
  return <MetaBoardFoundation playerName={playerName} onBack={onBack} />;
}
