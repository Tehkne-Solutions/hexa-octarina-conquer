export const CAMPAIGN_RESERVE = Object.freeze([
  "expansion",
  "expansion",
  "fortify",
  "fortify",
  "fortify",
  "duel",
  "duel",
  "duel",
  "strike",
  "strike",
  "strike",
  "shield",
  "shield",
  "wet",
  "wet",
  "lightning",
  "lightning",
  "heal",
  "heal",
]);

export function applyCampaignLoadout(player) {
  player.hand.push(...CAMPAIGN_RESERVE);
  return player;
}
