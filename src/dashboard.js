'use strict';

const DASHBOARD_PAGE = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AJEITA - Painel</title>
<style>
:root{--bg:#f4f7f5;--card:#fff;--text:#14261d;--muted:#6b7f74;--line:#e1e9e4;--ok:#1f9d55;--warn:#d99a1a;--bad:#d64545;--info:#2f7de1;--term:#0f1713;--termtext:#d7e6dd}
@media(prefers-color-scheme:dark){:root{--bg:#0d1511;--card:#16211b;--text:#e3efe8;--muted:#8aa196;--line:#25362c;--term:#0a100d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px system-ui,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:18px 16px 40px;display:grid;gap:16px}
h1{margin:0;font-size:22px}h2{margin:0 0 12px;font-size:15px;letter-spacing:.02em;text-transform:uppercase;color:var(--muted)}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.status{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.dot{width:16px;height:16px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 5px color-mix(in srgb,var(--warn) 22%,transparent)}
.dot.ok{background:var(--ok);box-shadow:0 0 0 5px color-mix(in srgb,var(--ok) 22%,transparent)}
.dot.bad{background:var(--bad);box-shadow:0 0 0 5px color-mix(in srgb,var(--bad) 22%,transparent)}
.big{font-size:20px;font-weight:650}.muted{color:var(--muted);font-size:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:14px}
.stat{border:1px solid var(--line);border-radius:10px;padding:10px 12px}.stat b{display:block;font-size:20px}
#qr{display:none;text-align:center;margin-top:14px}#qr img{width:260px;max-width:100%;border-radius:10px;background:#fff;padding:6px}
.req{display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;padding:10px 0;border-top:1px solid var(--line)}
.req:first-child{border-top:0}.req .who{font-weight:650}.req .typed{grid-column:1/3;color:var(--muted);font-size:13px;word-break:break-word}
.req .detail{grid-column:1/-1;font-size:13px;color:var(--muted);word-break:break-word}
.time{color:var(--muted);font-size:12px;white-space:nowrap}
.badge{font-size:12px;font-weight:650;padding:2px 10px;border-radius:99px;color:#fff;background:var(--muted);align-self:start;white-space:nowrap}
.b-concluido{background:var(--ok)}.b-erro{background:var(--bad)}.b-ignorado{background:var(--warn)}.b-processando,.b-na-fila{background:var(--info)}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
select,input,button{background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font:inherit;font-size:13px}
#log{background:var(--term);color:var(--termtext);border-radius:10px;padding:10px 12px;font:12.5px/1.5 ui-monospace,Consolas,monospace;height:420px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.t{color:#6d8a79}.l.warn{color:#f2c14e}.l.error{color:#ff8a8a}.empty{color:var(--muted);padding:6px 0}
</style></head><body><main>
<div class="top"><h1>AJEITA</h1><span class="muted" id="upd">carregando...</span></div>

<section class="card"><h2>WhatsApp</h2>
<div class="status"><span class="dot" id="dot"></span><div><div class="big" id="phase">...</div><div class="muted" id="sub"></div></div></div>
<div id="qr"><p class="muted">Abra no celular: WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho</p><img id="qrimg" alt="QR Code"></div>
<div class="stats">
<div class="stat"><span class="muted">Fila</span><b id="s-queue">-</b></div>
<div class="stat"><span class="muted">Baixando agora</span><b id="s-work">-</b></div>
<div class="stat"><span class="muted">Mensagens vistas</span><b id="s-msgs">-</b></div>
<div class="stat"><span class="muted">Comandos</span><b id="s-cmds">-</b></div>
<div class="stat"><span class="muted">Ativo ha</span><b id="s-up">-</b></div>
<div class="stat"><span class="muted">Grupos</span><b id="s-groups">-</b></div>
</div></section>

<section class="card"><h2>Pedidos recentes</h2><div id="reqs"><div class="empty">Nenhum pedido ainda.</div></div></section>

<section class="card"><h2>Logs</h2>
<div class="tools"><select id="lvl"><option value="info">Tudo</option><option value="warn">Avisos e erros</option><option value="error">So erros</option></select>
<input id="q" placeholder="Buscar no log"><label class="muted"><input type="checkbox" id="auto" checked> acompanhar</label><button id="clr">Limpar tela</button></div>
<div id="log"></div></section>
</main><script>
const $=id=>document.getElementById(id);let last=0;
const PHASES={ready:['Conectado','ok','Pronto para receber pedidos.'],pairing:['Aguardando QR','','Leia o QR code abaixo com o celular.'],authenticated:['Autenticando','','Sessao reconhecida, finalizando conexao.'],starting:['Iniciando','','Abrindo o WhatsApp Web.'],disconnected:['Desconectado','bad','O bot sera reiniciado automaticamente.'],auth_failure:['Falha de login','bad','Pareie novamente pelo QR.'],browser_error:['Navegador com erro','bad','Reiniciando para recuperar.'],startup_error:['Erro ao iniciar','bad','Veja os logs abaixo.']};
const BADGE={concluido:'Concluido','na fila':'Na fila',processando:'Processando',erro:'Erro',ignorado:'Ignorado'};
const hm=iso=>new Date(iso).toLocaleTimeString('pt-BR');
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function renderReqs(list){const box=$('reqs');box.textContent='';if(!list?.length){box.append(el('div','empty','Nenhum pedido ainda.'));return}
for(const r of list.slice(0,20)){const row=el('div','req');
row.append(el('div','who',r.who+(r.chatKind==='grupo'?' (grupo)':'')),el('span','time',hm(r.time)+(r.seconds!=null?' | '+r.seconds+'s':'')));
const b=el('span','badge b-'+r.status.replace(' ','-'),BADGE[r.status]||r.status);row.append(b);
row.append(el('div','typed','Escreveu: "'+r.typed+'"'+(r.host?'  -  '+r.host:'')));
if(r.detail)row.append(el('div','detail',r.detail));
box.append(row)}}
function renderStatus(s){const p=PHASES[s.phase]||[s.phase||'?','',''];
$('phase').textContent=p[0];$('sub').textContent=p[2]+(s.web?.state?'  (WhatsApp Web: '+s.web.state+')':'');
$('dot').className='dot '+p[1];
$('s-queue').textContent=s.queued??'-';$('s-work').textContent=s.working?'Sim':'Nao';
$('s-msgs').textContent=s.receivedMessages??0;$('s-cmds').textContent=s.receivedCommands??0;
const m=Math.round((s.uptimeSeconds||0)/60);$('s-up').textContent=m>=60?Math.floor(m/60)+'h '+m%60+'min':m+' min';
$('s-groups').textContent=s.settings?(s.settings.allowGroups?'Ativados':'Desativados'):'-';
if(s.qrImage){$('qrimg').src=s.qrImage;$('qr').style.display='block'}else $('qr').style.display='none';
renderReqs(s.requests);$('upd').textContent='atualizado '+new Date().toLocaleTimeString('pt-BR')}
const log=$('log');
function addLog(e){const row=el('div','l '+e.level);row.dataset.t=e.text.toLowerCase();
row.append(el('span','t',hm(e.time)+'  '),document.createTextNode((e.level==='info'?'':e.level.toUpperCase()+' ')+e.text));log.append(row)}
function filter(){const q=$('q').value.toLowerCase();for(const r of log.children)r.style.display=!q||r.dataset.t.includes(q)?'':'none'}
async function tick(){try{
const d=await (await fetch('/logs.json?after='+last+'&level='+$('lvl').value)).json();
for(const e of d.entries){last=Math.max(last,e.id);addLog(e)}
while(log.children.length>3000)log.firstChild.remove();
renderStatus(d.status||{});filter();
if($('auto').checked&&d.entries.length)log.scrollTop=log.scrollHeight}catch{$('upd').textContent='sem conexao com o bot...'}}
$('q').oninput=filter;$('clr').onclick=()=>{log.textContent=''};
$('lvl').onchange=()=>{log.textContent='';last=0;tick()};
tick();setInterval(tick,2000);
</script></body></html>`;

module.exports = { DASHBOARD_PAGE };
