import { useEffect, useMemo, useState } from "react";

import { CardCombatScreen, type CombatExit } from "./CardCombatScreen";
import { EconomyOverlay } from "./EconomyOverlay";
import { HexaOverlay, type HexaFilter } from "./HexaOverlay";
import { LivingMap, type ArmyView, type Hoc2Hex, type MovementTargetView, type OctarinaEdgeView, type OctarinaNodeView, type StrategicEdgeView, type StrategicNodeView } from "./LivingMap";
import { useHoc2Camera } from "./MapCamera";
import { emitHoc2Telemetry } from "./hoc2Telemetry";
import "./hoc2.css";

const SPECIAL_HEXES = new Map<string, Partial<Hoc2Hex>>([
  ["0,0",{ terrain:"plain",owner:"alliance",landmark:"city",label:"Aldor",influence:{alliance:3},libertyCount:3 }],
  ["1,0",{ terrain:"plain",owner:"alliance",influence:{alliance:3,rubra:1},libertyCount:2 }],
  ["2,0",{ terrain:"road",owner:"neutral",landmark:"bridge",label:"Velmar",influence:{alliance:2,rubra:2},goStatus:"isolated",libertyCount:1 }],
  ["3,0",{ terrain:"plain",owner:"neutral",landmark:"mine",label:"Mina",influence:{alliance:1,rubra:2} }],
  ["4,0",{ terrain:"plain",owner:"rubra",influence:{alliance:1,rubra:3},libertyCount:2 }],
  ["5,0",{ terrain:"mountain",owner:"rubra",landmark:"fortress",label:"Fortaleza",influence:{rubra:3},libertyCount:3 }],
  ["2,1",{ terrain:"road",owner:"neutral",influence:{alliance:2,rubra:2} }],
  ["3,1",{ terrain:"plain",owner:"neutral",landmark:"octarina",label:"Núcleo",influence:{alliance:1,rubra:1} }],
  ["4,1",{ terrain:"plain",owner:"rubra",influence:{alliance:1,rubra:3},libertyCount:2 }],
  ["3,3",{ owner:"rubra",influence:{rubra:2},libertyCount:1,goStatus:"isolated" }],
  ["4,3",{ terrain:"mountain",owner:"rubra",influence:{rubra:3},libertyCount:2 }],
]);

const FRONTIER_TERRAIN: ReadonlyArray<ReadonlyArray<Hoc2Hex["terrain"]>> = [
  ["plain","plain","road","plain","plain","mountain","mountain","forest"],
  ["forest","plain","road","plain","plain","mountain","forest","forest"],
  ["forest","forest","plain","plain","water","plain","forest","forest"],
  ["forest","plain","plain","water","mountain","plain","plain","forest"],
  ["plain","plain","water","water","mountain","mountain","plain","plain"],
  ["plain","forest","plain","water","plain","mountain","forest","plain"],
  ["forest","forest","plain","plain","plain","forest","mountain","mountain"],
  ["forest","forest","forest","plain","plain","mountain","mountain","mountain"],
];

function strategicTerrain(q: number, r: number): Hoc2Hex["terrain"] {
  return FRONTIER_TERRAIN[r]?.[q] ?? "plain";
}

function strategicOwner(q: number): Hoc2Hex["owner"] {
  if (q<=1) return "alliance";
  if (q>=5) return "rubra";
  return "neutral";
}

function buildStrategicRegion(): Hoc2Hex[] {
  const region: Hoc2Hex[] = [];
  for (let r=0;r<8;r+=1) {
    for (let q=0;q<8;q+=1) {
      const owner=strategicOwner(q);
      const base: Hoc2Hex = {
        q,r,
        terrain:strategicTerrain(q,r),
        owner,
        influence:owner==="alliance"?{alliance:q===1?2:3}:owner==="rubra"?{rubra:q===5?2:3}:{alliance:1,rubra:1},
        libertyCount:owner==="neutral"?undefined:3,
      };
      region.push({ ...base, ...(SPECIAL_HEXES.get(`${q},${r}`)??{}) });
    }
  }
  return region;
}

