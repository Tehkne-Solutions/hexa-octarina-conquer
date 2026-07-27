import { useEffect, useRef, useState } from "react";

import {
  appendUniqueAiMessage,
  BATTLE_COACH_STEPS,
  parseStoredCoachSteps,
  resolveBattleCoachStep,
  serializeCoachSteps,
  type BattleCoachSnapshot,
  type BattleCoachStepId,
} from "./battle-coach-state";
import { BattlePresentationLayer } from "./BattlePresentationLayer";
import { GoDotsLivingBoardDemo } from "./GoDotsLivingBoardDemo";
import { Pack99CombatCinematics } from "./Pack99CombatCinematics";
import { Pack99ElementalAbilities } from "./Pack99ElementalAbilities";
import { Pack99PremiumCardRuntime } from "./Pack99PremiumCardRuntime";
import { Pack99TerritoryMinimap } from "./Pack99TerritoryMinimap";
import { Pack99WorldVfx } from "./Pack99WorldVfx";
import {
  beginLivingCampaignAttempt,
  updateLivingCampaignProgress,
} from "./unified-progress";

interface CampaignExperienceProps { playerName: string; onBack: () => void; }
const COACH_ENABLED_KEY = "hexa.settings.contextual-tutorial";
const COACH_STEPS_KEY = "hexa.tutorial.dismissed-steps.v1";
let lastCampaignMountAt = 0;

function readTurn(root: HTMLElement): number { const label = root.querySelector(".phase-banner small")?.textContent ?? ""; const match = label.match(/\d+/); return match ? Number(match[0]) : 1; }
function readCoachSnapshot(root: HTMLElement): BattleCoachSnapshot {
  const objectiveNodes = [...root.querySelectorAll<HTMLElement>(".compact-objectives > div")];
  const objectiveIndex = Math.max(0, objectiveNodes.findIndex((node) => node.classList.contains("current")));
  const aiCurtain = root.querySelector<HTMLElement>(".ai-turn-curtain");
  return { storyActive: Boolean(root.querySelector(".story-scene")), objectiveIndex, battleOpen: Boolean(root.querySelector(".living-battle-overlay")), constructionOpen: Boolean(root.querySelector(".construction-overlay")), victory: Boolean(root.querySelector(".outcome-screen.victory")), defeat: Boolean(root.querySelector(".outcome-screen.defeat")), aiActive: Boolean(aiCurtain), aiMessage: aiCurtain?.querySelector("strong")?.textContent?.trim() ?? null };
}
function synchronizeCampaignProgress(root: HTMLElement, snapshot: BattleCoachSnapshot): void {
  const completedObjectives = root.querySelectorAll(".compact-objectives .completed").length;
  const currentObjective = root.querySelector(".compact-objectives .current");
  const storyDots = root.querySelectorAll(".story-progress i.active").length;
  const outcomeText = root.querySelector(".outcome-screen p:nth-of-type(2)")?.textContent ?? "";
  const building = outcomeText.includes("Fazenda Arcana") ? "farm" : outcomeText.includes("Torre Rúnica") ? "tower" : null;
  let percent = 4;
  if (storyDots > 0) percent = Math.min(10, storyDots * 3);
  if (currentObjective) percent = Math.max(percent, 12 + completedObjectives * 16);
  if (snapshot.battleOpen) percent = Math.max(percent, 52);
  if (snapshot.constructionOpen) percent = Math.max(percent, 88);
  if (snapshot.victory) percent = 100;
  updateLivingCampaignProgress({ status: snapshot.victory ? "victory" : snapshot.defeat ? "defeat" : "active", percent, completedObjectives: snapshot.victory ? 5 : completedObjectives, lastTurn: readTurn(root), building, rewards: snapshot.victory ? ["Arco Prismático", ...(building ? [building === "tower" ? "Torre Rúnica" : "Fazenda Arcana"] : [])] : [] });
}
function updateCoachHighlight(root: HTMLElement, stepId: BattleCoachStepId | null): void {
  const step = stepId ? BATTLE_COACH_STEPS[stepId] : null;
  const target = step ? root.querySelector<HTMLElement>(step.targetSelector) : null;
  root.querySelectorAll<HTMLElement>(".battle-coach-highlight").forEach((node) => { if (node !== target) node.classList.remove("battle-coach-highlight"); });
  if (target && !target.classList.contains("battle-coach-highlight")) target.classList.add("battle-coach-highlight");
}
function skipStoryFrames(root: HTMLElement): void { let advances = 0; const advance = () => { const button = root.querySelector<HTMLButtonElement>(".story-scene .story-dialogue .living-primary"); if (!button || advances >= 6) return; advances += 1; button.click(); window.setTimeout(advance, 90); }; advance(); }

