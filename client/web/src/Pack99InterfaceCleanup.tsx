import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

interface NoticeItem {
  id: string;
  text: string;
  kind: "objective" | "combat" | "ai" | "system";
  createdAt: number;
}

const NOTICE_SELECTORS = [
  ".living-notice",
  ".ai-turn-summary",
  ".event-timeline p",
  ".phase-banner",
  ".compact-objectives .current",
];

const HIDE_SOURCE_SELECTORS = new Set([
  ".living-notice",
  ".event-timeline p",
  ".compact-objectives .current",
]);

function classifyNotice(text: string): NoticeItem["kind"] {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/objetivo|missao|territorio|ponte|moinho/.test(normalized)) return "objective";
  if (/dano|combate|ataque|derrot|bloque|esquiv/.test(normalized)) return "combat";
  if (/ia|inimigo|saqueador|turno inimigo/.test(normalized)) return "ai";
  return "system";
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

export function Pack99InterfaceCleanup({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NoticeItem[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;

    const synchronize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const additions: NoticeItem[] = [];
        NOTICE_SELECTORS.forEach((selector) => {
          root.querySelectorAll<HTMLElement>(selector).forEach((node) => {
            if (node.closest(".pack99-notification-dock")) return;
            const text = cleanText(node.textContent ?? "");
            if (!text || text.length < 3) return;
            const signature = text;
            if (HIDE_SOURCE_SELECTORS.has(selector)) node.classList.add("pack99-notice-source");
            if (seen.current.has(signature)) return;
            seen.current.add(signature);
            additions.push({ id: `${Date.now()}-${seen.current.size}`, text, kind: classifyNotice(text), createdAt: Date.now() });
          });
        });
        if (additions.length) setItems((current) => [...additions, ...current].slice(0, 40));
      });
    };

    const observer = new MutationObserver(synchronize);
    observer.observe(root, { attributes: true, childList: true, characterData: true, subtree: true });
    synchronize();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      root.querySelectorAll(".pack99-notice-source").forEach((node) => node.classList.remove("pack99-notice-source"));
    };
  }, [rootRef]);

  const unread = open ? 0 : items.length;
  const grouped = useMemo(() => items, [items]);

  return (
    <aside className={`pack99-notification-dock ${open ? "is-open" : "is-closed"}`} aria-label="Central de notificações">
      <button type="button" className="pack99-notification-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} title="Notificações">
        <span aria-hidden="true">♜</span>
        <strong>Eventos</strong>
        {unread > 0 ? <b>{Math.min(unread, 99)}</b> : null}
      </button>
      {open ? (
        <section className="pack99-notification-panel">
          <header><div><small>CRÔNICA DA BATALHA</small><strong>Eventos recentes</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Minimizar notificações">−</button></header>
          <div className="pack99-notification-list">
            {grouped.length ? grouped.map((item) => (
              <article key={item.id} className={`notice-${item.kind}`}>
                <i aria-hidden="true" />
                <p>{item.text}</p>
                <button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label="Remover notificação">×</button>
              </article>
            )) : <p className="pack99-notification-empty">Nenhum evento registrado.</p>}
          </div>
          {grouped.length ? <footer><button type="button" onClick={() => setItems([])}>Limpar histórico</button></footer> : null}
        </section>
      ) : null}
    </aside>
  );
}
