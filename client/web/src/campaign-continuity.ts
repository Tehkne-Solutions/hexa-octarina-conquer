import type { CampaignResult } from "./protocol";

export const CAMPAIGN_CONTINUITY_EVENT = "hexa:campaign-result-recorded";
const LAST_RESULT_KEY = "hexa.campaign.last-recorded-result";

export interface CampaignContinuityResult {
  missionId: string;
  success: boolean;
  stars: number;
  rewardXp: number;
  reason: string;
  finishedAt: number;
}

export function toCampaignContinuityResult(result: CampaignResult): CampaignContinuityResult {
  return {
    missionId: result.missionId,
    success: result.success,
    stars: Math.max(0, Math.min(3, Number(result.stars ?? 0))),
    rewardXp: Math.max(0, Number(result.rewardXp ?? 0)),
    reason: String(result.reason ?? ""),
    finishedAt: Number(result.finishedAt ?? Date.now()),
  };
}

export function publishCampaignContinuityResult(result: CampaignResult): CampaignContinuityResult {
  const detail = toCampaignContinuityResult(result);
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(LAST_RESULT_KEY, JSON.stringify(detail));
    window.dispatchEvent(new CustomEvent<CampaignContinuityResult>(CAMPAIGN_CONTINUITY_EVENT, { detail }));
  }
  return detail;
}

export function readLastCampaignContinuityResult(): CampaignContinuityResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LAST_RESULT_KEY);
    return raw ? JSON.parse(raw) as CampaignContinuityResult : null;
  } catch {
    window.sessionStorage.removeItem(LAST_RESULT_KEY);
    return null;
  }
}

export function clearLastCampaignContinuityResult(): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(LAST_RESULT_KEY);
}
