import { useEffect, useMemo, useState } from "react";

import { emptyPack99StrategicCatalog, loadPack99StrategicCatalog, type Pack99StrategicCatalog } from "../pack99-strategic-catalog";
import { emitHoc2Telemetry } from "./hoc2Telemetry";
import "./card-combat.css";

type CombatCard = { id: string; name: string; type: "attack"|"defense"|"tactic"|"formation"|"hero"|"octarina"; cost: number; priority: number; text: string };
export type CombatExit = "retreat" | "victory";

const HAND: CombatCard[] = [
  { id:"feint", name:"Feint", type:"tactic", cost:1, priority:9, text:"Aplica OPENING e expõe a defesa inimiga." },
  { id:"precise-strike", name:"Precise Strike", type:"attack", cost:2, priority:5, text:"6 dano. +4 quando segue uma abertura." },
  { id:"shield-wall", name:"Shield Wall", type:"defense", cost:2, priority:8, text:"Ganha 5 de escudo antes dos ataques lentos." },
  { id:"arrow-volley", name:"Arrow Volley", type:"formation", cost:3, priority:4, text:"Dano ao comandante e à força do exército." },
  { id:"octarina-guard", name:"Octarina Guard", type:"octarina", cost:3, priority:10, text:"7 de escudo e estado GUARDED." },
];

export function CardCombatScreen({ onClose }: { onClose: (outcome: CombatExit) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<"select"|"resolve"|"result">("select");
  const [assets, setAssets] = useState<Pack99StrategicCatalog>(() => emptyPack99StrategicCatalog());
  const startingEnergy = 7;
  const spent = useMemo(() => selected.reduce((sum,id)=>sum+(HAND.find(c=>c.id===id)?.cost??0),0), [selected]);
  const energy = startingEnergy - spent;
  const combo = selected.indexOf("feint") !== -1 && selected.indexOf("precise-strike") > selected.indexOf("feint");

  useEffect(() => {
    let active = true;
    void loadPack99StrategicCatalog().then((catalog) => { if (active) setAssets(catalog); });
    return () => { active = false; };
  }, []);

  function toggle(id: string) {
    if (phase !== "select") return;
    setSelected((current) => current.includes(id) ? current.filter((item)=>item!==id) : current.length < 3 ? [...current,id] : current);
  }
  function commit() {
    if (!selected.length || energy < 0) return;
    setPhase("resolve");
    window.setTimeout(() => setPhase("result"), 650);
  }
  function exitCombat(outcome: CombatExit) {
    emitHoc2Telemetry({ event:"combat.exit.requested", source:"card-combat", outcome });
    onClose(outcome);
    emitHoc2Telemetry({ event:"combat.exit.applied", source:"card-combat", outcome });
  }

  const portrait = (src: string | null, initials: string, alt: string, tacticalFallback = false) => (
    <div className="hoc2-portrait-frame">
      {src ? <img src={src} alt={alt} className="hoc2-portrait-image"/> : <span className={`hoc2-portrait-fallback${tacticalFallback ? " is-brakk" : ""}`} data-brakk-fallback={tacticalFallback ? "true" : undefined}><b>{initials}</b>{tacticalFallback ? <small>RUBRA · TACTICAL PROFILE</small> : null}</span>}
    </div>
  );

  return <section className="hoc2-combat-screen" aria-label="Card Combat 2">
    <header className="hoc2-combat-header"><span>ENEMY CONTACT</span><strong>KAEL VORTHAN <em>VS</em> BRAKK NULGAR</strong><small>ROUND 1 · PLANÍCIE · Ressonância Arcana +1 energia</small></header>
    <div className="hoc2-combat-stage">
      <article className="hoc2-combatant is-alliance">{portrait(assets.kael,"KV","Kael Vorthan — arte canônica PACK 99")}<h2>Kael Vorthan</h2><div className="hoc2-bars"><label>HP <span>24 / 24</span></label><progress max="24" value="24"/><label>ARMY <span>30 / 30</span></label><progress max="30" value="30"/></div><small>Guardas · Arqueiros · Cavalaria</small></article>
      <div className="hoc2-versus"><span>INTENT</span><strong>AGGRESSIVE</strong><small>Brakk prepara pressão frontal.</small></div>
      <article className="hoc2-combatant is-rubra">{portrait(null,"BN","Brakk Nulgar — perfil tático temporário",true)}<h2>Brakk Nulgar</h2><div className="hoc2-bars"><label>HP <span>26 / 26</span></label><progress max="26" value="26"/><label>ARMY <span>32 / 32</span></label><progress max="32" value="32"/></div><small>Brutos · Lanceiros · Arqueiros</small></article>
    </div>

    {phase === "select" ? <>
      <div className="hoc2-selected-sequence"><strong>SEQUÊNCIA</strong>{selected.length ? selected.map((id,index)=><span key={id}>{index+1}. {HAND.find(c=>c.id===id)?.name}</span>) : <span>Selecione de 1 a 3 cartas</span>}{combo?<b>COMBO · OPENING STRIKE</b>:null}</div>
      <div className="hoc2-card-hand">{HAND.map((card)=><button type="button" key={card.id} onClick={()=>toggle(card.id)} className={`hoc2-combat-card type-${card.type}${selected.includes(card.id)?" is-selected":""}`}><span>{card.type}</span><strong>{card.name}</strong><small>{card.text}</small><footer><b>{card.cost} EN</b><i>P{card.priority}</i></footer></button>)}</div>
      <footer className="hoc2-combat-actions"><div><span>ENERGIA</span><strong>{Math.max(0,energy)} / {startingEnergy}</strong><small>Seleção simultânea · máximo 3 cartas</small></div><button type="button" className="secondary" onClick={()=>exitCombat("retreat")}>RETIRADA <small>disponível · 1 liberdade</small></button><button type="button" className="primary" disabled={!selected.length||energy<0} onClick={commit}>CONFIRMAR</button></footer>
    </> : phase === "resolve" ? <div className="hoc2-combat-resolution"><strong>RESOLVENDO AÇÕES</strong><span>Prioridade → defesa → controle → ataque</span></div> : <div className="hoc2-combat-result"><strong>COMBAT RESULT</strong><p>{combo ? "Feint abriu a guarda de Brakk e Precise Strike recebeu bônus de combo." : "A sequência foi resolvida pelo contrato autoritativo do HOC2."}</p><button type="button" onClick={()=>{setPhase("select");setSelected([])}}>PRÓXIMA RODADA</button><button type="button" className="primary" onClick={()=>exitCombat("victory")}>APLICAR RESULTADO AO MAPA</button></div>}
  </section>;
}
