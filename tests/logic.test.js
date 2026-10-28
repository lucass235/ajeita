'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isAjeita, normalizeLink, findLinkForCommand } = require('../src/link');
const { authorized } = require('../src/status');
const { downloadVideo, getFriendlyError } = require('../src/downloader');
const { runProcess } = require('../src/downloader');
const { createStatusServer } = require('../src/status');

test('ajeita aceita frases naturais e erros ortograficos seguros', () => {
  for (const txt of [
    'ajeita', 'AJEITA', 'Ajeita', '  ajeita  ',
    'ajeita por favor', 'pode ajeitar?', 'ajeita ai', 'por favor, ajeite isso',
    'ageita', 'pode ageitar pra mim?', 'ajeitaa!',
    'ajeita https://www.tiktok.com/@teste/video/1'
  ]) assert.equal(isAjeita(txt), true, txt);
  for (const txt of [
    '/baixar', 'desajeita', 'aceita isso?', 'jeita',
    'esta mensagem apenas comenta uma coisa muito longa sobre a palavra ajeita sem fazer um pedido direto para baixar qualquer video agora'
  ]) assert.equal(isAjeita(txt), false, txt);
});
test('somente facebook, tiktok e instagram', () => {
  assert.match(normalizeLink('https://vm.tiktok.com/ABCDE/'), /^https/);
  assert.match(normalizeLink('https://www.facebook.com/reel/1'), /^https/);
  assert.match(normalizeLink('https://www.instagram.com/reel/Db8tQGtIrL1/'), /^https/);
  for (const x of ['https://example.com/', 'http://localhost/', 'https://facebook.com.evil.test/', 'https://instagram.com.evil.test/', 'file:///etc/passwd']) assert.equal(normalizeLink(x), null);
});
test('acha link da conversa anterior ao comando', async () => {
  const now = Date.now();
  const ts = Math.floor(now / 1000);
  const msgs = [
    {id:{_serialized:'1'},body:'https://fb.watch/1',timestamp:ts-10},
    {id:{_serialized:'2'},body:'https://vm.tiktok.com/2',timestamp:ts-5},
    {id:{_serialized:'3'},body:'ajeita',timestamp:ts},
    {id:{_serialized:'4'},body:'https://fb.watch/4',timestamp:ts+1}
  ];
  assert.equal(await findLinkForCommand(msgs[2],{fetchMessages:async()=>msgs},{now}),'https://vm.tiktok.com/2');
});
test('basic auth do painel', () => {
  const h='Basic '+Buffer.from('admin:abc123').toString('base64');
  assert.equal(authorized(h,'abc123'),true);
  assert.equal(authorized(h,'errado'),false);
});
test('download bloqueia endereco arbitrario', async () => {
  await assert.rejects(downloadVideo('https://example.com/test'),/Link invalido/);
});
test('erro de video privado e legivel', () => {
  assert.match(getFriendlyError(Error('private video')),/privado/i);
});

test('resposta prioriza link citado mesmo havendo link mais novo', async () => {
  assert.equal(await findLinkForCommand({hasQuotedMsg:true, getQuotedMessage:async()=>({body:'https://fb.watch/quoted'})},
    {fetchMessages:async()=>{throw Error('nao deveria consultar');}}), 'https://fb.watch/quoted');
});
test('ignora links antigos e de mensagens posteriores', async () => {
  const now = Date.now(), timestamp = now / 1000;
  assert.equal(await findLinkForCommand({timestamp}, {fetchMessages:async()=>[
    {timestamp:timestamp-360000,body:'https://fb.watch/old'},
    {timestamp:timestamp+10,body:'https://fb.watch/future'}
  ]}, {now,maxAgeHours:1}), null);
});
test('timeout encerra processo antes de rejeitar', async () => {
  await assert.rejects(runProcess(process.execPath, ['-e','setInterval(()=>{},1000)'], {timeoutMs:50}), /tempo limite/);
});
test('painel exige autenticacao e nao vaza QR no healthcheck', async () => {
  const server = createStatusServer({port:0,adminToken:'test-token',getStatus:()=>({phase:'pairing',qr:'sensitive-qr'}),getDiagnostics:async()=>({browserConnected:true})});
  await new Promise(resolve => server.once('listening',resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(url+'/pair')).status,401);
    assert.equal((await fetch(url+'/diagnostics')).status,401);
    assert.equal((await fetch(url+'/pair',{headers:{authorization:'Basic '+Buffer.from('admin:wrong').toString('base64')}})).status,401);
    const health = await (await fetch(url+'/healthz')).text();
    assert.equal(health.includes('sensitive-qr'),false);
    const paired = await fetch(url+'/pair',{headers:{authorization:'Basic '+Buffer.from('admin:test-token').toString('base64')}});
    assert.equal(paired.status,200);
    assert.match(paired.headers.get('cache-control'),/no-store/);
    const diagnostics = await fetch(url+'/diagnostics',{headers:{authorization:'Basic '+Buffer.from('admin:test-token').toString('base64')}});
    assert.deepEqual(await diagnostics.json(),{browserConnected:true});
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
});

