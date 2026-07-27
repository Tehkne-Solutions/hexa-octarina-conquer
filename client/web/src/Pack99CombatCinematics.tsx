import { type CSSProperties, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface CombatPulse {
  id: number;
  playerDamage: number;
  enemyDamage: number;
  critical: boolean;
}

function readDamage(root: HTMLElement): CombatPulse | null {
  const panel = root.querySelector<HTMLElement>(".battle-resolution-panel");
  if (!panel) return null;
  const dealt = panel.querySelector<HTMLElement>(".damage-dealt")?.textContent ?? "";
  const taken = panel.querySelector<HTMLElement>(".damage-taken")?.textContent ?? "";
  const playerDamage = Number(dealt.match(/\d+/)?.[0] ?? 0);
  const enemyDamage = Number(taken.match(/\d+/)?.[0] ?? 0);
  if (!playerDamage && !enemyDamage) return null;
  return { id: 0, playerDamage, enemyDamage, critical: playerDamage >= 5 || enemyDamage >= 5 };
}

export function Pack99CombatCinematics({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [pulse, setPulse] = useState<CombatPulse | null>(null);
  const signatureRef = useRef("");
  const counterRef = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    let clearTimer = 0;

    const sync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const world = root.querySelector<HTMLElement>(".go-dots-world");
        setTarget((current) => current === world ? current : world);
        const result = readDamage(root);
        if (!result) return;
        const signature = `${result.playerDamage}:${result.enemyDamage}:${root.querySelector(".battle-resolution-panel")?.textContent}`;
        if (signature === signatureRef.current) return;
        signatureRef.current = signature;
        counterRef.current += 1;
        setPulse({ ...result, id: counterRef.current });
        world?.classList.remove("pack99-impact-camera");
        void world?.offsetWidth;
        world?.classList.add("pack99-impact-camera");
        window.clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => {
          setPulse(null);
          world?.classList.remove("pack99-impact-camera");
        }, 1500);
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });
    sync();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clearTimer);
    };
  }, [rootRef]);

  if (!target || !pulse) return null;

  return createPortal(
    <div key={pulse.id} className={`pack99-combat-cinematics ${pulse.critical ? "is-critical" : ""}`} aria-hidden="true">
      <span className="combat-flash" />
      <span className="combat-projectile player-projectile" />
      <span className="combat-projectile enemy-projectile" />
      <span className="combat-impact player-impact" />
      <span className="combat-impact enemy-impact" />
      <strong className="floating-damage damage-enemy">-{pulse.playerDamage}</strong>
      <strong className="floating-damage damage-player">-{pulse.enemyDamage}</strong>
      <span className="combat-shards">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--shard": index } as CSSProperties} />)}</span>
    </div>,
    target,
  );
}
