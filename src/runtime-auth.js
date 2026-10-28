'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

async function prepareRuntimeAuth(env = process.env) {
  const encoded = env.TIKTOK_COOKIES_BASE64;
  if (!encoded) return;
  if (!env.TIKTOK_COOKIES_FILE) throw new Error('Configure TIKTOK_COOKIES_FILE para restaurar a sessao.');
  const text = Buffer.from(encoded, 'base64').toString('utf8');
  if (text.length > 1024 * 1024 || !/^# (?:Netscape HTTP Cookie File|HTTP Cookie File)/.test(text)) {
    throw new Error('Arquivo de sessao TikTok invalido.');
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) continue;
    const fields = line.replace(/^#HttpOnly_/, '').split('\t');
    if (fields.length !== 7 || !/(^|\.)tiktok\.com$/i.test(fields[0])) {
      throw new Error('A sessao deve conter somente cookies do TikTok.');
    }
  }
  const filename = env.TIKTOK_COOKIES_FILE;
  await fs.mkdir(path.dirname(filename), {recursive:true, mode:0o700});
  await fs.writeFile(filename, text, {mode:0o600});
  await fs.chmod(filename, 0o600);
  delete env.TIKTOK_COOKIES_BASE64;
}

module.exports = {prepareRuntimeAuth};
