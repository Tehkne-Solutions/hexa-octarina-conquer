import { useState } from "react";

import { CardCombatScreen } from "./CardCombatScreen";
import { EconomyOverlay } from "./EconomyOverlay";
import { HexaOverlay, type HexaFilter } from "./HexaOverlay";
import { LivingMap, type ArmyView, type Hoc2Hex, type MovementTargetView, type OctarinaEdgeView, type OctarinaNodeView, type StrategicEdgeView, type StrategicNodeView } from "./LivingMap";
import { useHoc2Camera } from "./MapCamera";
import "./hoc2.css";

const SANDBOX_HEXES: Hoc2Hex[] = [
  { q:0,r:0,terrain:"plain",owner:"alliance",landmark:"city",label:"Aldor",influence:{alliance:3},libertyCount:3 },
  { q:1,r:0,terrain:"plain",owner:"alliance",influence:{alliance:3,rubra:1},libertyCount:2 },
  { q:2,r:0,terrain:"road",owner:"neutral",landmark:"bridge",label:"Velmar",influence:{alliance:2,rubra:2},goStatus:"isolated",libertyCount:1 },
  { q:3,r:0,terrain:"plain",owner:"neutral",landmark:"mine",label:"Mina",influence:{alliance:1,rubra:2} },
  { q:4,r:0,terrain:"plain",owner:"rubra",influence:{alliance:1,rubra:3},libertyCount:2 },
  { q:5,r:0,terrain:"mountain",owner:"rubra",landmark:"fortress",label:"Fortaleza",influence:{rubra:3},libertyCount:3 },
  { q:0,r:1,terrain:"forest",owner:"alliance",influence:{alliance:3},libertyCount:3 }, { q:1,r:1,terrain:"forest",owner:"alliance",influence:{alliance:3,rubra:1},libertyCount:2 },
  { q:2,r:1,terrain:"road",owner:"neutral",influence:{alliance:2,rubra:2} }, { q:3,r:1,terrain:"plain",owner:"neutral",landmark:"octarina",label:"Núcleo",influence:{alliance:1,rubra:1} },
  { q:4,r:1,terrain:"plain",owner:"rubra",influence:{alliance:1,rubra:3},libertyCount:2 }, { q:5,r:1,terrain:"mountain",owner:"rubra",influence:{rubra:3},libertyCount:3 },
  { q:-1,r:2,terrain:"forest",owner:"alliance",influence:{alliance:3},libertyCount:3 }, { q:0,r:2,terrain:"plain",owner:"alliance",influence:{alliance:3},libertyCount:2 },
  { q:1,r:2,terrain:"plain",owner:"neutral",influence:{alliance:2,rubra:1} }, { q:2,r:2,terrain:"water",owner:"neutral",influence:{} }, { q:3,r:2,terrain:"plain",owner:"neutral",influence:{alliance:1,rubra:2} }, { q:4,r:2,terrain:"plain",owner:"rubra",influence:{rubra:3},libertyCount:2 },
  { q:-1,r:3,terrain:"plain",owner:"alliance",influence:{alliance:2},libertyCount:2 }, { q:0,r:3,terrain:"plain",owner:"neutral",influence:{alliance:1} }, { q:1,r:3,terrain:"water",owner:"neutral",influence:{} }, { q:2,r:3,terrain:"water",owner:"neutral",influence:{} }, { q:3,r:3,terrain:"plain",owner:"rubra",influence:{rubra:2},libertyCount:1,goStatus:"isolated" }, { q:4,r:3,terrain:"mountain",owner:"rubra",influence:{rubra:3},libertyCount:2 },
];
const NETWORK_NODES: StrategicNodeView[] = [
  { id:"aldor",q:0,r:0,kind:"Cidade",owner:"alliance" }, { id:"bridge",q:2,r:0,kind:"Ponte",owner:"alliance" }, { id:"mine",q:3,r:0,kind:"Mina",owner:"alliance" }, { id:"core",q:3,r:1,kind:"Núcleo",owner:"neutral" }, { id:"fortress",q:5,r:0,kind:"Fortaleza",owner:"rubra" },
];
const NETWORK_EDGES: StrategicEdgeView[] = [ { a:"aldor",b:"bridge",state:"connected" }, { a:"bridge",b:"mine",state:"connected" }, { a:"mine",b:"core",state:"contested" }, { a:"core",b:"fortress",state:"blocked" } ];
const OCTARINA_NODES: OctarinaNodeView[] = [ { id:"oct-core",q:3,r:1,kind:"core",owner:"alliance",state:"active" }, { id:"oct-north",q:4,r:0,kind:"source",owner:"alliance",state:"active",charge:2 }, { id:"oct-east",q:4,r:1,kind:"source",owner:"alliance",state:"active",charge:3 }, { id:"oct-south",q:3,r:2,kind:"source",owner:"alliance",state:"active",charge:4 } ];
const OCTARINA_EDGES: OctarinaEdgeView[] = [ { a:"oct-core",b:"oct-north",state:"connected" }, { a:"oct-core",b:"oct-east",state:"connected" }, { a:"oct-core",b:"oct-south",state:"connected" } ];
const ARMIES: ArmyView[] = [
  { id:"kael",q:1,r:0,faction:"alliance",commander:"Kael Vorthan",supply:"supplied",movement:4,units:["Guardas","Arqueiros","Cavalaria"] },
  { id:"brakk",q:4,r:0,faction:"rubra",commander:"Brakk Nulgar",supply:"supplied",movement:4,units:["Brutos","Lanceiros","Arqueiros"] },
];
const KAEL_MOVEMENT: MovementTargetView[] = [
  { q:0,r:0,cost:1 }, { q:0,r:1,cost:2 }, { q:1,r:1,cost:2 }, { q:2,r:0,cost:1 }, { q:2,r:1,cost:2,zoc:true }, { q:3,r:0,cost:2,zoc:true }, { q:4,r:0,cost:3,contact:true },
];

