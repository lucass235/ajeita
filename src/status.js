'use strict';

const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { DASHBOARD_PAGE } = require('./dashboard');

function authorized(header, token) {
  if (!token || !header?.startsWith('Basic ')) return false;
  let decoded;
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); }
  catch { return false; }
  const expected = Buffer.from('admin:' + token);
  const provided = Buffer.from(decoded);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

function createStatusServer({ port, adminToken, getStatus, getDiagnostics, getLogs }) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const route = (req.url || '').split('?')[0];
    if (req.method !== 'GET' || !['/', '/healthz', '/pair', '/diagnostics', '/logs', '/logs.json'].includes(route)) {
      res.writeHead(404).end('Not found'); return;
    }
    if (route === '/healthz' || route === '/') {
      // 200 mesmo antes do pareamento: o healthcheck nao pode reiniciar o QR.
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ service: 'ajeita', status: getStatus().phase }));
      return;
    }
    if (!adminToken) {
      res.writeHead(503).end('Configure ADMIN_TOKEN na hospedagem.'); return;
    }
    if (!authorized(req.headers.authorization, adminToken)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="AJEITA pairing", charset="UTF-8"');
      res.writeHead(401).end('Autenticacao obrigatoria'); return;
    }
    if (route === '/diagnostics') {
      if (!getDiagnostics) {res.writeHead(404).end('Not found');return;}
      try {
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
        res.end(JSON.stringify(await getDiagnostics()));
      } catch {
        res.end(JSON.stringify({error:'Diagnostico indisponivel'}));
      }
      return;
    }
    if (route === '/logs' || route === '/logs.json') {
      if (!getLogs) {res.writeHead(404).end('Not found');return;}
      if (route === '/logs') {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'none'; connect-src 'self'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';",
          'X-Frame-Options': 'DENY'
        });
        res.end(DASHBOARD_PAGE); return;
      }
      const params = new URL(req.url, 'http://x').searchParams;
      let status = {};
      try { status = getDiagnostics ? await getDiagnostics() : {}; } catch {}
      status.uptimeSeconds = Math.round(process.uptime());
      const current = getStatus();
      if (current.qr) {
        try { status.qrImage = await require('qrcode').toDataURL(current.qr, { width: 320, margin: 2 }); } catch {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status,
        entries: getLogs({ after: Number(params.get('after')) || 0, level: params.get('level') || 'info' })
      }));
      return;
    }
    const { phase, qr, backupSavedAt, backupError } = getStatus();
    try {
      const QRCode = require('qrcode');
      const qrImage = qr ? '<img src="' + await QRCode.toDataURL(qr, { width: 320, margin: 2 }) + '" alt="QR Code de pareamento" />' : '';
      const content = phase === 'ready' ? '<p>WhatsApp conectado.</p>' : qr
        ? '<p>Abra no celular: WhatsApp - Aparelhos conectados - Conectar aparelho.</p>' + qrImage
        : '<p>Status: ' + String(phase).replace(/[^a-z_\-]/gi, '') + '. Aguarde o QR.</p>';
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline';",
        'X-Frame-Options': 'DENY'
      });
      const backup = backupError ? '<p>Falha no backup. Nao considere a sessao persistida.</p>'
        : backupSavedAt ? '<p>Primeiro backup desta sessao confirmado.</p>'
        : '<p>Aguarde a confirmacao do primeiro backup nos logs antes de parar uma sessao nova.</p>';
      res.end('<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="12"><title>AJEITA - Pareamento</title><style>body{font:16px system-ui,sans-serif;max-width:560px;margin:4rem auto;padding:1rem;text-align:center;background:#f5f7f6;color:#132720}img{max-width:100%;height:auto}main{background:white;border-radius:18px;padding:2rem;box-shadow:0 5px 25px #0001}</style></head><body><main><h1>AJEITA</h1>' + content + backup + '<p>Atualiza a cada 12 segundos.</p></main></body></html>');
    } catch (err) {
      console.error('Falha na pagina de QR:', err.message);
      res.writeHead(500).end('Falha ao gerar QR');
    }
  });
  const host = process.env.HOST || '0.0.0.0';
  server.listen(port, host, () => console.log('Painel /pair, /logs e /healthz em ' + host + ':' + port));
  return server;
}
module.exports = { authorized, createStatusServer };

