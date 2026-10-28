'use strict';

// Painel temporario local: mostra o QR remoto sem expor ADMIN_TOKEN no navegador.
const http = require('node:http');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const dataDir = path.resolve(__dirname,'../data');
const remote = 'https://ajeita-bot-production.up.railway.app';
const token = process.env.ADMIN_TOKEN;
if (!token) throw new Error('ADMIN_TOKEN local nao configurado.');
const route = '/' + crypto.randomBytes(24).toString('hex');
const server = http.createServer(async (req,res) => {
  if (req.method !== 'GET' || req.url !== route) {res.writeHead(404).end();return;}
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'none'; img-src data:; style-src 'unsafe-inline'");
  try {
    const response = await fetch(remote + '/pair', {
      headers:{authorization:'Basic ' + Buffer.from('admin:'+token).toString('base64')},
      signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('HTTP '+response.status);
    const html = await response.text();
    const qr = html.match(/<img src="(data:image\/png;base64,[^"]+)"/);
    const ready = html.includes('WhatsApp conectado.');
    const content = ready ? '<h1>WhatsApp conectado na nuvem!</h1>'
      : qr ? '<h1>Conectar AJEITA na nuvem</h1><p>No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.</p><img alt="QR do WhatsApp" width="420" height="420" src="'+qr[1]+'"><p>O QR atualiza automaticamente.</p>'
        : '<h1>Aguarde o QR Code...</h1>';
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end('<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta http-equiv="refresh" content="3"><title>AJEITA na nuvem</title><style>body{font:20px system-ui;text-align:center;margin:2rem;background:#f4f7f5;color:#123}img{max-width:90vw;height:auto}</style></head><body>'+content+'</body></html>');
  } catch {
    res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'}).end('Aguarde alguns segundos e atualize esta pagina.');
  }
});
server.listen(3015,'127.0.0.1',async()=>{
  await fs.mkdir(dataDir,{recursive:true});
  await fs.writeFile(path.join(dataDir,'railway-pair-url.txt'),'http://127.0.0.1:3015'+route,{mode:0o600});
  console.log('Painel temporario de pareamento pronto.');
});
setTimeout(()=>{server.closeAllConnections();server.close();},20*60*1000);
