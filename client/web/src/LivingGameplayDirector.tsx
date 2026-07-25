import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const HAPTICS_KEY = "hexa.settings.combat-haptics";
const SOUND_KEY = "hexa.settings.combat-sound";

type DrawerId = "menu" | "mission" | "units" | "chronicle" | null;
type CombatBeat = "idle" | "selection" | "player-speech" | "player-strike" | "enemy-speech" | "enemy-strike" | "aftermath" | "summary";
type SpeakerTone = "oracle" | "player" | "ally" | "enemy";

export interface DialogueSpeaker {
  name: string;
  icon: string;
  tone: SpeakerTone;
}

interface ObjectiveItem {
  label: string;
  state: "completed" | "current" | "locked";
}

interface UnitHudItem {
  index: number;
  name: string;
  title: string;
  hp: string;
  selected: boolean;
  locked: boolean;
}

interface CombatSnapshot {
  open: boolean;
  resolved: boolean;
  resolutionKey: string | null;
  round: string;
  playerName: string;
  playerTitle: string;
  playerHp: string;
  enemyName: string;
  enemyTitle: string;
  enemyHp: string;
  playerCard: string;
  enemyCard: string;
  playerDamage: number;
  enemyDamage: number;
  playerDefeated: boolean;
  enemyDefeated: boolean;
}

interface GameplaySnapshot {
  phase: string;
  round: string;
  commandCurrent: number;
  commandMax: number;
  objectiveTitle: string;
  objectiveLabel: string;
  objectiveHelp: string;
  objectives: ObjectiveItem[];
  notice: string;
  resources: string[];
  units: UnitHudItem[];
  chronicle: string[];
  endTurnLabel: string;
  endTurnDisabled: boolean;
  combat: CombatSnapshot;
}

interface CombatScript {
  playerSpeech: string;
  playerAction: string;
  enemySpeech: string;
  enemyAction: string;
  aftermath: string;
}

