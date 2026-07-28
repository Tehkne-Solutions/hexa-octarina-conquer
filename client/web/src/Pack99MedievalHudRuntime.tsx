import { type RefObject, useEffect } from "react";

const MISSION_PANEL_KEY = "hoc.ui.mission-panel-open";
const UNIT_PANEL_KEY = "hoc.ui.unit-panel-open";

function readOpenState(key: string, fallback: boolean): boolean {
  const stored = localStorage.getItem(key);
  return stored === null ? fallback : stored === "true";
}

function applyPanelState(panel: HTMLElement, button: HTMLButtonElement, open: boolean, label: string): void {
  panel.classList.toggle("is-collapsed", !open);
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "Recolher" : label;
}

function makeToggle(
  label: string,
  className: string,
  storageKey: string,
  panel: HTMLElement,
  defaultOpen: boolean,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `medieval-panel-toggle ${className}`;

  let open = readOpenState(storageKey, defaultOpen);
  applyPanelState(panel, button, open, label);

  button.addEventListener("click", () => {
    open = panel.classList.contains("is-collapsed");
    localStorage.setItem(storageKey, String(open));
    applyPanelState(panel, button, open, label);
  });

  return button;
}

export function Pack99MedievalHudRuntime({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frame = 0;
    const cleanups: Array<() => void> = [];

    const install = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const mission = root.querySelector<HTMLElement>(".living-mission-panel");
        const units = root.querySelector<HTMLElement>(".unit-command-panel");
        const layout = root.querySelector<HTMLElement>(".go-dots-layout");
        if (!layout) return;

        layout.classList.add("medieval-hud-layout");

        if (mission && !mission.querySelector(".mission-panel-toggle")) {
          const button = makeToggle("Missão", "mission-panel-toggle", MISSION_PANEL_KEY, mission, false);
          mission.prepend(button);
          cleanups.push(() => button.remove());
        }

        if (units && !units.querySelector(".unit-panel-toggle")) {
          const button = makeToggle("Unidade", "unit-panel-toggle", UNIT_PANEL_KEY, units, false);
          units.prepend(button);
          cleanups.push(() => button.remove());
        }

        const objectiveList = mission?.querySelector<HTMLElement>(".compact-objectives");
        objectiveList?.setAttribute("aria-hidden", "true");
        const timeline = units?.querySelector<HTMLElement>(".event-timeline");
        timeline?.setAttribute("aria-hidden", "true");
      });
    };

    const observer = new MutationObserver(install);
    observer.observe(root, { childList: true, subtree: true });
    install();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [rootRef]);

  return null;
}
