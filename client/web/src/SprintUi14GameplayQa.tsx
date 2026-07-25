import { FantasyUnitSprite } from "./FantasyUnitSprite";
import { GoDotsBoard } from "./GoDotsBoard";
import { INITIAL_LIVING_UNITS, TCG_CARDS, createLivingTiles, type LivingUnit } from "./living-board-data";

const tiles = createLivingTiles();
const units = INITIAL_LIVING_UNITS.map((unit) => ({ ...unit, deck: [...unit.deck] }));
const kael = units.find((unit) => unit.id === "kael") as LivingUnit;
const brakk = units.find((unit) => unit.id === "raider-mill") as LivingUnit;

function HiddenGameplayData() {
  return (
    <>
      <header className="living-topbar">
        <button className="living-back-button">← Menu</button>
        <div className="mission-identity"><small>SPRINT UI 14 · VISUAL QA</small><strong>A Ponte das Cinzas</strong></div>
        <div className="resource-strip"><span>🪵 3</span><span>◈ 2</span><span>🌾 1</span><span>⬡ 2</span></div>
      </header>
      <aside className="living-mission-panel glass">
        <div className="phase-banner"><small>RODADA 3</small><strong>SEU TURNO</strong></div>
        <div className="command-points"><span>PONTOS DE COMANDO</span><div><i className="active">✦</i><i className="active">✦</i><i>✦</i></div><small>1 ação usada · 2 restantes</small></div>
        <div className="current-objective-card"><small>PASSO 3 · VENÇA O CONFRONTO</small><strong>Vencer um confronto de fronteira</strong><p>Invada um nó inimigo e confirme uma combinação de cartas.</p></div>
        <div className="objective-list compact-objectives">
          <div className="completed"><span>✓</span><p>Libertar Lyra no Observatório</p></div>
          <div className="completed"><span>✓</span><p>Atravessar a Ponte das Cinzas</p></div>
          <div className="current"><span>3</span><p>Vencer um confronto de fronteira</p></div>
          <div className="locked"><span>4</span><p>Reivindicar o Moinho do Norte</p></div>
        </div>
        <div className="living-notice"><b>ORÁCULO</b><p>Kael avançou para o nó contestado. Brakk prepara o Machado das Cinzas.</p></div>
        <button className="end-turn-button">Encerrar turno</button>
      </aside>
      <aside className="unit-command-panel glass go-unit-panel">
        <div className="unit-roster">
          <button className="selected"><div><strong>Kael</strong><small>Guardião Rúnico</small><span>HP 14/18</span></div></button>
          <button><div><strong>Lyra</strong><small>Arqueira do Éter</small><span>HP 12/14</span></div></button>
        </div>
        <div className="event-timeline"><h3>Crônica do turno</h3><p>Kael atravessou a ponte.</p><p>Lyra abriu uma trilha prismática.</p><p>Brakk ocupou o Moinho do Norte.</p></div>
      </aside>
    </>
  );
}

function GameplayScene() {
  return (
    <main className="living-demo go-dots-demo ui14-qa-gameplay">
      <HiddenGameplayData />
      <section className="living-layout go-dots-layout">
        <aside className="living-mission-panel glass" />
        <GoDotsBoard
          tiles={tiles}
          units={units}
          selectedUnitId="kael"
          validNodeIds={new Set(["2,2", "3,3"])}
          recommendedNodeId="3,3"
          objectiveTargetId="5,1"
          influenceEdges={[]}
          claimedCells={[]}
          building={null}
          onNodeClick={() => undefined}
        />
        <aside className="unit-command-panel glass" />
      </section>
    </main>
  );
}

function QaCard({ id, selected = false }: { id: string; selected?: boolean }) {
  const card = TCG_CARDS[id];
  return (
    <button className={`living-card rarity-${card.rarity} role-${card.unitRole} ${selected ? "selected" : ""}`}>
      <span className="living-card-cost">{card.cost}</span>
      <div className="living-card-header"><strong>{card.name}</strong><small>{card.rarity} · {card.element}</small></div>
      <div className="living-card-art"><span className="cabal-ring ring-one" /><b>{card.art}</b></div>
      <div className="living-card-keywords">{card.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
      <p>{card.description}</p><blockquote>{card.flavor}</blockquote>
      <div className="living-card-stats"><span>⚔ <b>{card.attack}</b></span><span>◆ <b>{card.defense}</b></span><span>➤ <b>{card.speed}</b></span></div>
    </button>
  );
}

function CombatScene({ resolved }: { resolved: boolean }) {
  return (
    <main className="living-demo go-dots-demo ui14-qa-combat">
      <HiddenGameplayData />
      <section className="living-layout go-dots-layout"><div /></section>
      <section className="living-battle-overlay">
        <div className="living-battle-stage">
          <header><div><small>CONFLITO DIRETO · NÓ CONTESTADO</small><h2>Kael × Brakk</h2></div><div className="battle-energy">ENERGIA <b>3/3</b></div></header>
          <div className="battle-instruction-strip"><span>1 · Leia a intenção</span><span>2 · Escolha cartas</span><span>3 · Confirme</span></div>
          <div className="fighters">
            <div className="fighter player-fighter"><FantasyUnitSprite unit={{ ...kael, hp: resolved ? 11 : 14 }} /><strong>{kael.title}</strong><span>HP {resolved ? 11 : 14}/{kael.maxHp}</span></div>
            <div className="battle-sigil"><span>VS</span><i>Rodada 2</i></div>
            <div className="fighter enemy-fighter"><FantasyUnitSprite unit={{ ...brakk, hp: resolved ? 5 : 12 }} /><strong>{brakk.title}</strong><span>HP {resolved ? 5 : 12}/{brakk.maxHp}</span></div>
          </div>
          <div className="enemy-intent revealed"><span>INTENÇÃO INIMIGA</span><div className="intent-card-mini"><b>Machado das Cinzas</b><small>⚔ 4 · ◆ 1 · ➤ 2</small></div></div>
          {!resolved ? <div className="combat-preview"><span>Você causará aproximadamente <b>7</b></span><span>Você receberá aproximadamente <b>3</b></span></div> : null}
          {resolved ? (
            <div className="battle-resolution-panel"><small>RESULTADO DA RODADA</small><div><span className="damage-dealt">-7 HP inimigo</span><span className="damage-taken">-3 HP aliado</span></div><p>Kael executa Golpe Rúnico.</p><p>Brakk responde com Machado das Cinzas.</p><button className="living-primary">Preparar próxima rodada</button></div>
          ) : (
            <><div className="tcg-hand"><QaCard id="kael-golpe-runico" selected /><QaCard id="kael-guardiao-celeste" selected /><QaCard id="kael-contra-selo" /><QaCard id="kael-muralha-astral" /></div><div className="battle-actions"><p>Combine ataque, defesa e velocidade dentro de 3 de energia.</p><button className="living-primary">Confirmar combinação</button></div></>
          )}
        </div>
      </section>
    </main>
  );
}

export function SprintUi14GameplayQa({ scene }: { scene: string }) {
  if (scene === "ui14-combat-impact") return <CombatScene resolved />;
  if (scene === "ui14-combat-selection") return <CombatScene resolved={false} />;
  return <GameplayScene />;
}
