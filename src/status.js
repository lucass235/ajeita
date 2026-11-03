'use strict';

const http = require('node:http');
const { timingSafeEqual, createHmac, createHash } = require('node:crypto');
const { DASHBOARD_PAGE } = require('./dashboard');
const { FAVICON, loginPage, pairPage } = require('./pages');

const SESSION_MS = 7 * 24 * 3600 * 1000;
const MAX_STREAMS = 10;

function authorized(header, token) {
  if (!token || !header?.startsWith('Basic ')) return false;
  let decoded;
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); }
  catch { return false; }
  const expected = Buffer.from('admin:' + token);
  const provided = Buffer.from(decoded);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function sameSecret(a, b) {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
}
function signSession(token, exp) {
  return exp + '.' + createHmac('sha256', token).update('ajeita-session:' + exp).digest('hex');
}
function validSession(cookieHeader, token) {
  if (!token || !cookieHeader) return false;
  const match = /(?:^|;\s*)ajeita_session=([^;]+)/.exec(cookieHeader);
  if (!match) return false;
  const exp = Number(match[1].split('.')[0]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(signSession(token, exp));
  const provided = Buffer.from(match[1]);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { reject(new Error('corpo grande demais')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function csvCell(value) {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; // evita injecao de formula no Excel
  return '"' + text.replace(/"/g, '""') + '"';
}
function toCsv(requests) {
  const cols = ['time', 'status', 'who', 'number', 'chatKind', 'host', 'link', 'typed', 'seconds', 'detail'];
  const lines = [cols.join(',')];
  for (const r of requests || []) lines.push(cols.map(c => csvCell(r[c])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const HTML_CSP = "default-src 'none'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const PAGE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const GET_ROUTES = ['/', '/healthz', '/login', '/logout', '/pair', '/diagnostics', '/logs', '/logs.json', '/events', '/export.csv', '/favicon.svg'];
const POST_ROUTES = ['/login', '/action'];

function createStatusServer({ port, adminToken, getStatus, getDiagnostics, getLogs, actions }) {
  const failures = new Map();
  let streams = 0;

  async function buildPayload(after, level) {
    let status = {};
    try { status = getDiagnostics ? await getDiagnostics() : {}; } catch {}
    status.uptimeSeconds = Math.round(process.uptime());
    const current = getStatus();
    if (current.qr) {
      try { status.qrImage = await require('qrcode').toDataURL(current.qr, { width: 320, margin: 2 }); } catch {}
    }
    return { status, entries: getLogs({ after, level }) };
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const route = (req.url || '').split('?')[0];
    const allowed = req.method === 'GET' ? GET_ROUTES : req.method === 'POST' ? POST_ROUTES : [];
    if (!allowed.includes(route)) { res.writeHead(404).end('Not found'); return; }

    const secure = String(req.headers['x-forwarded-proto'] || '').includes('https');
    const page = (status, html, csp = PAGE_CSP) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp, 'X-Frame-Options': 'DENY' });
      res.end(html);
    };
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };

    if (route === '/healthz' || route === '/') {
      // 200 mesmo antes do pareamento: o healthcheck nao pode reiniciar o QR.
      json(200, { service: 'ajeita', status: getStatus().phase }); return;
    }
    if (route === '/favicon.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
      res.end(FAVICON); return;
    }
    if (!adminToken) { res.writeHead(503).end('Configure ADMIN_TOKEN na hospedagem.'); return; }

    if (route === '/login') {
      if (req.method === 'GET') { page(200, loginPage()); return; }
      const ip = req.socket.remoteAddress || '?';
      const entry = failures.get(ip) || { count: 0, until: 0 };
      if (entry.until > Date.now()) {
        page(429, loginPage({ error: 'Muitas tentativas. Aguarde 1 minuto.' })); return;
      }
      let token = '';
      try { token = new URLSearchParams(await readBody(req)).get('token') || ''; } catch {}
      if (!sameSecret(token, adminToken)) {
        entry.count++;
        if (entry.count >= 5) { entry.until = Date.now() + 60000; entry.count = 0; }
        failures.set(ip, entry);
        if (failures.size > 500) failures.delete(failures.keys().next().value);
        page(401, loginPage({ error: 'Senha incorreta.' })); return;
      }
      failures.delete(ip);
      const exp = Date.now() + SESSION_MS;
      res.writeHead(303, {
        Location: '/logs',
        'Set-Cookie': 'ajeita_session=' + signSession(adminToken, exp) + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + SESSION_MS / 1000 + (secure ? '; Secure' : '')
      });
      res.end(); return;
    }
    if (route === '/logout') {
      res.writeHead(303, { Location: '/login', 'Set-Cookie': 'ajeita_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
      res.end(); return;
    }

    const viaCookie = validSession(req.headers.cookie, adminToken);
    if (!viaCookie && !authorized(req.headers.authorization, adminToken)) {
      if (req.method === 'GET' && String(req.headers.accept || '').includes('text/html')) {
        res.writeHead(302, { Location: '/login' }).end(); return;
      }
      res.setHeader('WWW-Authenticate', 'Basic realm="AJEITA pairing", charset="UTF-8"');
      res.writeHead(401).end('Autenticacao obrigatoria'); return;
    }

    if (route === '/action') {
      const origin = req.headers.origin;
      let sameOrigin = true;
      try { sameOrigin = !origin || new URL(origin).host === req.headers.host; } catch { sameOrigin = false; }
      if (req.headers['x-requested-with'] !== 'ajeita' || !sameOrigin) { json(403, { ok: false, error: 'Requisicao recusada' }); return; }
      let name = '';
      try { name = String(JSON.parse(await readBody(req)).action || ''); } catch {}
      if (!actions || !Object.hasOwn(actions, name)) { json(404, { ok: false, error: 'Acao desconhecida' }); return; }
      try { json(200, { ok: true, ...(await actions[name]()) }); }
      catch (error) { json(500, { ok: false, error: String(error?.message || error).slice(0, 200) }); }
      return;
    }
    if (route === '/diagnostics') {
      if (!getDiagnostics) { res.writeHead(404).end('Not found'); return; }
      try { json(200, await getDiagnostics()); }
      catch { json(200, { error: 'Diagnostico indisponivel' }); }
      return;
    }
    if (route === '/export.csv') {
      let list = [];
      try { list = (await getDiagnostics?.())?.requests || []; } catch {}
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ajeita-pedidos-' + new Date().toISOString().slice(0, 10) + '.csv"'
      });
      res.end(toCsv(list)); return;
    }
    if (route === '/logs' || route === '/logs.json' || route === '/events') {
      if (!getLogs) { res.writeHead(404).end('Not found'); return; }
      if (route === '/logs') { page(200, DASHBOARD_PAGE, HTML_CSP); return; }
      const params = new URL(req.url, 'http://x').searchParams;
      let after = Number(params.get('after')) || 0;
      const level = params.get('level') || 'info';
      if (route === '/logs.json') { json(200, await buildPayload(after, level)); return; }
      if (streams >= MAX_STREAMS) { res.writeHead(429).end('Conexoes demais'); return; }
      streams++;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      let busy = false;
      const push = async () => {
        if (busy) return;
        busy = true;
        try {
          const payload = await buildPayload(after, level);
          for (const entry of payload.entries) after = Math.max(after, entry.id);
          res.write('data: ' + JSON.stringify(payload) + '\n\n');
        } catch {} finally { busy = false; }
      };
      const timer = setInterval(() => void push(), 2000);
      req.on('close', () => { clearInterval(timer); streams--; });
      void push();
      return;
    }
    // /pair
    const { phase, qr, backupSavedAt, backupError } = getStatus();
    try {
      const qrImage = qr ? await require('qrcode').toDataURL(qr, { width: 320, margin: 2 }) : '';
      page(200, pairPage({ phase, qrImage, backupError, backupSavedAt }));
    } catch (err) {
      console.error('Falha na pagina de QR:', err.message);
      res.writeHead(500).end('Falha ao gerar QR');
    }
  });
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => console.log('Painel /pair, /logs e /healthz em ' + host + ':' + port));
  return server;
}
module.exports = { authorized, createStatusServer, toCsv };
