import type { AccountSession, CampaignCatalog } from "./protocol";
import {
  readLivingCampaignProgress,
  replaceLivingCampaignProgress,
  type LivingCampaignProgress,
} from "./unified-progress";

export const ACCOUNT_SESSION_EVENT = "hexa:account-session-changed";
export const OPEN_ACCOUNT_ONBOARDING_EVENT = "hexa:open-account-onboarding";
export const PROGRESS_BACKUP_KEY = "hexa.account.progress-backups.v1";
export const ONBOARDING_DISMISSED_KEY = "hexa.account.onboarding-dismissed.v1";

export type GuestProgressRelation = "equal" | "local-ahead" | "remote-ahead" | "conflict";
export type GuestProgressStrategy = "preview" | "merge" | "local" | "remote";

export interface GuestProgressSyncResponse {
  relation: GuestProgressRelation;
  strategy: GuestProgressStrategy;
  local: LivingCampaignProgress;
  remote: LivingCampaignProgress;
  resolved: LivingCampaignProgress;
  changed: boolean;
  progress: { guestPrologue?: LivingCampaignProgress };
  profile: AccountSession["account"];
  catalog: CampaignCatalog;
  xpReward?: {
    recorded: boolean;
    xpAwarded: number;
    profile?: AccountSession["account"];
  };
  signature: "Tehkné Solutions";
}

export interface ProgressBackup {
  version: 1;
  accountId: string;
  createdAt: number;
  strategy: Exclude<GuestProgressStrategy, "preview">;
  localProgress: LivingCampaignProgress;
}

type BackupStorage = Pick<Storage, "getItem" | "setItem">;

function storageOrNull(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function cloneProgress(progress: LivingCampaignProgress): LivingCampaignProgress {
  return JSON.parse(JSON.stringify(progress)) as LivingCampaignProgress;
}

export function guestProgressHasActivity(progress: LivingCampaignProgress = readLivingCampaignProgress()): boolean {
  return progress.status !== "not-started"
    || progress.percent > 0
    || progress.completedObjectives > 0
    || progress.attempts > 0;
}

export function progressSummary(progress: LivingCampaignProgress): string {
  if (progress.status === "victory") return `Prólogo concluído · ${progress.completedObjectives}/5 objetivos`;
  if (progress.status === "defeat") return `Tentativa registrada · ${progress.percent}%`;
  if (progress.status === "active") return `${progress.percent}% · ${progress.completedObjectives}/5 objetivos`;
  return "Nenhum progresso local";
}

export function readProgressBackups(storage: BackupStorage | null = storageOrNull()): ProgressBackup[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PROGRESS_BACKUP_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ProgressBackup => Boolean(
      item
      && typeof item === "object"
      && (item as ProgressBackup).version === 1
      && typeof (item as ProgressBackup).accountId === "string"
      && typeof (item as ProgressBackup).createdAt === "number",
    )).slice(0, 10);
  } catch {
    return [];
  }
}

export function createProgressBackup(
  accountId: string,
  strategy: Exclude<GuestProgressStrategy, "preview">,
  localProgress = readLivingCampaignProgress(),
  storage: BackupStorage | null = storageOrNull(),
  now = Date.now(),
): ProgressBackup | null {
  if (!storage) return null;
  const backup: ProgressBackup = {
    version: 1,
    accountId,
    createdAt: now,
    strategy,
    localProgress: cloneProgress(localProgress),
  };
  const existing = readProgressBackups(storage);
  storage.setItem(PROGRESS_BACKUP_KEY, JSON.stringify([backup, ...existing].slice(0, 10)));
  return backup;
}

export function restoreProgressBackup(backup: ProgressBackup): LivingCampaignProgress {
  return replaceLivingCampaignProgress(cloneProgress(backup.localProgress));
}

export function applySynchronizedProgress(response: GuestProgressSyncResponse): LivingCampaignProgress {
  return replaceLivingCampaignProgress(response.resolved);
}

export function emitAccountSessionChanged(session: AccountSession | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AccountSession | null>(ACCOUNT_SESSION_EVENT, { detail: session }));
}

export function requestAccountOnboarding(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_ACCOUNT_ONBOARDING_EVENT));
}

export function shouldOfferAccountOnboarding(
  account: AccountSession | null,
  progress: LivingCampaignProgress,
  storage: Pick<Storage, "getItem"> | null = storageOrNull(),
): boolean {
  if (account || !guestProgressHasActivity(progress)) return false;
  return storage?.getItem(ONBOARDING_DISMISSED_KEY) !== "true";
}
