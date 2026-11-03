'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStatusServer, toCsv } = require('../src/status');
const { DASHBOARD_PAGE } = require('../src/dashboard');

test('JavaScript do painel e valido', () => {
  new Function(DASHBOARD_PAGE.match(/<script>([\s\S]*)<\/script>/)[1]);
});

test('CSV neutraliza formulas e escapa aspas', () => {
  const csv = toCsv([{ time: 't', status: 'erro', who: '=CMD()', typed: 'diz "oi"' }]);
  assert.match(csv, /"'=CMD\(\)"/);
  assert.match(csv, /"diz ""oi"""/);
});

test('login por formulario, cookie, acoes e exportacao', async () => {
  const calls = [];
  const server = createStatusServer({
    port: 0, adminToken: 'segredo-de-teste',
    getStatus: () => ({ phase: 'ready' }),
    getDiagnostics: async () => ({ requests: [{ time: 'x', status: 'concluido', who: 'Ana' }] }),
    getLogs: () => [],
    actions: { async 'clear-queue'() { calls.push('clear'); return { message: 'ok' }; } }
  });
  await new Promise(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const html = { accept: 'text/html' };
  try {
    const redirect = await fetch(url + '/logs', { headers: html, redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/login');
    assert.equal((await fetch(url + '/login')).status, 200);
    const form = body => ({ method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    assert.equal((await fetch(url + '/login', form('token=errada'))).status, 401);
    const ok = await fetch(url + '/login', form('token=segredo-de-teste'));
    assert.equal(ok.status, 303);
    const cookie = ok.headers.get('set-cookie').split(';')[0];
    assert.match(ok.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await fetch(url + '/logs', { headers: { cookie } })).status, 200);
    assert.match(await (await fetch(url + '/export.csv', { headers: { cookie } })).text(), /Ana/);
    const post = headers => fetch(url + '/action', { method: 'POST', headers: { cookie, 'content-type': 'application/json', ...headers }, body: '{"action":"clear-queue"}' });
    assert.equal((await post({})).status, 403);
    assert.equal((await post({ 'x-requested-with': 'ajeita', origin: 'http://evil.example' })).status, 403);
    const done = await post({ 'x-requested-with': 'ajeita' });
    assert.equal(done.status, 200);
    assert.deepEqual(calls, ['clear']);
    assert.equal((await fetch(url + '/action', { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await fetch(url + '/logs', { headers: { ...html, cookie: 'ajeita_session=999999999999999.forjado' }, redirect: 'manual' })).status, 302);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('bloqueia login apos varias tentativas erradas', async () => {
  const server = createStatusServer({ port: 0, adminToken: 'segredo-de-teste', getStatus: () => ({}) });
  await new Promise(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    const bad = () => fetch(url + '/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'token=x' });
    for (let i = 0; i < 5; i++) assert.equal((await bad()).status, 401);
    assert.equal((await bad()).status, 429);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
