'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

// Fallback para posts do Facebook que o yt-dlp nao consegue ler: abre a pagina
// num Chrome headless e captura os streams (video e audio separados) do CDN.
async function sniffFacebookStreams(url, { chromePath, timeoutMs = 45000 } = {}) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(chromePath ? { executablePath: chromePath } : {}),
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    const urls = [];
    page.on('response', res => {
      const u = res.url();
      if (/^https:\/\/video\.[^/]*fbcdn\.net\/.*\.mp4/.test(u)) urls.push(u);
    });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 4000));
    // O mesmo arquivo chega em varios trechos (bytestart/byteend): sem eles vem inteiro.
    const unique = new Map();
    for (const raw of urls) {
      const parsed = new URL(raw);
      parsed.searchParams.delete('bytestart');
      parsed.searchParams.delete('byteend');
      const key = parsed.origin + parsed.pathname;
      if (!unique.has(key)) unique.set(key, parsed.href);
    }
    return [...unique.values()];
  } finally {
    await browser.close().catch(() => {});
  }
}

async function downloadFacebookFallback(url, tempDir, { chromePath, runProcess, timeoutMs = 180000, maxFileMB = 100 } = {}) {
  const streams = await sniffFacebookStreams(url, { chromePath });
  if (!streams.length) throw new Error('Nao encontrei video nessa pagina do Facebook.');
  let video;
  let audio;
  for (const [index, href] of streams.entries()) {
    if (video && audio) break;
    const res = await fetch(href, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) continue;
    const size = Number(res.headers.get('content-length')) || 0;
    if (size > maxFileMB * 1024 * 1024) throw Object.assign(new Error('Video acima do limite de ' + maxFileMB + ' MB.'), { code: 'TOO_LARGE' });
    const file = path.join(tempDir, 'fb-stream-' + index + '.mp4');
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    const probe = JSON.parse(await runProcess('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', file], { timeoutMs: 30000 }));
    const types = probe.streams.map(stream => stream.codec_type);
    if (types.includes('video') && !video) video = file;
    else if (types.includes('audio') && !types.includes('video') && !audio) audio = file;
  }
  if (!video) throw new Error('Nao encontrei video nessa pagina do Facebook.');
  const output = path.join(tempDir, 'video.mp4');
  await runProcess('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', video,
    ...(audio ? ['-i', audio, '-map', '0:v:0', '-map', '1:a:0'] : []),
    '-c', 'copy', output
  ], { timeoutMs });
  return output;
}

module.exports = { downloadFacebookFallback, sniffFacebookStreams };
