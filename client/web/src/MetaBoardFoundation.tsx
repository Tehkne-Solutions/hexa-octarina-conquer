import { useEffect, useMemo, useState } from "react";

import { MetaPack99World, type MetaUnitId } from "./MetaPack99World";
import {
  canClaimEdge, claimEdge, connectedNodeIds, countFactionCells, createMetaBoardModel,
  metaCellPolygon, metaEdgeId, metaIsoPoint,
  type MetaBoardModel, type MetaEdge, type MetaFaction, type MetaNode,
} from "./meta-board-model";
import { runtimeAssetUrl } from "./runtime-assets";
import "./meta-board-foundation.css";
import "./meta-board-gameplay.css";
import "./meta-pack99-world.css";

interface MetaBoardFoundationProps { playerName:string; onBack:()=>void; }
interface MetaRuntimeVisuals { pillar:string|null; pillarSelected:string|null; }
type ActionMode = "build"|"move"|"attack";
type GameResult = "playing"|"victory"|"defeat";

const FACTION_LABEL:Record<MetaFaction,string>={blue:"Aliança de Orun",red:"Legião Rubra",violet:"Convergência Octarina"};
const EMPTY_VISUALS:MetaRuntimeVisuals={pillar:null,pillarSelected:null};
const PLAYER_FACTION:MetaFaction="blue";
const INITIAL_UNITS:Record<MetaUnitId,string>={kael:"n-1-3",lyra:"n-2-3",varg:"n-5-2",brakk:"n-5-1"};
const INITIAL_HP:Record<MetaUnitId,number>={kael:18,lyra:14,varg:12,brakk:16};
const FRIENDLY_UNITS:MetaUnitId[]=["kael","lyra"];
const ENEMY_UNITS:MetaUnitId[]=["varg","brakk"];

function edgeGeometry(edge:MetaEdge,nodeIndex:Map<string,MetaNode>){
  const a=nodeIndex.get(edge.a)!; const b=nodeIndex.get(edge.b)!; const start=metaIsoPoint(a.col,a.row); const end=metaIsoPoint(b.col,b.row);
  const dx=end.x-start.x,dy=end.y-start.y;
  return {left:`${(start.x+end.x)/2/10.8}%`,top:`${(start.y+end.y)/2/6.2}%`,width:`${Math.hypot(dx,dy)/10.8}%`,transform:`translate(-50%, -50%) rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`};
}
function ownedConnection(board:MetaBoardModel,a:string,b:string,faction:MetaFaction){return board.edges.some((edge)=>edge.id===metaEdgeId(a,b)&&edge.owner===faction);}
function firstEnemyExpansion(board:MetaBoardModel,from:string){return connectedNodeIds(board,from).find((id)=>canClaimEdge(board,from,id))??null;}
function unitAtNode(unitNodes:Record<MetaUnitId,string>,defeated:Set<MetaUnitId>,nodeId:string,ids:MetaUnitId[]){return ids.find((id)=>!defeated.has(id)&&unitNodes[id]===nodeId)??null;}

