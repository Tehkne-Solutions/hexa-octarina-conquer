export function renderAdminPanel() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hexa Octarina — Operações</title>
  <style>
    :root{color-scheme:dark;--bg:#070b14;--panel:#101827;--line:#24324a;--text:#eef4ff;--muted:#93a4bd;--accent:#6ee7d8;--danger:#fb7185}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#13213a 0,#070b14 48%);color:var(--text);font:14px/1.45 system-ui,sans-serif}
    header{padding:28px clamp(18px,4vw,56px);border-bottom:1px solid var(--line);display:flex;gap:18px;align-items:end;justify-content:space-between;flex-wrap:wrap}
    h1{margin:0;font-size:clamp(24px,4vw,42px)}h2{font-size:16px;margin:0 0 12px}.sig{color:var(--accent);font-weight:700}.muted{color:var(--muted)}
    main{padding:24px clamp(18px,4vw,56px) 56px}.toolbar{display:flex;gap:8px;flex-wrap:wrap}.toolbar input{min-width:280px}
    input,button,select{border:1px solid var(--line);background:#0b1220;color:var(--text);padding:10px 12px;border-radius:10px}button{cursor:pointer}button:hover{border-color:var(--accent)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:20px 0}.card,.section{background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 18px 50px #0005}.value{font-size:28px;font-weight:800;margin-top:6px}
    .section{margin-top:14px;overflow:auto}table{width:100%;border-collapse:collapse;min-width:720px}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}.ok{color:var(--accent)}.bad{color:var(--danger)}code{font-family:ui-monospace,monospace;color:#c4b5fd}
    footer{padding:18px clamp(18px,4vw,56px);color:var(--muted);border-top:1px solid var(--line)}
  </style>
</head>
<body>
<header>
  <div><div class="sig">Tehkné Solutions</div><h1>Hexa Octarina Operations</h1><div class="muted">Temporadas, penalidades, reconexões e replays autoritativos.</div></div>
  <div class="toolbar"><input id="token" type="password" placeholder="HEXA_ADMIN_TOKEN"><button id="save">Conectar</button><button id="refresh">Atualizar</button></div>
</header>
<main>
  <div id="status" class="muted">Informe o token administrativo.</div>
  <div class="grid">
    <div class="card"><div class="muted">Instâncias ativas</div><div id="instances" class="value">—</div></div>
    <div class="card"><div class="muted">Jogadores online</div><div id="players" class="value">—</div></div>
    <div class="card"><div class="muted">Reconexões pendentes</div><div id="leases" class="value">—</div></div>
    <div class="card"><div class="muted">Replays arquivados</div><div id="replays" class="value">—</div></div>
  </div>
  <section class="section"><h2>Reconexões pendentes</h2><table><thead><tr><th>Sala</th><th>Jogador</th><th>Conta</th><th>Prazo</th><th>Origem</th></tr></thead><tbody id="leaseRows"></tbody></table></section>
  <section class="section"><h2>Replays recentes</h2><table><thead><tr><th>Sala</th><th>Status</th><th>Revisão</th><th>Jogadores</th><th>Resultado</th><th>Atualizado</th></tr></thead><tbody id="replayRows"></tbody></table></section>
  <section class="section"><h2>Penalidades</h2><table><thead><tr><th>Conta</th><th>Tipo</th><th>Pontos</th><th>Motivo</th><th>Expira</th></tr></thead><tbody id="penaltyRows"></tbody></table></section>
  <section class="section"><h2>Temporadas</h2><table><thead><tr><th>ID</th><th>Nome</th><th>Status</th><th>Início</th><th>Fim</th></tr></thead><tbody id="seasonRows"></tbody></table></section>
</main>
<footer>Operação e tecnologia por <strong>Tehkné Solutions</strong>.</footer>
<script>
const $=id=>document.getElementById(id);const fmt=v=>v?new Date(Number(v)).toLocaleString('pt-BR'):'—';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('token').value=sessionStorage.getItem('hexaAdminToken')||'';
$('save').onclick=()=>{sessionStorage.setItem('hexaAdminToken',$('token').value);load()};$('refresh').onclick=load;
async function api(path){const token=$('token').value||sessionStorage.getItem('hexaAdminToken')||'';const r=await fetch(path,{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||('HTTP '+r.status));return r.json()}
function rows(id,items,render){$(id).innerHTML=items.length?items.map(render).join(''):'<tr><td colspan="8" class="muted">Nenhum registro.</td></tr>'}
async function load(){try{$('status').textContent='Atualizando…';const data=await api('/admin/overview');$('instances').textContent=data.health.activeInstances??0;$('players').textContent=data.health.activePlayers??0;$('leases').textContent=data.disconnects.length;$('replays').textContent=data.replays.length;
rows('leaseRows',data.disconnects,x=>'<tr><td><code>'+esc(x.roomId)+'</code></td><td><code>'+esc(x.playerId)+'</code></td><td>'+esc(x.accountId||'visitante')+'</td><td>'+fmt(x.deadlineAt)+'</td><td>'+esc(x.sourceInstanceId||'—')+'</td></tr>');
rows('replayRows',data.replays,x=>'<tr><td><code>'+esc(x.roomId)+'</code></td><td>'+esc(x.status)+'</td><td>'+esc(x.latestRevision)+'</td><td>'+esc((x.players||[]).map(p=>p.name).join(', '))+'</td><td>'+esc(x.result?x.result.reason:'—')+'</td><td>'+fmt(x.updatedAt)+'</td></tr>');
rows('penaltyRows',data.penalties,x=>'<tr><td><code>'+esc(x.accountId)+'</code></td><td>'+esc(x.kind)+'</td><td>'+esc(x.points)+'</td><td>'+esc(x.reason)+'</td><td>'+fmt(x.expiresAt)+'</td></tr>');
rows('seasonRows',data.seasons,x=>'<tr><td><code>'+esc(x.id)+'</code></td><td>'+esc(x.name)+'</td><td class="'+(x.status==='active'?'ok':'')+'">'+esc(x.status)+'</td><td>'+fmt(x.startsAt)+'</td><td>'+fmt(x.endsAt)+'</td></tr>');$('status').innerHTML='<span class="ok">Conectado</span> • '+new Date().toLocaleTimeString('pt-BR')}catch(e){$('status').innerHTML='<span class="bad">Falha:</span> '+esc(e.message)}}
if($('token').value)load();
</script>
</body></html>`;
}
