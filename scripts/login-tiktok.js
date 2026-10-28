'use strict';

// Login feito pelo usuario em um perfil exclusivo do AJEITA. Nao acessa
// senhas nem cookies de outros sites do navegador pessoal.
const fs = require('node:fs/promises');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

async function main() {
  const dataDir = path.resolve(__dirname, '../data/tiktok');
  await fs.mkdir(dataDir, {recursive:true});
  const candidates = [
    process.env.TIKTOK_LOGIN_CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ].filter(Boolean);
  let executablePath;
  for (const candidate of candidates) {
    try { await fs.access(candidate); executablePath = candidate; break; } catch {}
  }
  if (!executablePath) throw new Error('Chrome/Edge nao encontrado. Configure TIKTOK_LOGIN_CHROME_PATH.');
  const browser = await puppeteer.launch({
    executablePath,
    headless:false,
    userDataDir:path.join(dataDir, 'browser'),
    defaultViewport:null,
    args:['--start-maximized']
  });
  let stopped = false;
  browser.on('disconnected', () => { stopped = true; });
  try {
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.goto('https://www.tiktok.com/login', {waitUntil:'domcontentloaded', timeout:60000})
      .catch(error => {if (error.name !== 'TimeoutError') throw error;});
    console.log('Entre no TikTok na janela aberta. A sessao sera salva automaticamente.');
    const deadline = Date.now() + 20 * 60 * 1000;
    while (!stopped && Date.now() < deadline) {
      const cookies = (await browser.cookies()).filter(c => /(^|\.)tiktok\.com$/i.test(c.domain));
      if (cookies.some(c => ['sessionid','sessionid_ss'].includes(c.name) && c.value)) {
        const rows = cookies.filter(c => !/[\t\r\n]/.test(c.domain + c.name + c.value + c.path)).map(c => [
          (c.httpOnly ? '#HttpOnly_' : '') + c.domain,
          c.domain.startsWith('.') ? 'TRUE' : 'FALSE',
          c.path || '/', c.secure ? 'TRUE' : 'FALSE',
          c.expires > 0 ? Math.floor(c.expires) : 0, c.name, c.value
        ].join('\t'));
        const cookieFile = path.join(dataDir, 'cookies.txt');
        const stagingFile = path.join(dataDir, 'cookies.tmp');
        await fs.writeFile(stagingFile, '# Netscape HTTP Cookie File\n' + rows.join('\n') + '\n', {mode:0o600});
        await fs.rename(stagingFile, cookieFile);
        console.log('LOGIN_TIKTOK_CONCLUIDO: sessao salva localmente para o AJEITA.');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.log('Login nao concluido. Execute npm run login:tiktok para tentar novamente.');
  } finally {
    if (!stopped) await browser.close();
  }
}

main().catch(error => {console.error('Falha ao conectar TikTok: ' + error.message);process.exitCode=1;});
