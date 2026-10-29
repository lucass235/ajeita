'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { normalizeLink } = require('./link');

function runProcess(command, args, { timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    let output = '';
    let done = false;
    let timeoutError;
    const child = spawn(command, args, { shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const timeout = setTimeout(() => {
      timeoutError = new Error('O tempo limite de ' + Math.round(timeoutMs / 1000) + ' segundos foi excedido.');
      // FFmpeg herda o grupo: nao deixar subprocessos gravando apos a limpeza.
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch (err) { if (err.code !== 'ESRCH') child.kill('SIGKILL'); }
    }, timeoutMs);
    function finish(err) {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve(output);
    }
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', chunk => { output = (output + chunk.toString('utf8')).slice(-10000); });
    }
    child.on('error', error => finish(new Error('Nao consegui executar ' + command + ': ' + error.message)));
    child.on('close', code => {
      if (done) return;
      if (timeoutError) return finish(timeoutError);
      if (code !== 0) {
        const lines = output.trim().split('\n').slice(-4).join(' ').trim();
        finish(new Error(lines || 'yt-dlp encerrou com codigo ' + code));
      } else finish(null);
    });
  });
}

function getFriendlyError(error) {
  const message = String(error?.message || error || 'Erro desconhecido');
  if (/Sign in|login required|private|not available|not accessible|unsupported url|not supported/i.test(message)) {
    return 'Nao consegui acessar esse video. Ele pode ser privado, removido ou incompativel com o yt-dlp.';
  }
  if (/larger than max|exceeds max-filesize|File is larger|maior que o limite/i.test(message)) {
    return 'Esse video e maior que o limite configurado.';
  }
  if (/limite de duracao/i.test(message)) {
    return 'Esse video ultrapassa a duracao maxima configurada.';
  }
  if (/ffmpeg|ffprobe/i.test(message)) {
    return 'Nao encontrei o FFmpeg. Instale-o e confira se esta no PATH.';
  }
  if (/No module named yt_dlp/i.test(message)) {
    return 'yt-dlp nao esta instalado. Execute: python -m pip install -U yt-dlp';
  }
  if (/spawn|ENOENT|Nao consegui executar/i.test(message)) {
    return 'Nao encontrei o Python. Instale-o ou ajuste PYTHON_BIN no .env.';
  }
  if (/tim(e|ed) out|tempo limite|timeout/i.test(message)) {
    return 'O download demorou demais. Tente outro video ou tente novamente.';
  }
  return 'Nao consegui baixar ou enviar esse video. Tente um video publico menor.';
}

async function prepareWhatsAppVideo(filepath, { timeoutMs = 180000, maxDurationSeconds = 1200, maxFileMB = 45, startSeconds, clipSeconds, outputPath } = {}) {
  const probe = JSON.parse(await runProcess('ffprobe', [
    '-v', 'error', '-show_entries',
    'stream=codec_name,codec_type,profile,pix_fmt,width,height:format=duration,size', '-of', 'json', filepath
  ], { timeoutMs: Math.min(timeoutMs, 30000) }));
  const video = probe.streams.find(stream => stream.codec_type === 'video');
  const audio = probe.streams.find(stream => stream.codec_type === 'audio');
  if (!video) throw new Error('O arquivo baixado nao contem video.');
  if (Number(probe.format?.duration) > maxDurationSeconds) {
    throw new Error('O video excede o limite de duracao configurado.');
  }
  // MP4 e apenas o container: TikTok tambem entrega HEVC + HE-AACv2 nele.
  // Esses codecs sao rejeitados pela validacao de midia do WhatsApp Web.
  const compatibleVideo = video.codec_name === 'h264' && video.pix_fmt === 'yuv420p'
    && Math.max(video.width, video.height) <= 1280;
  const compatibleAudio = !audio || (audio.codec_name === 'aac' && audio.profile === 'LC');
  // Ficar abaixo de 14 MiB permite enviar como video reproduzivel no chat,
  // sem precisar usar o envio como documento para videos maiores.
  const targetFileMB = Math.min(maxFileMB, 13.5);
  if (clipSeconds === undefined && compatibleVideo && compatibleAudio && Number(probe.format?.size) <= targetFileMB * 1024 * 1024) return filepath;

  const output = outputPath || path.join(path.dirname(filepath), 'whatsapp.mp4');
  const duration = clipSeconds ?? Number(probe.format?.duration);
  // Reserva espaco para audio e container, limitando o bitrate do H.264.
  const maxBitrate = duration > 0
    ? Math.max(64000, Math.floor(targetFileMB * 1024 * 1024 * 8 * 0.9 / duration) - 128000)
    : 2500000;
  await runProcess('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    ...(startSeconds !== undefined ? ['-ss', String(startSeconds)] : []), '-i', filepath,
    // FPS fixo evita um ultimo frame ultrapassar os 90s em fontes VFR.
    ...(clipSeconds !== undefined ? ['-t', String(clipSeconds), '-r', '30'] : []),
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-threads', '2',
    '-maxrate', String(maxBitrate), '-bufsize', String(maxBitrate * 2),
    '-pix_fmt', 'yuv420p', '-profile:v', 'main',
    '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '128k', '-ac', '2', '-ar', '44100',
    '-movflags', '+faststart', output
  ], { timeoutMs });
  return output;
}

