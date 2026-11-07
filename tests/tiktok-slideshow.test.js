'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { runProcess } = require('../src/downloader');
const {
  downloadTikTokSlideshow, looksLikeTikTokSlideshowError, extractPostUrl, resolveTikTokPostUrl,
  planSlideshow, buildSlideshowArgs, imageExtension, isMediaUrl
} = require('../src/tiktok-slideshow');

// Mensagens reais registradas no log do AJEITA (ultimas 4 linhas do yt-dlp, unidas por espaco).
const PHOTO_ERROR = '[generic] Extracting URL: https://www.tiktok.com/@rodrigopaidasophia/photo/7704358603389537554?_r=1&_t=ZS-9BBws4ySBjY ' +
  '[generic] 7704358603389537554?_r=1&_t=ZS-9BBws4ySBjY: Downloading webpage [generic] 7704358603389537554?_r=1&_t=ZS-9BBws4ySBjY: Extracting information ' +
  'ERROR: Unsupported URL: https://www.tiktok.com/@rodrigopaidasophia/photo/7704358603389537554?_r=1&_t=ZS-9BBws4ySBjY';
const NO_FORMATS_ERROR = '[TikTok] 7700607014900174081: Downloading webpage [TikTok] Solving JS challenge using native Python implementation ' +
  '[TikTok] 7700607014900174081: Downloading webpage with challenge cookie ERROR: [TikTok] 7700607014900174081: No video formats found!; please report this issue';

test('reconhece erros do yt-dlp que indicam post de fotos do TikTok', () => {
  assert.equal(looksLikeTikTokSlideshowError(PHOTO_ERROR), true);
  assert.equal(looksLikeTikTokSlideshowError(NO_FORMATS_ERROR), true);
  for (const message of [
    'ERROR: [TikTok] 1: Video not available, status code 203008',
    'ERROR: Unsupported URL: https://example.com/video.mp4',
    'ERROR: Unsupported URL: https://www.tiktok.com/@user/live',
    'ERROR: [facebook] 1: No video formats found!',
    '', undefined
  ]) assert.equal(looksLikeTikTokSlideshowError(message), false, String(message));
});

test('extrai a URL do post da mensagem de erro', () => {
  assert.equal(extractPostUrl(PHOTO_ERROR), 'https://www.tiktok.com/@rodrigopaidasophia/photo/7704358603389537554?_r=1&_t=ZS-9BBws4ySBjY');
  assert.equal(extractPostUrl('sem url'), null);
});

test('resolve link curto seguindo redirecionamentos so por dominios permitidos', async () => {
  const final = 'https://www.tiktok.com/@maria/photo/7704300503655566610?_r=1';
  const calls = [];
  const fetchImpl = async url => {
    calls.push(String(url));
    return { headers: new Headers({ location: final }), body: null };
  };
  assert.equal(await resolveTikTokPostUrl('https://vt.tiktok.com/ZSpM3QNcB/', { fetchImpl }), final);
  assert.deepEqual(calls, ['https://vt.tiktok.com/ZSpM3QNcB/']);

  // URL de post ja resolvida nao faz requisicao nenhuma.
  const direct = 'https://www.tiktok.com/@maria/video/1';
  assert.equal(await resolveTikTokPostUrl(direct, { fetchImpl: async () => { throw new Error('nao deveria buscar'); } }), direct);

  const evil = async () => ({ headers: new Headers({ location: 'https://evil.example/@a/photo/1' }), body: null });
  await assert.rejects(resolveTikTokPostUrl('https://vt.tiktok.com/x/', { fetchImpl: evil }), /invalido/i);
  const loop = async () => ({ headers: new Headers({ location: 'https://vt.tiktok.com/y/' }), body: null });
  await assert.rejects(resolveTikTokPostUrl('https://vt.tiktok.com/x/', { fetchImpl: loop }), /descobrir/i);
  await assert.rejects(resolveTikTokPostUrl('https://example.com/x', { fetchImpl }), /invalido/i);
});

test('planeja duracao do video: cobre a musica e respeita o limite', () => {
  assert.deepEqual(planSlideshow({ imageCount: 1, audioSeconds: 60 }), { total: 60, perImage: 60 });
  assert.deepEqual(planSlideshow({ imageCount: 10 }), { total: 30, perImage: 3 });
  assert.deepEqual(planSlideshow({ imageCount: 2, audioSeconds: 3 }), { total: 6, perImage: 3 });
  assert.deepEqual(planSlideshow({ imageCount: 4, audioSeconds: 100, maxDurationSeconds: 40 }), { total: 40, perImage: 10 });
  assert.deepEqual(planSlideshow({ imageCount: 2, audioSeconds: NaN }), { total: 6, perImage: 3 });
});

test('so baixa midia de CDN do TikTok por https', () => {
  assert.equal(isMediaUrl('https://p16-common-sign.tiktokcdn.com/a.jpeg?x=1'), true);
  assert.equal(isMediaUrl('https://v16m.tiktokcdn.com/a/'), true);
  for (const url of ['http://p16.tiktokcdn.com/a.jpeg', 'https://tiktokcdn.com.evil.test/a', 'https://example.com/a.jpeg', 'file:///etc/passwd', 'nada']) {
    assert.equal(isMediaUrl(url), false, url);
  }
});

