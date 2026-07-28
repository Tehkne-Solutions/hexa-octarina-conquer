import { type RefObject, useEffect, useMemo, useState } from "react";

interface AssetAuditEntry {
  id: string;
  category: "world" | "unit" | "structure";
  state: "loading" | "ready" | "missing";
  detail?: string;
}

interface AssetAuditSnapshot {
  entries: AssetAuditEntry[];
  ready: number;
  loading: number;
  missing: number;
}

const EMPTY: AssetAuditSnapshot = { entries: [], ready: 0, loading: 0, missing: 0 };

function unique(entries: AssetAuditEntry[]): AssetAuditEntry[] {
  const byKey = new Map<string, AssetAuditEntry>();
  entries.forEach((entry) => byKey.set(`${entry.category}:${entry.id}`, entry));
  return [...byKey.values()].sort((left, right) => left.category.localeCompare(right.category) || left.id.localeCompare(right.id));
}

function readSnapshot(root: HTMLElement): AssetAuditSnapshot {
  const entries: AssetAuditEntry[] = [];

  root.querySelectorAll<HTMLElement>("[data-pack99-unit]").forEach((node) => {
    const id = node.dataset.pack99Unit ?? "unknown-unit";
    const state = (node.dataset.pack99AssetState ?? "loading") as AssetAuditEntry["state"];
    entries.push({ id, category: "unit", state, detail: node.dataset.pack99Asset });
  });

  const world = root.querySelector<HTMLElement>(".pack99-living-world");
  if (world) {
    const ready = world.dataset.pack99Ready === "true";
    const missing = Number(world.dataset.missingAssets ?? "0");
    entries.push({
      id: "ash-bridge-world",
      category: "world",
      state: ready ? "ready" : missing > 0 ? "missing" : "loading",
      detail: `${world.dataset.resolvedAssets ?? "0"}/${world.dataset.requiredAssets ?? "0"}`,
    });
  }

  const structures = root.querySelector<HTMLElement>(".pack99-strategic-structures");
  if (structures) {
    const missing = (structures.dataset.pack99StructuresMissing ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const ready = structures.dataset.pack99StructuresReady === "true";
    entries.push({ id: "strategic-structures", category: "structure", state: ready ? "ready" : missing.length ? "missing" : "loading", detail: missing.join(", ") || undefined });
    missing.forEach((id) => entries.push({ id, category: "structure", state: "missing" }));
  }

  const normalized = unique(entries);
  return {
    entries: normalized,
    ready: normalized.filter((entry) => entry.state === "ready").length,
    loading: normalized.filter((entry) => entry.state === "loading").length,
    missing: normalized.filter((entry) => entry.state === "missing").length,
  };
}

export function Pack99AssetAudit({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const [snapshot, setSnapshot] = useState<AssetAuditSnapshot>(EMPTY);
  const [open, setOpen] = useState(false);
  const qaEnabled = document.documentElement.dataset.visualQa === "true" || new URL(window.location.href).searchParams.get("pack99-audit") === "1";

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;
    const synchronize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = readSnapshot(root);
        setSnapshot(next);
        window.dispatchEvent(new CustomEvent("pack99:asset-audit", { detail: next }));
        (window as Window & { __PACK99_ASSET_AUDIT__?: AssetAuditSnapshot }).__PACK99_ASSET_AUDIT__ = next;
      });
    };
    const observer = new MutationObserver(synchronize);
    observer.observe(root, { attributes: true, childList: true, subtree: true });
    synchronize();
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [rootRef]);

  const grouped = useMemo(() => ({
    units: snapshot.entries.filter((entry) => entry.category === "unit"),
    world: snapshot.entries.filter((entry) => entry.category === "world"),
    structures: snapshot.entries.filter((entry) => entry.category === "structure"),
  }), [snapshot.entries]);

  if (!qaEnabled) return null;

  return (
    <aside className={`pack99-asset-audit ${open ? "is-open" : "is-closed"}`} aria-label="Auditoria de assets PACK 99">
      <button type="button" className="pack99-asset-audit-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        PACK 99 · {snapshot.ready} OK · {snapshot.missing} ausentes
      </button>
      {open ? <section>
        <header><strong>Auditoria de runtime</strong><button type="button" onClick={() => setOpen(false)} aria-label="Fechar auditoria">×</button></header>
        {[...grouped.world, ...grouped.units, ...grouped.structures].map((entry) => (
          <article key={`${entry.category}-${entry.id}`} className={`state-${entry.state}`}>
            <span>{entry.category}</span><strong>{entry.id}</strong><b>{entry.state}</b>{entry.detail ? <small>{entry.detail}</small> : null}
          </article>
        ))}
      </section> : null}
    </aside>
  );
}