async function prepareWhatsAppParts(filepath, options = {}) {
  const probe = JSON.parse(await runProcess('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', filepath
  ], { timeoutMs: 30000 }));
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Duracao do video invalida.');
  if (duration > (options.maxDurationSeconds ?? 1200)) throw new Error('O video excede o limite de duracao configurado.');
  const parts = [];
  for (let start = 0; start < duration; start += 90) {
    const output = await prepareWhatsAppVideo(filepath, {
      ...options,
      ...(duration > 90 ? {
        startSeconds: start, clipSeconds: Math.min(90, duration - start),
        outputPath: path.join(path.dirname(filepath), `parte-${parts.length + 1}.mp4`)
      } : {})
    });
    const stats = await fs.stat(output);
    if (stats.size === 0) throw new Error('Video gerado vazio.');
    if (stats.size > (options.maxFileMB ?? 45) * 1024 * 1024) throw new Error('O arquivo e maior que o limite configurado.');
    parts.push({ filepath: output, bytes: stats.size });
  }
  return parts;
}

async function downloadVideo(link, options = {}) {
  const url = normalizeLink(link);
  if (!url) throw new Error('Link invalido: somente Facebook, TikTok e Instagram.');
  const maxFileMB = Math.max(1, Math.min(100, Number(options.maxFileMB) || 45));
  const maxDurationSeconds = Math.max(30, Number(options.maxDurationSeconds) || 1200);
  const timeoutSeconds = Math.max(30, Number(options.timeoutSeconds) || 180);
  const pythonBin = options.pythonBin || (process.platform === 'win32' ? 'python' : 'python3');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ajeita-'));
  try {
    const cookieArgs = [];
    if (options.tiktokCookiesFile && /(^|\.)tiktok\.com$/i.test(new URL(url).hostname)) {
      // yt-dlp atualiza o cookie jar ao finalizar. A copia por pedido permite
      // montar a sessao original somente para leitura e evita sobrescreve-la.
      const cookieCopy = path.join(tempDir, 'tiktok-cookies.txt');
      try {
        await fs.copyFile(options.tiktokCookiesFile, cookieCopy);
        cookieArgs.push('--cookies', cookieCopy);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    const args = [
      '-m', 'yt_dlp',
      '--ignore-config',
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
      '--no-mtime',
      '--impersonate', 'chrome',
      '--restrict-filenames',
      '--socket-timeout', '20',
      '--retries', '2',
      '--fragment-retries', '2',
      '--max-filesize', maxFileMB + 'M',
      '--match-filters', 'duration <=? ' + maxDurationSeconds,
      '-f', 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b[ext=mp4]/b',
      '--merge-output-format', 'mp4',
      '--remux-video', 'mp4',
      ...cookieArgs,
      '-o', path.join(tempDir, 'video.%(ext)s'),
      url
    ];
    await runProcess(pythonBin, args, { timeoutMs: timeoutSeconds * 1000 });
    const files = await fs.readdir(tempDir);
    const filename = files.find(file => /^video.*\.mp4$/i.test(file));
    if (!filename) throw new Error('Video MP4 nao foi gerado. Confira FFmpeg.');
    const parts = await prepareWhatsAppParts(path.join(tempDir, filename), {
      timeoutMs: timeoutSeconds * 1000,
      maxDurationSeconds,
      maxFileMB
    });
    return { parts, bytes: parts.reduce((sum, part) => sum + part.bytes, 0), cleanup: () => fs.rm(tempDir, { recursive: true, force: true }) };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

module.exports = { downloadVideo, getFriendlyError, runProcess, prepareWhatsAppVideo, prepareWhatsAppParts };

