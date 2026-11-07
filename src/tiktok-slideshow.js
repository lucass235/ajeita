'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { isAllowedHost } = require('./link');

// Fallback para posts de fotos do TikTok (/photo/): o yt-dlp responde "Unsupported URL"
// ou entrega so o audio. As fotos e a musica sao lidas por scripts/tiktok_slideshow.py
// e viram um video (cada foto por alguns segundos, com a musica do post).
const HELPER_SCRIPT = path.join(__dirname, '..', 'scripts', 'tiktok_slideshow.py');
const SECONDS_PER_PHOTO = 3;
const MAX_PHOTOS = 40;
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
// Midia so e baixada de CDNs conhecidos do TikTok (a lista vem de uma resposta externa).
const MEDIA_HOSTS = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktok.com', 'tiktokv.com', 'tiktokv.us', 'ibytedtos.com', 'ibyteimg.com', 'byteimg.com', 'byteoversea.com', 'muscdn.com'];
const POST_PATH = /^\/@[\w.-]*\/(?:photo|video)\/\d+/i;

function isTikTokHost(hostname) {
  const name = String(hostname || '').toLowerCase();
  return name === 'tiktok.com' || name.endsWith('.tiktok.com');
}

function isMediaUrl(raw) {
  try {
    const url = new URL(raw);
    const name = url.hostname.toLowerCase();
    return url.protocol === 'https:' && MEDIA_HOSTS.some(domain => name === domain || name.endsWith('.' + domain));
  } catch {
    return false;
  }
}

// Erros do yt-dlp que indicam um post de fotos: URL /photo/ nao suportada, ou o
// TikTok sem nenhum formato de video (slideshow sem trilha de audio).
function looksLikeTikTokSlideshowError(message) {
  const text = String(message || '');
  return /Unsupported URL:\s*\S*tiktok\.com\/@[^/\s]*\/photo\//i.test(text) || /\[TikTok\][^\n]*No video formats found/i.test(text);
}

function extractPostUrl(message) {
  const found = String(message || '').match(/https?:\/\/(?:www\.)?tiktok\.com\/@[^/\s]*\/(?:photo|video)\/\d+\S*/i);
  return found ? found[0] : null;
}

// Links curtos (vt.tiktok.com, vm.tiktok.com) redirecionam para /@usuario/photo/ID.
// Segue os redirecionamentos manualmente, sem baixar a pagina e so por dominios permitidos.
async function resolveTikTokPostUrl(link, { fetchImpl = fetch } = {}) {
  let current = link;
  for (let hop = 0; hop < 6; hop++) {
    const url = new URL(current);
    if (!isAllowedHost(url.hostname) || !isTikTokHost(url.hostname)) throw new Error('Link do TikTok invalido.');
    if (POST_PATH.test(url.pathname)) return url.toString();
    const res = await fetchImpl(url, { redirect: 'manual', headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) });
    res.body?.cancel?.().catch(() => {});
    const location = res.headers.get('location');
    if (!location) break;
    current = new URL(location, url).toString();
  }
  throw new Error('Nao consegui descobrir o post do TikTok desse link.');
}

// Define quanto dura cada foto e o video: cobre a musica inteira quando ela e mais
// longa que as fotos e nunca passa do limite de duracao configurado.
function planSlideshow({ imageCount, audioSeconds = 0, maxDurationSeconds = 1200 }) {
  const audio = Number.isFinite(audioSeconds) && audioSeconds > 0 ? audioSeconds : 0;
  const total = Math.min(Math.max(1, maxDurationSeconds), Math.max(imageCount * SECONDS_PER_PHOTO, audio));
  return { total, perImage: total / imageCount };
}

