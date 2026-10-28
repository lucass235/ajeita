'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {prepareRuntimeAuth} = require('../src/runtime-auth');

test('restaura somente a sessao TikTok e remove o segredo do ambiente filho', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ajeita-auth-test-'));
  try {
    const text = '# Netscape HTTP Cookie File\n#HttpOnly_.tiktok.com\tTRUE\t/\tTRUE\t0\tsessionid\tfake-test-session\n';
    const env = {TIKTOK_COOKIES_FILE:path.join(dir,'tiktok','cookies.txt'), TIKTOK_COOKIES_BASE64:Buffer.from(text).toString('base64')};
    await prepareRuntimeAuth(env);
    assert.equal(await fs.readFile(env.TIKTOK_COOKIES_FILE,'utf8'),text);
    assert.equal(env.TIKTOK_COOKIES_BASE64,undefined);
    if (process.platform !== 'win32') assert.equal((await fs.stat(env.TIKTOK_COOKIES_FILE)).mode & 0o777,0o600);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

test('recusa cookies de outro site antes de gravar o arquivo', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ajeita-auth-test-'));
  try {
    const text = '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tTRUE\t0\tsessionid\tfake-test-session\n';
    const env = {TIKTOK_COOKIES_FILE:path.join(dir,'cookies.txt'),TIKTOK_COOKIES_BASE64:Buffer.from(text).toString('base64')};
    await assert.rejects(prepareRuntimeAuth(env),/somente cookies do TikTok/);
    await assert.rejects(fs.access(env.TIKTOK_COOKIES_FILE),{code:'ENOENT'});
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