export function MetaBoardFoundation({playerName,onBack}:MetaBoardFoundationProps){
  const initialBoard=useMemo(()=>createMetaBoardModel(),[]);
  const [board,setBoard]=useState(initialBoard);
  const nodeIndex=useMemo(()=>new Map(board.nodes.map((node)=>[node.id,node])),[board.nodes]);
  const [selectedNodeId,setSelectedNodeId]=useState(INITIAL_UNITS.kael);
  const [selectedUnit,setSelectedUnit]=useState<MetaUnitId>("kael");
  const [unitNodes,setUnitNodes]=useState<Record<MetaUnitId,string>>(INITIAL_UNITS);
  const [unitHp,setUnitHp]=useState<Record<MetaUnitId,number>>(INITIAL_HP);
  const [defeated,setDefeated]=useState<Set<MetaUnitId>>(new Set());
  const [mode,setMode]=useState<ActionMode>("build");
  const [runtimeVisuals,setRuntimeVisuals]=useState<MetaRuntimeVisuals>(EMPTY_VISUALS);
  const [actions,setActions]=useState(2);
  const [round,setRound]=useState(1);
  const [notice,setNotice]=useState("Selecione Kael ou Lyra e escolha CONSTRUIR, MOVER ou ATACAR.");
  const [result,setResult]=useState<GameResult>("playing");

  const isFriendly=FRIENDLY_UNITS.includes(selectedUnit);
  const activeUnitNode=unitNodes[selectedUnit];
  const buildTargets=useMemo(()=>new Set(isFriendly?connectedNodeIds(board,activeUnitNode).filter((id)=>canClaimEdge(board,activeUnitNode,id)):[]),[board,activeUnitNode,isFriendly]);
  const moveTargets=useMemo(()=>new Set(isFriendly?connectedNodeIds(board,activeUnitNode).filter((id)=>ownedConnection(board,activeUnitNode,id,PLAYER_FACTION)&&!unitAtNode(unitNodes,defeated,id,[...FRIENDLY_UNITS,...ENEMY_UNITS])):[]),[board,activeUnitNode,isFriendly,unitNodes,defeated]);
  const attackTargets=useMemo(()=>new Set(isFriendly?connectedNodeIds(board,activeUnitNode).filter((id)=>Boolean(unitAtNode(unitNodes,defeated,id,ENEMY_UNITS))):[]),[board,activeUnitNode,isFriendly,unitNodes,defeated]);
  const blueCells=countFactionCells(board,PLAYER_FACTION);

  useEffect(()=>{let active=true;void Promise.all([runtimeAssetUrl("PILLAR_NEUTRAL_01"),runtimeAssetUrl("PILLAR_SELECTED_01")]).then(([pillar,pillarSelected])=>{if(active)setRuntimeVisuals({pillar,pillarSelected});});return()=>{active=false;};},[]);

  function selectFriendly(unitId:MetaUnitId){
    if(defeated.has(unitId))return;
    setSelectedUnit(unitId);setSelectedNodeId(unitNodes[unitId]);
    if(FRIENDLY_UNITS.includes(unitId)){setNotice(`${unitId==="kael"?"Kael":"Lyra"} selecionado. Escolha uma ação.`);}else{setNotice("Alvo inimigo selecionado. Use ATACAR com um herói adjacente.");}
  }

  function handleNodeClick(nodeId:string){
    if(result!=="playing")return;
    if(actions<=0){setNotice("Sem ações. Encerre o turno para continuar.");return;}
    if(!isFriendly){setNotice("Selecione Kael ou Lyra para agir.");return;}

    if(mode==="build"&&buildTargets.has(nodeId)){
      setBoard((current)=>claimEdge(current,activeUnitNode,nodeId,PLAYER_FACTION));
      setActions((value)=>value-1);setSelectedNodeId(nodeId);setNotice("Muralha azul construída. A rota agora pode ser usada para mover.");return;
    }
    if(mode==="move"&&moveTargets.has(nodeId)){
      setUnitNodes((current)=>({...current,[selectedUnit]:nodeId}));setSelectedNodeId(nodeId);setActions((value)=>value-1);setNotice(`${selectedUnit==="kael"?"Kael":"Lyra"} avançou para um ponto livre.`);return;
    }
    if(mode==="attack"&&attackTargets.has(nodeId)){
      const target=unitAtNode(unitNodes,defeated,nodeId,ENEMY_UNITS); if(!target)return;
      const damage=selectedUnit==="kael"?6:5; const nextHp=Math.max(0,unitHp[target]-damage);
      setUnitHp((current)=>({...current,[target]:nextHp}));setActions((value)=>value-1);
      if(nextHp===0){const next=new Set(defeated);next.add(target);setDefeated(next);setNotice(`${target==="brakk"?"Brakk":"Varg"} foi derrotado.`);if(ENEMY_UNITS.every((id)=>next.has(id)))setResult("victory");}
      else setNotice(`${selectedUnit==="kael"?"Kael":"Lyra"} causou ${damage} de dano em ${target==="brakk"?"Brakk":"Varg"}.`);
      return;
    }
    setSelectedNodeId(nodeId);
    setNotice(mode==="build"?"Construa apenas a partir do herói selecionado.":mode==="move"?"Movimento exige muralha azul e destino livre.":"Ataque exige inimigo em ponto adjacente.");
  }

  function enemyTurn(){
    let nextBoard=board; const nextNodes={...unitNodes}; const nextHp={...unitHp}; const nextDefeated=new Set(defeated); let message="A Legião Rubra aguardou.";
    for(const enemy of ENEMY_UNITS){
      if(nextDefeated.has(enemy))continue;
      const from=nextNodes[enemy]; const adjacent=connectedNodeIds(nextBoard,from);
      const victim=FRIENDLY_UNITS.find((id)=>!nextDefeated.has(id)&&adjacent.includes(nextNodes[id]));
      if(victim){const damage=enemy==="brakk"?5:3;nextHp[victim]=Math.max(0,nextHp[victim]-damage);message=`${enemy==="brakk"?"Brakk":"Varg"} atacou ${victim==="kael"?"Kael":"Lyra"} por ${damage}.`;if(nextHp[victim]===0)nextDefeated.add(victim);break;}
      const target=firstEnemyExpansion(nextBoard,from);if(target){nextBoard=claimEdge(nextBoard,from,target,"red");nextNodes[enemy]=target;message=`${enemy==="brakk"?"Brakk":"Varg"} expandiu uma rota rubra.`;break;}
    }
    setBoard(nextBoard);setUnitNodes(nextNodes);setUnitHp(nextHp);setDefeated(nextDefeated);
    if(FRIENDLY_UNITS.every((id)=>nextDefeated.has(id)))setResult("defeat");
    setNotice(`${message} Nova rodada: 2 ações disponíveis.`);
  }

  function endTurn(){if(result!=="playing")return;enemyTurn();setRound((value)=>value+1);setActions(2);setMode("build");const survivor=FRIENDLY_UNITS.find((id)=>!defeated.has(id))??"kael";setSelectedUnit(survivor);setSelectedNodeId(unitNodes[survivor]);}
  function restart(){setBoard(initialBoard);setUnitNodes(INITIAL_UNITS);setUnitHp(INITIAL_HP);setDefeated(new Set());setSelectedUnit("kael");setSelectedNodeId(INITIAL_UNITS.kael);setMode("build");setActions(2);setRound(1);setResult("playing");setNotice("Nova partida iniciada. Selecione uma ação.");}

  const targets=mode==="build"?buildTargets:mode==="move"?moveTargets:attackTargets;
  return <main className="meta-foundation-screen meta-world-board-screen">
    <header className="meta-foundation-topbar"><button type="button" onClick={onBack} aria-label="Voltar ao menu">☰</button><div><small>META 05 · COMBATE E CONQUISTA</small><strong>Convergência de Orun</strong></div><div className="meta-foundation-turn"><small>RODADA {round}</small><strong>{result==="playing"?"SEU TURNO":result==="victory"?"VITÓRIA":"DERROTA"}</strong></div><div className="meta-foundation-resources"><span>◈ 1870</span><span>◆ 660</span><span>✦ {actions}/2 ações</span></div></header>
    <section className="meta-foundation-layout">
      <aside className="meta-foundation-roster"><h2>{playerName}</h2>
        {FRIENDLY_UNITS.map((id)=><button key={id} type="button" disabled={defeated.has(id)} className={`meta-roster-card ${selectedUnit===id?"is-active":""} ${defeated.has(id)?"is-defeated":""}`} onClick={()=>selectFriendly(id)}><b>{id.toUpperCase()}</b><span>{id==="kael"?"Guardião":"Arqueira"}</span><em>{unitHp[id]}/{INITIAL_HP[id]}</em></button>)}
        {ENEMY_UNITS.map((id)=><button key={id} type="button" disabled={defeated.has(id)} className={`meta-roster-card enemy ${selectedUnit===id?"is-active":""} ${defeated.has(id)?"is-defeated":""}`} onClick={()=>selectFriendly(id)}><b>{id.toUpperCase()}</b><span>{id==="brakk"?"Campeão":"Batedor"}</span><em>{unitHp[id]}/{INITIAL_HP[id]}</em></button>)}
        <div className="meta-action-mode" role="group">{(["build","move","attack"] as ActionMode[]).map((item)=><button key={item} type="button" disabled={!isFriendly||result!=="playing"} className={mode===item?"is-active":""} onClick={()=>{setMode(item);setSelectedNodeId(activeUnitNode);}}>{item==="build"?"CONSTRUIR":item==="move"?"MOVER":"ATACAR"}</button>)}</div>
        <div className="meta-faction-legend">{(Object.keys(FACTION_LABEL) as MetaFaction[]).map((faction)=><span key={faction} className={`owner-${faction}`}><i/>{FACTION_LABEL[faction]}</span>)}</div>
        <div className="meta-play-status"><small>{mode.toUpperCase()}</small><b>{actions}/2 ações</b><p>{notice}</p></div>
      </aside>
      <section className="meta-board-shell" aria-label="Mundo estratégico isométrico jogável">
        <MetaPack99World unitNodes={unitNodes} unitHp={unitHp} defeatedUnits={defeated} selectedUnit={selectedUnit} onUnitSelect={selectFriendly}/>
        <svg className="meta-board-svg" viewBox="0 0 1080 620"><g className="meta-territories">{board.cells.filter((cell)=>cell.owner).map((cell)=><polygon key={cell.id} className={`owner-${cell.owner}`} points={metaCellPolygon(cell)}/>)}</g></svg>
        <div className="meta-physical-links" aria-hidden="true">{board.edges.map((edge)=><span key={edge.id} className={`meta-physical-link ${edge.owner?`owner-${edge.owner} is-wall`:"owner-neutral is-road"}`} style={edgeGeometry(edge,nodeIndex)}><i/><b/><em/></span>)}</div>
        <div className="meta-node-layer">{board.nodes.map((node)=>{const point=metaIsoPoint(node.col,node.row);const selected=selectedNodeId===node.id;const actionable=actions>0&&targets.has(node.id);const runtimePillar=selected?runtimeVisuals.pillarSelected??runtimeVisuals.pillar:runtimeVisuals.pillar;return <button key={node.id} type="button" className={`meta-node kind-${node.kind} ${selected?"is-selected":""} ${actionable?"is-reachable":""} ${mode==="move"&&actionable?"is-move-target":""} ${mode==="attack"&&actionable?"is-attack-target":""} ${runtimePillar?"has-pack99-pillar":"is-fallback"}`} style={{left:`${point.x/10.8}%`,top:`${point.y/6.2}%`}} onClick={()=>handleNodeClick(node.id)}><span className="meta-node-pillar">{runtimePillar?<img src={runtimePillar} alt=""/>:null}</span>{selected?<strong>ORIGEM</strong>:actionable?<strong>{mode==="build"?"CONSTRUIR":mode==="move"?"MOVER":"ATACAR"}</strong>:null}</button>;})}</div>
        {result!=="playing"?<div className={`meta-result-overlay is-${result}`}><small>CONFRONTO ENCERRADO</small><h2>{result==="victory"?"Vitória de Orun":"A Convergência caiu"}</h2><p>{result==="victory"?"Varg e Brakk foram derrotados.":"Kael e Lyra foram derrotados."}</p><button type="button" onClick={restart}>JOGAR NOVAMENTE</button></div>:null}
      </section>
      <aside className="meta-foundation-objectives"><small>OBJETIVO PRINCIPAL</small><h3>Derrote a Legião Rubra</h3><p>Construa rotas, aproxime os heróis e elimine Varg e Brakk.</p><div className="meta-objective-progress"><span className={blueCells>0?"is-complete":""}/><span className={defeated.has("varg")?"is-complete":""}/><span className={defeated.has("brakk")?"is-complete":""}/></div><small>COMO JOGAR</small><ul><li>CONSTRUIR cria uma rota azul adjacente</li><li>MOVER exige rota azul e destino vazio</li><li>ATACAR exige inimigo adjacente</li><li>Brakk e Varg agem no fim do turno</li></ul><button type="button" disabled={result!=="playing"} onClick={endTurn}>ENCERRAR TURNO</button></aside>
    </section>
  </main>;
}
