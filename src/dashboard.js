'use strict';

const { THEME_CSS } = require('./pages');

// ATENCAO: a pagina e um template literal. Nao usar crase nem dollar-chaves no codigo do navegador.
const DASHBOARD_PAGE = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><title>AJEITA - Painel</title>
<style>
${THEME_CSS}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(900px 400px at 85% -10%,color-mix(in srgb,var(--brand) 14%,transparent),transparent),var(--bg);color:var(--text);font:15px/1.45 Inter,system-ui,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1120px;margin:0 auto;padding:22px 16px 48px;display:grid;gap:18px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:20px;background:linear-gradient(135deg,var(--brand),var(--brand2));box-shadow:0 6px 16px -6px var(--brand)}
h1{margin:0;font-size:21px;letter-spacing:-.01em;line-height:1.1}.brand small{color:var(--muted);font-size:12.5px}
h2{margin:0 0 14px;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:700}
.right-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pill{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);background:var(--card);border:1px solid var(--line);padding:6px 12px;border-radius:99px}
.pill i{width:7px;height:7px;border-radius:50%;background:var(--ok);animation:pulse 2s infinite}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:var(--shadow)}
.hero{display:grid;gap:18px}
.status{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.dot{flex:none;width:18px;height:18px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 6px color-mix(in srgb,var(--warn) 22%,transparent);animation:pulse 1.8s infinite}
.dot.ok{background:var(--ok);box-shadow:0 0 0 6px color-mix(in srgb,var(--ok) 22%,transparent)}
.dot.bad{background:var(--bad);box-shadow:0 0 0 6px color-mix(in srgb,var(--bad) 22%,transparent)}
@keyframes pulse{50%{opacity:.55}}
.big{font-size:24px;font-weight:700;letter-spacing:-.01em}.muted{color:var(--muted);font-size:13px}
.grow{flex:1}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stat{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:14px 16px;transition:transform .15s,border-color .15s}
.stat:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--brand) 45%,var(--line))}
.stat span{display:block;font-size:12px;color:var(--muted);font-weight:500}.stat b{display:block;font-size:26px;font-weight:700;margin-top:2px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
#qr{display:none;text-align:center;padding:18px;border:1px dashed var(--line);border-radius:14px;background:var(--bg)}
#qr img{width:260px;max-width:100%;border-radius:14px;background:#fff;padding:10px;box-shadow:var(--shadow)}
.sum{display:grid;gap:16px}
.bars{display:grid;gap:8px}.bar-row{display:grid;grid-template-columns:90px 1fr 34px;gap:10px;align-items:center;font-size:13px}
.track{height:10px;background:var(--bg);border-radius:99px;overflow:hidden;border:1px solid var(--line)}.fill{height:100%;background:linear-gradient(90deg,var(--brand),var(--brand2));border-radius:99px;transition:width .4s}
.cols{display:grid;grid-template-columns:1fr;gap:18px;align-items:start}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.chip{padding:5px 12px;border-radius:99px;font-size:12.5px;font-weight:600;background:var(--bg);border:1px solid var(--line);color:var(--muted);cursor:pointer}
.chip.on{background:var(--brand);border-color:var(--brand);color:#fff}
.day{border:1px solid var(--line);border-radius:14px;margin-bottom:10px;background:var(--bg)}
.day summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:12px 14px}
.day summary::-webkit-details-marker{display:none}.day summary::before{content:'\\25B8';margin-right:8px;color:var(--muted);transition:transform .15s}
.day[open] summary::before{transform:rotate(90deg)}.day summary b{flex:1;text-transform:capitalize}
.cnt{font-size:12px;color:var(--muted)}.dbody{padding:4px 14px 10px;border-top:1px solid var(--line);max-height:480px;overflow:auto}
.dbody .req:first-child{padding-top:12px}
.req{display:grid;grid-template-columns:40px 1fr auto;gap:2px 12px;padding:12px 0;border-top:1px solid var(--line);align-items:center}
.req:first-child{border-top:0;padding-top:0}
.av{grid-row:1/3;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:14px;color:#fff;background:linear-gradient(135deg,#4ade80,var(--brand2))}
.req .who{font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.req .who em{font-style:normal;font-weight:500;color:var(--muted);font-size:12px;margin-left:6px}
.req .typed{grid-column:2/4;color:var(--muted);font-size:13px;word-break:break-word}
.req .detail{grid-column:2/4;font-size:12.5px;color:var(--muted);word-break:break-word;background:var(--card);border-radius:8px;padding:6px 10px;margin-top:6px}
.req .acts{grid-column:2/4;display:flex;gap:6px;margin-top:6px}
.req .right{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.time{color:var(--muted);font-size:12px;white-space:nowrap}
.badge{--c:var(--muted);font-size:11.5px;font-weight:650;padding:3px 11px;border-radius:99px;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);white-space:nowrap}
.b-concluido{--c:var(--ok)}.b-erro{--c:var(--bad)}.b-ignorado{--c:var(--warn)}.b-processando,.b-na-fila{--c:var(--info)}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
select,input,button,.btn{background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;outline:none;transition:border-color .15s;text-decoration:none}
.q{flex:1;min-width:140px}input:focus,select:focus{border-color:var(--brand)}
button,.btn{cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:6px}button:hover,.btn:hover{border-color:var(--brand);color:var(--brand)}
button:disabled{opacity:.5;cursor:not-allowed}.btn.danger:hover{border-color:var(--bad);color:var(--bad)}
.mini{padding:3px 10px;font-size:12px;border-radius:8px;background:var(--card)}
label.muted{display:flex;align-items:center;gap:6px;cursor:pointer}input[type=checkbox]{accent-color:var(--brand);width:15px;height:15px;padding:0}
.term{border-radius:14px;overflow:hidden;background:var(--term);border:1px solid #1d2b23}
.winbar{display:flex;gap:6px;padding:10px 14px;background:rgba(255,255,255,.04)}.winbar i{width:10px;height:10px;border-radius:50%;background:#ff5f57}.winbar i:nth-child(2){background:#febc2e}.winbar i:nth-child(3){background:#28c840}
#log{color:var(--termtext);padding:12px 14px;font:12.5px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;height:420px;overflow:auto;white-space:pre-wrap;word-break:break-word}
#log::-webkit-scrollbar{width:8px}#log::-webkit-scrollbar-thumb{background:#2a3d32;border-radius:8px}
.t{color:#5f7d6c}.l.warn{color:#f2c14e}.l.error{color:#ff8a8a}.empty{color:var(--muted);padding:18px 0;text-align:center}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:10px 18px;border-radius:99px;font-size:13px;font-weight:600;box-shadow:var(--shadow);z-index:9}
@media(min-width:900px){.cols{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.big{font-size:20px}.stat b{font-size:22px}}
</style></head><body><main>
<div class="top"><div class="brand"><div class="logo">A</div><div><h1>AJEITA</h1><small>Painel do bot</small></div></div>
<div class="right-top"><span class="pill"><i></i><span id="upd">conectando...</span></span>
<button id="theme" title="Alternar tema claro/escuro">Tema</button><a class="btn" href="/export.csv" title="Baixar historico de pedidos">Exportar CSV</a><a class="btn" href="/logout">Sair</a></div></div>

<section class="card hero"><h2>WhatsApp</h2>
<div class="status"><span class="dot" id="dot"></span><div class="grow"><div class="big" id="phase">...</div><div class="muted" id="sub"></div></div>
<div class="actions"><button id="a-restart" class="danger btn">Reiniciar bot</button><button id="a-clear" class="btn">Limpar fila</button><button id="a-groups" class="btn">Grupos</button></div></div>
<div id="qr"><p class="muted">Abra no celular: WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho</p><img id="qrimg" alt="QR Code"></div>
<div class="stats">
<div class="stat"><span>Fila</span><b id="s-queue">-</b></div>
<div class="stat"><span>Baixando agora</span><b id="s-work">-</b></div>
<div class="stat"><span>Mensagens vistas</span><b id="s-msgs">-</b></div>
<div class="stat"><span>Comandos</span><b id="s-cmds">-</b></div>
<div class="stat"><span>Ativo ha</span><b id="s-up">-</b></div>
<div class="stat"><span>Grupos</span><b id="s-groups">-</b></div>
</div></section>

<section class="card sum"><h2>Resumo de hoje</h2>
<div class="stats">
<div class="stat"><span>Pedidos</span><b id="d-total">-</b></div>
<div class="stat"><span>Taxa de sucesso</span><b id="d-rate">-</b></div>
<div class="stat"><span>Tempo medio</span><b id="d-avg">-</b></div>
<div class="stat"><span>Erros</span><b id="d-err">-</b></div></div>
<div class="bars" id="d-plat"></div></section>

<div class="cols">
<section class="card"><h2>Pedidos recentes</h2>
<div class="tools"><input class="q" id="rq" placeholder="Buscar pessoa, link ou erro"></div>
<div class="chips" id="chips"></div>
<div id="reqs"><div class="empty">Nenhum pedido ainda.</div></div></section>

<section class="card"><h2>Logs</h2>
<div class="tools"><select id="lvl"><option value="info">Tudo</option><option value="warn">Avisos e erros</option><option value="error">So erros</option></select>
<input class="q" id="q" placeholder="Buscar no log"><label class="muted"><input type="checkbox" id="auto" checked> acompanhar</label><button id="clr">Limpar</button></div>
<div class="term"><div class="winbar"><i></i><i></i><i></i></div><div id="log"></div></div></section>
</div>
</main><script>
const $=id=>document.getElementById(id);let last=0;
try{const th=localStorage.getItem('ajeita-theme');if(th)document.documentElement.dataset.theme=th}catch{}
$('theme').onclick=()=>{const cur=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
const next=cur==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('ajeita-theme',next)}catch{}};
const PHASES={ready:['Conectado','ok','Pronto para receber pedidos.'],pairing:['Aguardando QR','','Leia o QR code abaixo com o celular.'],authenticated:['Autenticando','','Sessao reconhecida, finalizando conexao.'],starting:['Iniciando','','Abrindo o WhatsApp Web.'],disconnected:['Desconectado','bad','O bot sera reiniciado automaticamente.'],auth_failure:['Falha de login','bad','Pareie novamente pelo QR.'],browser_error:['Navegador com erro','bad','Reiniciando para recuperar.'],startup_error:['Erro ao iniciar','bad','Veja os logs abaixo.']};
const BADGE={concluido:'Concluido','na fila':'Na fila',processando:'Processando',erro:'Erro',ignorado:'Ignorado'};
const hm=iso=>new Date(iso).toLocaleTimeString('pt-BR');
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function toast(msg){const t=el('div','toast',msg);document.body.append(t);setTimeout(()=>t.remove(),2600)}
function copy(text,label){
const done=()=>toast(label+' copiado');
const fallback=()=>{const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();
try{document.execCommand('copy');done()}catch{toast('Nao foi possivel copiar')}t.remove()};
if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(done,fallback);else fallback()}
async function act(name,ask){if(ask&&!confirm(ask))return;
try{const r=await fetch('/action',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'ajeita'},body:JSON.stringify({action:name})});
if(r.status===401){location.href='/login';return}
const d=await r.json();toast(d.ok?(d.message||'Feito'):(d.error||'Falhou'))}catch{toast('Sem conexao com o bot')}}
$('a-restart').onclick=()=>act('restart','Reiniciar o bot agora? Pedidos em andamento serao interrompidos.');
$('a-clear').onclick=()=>act('clear-queue','Limpar a fila de downloads?');
$('a-groups').onclick=()=>act('toggle-groups');

const dayKey=iso=>{const d=new Date(iso);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
function dayLabel(iso){const d=new Date(iso),y=new Date(Date.now()-864e5);
if(dayKey(iso)===dayKey(new Date()))return 'Hoje';if(dayKey(iso)===dayKey(y))return 'Ontem';
return d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}
function platform(host){const h=String(host||'').toLowerCase();
if(h.includes('tiktok'))return 'TikTok';if(h.includes('youtu'))return 'YouTube';
if(h.includes('facebook')||h.includes('fb.watch')||h.includes('fb.com'))return 'Facebook';
if(h.includes('instagram'))return 'Instagram';if(h.includes('twitter')||h==='x.com'||h.endsWith('.x.com'))return 'X';
return h.replace('www.','')||'Outros'}
const GROUP=s=>s==='concluido'?'concluido':s==='erro'?'erro':s==='ignorado'?'ignorado':'andamento';
const CHIPS=[['todos','Todos'],['concluido','Concluidos'],['erro','Erros'],['ignorado','Ignorados'],['andamento','Em andamento']];
let reqs=[],statusFilter='todos';
function renderChips(){const box=$('chips');box.textContent='';
for(const [k,label] of CHIPS){const n=k==='todos'?reqs.length:reqs.filter(r=>GROUP(r.status)===k).length;
const c=el('button','chip'+(statusFilter===k?' on':''),label+' '+n);c.onclick=()=>{statusFilter=k;renderReqs()};box.append(c)}}
function renderSummary(){const today=reqs.filter(r=>dayKey(r.time)===dayKey(new Date()));
const done=today.filter(r=>r.status==='concluido'),err=today.filter(r=>r.status==='erro');
const fin=done.length+err.length;
$('d-total').textContent=today.length;$('d-err').textContent=err.length;
$('d-rate').textContent=fin?Math.round(done.length/fin*100)+'%':'-';
const secs=done.filter(r=>r.seconds!=null).map(r=>Number(r.seconds));
$('d-avg').textContent=secs.length?Math.round(secs.reduce((a,b)=>a+b,0)/secs.length)+'s':'-';
const counts=new Map();for(const r of today)counts.set(platform(r.host),(counts.get(platform(r.host))||0)+1);
const box=$('d-plat');box.textContent='';const max=Math.max(1,...counts.values());
for(const [name,n] of [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6)){
const row=el('div','bar-row');const track=el('div','track');const fill=el('div','fill');fill.style.width=(n/max*100)+'%';track.append(fill);
row.append(el('span','',name),track,el('b','',String(n)));box.append(row)}}
const openDays=new Map();
function renderRows(box,list){
for(const r of list){const row=el('div','req');
row.append(el('div','av',(String(r.who||'?').trim()[0]||'?').toUpperCase()));
const who=el('div','who',r.who);if(r.chatKind==='grupo')who.append(el('em','','grupo'));row.append(who);
const right=el('div','right');right.append(el('span','badge b-'+r.status.replace(' ','-'),BADGE[r.status]||r.status),el('span','time',hm(r.time)+(r.seconds!=null?' | '+r.seconds+'s':'')));row.append(right);
row.append(el('div','typed','Escreveu: "'+r.typed+'"'+(r.host?'  -  '+r.host:'')));
if(r.detail)row.append(el('div','detail',r.detail));
if(r.link||r.detail){const acts=el('div','acts');
if(r.link){const b=el('button','mini','Copiar link');b.onclick=()=>copy(r.link,'Link');acts.append(b)}
if(r.detail){const b=el('button','mini','Copiar erro');b.onclick=()=>copy(r.detail,'Erro');acts.append(b)}
row.append(acts)}
box.append(row)}}
function renderReqs(){renderChips();renderSummary();
const box=$('reqs');box.textContent='';const query=$('rq').value.trim().toLowerCase();
const list=reqs.filter(r=>(statusFilter==='todos'||GROUP(r.status)===statusFilter)
&&(!query||[r.who,r.number,r.link,r.host,r.typed,r.detail].join(' ').toLowerCase().includes(query)));
if(!list.length){box.append(el('div','empty',reqs.length?'Nada encontrado com esse filtro.':'Nenhum pedido ainda.'));return}
const filtering=statusFilter!=='todos'||query;
const groups=new Map();for(const r of list){const k=dayKey(r.time);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
let first=true;
for(const [k,items] of groups){const det=el('details','day');
det.open=filtering||(openDays.has(k)?openDays.get(k):first);first=false;
det.ontoggle=()=>{if(!filtering)openDays.set(k,det.open)};
const sum=el('summary','');sum.append(el('b','',dayLabel(items[0].time)),el('span','cnt',items.length+(items.length===1?' pedido':' pedidos')));
det.append(sum);const body=el('div','dbody');det.append(body);box.append(det);renderRows(body,items)}}
$('rq').oninput=renderReqs;

function renderStatus(s){const p=PHASES[s.phase]||[s.phase||'?','',''];
$('phase').textContent=p[0];$('sub').textContent=p[2]+(s.web?.state?'  (WhatsApp Web: '+s.web.state+')':'');
$('dot').className='dot '+p[1];
$('s-queue').textContent=s.queued??'-';$('s-work').textContent=s.working?'Sim':'Nao';
$('s-msgs').textContent=s.receivedMessages??0;$('s-cmds').textContent=s.receivedCommands??0;
const m=Math.round((s.uptimeSeconds||0)/60);$('s-up').textContent=m>=60?Math.floor(m/60)+'h '+m%60+'min':m+' min';
const on=Boolean(s.settings?.allowGroups);
$('s-groups').textContent=s.settings?(on?'Ativados':'Desativados'):'-';
$('a-groups').textContent=on?'Desativar grupos':'Ativar grupos';
const sup=Boolean(s.settings?.supervised);
$('a-restart').title=sup?'Reinicia o processo e volta sozinho':'Sem supervisor: o bot so encerra. Inicie com npm run start:forever';
if(s.qrImage){$('qrimg').src=s.qrImage;$('qr').style.display='block'}else $('qr').style.display='none';
reqs=s.requests||[];renderReqs();$('upd').textContent='ao vivo '+new Date().toLocaleTimeString('pt-BR')}

const log=$('log');
function addLog(e){const row=el('div','l '+e.level);row.dataset.t=e.text.toLowerCase();
row.append(el('span','t',hm(e.time)+'  '),document.createTextNode((e.level==='info'?'':e.level.toUpperCase()+' ')+e.text));log.append(row)}
function filter(){const q=$('q').value.toLowerCase();for(const r of log.children)r.style.display=!q||r.dataset.t.includes(q)?'':'none'}
function handle(d){for(const e of d.entries){last=Math.max(last,e.id);addLog(e)}
while(log.children.length>3000)log.firstChild.remove();
renderStatus(d.status||{});filter();
if($('auto').checked&&d.entries.length)log.scrollTop=log.scrollHeight}

let es,retry;
function connect(){clearTimeout(retry);if(es)es.close();
es=new EventSource('/events?after='+last+'&level='+$('lvl').value);
es.onmessage=m=>{try{handle(JSON.parse(m.data))}catch{}};
es.onerror=()=>{es.close();$('upd').textContent='reconectando...';checkAuth();retry=setTimeout(connect,3000)}}
async function checkAuth(){try{const r=await fetch('/logs.json?after=2147483647');if(r.status===401)location.href='/login'}catch{}}
$('q').oninput=filter;$('clr').onclick=()=>{log.textContent=''};
$('lvl').onchange=()=>{log.textContent='';last=0;connect()};
connect();
</script></body></html>`;

module.exports = { DASHBOARD_PAGE };