function text(node: Element | null | undefined): string {
  return node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function numberFromText(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function speakerForMessage(message: string, phase = ""): DialogueSpeaker {
  const normalized = `${phase} ${message}`.toLowerCase();
  if (normalized.includes("lyra")) return { name: "LYRA", icon: "➶", tone: "ally" };
  if (normalized.includes("kael")) return { name: "KAEL", icon: "⬡", tone: "player" };
  if (normalized.includes("brakk")) return { name: "BRAKK", icon: "⚒", tone: "enemy" };
  if (normalized.includes("varg") || normalized.includes("saqueador") || normalized.includes("turno da ia") || normalized.includes("fase inimiga")) {
    return { name: "FORÇAS DAS CINZAS", icon: "◆", tone: "enemy" };
  }
  return { name: "ORÁCULO DE CAMPO", icon: "✦", tone: "oracle" };
}

export function buildCombatScript(combat: Pick<CombatSnapshot, "playerName" | "enemyName" | "playerCard" | "enemyCard" | "playerDamage" | "enemyDamage" | "playerDefeated" | "enemyDefeated">): CombatScript {
  const playerCard = combat.playerCard || "Golpe rúnico";
  const enemyCard = combat.enemyCard || "Ataque das Cinzas";
  return {
    playerSpeech: combat.enemyDefeated
      ? `A rede já escolheu seu destino, ${combat.enemyName}.`
      : `Minha runa responde com ${playerCard}.`,
    playerAction: `${combat.playerName} executa ${playerCard} e rompe ${combat.playerDamage} pontos da guarda inimiga.`,
    enemySpeech: combat.playerDefeated
      ? "As cinzas apagam mais uma liberdade."
      : `Ainda estou de pé. ${enemyCard}!`,
    enemyAction: `${combat.enemyName} contra-ataca com ${enemyCard} e causa ${combat.enemyDamage} de dano.`,
    aftermath: combat.enemyDefeated
      ? `${combat.enemyName} caiu. O nó contestado foi aberto.`
      : combat.playerDefeated
        ? `${combat.playerName} caiu. A formação precisa ser reorganizada.`
        : "Os dois combatentes recuam. Uma nova combinação decidirá a próxima troca.",
  };
}

function readCombat(root: HTMLElement): CombatSnapshot {
  const stage = root.querySelector<HTMLElement>(".living-battle-stage");
  if (!stage) {
    return {
      open: false,
      resolved: false,
      resolutionKey: null,
      round: "1",
      playerName: "Kael",
      playerTitle: "Guardião Rúnico",
      playerHp: "",
      enemyName: "Saqueador",
      enemyTitle: "Forças das Cinzas",
      enemyHp: "",
      playerCard: "Golpe rúnico",
      enemyCard: "Ataque das Cinzas",
      playerDamage: 0,
      enemyDamage: 0,
      playerDefeated: false,
      enemyDefeated: false,
    };
  }

  const resolution = stage.querySelector<HTMLElement>(".battle-resolution-panel");
  const playerName = text(stage.querySelector("header h2")).split("×")[0]?.trim() || "Kael";
  const enemyName = text(stage.querySelector("header h2")).split("×")[1]?.trim() || "Saqueador";
  const playerDamage = numberFromText(text(resolution?.querySelector(".damage-dealt")));
  const enemyDamage = numberFromText(text(resolution?.querySelector(".damage-taken")));
  const resolutionText = text(resolution).toLowerCase();
  const round = text(stage.querySelector(".battle-sigil i")).replace(/[^0-9]/g, "") || "1";
  const selectedCards = [...stage.querySelectorAll<HTMLElement>(".living-card.selected .living-card-header strong")].map((card) => text(card));

  return {
    open: true,
    resolved: Boolean(resolution),
    resolutionKey: resolution ? `${round}:${playerDamage}:${enemyDamage}:${resolutionText.slice(0, 100)}` : null,
    round,
    playerName,
    playerTitle: text(stage.querySelector(".player-fighter strong")),
    playerHp: text(stage.querySelector(".player-fighter > span")),
    enemyName,
    enemyTitle: text(stage.querySelector(".enemy-fighter strong")),
    enemyHp: text(stage.querySelector(".enemy-fighter > span")),
    playerCard: selectedCards.join(" + ") || "Golpe rúnico",
    enemyCard: text(stage.querySelector(".intent-card-mini b")) || "Ataque das Cinzas",
    playerDamage,
    enemyDamage,
    playerDefeated: resolutionText.includes(`${playerName.toLowerCase()} caiu`) || resolutionText.includes("hp aliado") && text(stage.querySelector(".player-fighter > span")).includes("0/"),
    enemyDefeated: resolutionText.includes(`${enemyName.toLowerCase()} caiu`) || resolutionText.includes("hp inimigo") && text(stage.querySelector(".enemy-fighter > span")).includes("0/"),
  };
}

function readSnapshot(root: HTMLElement): GameplaySnapshot {
  const commandNodes = [...root.querySelectorAll<HTMLElement>(".command-points i")];
  const objectiveNodes = [...root.querySelectorAll<HTMLElement>(".objective-list > div")];
  const unitNodes = [...root.querySelectorAll<HTMLButtonElement>(".unit-roster > button")];
  const endTurn = root.querySelector<HTMLButtonElement>(".end-turn-button");

  return {
    phase: text(root.querySelector(".phase-banner strong")),
    round: text(root.querySelector(".phase-banner small")).replace(/[^0-9]/g, "") || "1",
    commandCurrent: commandNodes.filter((node) => node.classList.contains("active")).length,
    commandMax: commandNodes.length,
    objectiveTitle: text(root.querySelector(".current-objective-card small")),
    objectiveLabel: text(root.querySelector(".current-objective-card strong")),
    objectiveHelp: text(root.querySelector(".current-objective-card p")),
    objectives: objectiveNodes.map((node) => ({
      label: text(node.querySelector("p")),
      state: node.classList.contains("completed") ? "completed" : node.classList.contains("current") ? "current" : "locked",
    })),
    notice: text(root.querySelector(".living-notice p")),
    resources: [...root.querySelectorAll<HTMLElement>(".resource-strip span")].map((node) => text(node)),
    units: unitNodes.map((node, index) => ({
      index,
      name: text(node.querySelector("strong")),
      title: text(node.querySelector("small")),
      hp: text(node.querySelector("div > span")),
      selected: node.classList.contains("selected"),
      locked: node.disabled || node.classList.contains("locked"),
    })),
    chronicle: [...root.querySelectorAll<HTMLElement>(".event-timeline p")].map((node) => text(node)),
    endTurnLabel: text(endTurn) || "Encerrar turno",
    endTurnDisabled: Boolean(endTurn?.disabled),
    combat: readCombat(root),
  };
}

function effectsReduced(): boolean {
  return document.documentElement.classList.contains("hexa-reduced-motion")
    || document.documentElement.classList.contains("hexa-low-effects")
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playStrikeFeedback(side: "player" | "enemy", damage: number): void {
  if (effectsReduced()) return;
  if (window.localStorage.getItem(HAPTICS_KEY) !== "false" && "vibrate" in navigator) {
    navigator.vibrate(damage >= 6 ? [35, 24, 55] : damage >= 3 ? [24, 18, 32] : [16]);
  }
  if (window.localStorage.getItem(SOUND_KEY) === "false") return;
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;
  const context = new AudioContextConstructor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = side === "player" ? "triangle" : "sawtooth";
  oscillator.frequency.setValueAtTime(side === "player" ? 310 : 150, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(side === "player" ? 95 : 62, context.currentTime + 0.2);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.min(0.12, 0.055 + damage * 0.008), context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.25);
  oscillator.addEventListener("ended", () => void context.close(), { once: true });
}

function clickCurrent(selector: string): void {
  document.querySelector<HTMLButtonElement>(`.go-dots-demo ${selector}`)?.click();
}

export function LivingGameplayDirector() {
  const [snapshot, setSnapshot] = useState<GameplaySnapshot | null>(null);
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [dialogue, setDialogue] = useState<{ id: number; speaker: DialogueSpeaker; message: string } | null>(null);
  const [combatBeat, setCombatBeat] = useState<CombatBeat>("idle");
  const [combatScript, setCombatScript] = useState<CombatScript | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const lastSnapshotRef = useRef("");
  const lastNoticeRef = useRef("");
  const lastResolutionRef = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const synchronize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const root = document.querySelector<HTMLElement>(".go-dots-demo");
        if (rootRef.current && rootRef.current !== root) rootRef.current.classList.remove("living-directed");
        rootRef.current = root;
        document.documentElement.classList.toggle("living-game-active", Boolean(root));

        if (!root) {
          lastSnapshotRef.current = "";
          setSnapshot(null);
          return;
        }

        if (!root.classList.contains("living-directed")) root.classList.add("living-directed");
        const next = readSnapshot(root);
        const signature = JSON.stringify(next);
        if (signature !== lastSnapshotRef.current) {
          lastSnapshotRef.current = signature;
          setSnapshot(next);
        }
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", synchronize);
    synchronize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", synchronize);
      rootRef.current?.classList.remove("living-directed");
      document.documentElement.classList.remove("living-game-active");
    };
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.combat.open || !snapshot.notice || snapshot.notice === lastNoticeRef.current) return undefined;
    lastNoticeRef.current = snapshot.notice;
    setDialogue({ id: Date.now(), speaker: speakerForMessage(snapshot.notice, snapshot.phase), message: snapshot.notice });
    const timer = window.setTimeout(() => setDialogue(null), 4300);
    return () => window.clearTimeout(timer);
  }, [snapshot?.notice, snapshot?.phase, snapshot?.combat.open]);

  useEffect(() => {
    if (!snapshot?.combat.open) {
      setCombatBeat("idle");
      setCombatScript(null);
      setDrawer(null);
      const stage = document.querySelector<HTMLElement>(".living-battle-stage");
      stage?.removeAttribute("data-cinematic-beat");
      return undefined;
    }

    setDrawer(null);
    if (!snapshot.combat.resolutionKey) {
      setCombatBeat("selection");
      return undefined;
    }
    if (snapshot.combat.resolutionKey === lastResolutionRef.current) return undefined;

    lastResolutionRef.current = snapshot.combat.resolutionKey;
    setCombatScript(buildCombatScript(snapshot.combat));
    setCombatBeat("player-speech");
    const timers = [
      window.setTimeout(() => setCombatBeat("player-strike"), 650),
      window.setTimeout(() => setCombatBeat("enemy-speech"), 1450),
      window.setTimeout(() => setCombatBeat("enemy-strike"), 2200),
      window.setTimeout(() => setCombatBeat("aftermath"), 3050),
      window.setTimeout(() => setCombatBeat("summary"), 3950),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [snapshot?.combat.open, snapshot?.combat.resolutionKey]);

  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(".living-battle-stage");
    if (!stage) return;
    if (stage.dataset.cinematicBeat !== combatBeat) stage.dataset.cinematicBeat = combatBeat;
    if (combatBeat === "player-strike") playStrikeFeedback("player", snapshot?.combat.playerDamage ?? 1);
    if (combatBeat === "enemy-strike") playStrikeFeedback("enemy", snapshot?.combat.enemyDamage ?? 1);
  }, [combatBeat, snapshot?.combat.playerDamage, snapshot?.combat.enemyDamage]);

  const activeObjective = useMemo(() => snapshot?.objectives.findIndex((item) => item.state === "current") ?? -1, [snapshot?.objectives]);
  if (!snapshot || typeof document === "undefined") return null;

  const openDrawer = (next: Exclude<DrawerId, null>) => setDrawer((current) => current === next ? null : next);
  const speaker = dialogue?.speaker;
  const combat = snapshot.combat;
  const combatDialogue = combatBeat === "player-speech"
    ? { speaker: { name: combat.playerName.toUpperCase(), icon: "⬡", tone: "player" as const }, message: combatScript?.playerSpeech ?? "Minha runa responde." }
    : combatBeat === "enemy-speech"
      ? { speaker: { name: combat.enemyName.toUpperCase(), icon: "◆", tone: "enemy" as const }, message: combatScript?.enemySpeech ?? "As cinzas respondem." }
      : combatBeat === "aftermath"
        ? { speaker: { name: "NARRADOR", icon: "✦", tone: "oracle" as const }, message: combatScript?.aftermath ?? "A rodada foi resolvida." }
        : null;

  return createPortal(
    <>
      {!combat.open ? (
        <div className="living-game-hud" aria-label="Interface compacta de batalha">
          <div className="hud-top-left">
            <button type="button" className="hud-icon-button" onClick={() => openDrawer("menu")} aria-label="Abrir menu">☰</button>
            <div className="hud-turn-chip"><small>RODADA {snapshot.round}</small><strong>{snapshot.phase || "SEU TURNO"}</strong></div>
          </div>

          <div className="hud-resources" aria-label="Recursos da missão">
            {snapshot.resources.map((resource) => <span key={resource}>{resource}</span>)}
          </div>

          <div className="hud-command-points" aria-label={`${snapshot.commandCurrent} de ${snapshot.commandMax} pontos de comando`}>
            <small>PC</small>
            <div>{Array.from({ length: snapshot.commandMax }, (_, index) => <i key={index} className={index < snapshot.commandCurrent ? "active" : ""}>✦</i>)}</div>
          </div>

          <nav className="hud-floating-tools" aria-label="Informações da missão">
            <button type="button" onClick={() => openDrawer("mission")} aria-label="Abrir objetivos"><span>◎</span><small>Missão</small><b>{Math.max(1, activeObjective + 1)}</b></button>
            <button type="button" onClick={() => openDrawer("units")} aria-label="Abrir unidades"><span>⬡</span><small>Unidades</small><b>{snapshot.units.filter((unit) => !unit.locked).length}</b></button>
            <button type="button" onClick={() => openDrawer("chronicle")} aria-label="Abrir crônica"><span>☷</span><small>Crônica</small></button>
          </nav>

          <div className="hud-unit-switcher" aria-label="Selecionar unidade">
            {snapshot.units.filter((unit) => !unit.locked).map((unit) => (
              <button key={`${unit.index}-${unit.name}`} type="button" className={unit.selected ? "selected" : ""} onClick={() => clickCurrent(`.unit-roster > button:nth-child(${unit.index + 1})`)}>
                <span>{unit.name.slice(0, 1)}</span><strong>{unit.name}</strong><small>{unit.hp}</small>
              </button>
            ))}
          </div>

          <div className="hud-info-window" role="status" aria-live="polite">
            <span>✦</span><div><small>{snapshot.objectiveTitle || "ORÁCULO"}</small><strong>{snapshot.objectiveLabel}</strong><p>{snapshot.notice}</p></div>
          </div>

          <button type="button" className={`hud-end-turn ${snapshot.commandCurrent === 0 ? "urgent" : ""}`} disabled={snapshot.endTurnDisabled} onClick={() => clickCurrent(".end-turn-button")}>
            <span>{snapshot.commandCurrent === 0 ? "▶" : "Ⅱ"}</span><div><small>AÇÃO PRINCIPAL</small><strong>{snapshot.endTurnLabel}</strong></div>
          </button>
        </div>
      ) : null}

      {dialogue && speaker && !combat.open ? (
        <button key={dialogue.id} type="button" className={`rpg-dialogue-bubble tone-${speaker.tone}`} onClick={() => setDialogue(null)} aria-label="Fechar diálogo">
          <span className="dialogue-portrait">{speaker.icon}</span>
          <span className="dialogue-copy"><strong>{speaker.name}</strong><p>{dialogue.message}</p><small>TOQUE PARA FECHAR</small></span>
          <i />
        </button>
      ) : null}

      {drawer ? (
        <div className="hud-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDrawer(null); }}>
          <aside className={`hud-drawer drawer-${drawer}`} aria-label="Painel de informações">
            <header><div><small>PAINEL DE CAMPO</small><h2>{drawer === "menu" ? "Menu" : drawer === "mission" ? "Objetivos" : drawer === "units" ? "Unidades" : "Crônica"}</h2></div><button type="button" onClick={() => setDrawer(null)} aria-label="Fechar painel">×</button></header>
            {drawer === "menu" ? (
              <div className="drawer-menu-actions">
                <button type="button" onClick={() => { setDrawer(null); clickCurrent(".living-back-button"); }}><span>←</span><div><strong>Voltar ao menu</strong><small>Sair da missão atual</small></div></button>
                <button type="button" onClick={() => setDrawer("mission")}><span>◎</span><div><strong>Objetivos</strong><small>Progresso e instruções</small></div></button>
                <button type="button" onClick={() => setDrawer("chronicle")}><span>☷</span><div><strong>Crônica</strong><small>Últimos eventos do turno</small></div></button>
              </div>
            ) : null}
            {drawer === "mission" ? (
              <div className="drawer-mission">
                <article><small>{snapshot.objectiveTitle}</small><strong>{snapshot.objectiveLabel}</strong><p>{snapshot.objectiveHelp}</p></article>
                <ol>{snapshot.objectives.map((objective, index) => <li key={objective.label} className={objective.state}><span>{objective.state === "completed" ? "✓" : index + 1}</span><p>{objective.label}</p></li>)}</ol>
              </div>
            ) : null}
            {drawer === "units" ? (
              <div className="drawer-unit-list">
                {snapshot.units.map((unit) => <button key={`${unit.index}-${unit.name}`} type="button" disabled={unit.locked} className={unit.selected ? "selected" : ""} onClick={() => { clickCurrent(`.unit-roster > button:nth-child(${unit.index + 1})`); setDrawer(null); }}><span>{unit.name.slice(0, 1)}</span><div><strong>{unit.name}</strong><small>{unit.title}</small><p>{unit.hp}</p></div></button>)}
              </div>
            ) : null}
            {drawer === "chronicle" ? (
              <div className="drawer-chronicle">{snapshot.chronicle.map((entry, index) => <article key={`${entry}-${index}`}><span>{index + 1}</span><p>{entry}</p></article>)}</div>
            ) : null}
            <footer>Tehkné Solutions</footer>
          </aside>
        </div>
      ) : null}

      {combat.open ? (
        <div className={`rpg-combat-director beat-${combatBeat}`} aria-live="polite">
          {combatBeat === "selection" ? <div className="battle-narrative-prompt"><span>✦</span><div><small>ORÁCULO DE BATALHA</small><strong>Leia a intenção, combine suas cartas e confirme o golpe.</strong></div></div> : null}
          {combatDialogue ? (
            <div className={`combat-dialogue-card tone-${combatDialogue.speaker.tone}`}><span>{combatDialogue.speaker.icon}</span><div><small>{combatDialogue.speaker.name}</small><p>{combatDialogue.message}</p></div></div>
          ) : null}
          {combatBeat === "player-strike" ? <div className="cinematic-strike strike-player"><i /><b>-{combat.playerDamage}</b><strong>{combatScript?.playerAction}</strong></div> : null}
          {combatBeat === "enemy-strike" ? <div className="cinematic-strike strike-enemy"><i /><b>-{combat.enemyDamage}</b><strong>{combatScript?.enemyAction}</strong></div> : null}
          {combatBeat === "summary" ? <div className="combat-summary-ready"><span>✦</span><strong>Rodada resolvida</strong><small>Revise o resultado e continue.</small></div> : null}
        </div>
      ) : null}
    </>,
    document.body,
  );
}
