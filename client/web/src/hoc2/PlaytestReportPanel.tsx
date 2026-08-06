import { useEffect, useMemo, useState } from "react";

import type { Hoc2HealthSummary } from "./hoc2Health";
import type { Hoc2TelemetryEvent } from "./hoc2Telemetry";
import "./playtest-report.css";

type RatingKey =
  | "mapClarity"
  | "navigationClarity"
  | "hexaReadability"
  | "systemsDistinction"
  | "movementClarity"
  | "combatClarity"
  | "combatDecisionQuality"
  | "strategicConsequence"
  | "overallFun"
  | "playAgain";

type NoteKey =
  | "hesitation"
  | "mostSatisfying"
  | "redundantOrUnclear"
  | "combatTerritoryConnection"
  | "cardDecisionMeaning"
  | "consequenceObviousness"
  | "singleBestChange";

type Verdict = "PASS" | "ADJUST" | "BLOCK" | "";

type QaWindow = typeof window & {
  __HOC2_HEALTH__?: Hoc2HealthSummary;
  __HOC2_TELEMETRY__?: Hoc2TelemetryEvent[];
};

const ratingLabels: Record<RatingKey, string> = {
  mapClarity: "Clareza do mapa",
  navigationClarity: "Clareza da navegação",
  hexaReadability: "Leitura estratégica do Hexa",
  systemsDistinction: "Distinção Go / Dots / Octarina",
  movementClarity: "Clareza de movimento / ZoC",
  combatClarity: "Clareza do Card Combat",
  combatDecisionQuality: "Qualidade das decisões de cartas",
  strategicConsequence: "Leitura da consequência estratégica",
  overallFun: "Diversão geral",
  playAgain: "Vontade de jogar outra partida",
};

const noteLabels: Record<NoteKey, string> = {
  hesitation: "Onde você hesitou ou se perdeu?",
  mostSatisfying: "Qual mecânica foi mais satisfatória?",
  redundantOrUnclear: "Qual mecânica pareceu redundante ou confusa?",
  combatTerritoryConnection: "O combate pareceu conectado ao território?",
  cardDecisionMeaning: "As sequências de cartas pareceram decisões reais?",
  consequenceObviousness: "Vitória/retirada tiveram consequência óbvia?",
  singleBestChange: "Qual única mudança mais melhoraria a experiência?",
};

const initialRatings = Object.fromEntries(Object.keys(ratingLabels).map((key) => [key, 0])) as Record<RatingKey, number>;
const initialNotes = Object.fromEntries(Object.keys(noteLabels).map((key) => [key, ""])) as Record<NoteKey, string>;

export function PlaytestReportPanel() {
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState(initialRatings);
  const [notes, setNotes] = useState(initialNotes);
  const [verdict, setVerdict] = useState<Verdict>("");
  const [health, setHealth] = useState<Hoc2HealthSummary | null>(() => (window as QaWindow).__HOC2_HEALTH__ ?? null);

  useEffect(() => {
    const onHealth = (event: Event) => setHealth((event as CustomEvent<Hoc2HealthSummary>).detail);
    window.addEventListener("hoc2:health", onHealth);
    return () => window.removeEventListener("hoc2:health", onHealth);
  }, []);

  const ratingAverage = useMemo(() => {
    const values = Object.values(ratings).filter((value) => value > 0);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }, [ratings]);

  function exportReport() {
    const qaWindow = window as QaWindow;
    const payload = {
      schema: "hoc2.playtest01.human-session.v1",
      exportedAt: new Date().toISOString(),
      url: window.location.href,
      ratings,
      ratingAverage: Number(ratingAverage.toFixed(2)),
      notes,
      verdict,
      health: qaWindow.__HOC2_HEALTH__ ?? null,
      telemetry: qaWindow.__HOC2_TELEMETRY__ ?? [],
      knownDebt: ["Brakk definitive art tracked separately"],
      signature: "Tehkné Solutions",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `hoc2-playtest01-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  return <aside className={`hoc2-playtest-report${open ? " is-open" : ""}`} aria-label="HOC2 Playtest Report">
    <button type="button" className="hoc2-playtest-report__toggle" onClick={() => setOpen((value) => !value)}>
      {open ? "FECHAR RELATÓRIO" : "PLAYTEST REPORT"}
    </button>
    {open ? <div className="hoc2-playtest-report__body">
      <header>
        <strong>PLAYTEST 01 · HUMAN SESSION</strong>
        <span>Issue #326 · QA overlay</span>
      </header>

      <section className="hoc2-playtest-report__health">
        <b>HEALTH</b>
        <span className={`status-${health?.overall ?? "pending"}`}>{(health?.overall ?? "pending").toUpperCase()}</span>
        <small>{health ? `${health.route} · issues=${health.issues.length}` : "aguardando telemetria"}</small>
      </section>

      <section>
        <h3>Notas 1–5</h3>
        <div className="hoc2-playtest-report__ratings">
          {(Object.keys(ratingLabels) as RatingKey[]).map((key) => <label key={key}>
            <span>{ratingLabels[key]}</span>
            <select value={ratings[key]} onChange={(event) => setRatings((current) => ({ ...current, [key]: Number(event.target.value) }))}>
              <option value={0}>—</option>
              {[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>)}
        </div>
        <small>Média preenchida: {ratingAverage ? ratingAverage.toFixed(2) : "—"}</small>
      </section>

      <section>
        <h3>Observações</h3>
        {(Object.keys(noteLabels) as NoteKey[]).map((key) => <label className="hoc2-playtest-report__note" key={key}>
          <span>{noteLabels[key]}</span>
          <textarea rows={2} value={notes[key]} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} />
        </label>)}
      </section>

      <section>
        <h3>Decisão</h3>
        <div className="hoc2-playtest-report__verdicts">
          {(["PASS","ADJUST","BLOCK"] as const).map((value) => <button type="button" key={value} className={verdict === value ? "is-selected" : ""} onClick={() => setVerdict(value)}>{value}</button>)}
        </div>
      </section>

      <button type="button" className="hoc2-playtest-report__export" onClick={exportReport}>EXPORTAR SESSÃO JSON</button>
      <footer>Tehkné Solutions</footer>
    </div> : null}
  </aside>;
}
