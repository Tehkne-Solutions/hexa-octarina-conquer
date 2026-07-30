import { StrategicBoardSlice } from "./StrategicBoardSlice";

interface CampaignExperienceProps {
  playerName: string;
  onBack: () => void;
}

export function CampaignExperience({ playerName, onBack }: CampaignExperienceProps) {
  return <StrategicBoardSlice playerName={playerName} onBack={onBack} />;
}
