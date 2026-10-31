'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createBrowserHealthMonitor,isWhatsAppWebReady}=require('../src/browser-health');

test('considera pronto quando o WhatsApp conectou, sincronizou e instalou a ponte',async()=>{
  const client={pupBrowser:{isConnected:()=>true},pupPage:{isClosed:()=>false,evaluate:async()=>true}};
  assert.equal(await isWhatsAppWebReady(client),true);
  client.pupPage.evaluate=async()=>false;
  assert.equal(await isWhatsAppWebReady(client),false);
});

test('recupera navegador travado mesmo quando a conexao Puppeteer continua aberta',async()=>{
  let restarts=0;
  const client={pupBrowser:{isConnected:()=>true},pupPage:{isClosed:()=>false,evaluate:()=>new Promise(()=>{})}};
  const monitor=createBrowserHealthMonitor({client,isEnabled:()=>true,onUnhealthy:()=>restarts++,timeoutMs:5,intervalMs:60000,logger:{warn(){}}});
  try {
    await monitor.check();await monitor.check();
    assert.equal(restarts,0);
    await monitor.check();await monitor.check();
    assert.equal(restarts,1);
  } finally {monitor.stop();}
});

test('uma resposta saudavel zera falhas transitorias',async()=>{
  let responsive=false,restarts=0;
  const client={pupBrowser:{isConnected:()=>true},pupPage:{isClosed:()=>false,evaluate:async()=>responsive}};
  const monitor=createBrowserHealthMonitor({client,isEnabled:()=>true,onUnhealthy:()=>restarts++,intervalMs:60000,logger:{warn(){}}});
  try {
    await monitor.check();await monitor.check();responsive=true;
    await monitor.check();responsive=false;
    await monitor.check();await monitor.check();
    assert.equal(restarts,0);
  } finally {monitor.stop();}
});