function buildSlideshowArgs({ images, audio, perImage, total, portrait = true, output }) {
  const width = portrait ? 720 : 1280;
  const height = portrait ? 1280 : 720;
  const duration = perImage.toFixed(3);
  const inputs = images.flatMap(file => ['-loop', '1', '-framerate', '30', '-t', duration, '-i', file]);
  const filters = images.map((_, index) =>
    // JPEG e "full range" (yuvj420p): out_range=tv gera yuv420p padrao, aceito sem reconverter.
    `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease:out_range=tv,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[v${index}]`);
  const concat = images.map((_, index) => `[v${index}]`).join('') + `concat=n=${images.length}:v=1:a=0[v]`;
  return [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    ...inputs,
    ...(audio ? ['-i', audio] : []),
    '-filter_complex', [...filters, concat].join(';'),
    '-map', '[v]', ...(audio ? ['-map', `${images.length}:a:0`] : []),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-threads', '2',
    '-pix_fmt', 'yuv420p', '-profile:v', 'main',
    ...(audio ? ['-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '128k', '-ac', '2', '-ar', '44100'] : []),
    '-t', total.toFixed(3),
    '-movflags', '+faststart', output
  ];
}

// O FFmpeg escolhe o leitor de imagem pela extensao: detecta pelo conteudo, nao pela URL.
function imageExtension(data) {
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpg';
  if (data[0] === 0x89 && data.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return 'jpg';
}

async function fetchBuffer(candidates, { maxBytes, fetchImpl = fetch } = {}) {
  let lastError;
  for (const raw of candidates) {
    if (!isMediaUrl(raw)) continue;
    try {
      const res = await fetchImpl(raw, {
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.tiktok.com/' },
        signal: AbortSignal.timeout(60000)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (Number(res.headers.get('content-length')) > maxBytes) throw Object.assign(new Error('Arquivo grande demais.'), { code: 'TOO_LARGE' });
      const data = Buffer.from(await res.arrayBuffer());
      if (!data.length) throw new Error('Arquivo vazio.');
      if (data.length > maxBytes) throw Object.assign(new Error('Arquivo grande demais.'), { code: 'TOO_LARGE' });
      return data;
    } catch (error) {
      if (error.code === 'TOO_LARGE') throw error;
      lastError = error;
    }
  }
  throw new Error('Nao consegui baixar a midia do TikTok' + (lastError ? ': ' + lastError.message : '.'));
}

async function downloadTikTokSlideshow(link, tempDir, {
  pythonBin, runProcess, timeoutMs = 180000, maxFileMB = 100, maxDurationSeconds = 1200,
  cookiesFile, postUrl, fetchImpl = fetch, helperScript = HELPER_SCRIPT
} = {}) {
  const resolved = postUrl && POST_PATH.test(new URL(postUrl).pathname)
    ? postUrl
    : await resolveTikTokPostUrl(link, { fetchImpl });

  const infoFile = path.join(tempDir, 'slideshow.json');
  try {
    await runProcess(pythonBin, [helperScript, resolved, infoFile, ...(cookiesFile ? [cookiesFile] : [])], { timeoutMs });
  } catch (error) {
    if (/o post nao tem fotos/i.test(error.message)) throw Object.assign(new Error('Esse post do TikTok nao tem fotos.'), { code: 'NOT_SLIDESHOW' });
    throw error;
  }
  const info = JSON.parse(await fs.readFile(infoFile, 'utf8'));
  const photos = (info.images || []).slice(0, MAX_PHOTOS);
  if (!photos.length) throw Object.assign(new Error('Esse post do TikTok nao tem fotos.'), { code: 'NOT_SLIDESHOW' });

  const files = [];
  for (const [index, photo] of photos.entries()) {
    const data = await fetchBuffer(photo.urls, { maxBytes: MAX_PHOTO_BYTES, fetchImpl });
    const file = path.join(tempDir, `foto-${String(index + 1).padStart(2, '0')}.${imageExtension(data)}`);
    await fs.writeFile(file, data);
    files.push(file);
  }

  // Sem a musica o video ainda sai (mudo): so as fotos ja sao o conteudo do post.
  let audioFile;
  if (info.audio?.url) {
    const candidate = path.join(tempDir, 'audio.mp3');
    try {
      await fs.writeFile(candidate, await fetchBuffer([info.audio.url], { maxBytes: maxFileMB * 1024 * 1024, fetchImpl }));
      audioFile = candidate;
    } catch (error) {
      console.warn('Nao consegui baixar a musica do slideshow:', error.message);
    }
  }

  const { total, perImage } = planSlideshow({
    imageCount: files.length,
    audioSeconds: audioFile ? Number(info.audio.duration) : 0,
    maxDurationSeconds
  });
  const first = photos[0];
  const output = path.join(tempDir, 'video.mp4');
  await runProcess('ffmpeg', buildSlideshowArgs({
    images: files, audio: audioFile, perImage, total,
    portrait: !(Number(first.width) > Number(first.height)), output
  }), { timeoutMs });
  return output;
}

module.exports = {
  downloadTikTokSlideshow, looksLikeTikTokSlideshowError, extractPostUrl, resolveTikTokPostUrl,
  planSlideshow, buildSlideshowArgs, imageExtension, isTikTokHost, isMediaUrl
};
