import { type RefObject, useEffect, useState } from "react";

interface GuidanceState {
  ai: string | null;
  tutorial: { title: string; text: string } | null;
}

const EMPTY: GuidanceState = { ai: null, tutorial: null };

function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function Pack99NonBlockingGuidance({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [state, setState] = useState<GuidanceState>(EMPTY);
  const [dismissedAi, setDismissedAi] = useState("");
  const [dismissedTutorial, setDismissedTutorial] = useState("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const aiNode = root.querySelector(".ai-turn-curtain");
        const ai = text(aiNode?.querySelector("strong") ?? aiNode) || null;
        const coach = root.querySelector(".battle-coach-card");
        const title = text(coach?.querySelector("strong"));
        const description = text(coach?.querySelector("p"));
        setState({ ai, tutorial: coach && title ? { title, text: description } : null });
      });
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    sync();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [rootRef]);

  const showAi = Boolean(state.ai && state.ai !== dismissedAi);
  const tutorialKey = state.tutorial ? `${state.tutorial.title}:${state.tutorial.text}` : "";
  const showTutorial = Boolean(state.tutorial && tutorialKey !== dismissedTutorial);

  if (!showAi && !showTutorial) return null;

  return (
    <div className="pack99-guidance-stack" aria-live="polite">
      {showAi && state.ai ? (
        <aside className="pack99-guidance-card is-ai">
          <span aria-hidden="true">♞</span><div><small>Movimento inimigo</small><strong>{state.ai}</strong></div>
          <button type="button" onClick={() => setDismissedAi(state.ai ?? "")} aria-label="Fechar aviso da IA">×</button>
        </aside>
      ) : null}
      {showTutorial && state.tutorial ? (
        <aside className="pack99-guidance-card is-tutorial">
          <span aria-hidden="true">?</span><div><small>Dica de campo</small><strong>{state.tutorial.title}</strong><p>{state.tutorial.text}</p></div>
          <button type="button" onClick={() => setDismissedTutorial(tutorialKey)} aria-label="Fechar dica">×</button>
        </aside>
      ) : null}
    </div>
  );
}