const BASE_HEXES: Hoc2Hex[] = buildStrategicRegion();

const NETWORK_NODES: StrategicNodeView[] = [
  { id:"aldor",q:0,r:0,kind:"Cidade",owner:"alliance" }, { id:"bridge",q:2,r:0,kind:"Ponte",owner:"alliance" }, { id:"mine",q:3,r:0,kind:"Mina",owner:"alliance" }, { id:"core",q:3,r:1,kind:"Núcleo",owner:"neutral" }, { id:"fortress",q:5,r:0,kind:"Fortaleza",owner:"rubra" },
];
const NETWORK_EDGES: StrategicEdgeView[] = [ { a:"aldor",b:"bridge",state:"connected" }, { a:"bridge",b:"mine",state:"connected" }, { a:"mine",b:"core",state:"contested" }, { a:"core",b:"fortress",state:"blocked" } ];
const OCTARINA_NODES: OctarinaNodeView[] = [ { id:"oct-core",q:3,r:1,kind:"core",owner:"alliance",state:"active" }, { id:"oct-north",q:4,r:0,kind:"source",owner:"alliance",state:"active",charge:2 }, { id:"oct-east",q:4,r:1,kind:"source",owner:"alliance",state:"active",charge:3 }, { id:"oct-south",q:3,r:2,kind:"source",owner:"alliance",state:"active",charge:4 } ];
const OCTARINA_EDGES: OctarinaEdgeView[] = [ { a:"oct-core",b:"oct-north",state:"connected" }, { a:"oct-core",b:"oct-east",state:"connected" }, { a:"oct-core",b:"oct-south",state:"connected" } ];
const BASE_ARMIES: ArmyView[] = [
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
  const [battleOutcome,setBattleOutcome]=useState<CombatExit|null>(null);

  const hexes=useMemo(()=>battleOutcome==="victory" ? BASE_HEXES.map((hex)=>hex.q===4&&hex.r===0?{...hex,owner:"alliance" as const,influence:{alliance:3,rubra:1},libertyCount:2}:hex) : BASE_HEXES,[battleOutcome]);
  const armies=useMemo<ArmyView[]>(()=>battleOutcome==="victory" ? [
    { ...BASE_ARMIES[0], q:4, r:0, movement:0 },
    { ...BASE_ARMIES[1], q:4, r:1, supply:"cut-off" },
  ] : BASE_ARMIES,[battleOutcome]);
  const movementTargets=battleOutcome ? [] : KAEL_MOVEMENT;

  const hexaLabel = hexaFilter === "movement" ? (battleOutcome==="victory" ? "MOVIMENTO · combate encerrado · Kael ocupou o hex e Brakk recuou" : "MOVIMENTO · Kael 4 MP · terreno, ZoC e contato com Brakk calculados pelo servidor")
    : hexaFilter === "influence" ? "INFLUÊNCIA · pressão Aliança:Rubra, liberdades e posições isoladas"
    : hexaFilter === "connections" ? "CONEXÕES · nós estratégicos, supply e trechos bloqueados"
    : hexaFilter === "octarina" ? "OCTARINA · HEXA 3/6 · Ressonância Arcana ativa"
    : hexaFilter === "resources" ? "RECURSOS · produção por turno e Mina dependente de supply"
    : hexaFilter === "construction" ? "CONSTRUÇÃO · Posto Avançado, Estrada e Condutor em contexto"
    : "DOMÍNIO · Aliança, Rubra e território neutro";

  useEffect(() => {
    if (!battleOutcome) return;
    emitHoc2Telemetry({ event:"strategic.snapshot.rendered", source:"hoc2-game", outcome:battleOutcome, filter:hexaFilter });
  }, [battleOutcome, hexaFilter]);

  function toggleHexaMode() {
    setHexaMode((current) => {
      const next = !current;
      emitHoc2Telemetry({ event:"hexa.mode", source:"ui", input:next?"on":"off", filter:hexaFilter });
      return next;
    });
  }

  function selectHexaFilter(filter: HexaFilter) {
    setHexaFilter(filter);
    emitHoc2Telemetry({ event:"hexa.filter", source:"ui", filter });
  }

  function startCombat() {
    emitHoc2Telemetry({ event:"movement.contact", source:"movement", q:4, r:0, attacker:"kael", defender:"brakk" });
    emitHoc2Telemetry({ event:"combat.open", source:"movement", q:4, r:0, attacker:"kael", defender:"brakk" });
    setCombatOpen(true);
  }

  function closeCombat(outcome: CombatExit) {
    setCombatOpen(false);
    setBattleOutcome(outcome);
    if(outcome==="victory") setHexaFilter("domain");
  }

  if (combatOpen) return <CardCombatScreen onClose={closeCombat}/>;

  return <main className={`hoc2-shell${hexaMode?" is-hexa-mode":""}`}>
    <header className="hoc2-topbar">
      <div className="hoc2-brand"><strong>HOC</strong><span>Hexa Octarina Conquer</span></div>
      <div className="hoc2-phase"><span>Fronteira Verde · VS01</span><strong>{hexaMode?"Modo Hexa · Análise Territorial":"Mapa Vivo · Explorar e Gerenciar"}</strong></div>
      <div className="hoc2-top-actions"><button type="button" onClick={camera.focusCenter}>Centralizar</button></div>
      <HexaOverlay active={hexaMode} filter={hexaFilter} onToggle={toggleHexaMode} onFilter={selectHexaFilter}/>
    </header>
    <section className="hoc2-map-viewport" {...camera.handlers}>
      <div className="hoc2-map-camera" style={{transform:camera.transform}}><LivingMap hexes={hexes} hexaMode={hexaMode} hexaFilter={hexaFilter} networkNodes={NETWORK_NODES} networkEdges={NETWORK_EDGES} octarinaNodes={OCTARINA_NODES} octarinaEdges={OCTARINA_EDGES} octarinaFormation={{coreId:"oct-core",slots:3,maxSlots:6,flow:9,resonance:true}} armies={armies} movementTargets={hexaFilter==="movement"?movementTargets:[]} /></div>
      {hexaMode?<EconomyOverlay filter={hexaFilter}/>:null}
      {hexaMode&&hexaFilter==="movement"&&!battleOutcome?<aside className="hoc2-army-panel"><strong>Kael Vorthan</strong><span>MP 4/4 · SUPPLIED</span><small>Guardas · Arqueiros · Cavalaria</small><em>Brakk em ZoC: entrar no hex inimigo gera ENEMY_CONTACT.</em><button type="button" onClick={startCombat}>INICIAR CONFRONTO</button></aside>:null}
      {battleOutcome==="victory"?<aside className="hoc2-cascade-panel" role="status"><strong>CONSEQUÊNCIA ESTRATÉGICA</strong><span>HEX CAPTURADO</span><span>Brakk recuou</span><span>CADEIA RUBRA RECALCULADA</span><span>SUPPLY RECALCULADO</span><span>OCTARINA RECALCULADA</span><small>O servidor HOC2 aplica esta cascata antes de devolver o snapshot ao mapa.</small></aside>:null}
      {battleOutcome==="retreat"?<aside className="hoc2-cascade-panel" role="status"><strong>RETIRADA</strong><span>Kael preservou sua posição anterior.</span><small>Nenhuma captura territorial foi aplicada.</small></aside>:null}
      <aside className="hoc2-camera-help" aria-label="Controles da câmera"><strong>{hexaMode?"Visão estratégica":"Câmera"}</strong><span>Roda: zoom</span><span>WASD / setas: navegar</span><span>Shift + arrastar ou botão do meio: pan</span><span>Bordas: edge scrolling</span><small>Zoom {camera.camera.zoom.toFixed(2)}×</small></aside>
      {hexaMode?<div className="hoc2-mode-note" role="status">{hexaLabel}</div>:null}
    </section><footer className="hoc2-footer">Tehkné Solutions</footer>
  </main>;
}
