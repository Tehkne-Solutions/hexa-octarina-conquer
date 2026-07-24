import { FantasyBuildingSprite } from "./FantasyBuildingSprite";
import { FantasyUnitSprite } from "./FantasyUnitSprite";
import { INITIAL_LIVING_UNITS, type LivingUnit } from "./living-board-data";

function unit(id: string, patch: Partial<LivingUnit> = {}): LivingUnit {
  const source = INITIAL_LIVING_UNITS.find((item) => item.id === id);
  if (!source) throw new Error(`QA unit not found: ${id}`);
  return { ...source, deck: [...source.deck], ...patch };
}

const kael = unit("kael");
const lyra = unit("lyra", { active: true, hp: 5 });
const varg = unit("raider-bridge", { hp: 0, defeated: true });
const brakk = unit("raider-mill");

function QaHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="ui08-qa-header">
      <div><small>SPRINT UI 08 · VISUAL QA</small><h1>{title}</h1><p>{subtitle}</p></div>
      <span>Tehkné Solutions</span>
    </header>
  );
}

function AssetScene() {
  return (
    <main className="ui08-qa-scene asset-scene">
      <QaHeader title="Atlas final de Orun" subtitle="Personagens e construções vetoriais em seus estados de produção." />
      <section className="ui08-qa-unit-grid">
        <article><FantasyUnitSprite unit={kael} /><small>HOC-CHR-KAEL-001</small><strong>Kael · neutro</strong></article>
        <article><FantasyUnitSprite unit={kael} selected /><small>HOC-CHR-KAEL-001</small><strong>Kael · selecionado</strong></article>
        <article><FantasyUnitSprite unit={lyra} /><small>HOC-CHR-LYRA-001</small><strong>Lyra · ferida</strong></article>
        <article><FantasyUnitSprite unit={varg} /><small>HOC-CHR-RAIDER-001</small><strong>Varg · derrotado</strong></article>
        <article><FantasyUnitSprite unit={brakk} /><small>HOC-CHR-BRAKK-001</small><strong>Brakk · elite</strong></article>
      </section>
      <section className="ui08-qa-building-grid">
        <article><FantasyBuildingSprite type="mill" /><small>HOC-BLD-MILL-001</small><strong>Moinho do Norte</strong></article>
        <article><FantasyBuildingSprite type="farm" state="built" /><small>HOC-BLD-FARM-001</small><strong>Fazenda Arcana</strong></article>
        <article><FantasyBuildingSprite type="tower" state="built" /><small>HOC-BLD-TOWER-001</small><strong>Torre Rúnica</strong></article>
      </section>
    </main>
  );
}

function CombatScene() {
  return (
    <main className="ui08-qa-scene combat-scene">
      <QaHeader title="Impacto de combate" subtitle="Dano, intenção e estados continuam legíveis em notebook e celular." />
      <section className="ui08-qa-combat-stage">
        <header><div><small>CONFLITO DIRETO · NÓ CONTESTADO</small><h2>Kael × Brakk</h2></div><div className="battle-energy">ENERGIA <b>3/3</b></div></header>
        <div className="fighters">
          <div className="fighter player-fighter"><FantasyUnitSprite unit={{ ...kael, hp: 7 }} /><strong>Guardião Rúnico</strong><span>HP 7/18</span></div>
          <div className="battle-sigil"><span>VS</span><i>Rodada 3</i></div>
          <div className="fighter enemy-fighter"><FantasyUnitSprite unit={{ ...brakk, hp: 5 }} /><strong>Capitão do Moinho</strong><span>HP 5/16</span></div>
        </div>
        <div className="enemy-intent revealed"><span>INTENÇÃO INIMIGA</span><div className="intent-card-mini"><b>Machado das Cinzas</b><small>⚔ 4 · ◆ 1 · ➤ 2</small></div></div>
        <div className="battle-resolution-panel"><small>RESULTADO DA RODADA</small><div><span className="damage-dealt">-7 HP inimigo</span><span className="damage-taken">-3 HP aliado</span></div><p>Kael rompeu a guarda de Brakk.</p></div>
        <div className="combat-impact-layer impact-heavy qa-impact-static" aria-hidden="true">
          <span className="impact-flash" /><span className="impact-slash slash-one" /><span className="impact-slash slash-two" /><b className="impact-number dealt">-7</b><b className="impact-number taken">-3</b>
        </div>
        <div className="combat-feedback-toggles qa-feedback-static"><button type="button" aria-pressed="true">Som ativo</button><button type="button" aria-pressed="true">Vibração ativa</button></div>
      </section>
    </main>
  );
}

function OutcomeScene() {
  return (
    <main className="ui08-qa-scene outcome-qa-scene">
      <section className="post-battle-cinematic result-victory">
        <div className="cinematic-atmosphere" aria-hidden="true"><i /><i /><i /><b /></div>
        <header><p>MISSÃO CONCLUÍDA</p><h1>Orun voltou a respirar</h1><span>A Ponte das Cinzas foi retomada</span></header>
        <div className="cinematic-score-grid"><article><small>Rodadas</small><strong>5</strong></article><article><small>Territórios</small><strong>2</strong></article><article><small>Resultado</small><strong>Vitória</strong></article></div>
        <div className="cinematic-content-grid">
          <article className="tactical-highlights"><small>DESTAQUES TÁTICOS</small><ul><li>Kael protegeu a travessia central.</li><li>Lyra abriu a rota do observatório.</li><li>Brakk foi derrotado no nó do moinho.</li></ul></article>
          <article className="cinematic-rewards"><small>RECOMPENSAS</small><div className="cinematic-reward"><span className="ui08-qa-bow">➶</span><span><strong>Arco Prismático</strong><small>Nova arma desbloqueada</small></span></div><div className="cinematic-reward"><FantasyBuildingSprite type="tower" compact state="built" /><span><strong>Torre Rúnica</strong><small>Construção adicionada à coleção</small></span></div></article>
        </div>
        <footer><button type="button" className="living-secondary">Avançar no mapa</button><button type="button" className="living-primary">Repetir missão</button></footer>
      </section>
    </main>
  );
}

export function SprintUi08VisualQa({ scene }: { scene: string }) {
  if (scene === "ui08-combat") return <CombatScene />;
  if (scene === "ui08-outcome") return <OutcomeScene />;
  return <AssetScene />;
}
