'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

function boot(env = {}, parts = [{filepath:"fixture.mp4",bytes:10}]) {
  env = {REQUEST_DELAY_SECONDS:'0', SEND_PROGRESS:'false', ...env};
  const sent = [], downloads = [], pauses = [];
  let client;
  class Client extends EventEmitter {
    constructor() { super(); client = this; }
    initialize() { return Promise.resolve(); }
    async sendMessage(chatId, body, options) { sent.push({chatId,body,options}); return {id:{_serialized:'sent'}}; }
  }
  const modules = {
    dotenv: {config() {}},
    'whatsapp-web.js': {Client, LocalAuth: class {}, MessageMedia:{fromFilePath:()=>({mp4:true})}},
    './remote-auth': {ReliableRemoteAuth:class {}},
    './gcs-store': {GcsSessionStore:class {}},
    'qrcode-terminal': {},
    './link': require('../src/link'),
    './status': {},
    './log-buffer': {installLogBuffer(){},getLogs:()=>[]},
    './runtime-auth': {prepareRuntimeAuth:async()=>{}},
    './browser-health': {},
    './downloader': {getFriendlyError:()=> 'Falha', downloadVideo:async link=>{
      downloads.push(link); return {parts,bytes:10,cleanup:async()=>{}};
    }}
  };
  const script = fs.readFileSync(path.join(__dirname,'../src/bot.js'),'utf8');
  vm.runInNewContext(script, {require:name=>modules[name], process:{env,platform:process.platform,on(){}},
    console:{log(){},warn(){},error(){}},setTimeout:(fn,ms)=>{ if(ms===5000) { pauses.push(ms); fn(); return; } return setTimeout(fn,ms); },clearTimeout,URL});
  client.emit('ready');
  return {client,sent,downloads,pauses,handle:client.listeners('message_create')[0]};
}
function message(chatId, fromMe, id, extras = {}) {
  const timestamp = Date.now()/1000;
  const chat = {id:{_serialized:chatId},isGroup:false,fetchMessages:async()=>[
    {timestamp:timestamp-1,body:'https://fb.watch/video'}
  ],...extras};
  return {body:'Ajeita',fromMe,from:chatId,to:chatId,id:{_serialized:id,remote:chatId},timestamp,getChat:async()=>chat};
}
const settle = () => new Promise(resolve=>setImmediate(resolve));

test('comandos de ambas as pessoas entregam no chat de origem e repeticao nao duplica', async()=>{
  const bot = boot({CHAT_COOLDOWN_SECONDS:'0',SEND_PROGRESS:'true'});
  for (const [chat,own,id] of [['a@c.us',true,'1'],['b@c.us',false,'2']]) {
    const msg = message(chat,own,id);
    await bot.handle(msg); await settle();
    await bot.handle(msg); await settle();
  }
  assert.deepEqual(bot.sent.map(x=>x.chatId),['a@c.us','a@c.us','b@c.us','b@c.us']);
  assert.deepEqual(bot.sent.filter(x=>typeof x.body==='string').map(x=>x.body),['perai','perai']);
  for (const video of bot.sent.filter(x=>typeof x.body!=='string')) {
    assert.equal(video.options.caption,undefined);
  }
  assert.equal(bot.downloads.length,2);
});
test('sem comando e em grupos nao baixa',async()=>{
  const bot=boot();
  await bot.handle({...message('a@c.us',false,'1'),body:'https://fb.watch/video'});
  await bot.handle(message('g@g.us',false,'2',{isGroup:true}));
  await settle();
  assert.equal(bot.downloads.length,0);
});
test('consulta concorrente reserva capacidade antes do download',async()=>{
  const bot=boot({MAX_QUEUE:'1',CHAT_COOLDOWN_SECONDS:'0'});
  let release;
  const firstMessage=message('a@c.us',false,'1',{fetchMessages:()=>new Promise(resolve=>{release=resolve;})});
  const first=bot.handle(firstMessage);
  await settle();
  await bot.handle(message('b@c.us',false,'2'));
  assert.equal(bot.sent.length,1);
  assert.equal(bot.sent[0].body,'eita deu alguma bronca aqui nesse video, nao conseguir baixar');
  release([{timestamp:firstMessage.timestamp-1,body:'https://fb.watch/video'}]);
  await first; await settle();
  assert.equal(bot.downloads.length,1);
});

test('envia partes numeradas e pausa depois do aviso e de cada video',async()=>{
  const bot=boot({SEND_PROGRESS:'true'},[
    {filepath:'parte-1.mp4',bytes:10}, {filepath:'parte-2.mp4',bytes:10}, {filepath:'parte-3.mp4',bytes:10}
  ]);
  await bot.handle(message('a@c.us',false,'parts'));
  await settle();
  assert.equal(bot.sent[0].body,'perai');
  assert.deepEqual(bot.sent.slice(1).map(x=>x.options.caption),['Parte 1 \u{1F446}','Parte 2 \u{1F446}','Parte 3 \u{1F446}']);
  assert.equal(bot.pauses.length,4);
});