export function Hoc2Game() {
  const camera=useHoc2Camera();
  const [hexaMode,setHexaMode]=useState(false);
  const [hexaFilter,setHexaFilter]=useState<HexaFilter>("domain");
  const [combatOpen,setCombatOpen]=useState(false);
  const hexaLabel = hexaFilter === "movement" ? "MOVIMENTO · Kael 4 MP · terreno, ZoC e contato com Brakk calculados pelo servidor"
    : hexaFilter === "influence" ? "INFLUÊNCIA · pressão Aliança:Rubra, liberdades e posições isoladas"
    : hexaFilter === "connections" ? "CONEXÕES · nós estratégicos, supply e trechos bloqueados"
    : hexaFilter === "octarina" ? "OCTARINA · HEXA 3/6 · Ressonância Arcana ativa"
    : hexaFilter === "resources" ? "RECURSOS · produção por turno e Mina dependente de supply"
    : hexaFilter === "construction" ? "CONSTRUÇÃO · Posto Avançado, Estrada e Condutor em contexto"
    : "DOMÍNIO · Aliança, Rubra e território neutro";

  if (combatOpen) return <CardCombatScreen onClose={()=>setCombatOpen(false)}/>;

  return <main className={`hoc2-shell${hexaMode?" is-hexa-mode":""}`}>
    <header className="hoc2-topbar"><div className="hoc2-brand"><strong>HOC</strong><span>Hexa Octarina Conquer</span></div><div className="hoc2-phase"><span>HOC2 VS01-I</span><strong>{hexaMode?"Strategic Hexa View":"Living Map Sandbox"}</strong></div><button type="button" onClick={camera.focusCenter}>Centralizar</button></header>
    <section className="hoc2-map-viewport" {...camera.handlers}>
      <div className="hoc2-map-camera" style={{transform:camera.transform}}><LivingMap hexes={SANDBOX_HEXES} hexaMode={hexaMode} hexaFilter={hexaFilter} networkNodes={NETWORK_NODES} networkEdges={NETWORK_EDGES} octarinaNodes={OCTARINA_NODES} octarinaEdges={OCTARINA_EDGES} octarinaFormation={{coreId:"oct-core",slots:3,maxSlots:6,flow:9,resonance:true}} armies={ARMIES} movementTargets={hexaFilter==="movement"?KAEL_MOVEMENT:[]} /></div>
      <HexaOverlay active={hexaMode} filter={hexaFilter} onToggle={()=>setHexaMode(v=>!v)} onFilter={setHexaFilter}/>
      {hexaMode?<EconomyOverlay filter={hexaFilter}/>:null}
      {hexaMode&&hexaFilter==="movement"?<aside className="hoc2-army-panel"><strong>Kael Vorthan</strong><span>MP 4/4 · SUPPLIED</span><small>Guardas · Arqueiros · Cavalaria</small><em>Brakk em ZoC: entrar no hex inimigo gera ENEMY_CONTACT.</em><button type="button" onClick={()=>setCombatOpen(true)}>INICIAR CONFRONTO</button></aside>:null}
      <aside className="hoc2-camera-help" aria-label="Controles da câmera"><strong>{hexaMode?"Visão estratégica":"Câmera"}</strong><span>Roda: zoom</span><span>WASD / setas: navegar</span><span>Shift + arrastar ou botão do meio: pan</span><span>Bordas: edge scrolling</span><small>Zoom {camera.camera.zoom.toFixed(2)}×</small></aside>
      {hexaMode?<div className="hoc2-mode-note" role="status">{hexaLabel}</div>:null}
    </section><footer className="hoc2-footer">Tehkné Solutions</footer>
  </main>;
}
