'use strict';

// Tema compartilhado por todas as paginas (painel, login e pareamento).
const COMMON = '--brand:#16a34a;--brand2:#0d7a37;--ok:#16a34a;--warn:#d99a1a;--bad:#dc4a4a;--info:#2f7de1;--termtext:#d7e6dd';
const LIGHT = '--bg:#f3f6f4;--card:#fff;--text:#12241b;--muted:#64796e;--line:#e0e8e3;--term:#0c130f;--shadow:0 1px 2px rgba(16,40,28,.05),0 8px 24px -12px rgba(16,40,28,.12)';
const DARK = '--bg:#0b120e;--card:#141f19;--text:#e4f0e9;--muted:#8aa196;--line:#22332a;--term:#080d0a;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.5)';
const THEME_CSS = ':root{' + COMMON + ';' + LIGHT + '}'
  + '@media(prefers-color-scheme:dark){:root:not([data-theme=light]){' + DARK + '}}'
  + ':root[data-theme=dark]{' + DARK + '}:root[data-theme=light]{' + LIGHT + '}';

const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
  + '<stop offset="0" stop-color="#16a34a"/><stop offset="1" stop-color="#0d7a37"/></linearGradient></defs>'
  + '<rect width="64" height="64" rx="16" fill="url(#g)"/><text x="32" y="45" font-size="38" font-weight="800" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">A</text></svg>';

const CARD_CSS = '*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;'
  + 'background:radial-gradient(800px 400px at 80% -10%,rgba(22,163,74,.16),transparent),var(--bg);color:var(--text);font:16px/1.5 Inter,system-ui,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}'
  + 'main{width:100%;max-width:440px;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:28px 24px;text-align:center;box-shadow:0 12px 40px -16px rgba(16,40,28,.25)}'
  + '.logo{width:52px;height:52px;margin:0 auto 6px;border-radius:15px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:26px;background:linear-gradient(135deg,var(--brand),var(--brand2));box-shadow:0 8px 20px -8px var(--brand)}'
  + 'h1{margin:0 0 18px;font-size:14px;letter-spacing:.14em;color:var(--muted)}h2{margin:0 0 4px;font-size:22px;letter-spacing:-.01em}.m{margin:0 0 18px;color:var(--muted);font-size:14px}'
  + '.qr{display:inline-block;background:#fff;padding:12px;border-radius:18px;border:1px solid var(--line);margin-bottom:18px}.qr img{display:block;width:280px;max-width:100%;height:auto}'
  + 'ol{text-align:left;margin:0 auto 18px;padding:14px 14px 14px 36px;background:var(--bg);border-radius:14px;font-size:14px;color:var(--muted)}ol b{color:var(--text)}'
  + '.ic{width:64px;height:64px;margin:6px auto 14px;border-radius:50%;display:grid;place-items:center;font-size:30px;color:#fff}.ic.ok{background:var(--brand)}'
  + '.ic.wait{border:5px solid var(--line);border-top-color:var(--brand);animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}'
  + '.note{font-size:13px;padding:10px 12px;border-radius:12px;background:var(--bg);color:var(--muted);margin-bottom:12px}.note.ok{color:var(--brand2);background:rgba(22,163,74,.1)}.note.bad{color:var(--bad);background:rgba(220,74,74,.1)}'
  + '.foot{font-size:12px;color:var(--muted);margin:0}.foot a{color:var(--brand2)}'
  + 'form{display:grid;gap:12px;text-align:left}label{font-size:13px;font-weight:600;color:var(--muted)}'
  + 'input{width:100%;margin-top:6px;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font:inherit;outline:none}input:focus{border-color:var(--brand)}'
  + 'button{cursor:pointer;border:0;border-radius:12px;padding:12px 14px;font:inherit;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--brand),var(--brand2))}button:hover{filter:brightness(1.07)}';

function shell(title, body, extraHead) {
  return '<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="light dark"><link rel="icon" href="/favicon.svg" type="image/svg+xml">' + (extraHead || '')
    + '<title>' + title + '</title><style>' + THEME_CSS + CARD_CSS + '</style></head><body><main><div class="logo">A</div><h1>AJEITA</h1>'
    + body + '</main></body></html>';
}

function loginPage({ error } = {}) {
  const note = error ? '<div class="note bad">' + error + '</div>' : '';
  return shell('AJEITA - Entrar',
    '<h2>Entrar no painel</h2><p class="m">Use a senha definida em ADMIN_TOKEN.</p>' + note
    + '<form method="post" action="/login"><label>Senha<input type="password" name="token" autocomplete="current-password" autofocus required></label>'
    + '<button type="submit">Entrar</button></form>');
}

function pairPage({ phase, qrImage, backupError, backupSavedAt }) {
  const safePhase = String(phase).replace(/[^a-z_\-]/gi, '');
  const content = phase === 'ready'
    ? '<div class="ic ok">&#10003;</div><h2>WhatsApp conectado</h2><p class="m">Tudo certo, o bot ja esta recebendo pedidos.</p>'
    : qrImage
      ? '<h2>Conecte o WhatsApp</h2><p class="m">Escaneie o QR code com o celular.</p><div class="qr"><img src="' + qrImage + '" alt="QR Code de pareamento"></div>'
        + '<ol><li>Abra o <b>WhatsApp</b></li><li>Toque em <b>Aparelhos conectados</b></li><li>Toque em <b>Conectar aparelho</b> e aponte para o QR</li></ol>'
      : '<div class="ic wait"></div><h2>Preparando...</h2><p class="m">Status: ' + safePhase + '. Aguarde o QR aparecer.</p>';
  const backup = backupError ? '<div class="note bad">Falha no backup. Nao considere a sessao persistida.</div>'
    : backupSavedAt ? '<div class="note ok">Primeiro backup desta sessao confirmado.</div>'
    : '<div class="note">Aguarde a confirmacao do primeiro backup nos logs antes de parar uma sessao nova.</div>';
  return shell('AJEITA - Pareamento', content + backup
    + '<p class="foot">Atualiza sozinho a cada 12 segundos. <a href="/logs">Abrir painel</a></p>',
    '<meta http-equiv="refresh" content="12">');
}

module.exports = { THEME_CSS, FAVICON, loginPage, pairPage };