test('detecta o formato da imagem pelo conteudo', () => {
  assert.equal(imageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(imageExtension(Buffer.from('\x89PNG\r\n\x1a\n', 'latin1')), 'png');
  assert.equal(imageExtension(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'webp');
  assert.equal(imageExtension(Buffer.from('desconhecido')), 'jpg');
});

test('comando do FFmpeg liga fotos, musica e duracao total', () => {
  const withAudio = buildSlideshowArgs({ images: ['a.jpg', 'b.jpg'], audio: 'm.mp3', perImage: 3, total: 6, portrait: true, output: 'o.mp4' });
  assert.equal(withAudio.filter(arg => arg === '-loop').length, 2);
  assert.ok(withAudio.join(' ').includes('concat=n=2:v=1:a=0[v]'));
  assert.ok(withAudio.join(' ').includes('scale=720:1280'));
  assert.ok(withAudio.join(' ').includes('-map [v] -map 2:a:0'));
  assert.equal(withAudio[withAudio.indexOf('-t', withAudio.indexOf('-filter_complex')) + 1], '6.000');
  assert.equal(withAudio.at(-1), 'o.mp4');

  const silent = buildSlideshowArgs({ images: ['a.jpg'], perImage: 3, total: 3, portrait: false, output: 'o.mp4' });
  assert.ok(silent.join(' ').includes('scale=1280:720'));
  assert.ok(!silent.includes('-c:a'));
  assert.ok(!silent.join(' ').includes('a:0'));
});

async function ffmpegAvailable(t) {
  try {
    await runProcess('ffmpeg', ['-version']);
    await runProcess('ffprobe', ['-version']);
    return true;
  } catch (error) {
    if (/ENOENT/.test(error.message)) { t.skip('FFmpeg/ffprobe indisponiveis.'); return false; }
    throw error;
  }
}

test('monta o video do slideshow com fotos de tamanhos diferentes e a musica', async t => {
  if (!await ffmpegAvailable(t)) return;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ajeita-slideshow-test-'));
  try {
    const assets = path.join(dir, 'assets');
    await fs.mkdir(assets);
    const portrait = path.join(assets, 'retrato.jpg');
    const landscape = path.join(assets, 'paisagem.jpg');
    const audio = path.join(assets, 'musica.mp3');
    await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=c=red:s=64x96', '-frames:v', '1', portrait]);
    await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=c=blue:s=96x64', '-frames:v', '1', landscape]);
    await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '8', '-c:a', 'libmp3lame', audio]);
    const files = new Map([
      ['https://p16-common-sign.tiktokcdn.com/1.jpeg', await fs.readFile(portrait)],
      ['https://p16-common-sign.tiktokcdn.com/2.jpeg', await fs.readFile(landscape)],
      ['https://v16m.tiktokcdn.com/musica/', await fs.readFile(audio)]
    ]);
    const requested = [];
    const fetchImpl = async (url, options) => {
      requested.push({ url: String(url), referer: options?.headers?.Referer });
      const body = files.get(String(url));
      return body ? new Response(body, { status: 200 }) : new Response('', { status: 404 });
    };
    // Substitui so a chamada ao helper Python; o FFmpeg e executado de verdade.
    const fakeRunProcess = async (command, args, options) => {
      if (command !== 'fake-python') return runProcess(command, args, options);
      assert.match(args[1], /\/@maria\/photo\/1$/);
      await fs.writeFile(args[2], JSON.stringify({
        id: '1', description: '',
        images: [
          // O primeiro endereco falha: o seguinte deve ser usado.
          { urls: ['https://p16-common-sign.tiktokcdn.com/falha.jpeg', 'https://p16-common-sign.tiktokcdn.com/1.jpeg'], width: 64, height: 96 },
          { urls: ['https://p16-common-sign.tiktokcdn.com/2.jpeg'], width: 96, height: 64 }
        ],
        audio: { url: 'https://v16m.tiktokcdn.com/musica/', duration: 8, title: 'som original' }
      }));
    };
    const work = path.join(dir, 'work');
    await fs.mkdir(work);
    const output = await downloadTikTokSlideshow('https://www.tiktok.com/@maria/photo/1', work, {
      pythonBin: 'fake-python', runProcess: fakeRunProcess, fetchImpl, helperScript: 'helper.py', timeoutMs: 60000
    });
    assert.equal(path.basename(output), 'video.mp4');
    assert.ok(requested.every(item => item.referer === 'https://www.tiktok.com/'));
    assert.equal(requested.filter(item => item.url.endsWith('/falha.jpeg')).length, 1);

    const probe = JSON.parse(await runProcess('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output]));
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    const sound = probe.streams.find(stream => stream.codec_type === 'audio');
    assert.equal(video.codec_name, 'h264');
    assert.equal(video.pix_fmt, 'yuv420p', 'faixa de cor padrao: o WhatsApp nao exige reconverter');
    assert.equal(video.width, 720);
    assert.equal(video.height, 1280);
    assert.equal(sound.codec_name, 'aac');
    assert.ok(Math.abs(Number(probe.format.duration) - 8) < 0.5, 'dura o mesmo que a musica: ' + probe.format.duration);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('post sem fotos vira NOT_SLIDESHOW e midia fora da lista permitida e ignorada', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ajeita-slideshow-test-'));
  try {
    const noPhotos = async () => { throw new Error('ERROR: o post nao tem fotos'); };
    await assert.rejects(
      downloadTikTokSlideshow('https://www.tiktok.com/@maria/video/1', dir, { pythonBin: 'p', runProcess: noPhotos, helperScript: 'h.py' }),
      error => error.code === 'NOT_SLIDESHOW');

    const offList = async (command, args) => {
      await fs.writeFile(args[2], JSON.stringify({ images: [{ urls: ['https://example.com/a.jpg'] }], audio: null }));
    };
    await assert.rejects(
      downloadTikTokSlideshow('https://www.tiktok.com/@maria/video/1', dir, {
        pythonBin: 'p', runProcess: offList, helperScript: 'h.py',
        fetchImpl: async () => { throw new Error('nao deveria buscar'); }
      }),
      /Nao consegui baixar a midia/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
