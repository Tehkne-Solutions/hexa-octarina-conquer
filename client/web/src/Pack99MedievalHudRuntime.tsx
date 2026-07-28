import { type RefObject, useEffect } from "react";

function makeToggle(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `medieval-panel-toggle ${className}`;
  button.textContent = label;
  button.setAttribute("aria-expanded", "true");
  button.addEventListener("click", onClick);
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
          const button = makeToggle("Missão", "mission-panel-toggle", () => {
            const collapsed = mission.classList.toggle("is-collapsed");
            button.setAttribute("aria-expanded", String(!collapsed));
            button.textContent = collapsed ? "Missão" : "Recolher";
          });
          mission.prepend(button);
          cleanups.push(() => button.remove());
        }

        if (units && !units.querySelector(".unit-panel-toggle")) {
          const button = makeToggle("Unidade", "unit-panel-toggle", () => {
            const collapsed = units.classList.toggle("is-collapsed");
            button.setAttribute("aria-expanded", String(!collapsed));
            button.textContent = collapsed ? "Unidade" : "Recolher";
          });
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