export function CampaignExperience({ playerName, onBack }: CampaignExperienceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const aiMessagesRef = useRef<string[]>([]);
  const previousAiActiveRef = useRef(false);
  const summaryTimerRef = useRef<number | null>(null);
  const [coachEnabled, setCoachEnabled] = useState(() => localStorage.getItem(COACH_ENABLED_KEY) !== "false");
  const [dismissedSteps, setDismissedSteps] = useState<Set<BattleCoachStepId>>(() => parseStoredCoachSteps(localStorage.getItem(COACH_STEPS_KEY)));
  const [activeCoachId, setActiveCoachId] = useState<BattleCoachStepId | null>(null);
  const [aiSummary, setAiSummary] = useState<string[] | null>(null);

  useEffect(() => {
    const now = Date.now(); if (now - lastCampaignMountAt > 3_000) beginLivingCampaignAttempt(); lastCampaignMountAt = now;
    const root = rootRef.current; if (!root) return undefined;
    let frame = 0;
    const synchronize = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(() => {
      const snapshot = readCoachSnapshot(root); synchronizeCampaignProgress(root, snapshot);
      const nextStep = resolveBattleCoachStep(snapshot); const visibleStep = coachEnabled && nextStep && !dismissedSteps.has(nextStep) ? nextStep : null;
      setActiveCoachId((current) => current === visibleStep ? current : visibleStep); updateCoachHighlight(root, visibleStep);
      const nextAiMessages = appendUniqueAiMessage(aiMessagesRef.current, snapshot.aiMessage); aiMessagesRef.current = nextAiMessages;
      if (previousAiActiveRef.current && !snapshot.aiActive && nextAiMessages.length > 0) { setAiSummary(nextAiMessages); aiMessagesRef.current = []; if (summaryTimerRef.current !== null) window.clearTimeout(summaryTimerRef.current); summaryTimerRef.current = window.setTimeout(() => setAiSummary(null), 5_000); }
      previousAiActiveRef.current = snapshot.aiActive;
    }); };
    const observer = new MutationObserver(synchronize); observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true }); synchronize();
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); updateCoachHighlight(root, null); };
  }, [coachEnabled, dismissedSteps]);
  useEffect(() => () => { if (summaryTimerRef.current !== null) window.clearTimeout(summaryTimerRef.current); }, []);

  const dismissCurrentStep = () => { if (!activeCoachId) return; const next = new Set(dismissedSteps); next.add(activeCoachId); localStorage.setItem(COACH_STEPS_KEY, serializeCoachSteps(next)); setDismissedSteps(next); setActiveCoachId(null); };
  const disableCoach = () => { localStorage.setItem(COACH_ENABLED_KEY, "false"); setCoachEnabled(false); setActiveCoachId(null); };
  const replayCoach = () => { localStorage.setItem(COACH_ENABLED_KEY, "true"); localStorage.removeItem(COACH_STEPS_KEY); setDismissedSteps(new Set()); setCoachEnabled(true); };
  const activeCoach = activeCoachId ? BATTLE_COACH_STEPS[activeCoachId] : null;

  return <div className="campaign-experience" ref={rootRef}>
    <GoDotsLivingBoardDemo playerName={playerName} onBack={onBack} />
    <BattlePresentationLayer rootRef={rootRef} />
    <Pack99WorldVfx rootRef={rootRef} />
    <Pack99CombatCinematics rootRef={rootRef} />
    <Pack99ElementalAbilities rootRef={rootRef} />
    <Pack99PremiumCardRuntime rootRef={rootRef} />
    <Pack99TerritoryMinimap rootRef={rootRef} />
    <button type="button" className="battle-help-button" onClick={replayCoach} aria-label="Mostrar tutorial contextual novamente" title="Mostrar tutorial novamente">?</button>
    {activeCoach ? <aside className={`battle-coach-card coach-${activeCoach.id}`} role="dialog" aria-labelledby="battle-coach-title"><div className="battle-coach-heading"><span aria-hidden="true">✦</span><div><small>{activeCoach.eyebrow}</small><strong id="battle-coach-title">{activeCoach.title}</strong></div></div><p>{activeCoach.description}</p><div className="battle-coach-actions">{activeCoach.id === "story" ? <button type="button" className="coach-secondary" onClick={() => rootRef.current && skipStoryFrames(rootRef.current)}>Pular introdução</button> : null}<button type="button" className="coach-secondary" onClick={disableCoach}>Pular tutorial</button><button type="button" className="coach-primary" onClick={dismissCurrentStep}>{activeCoach.actionLabel}</button></div></aside> : null}
    {aiSummary ? <aside className="ai-turn-summary" aria-live="polite"><div><span aria-hidden="true">◉</span><small>RESUMO DA IA</small><strong>O controle voltou para você</strong></div><ul>{aiSummary.map((message) => <li key={message}>{message}</li>)}</ul><button type="button" onClick={() => setAiSummary(null)} aria-label="Fechar resumo da IA">×</button></aside> : null}
  </div>;
}
