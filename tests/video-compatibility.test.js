'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { runProcess, prepareWhatsAppVideo, prepareWhatsAppParts } = require('../src/downloader');

test('converte MP4 incompativel para H.264/AAC e preserva audio e video', async t => {
  try {
    await runProcess('ffmpeg', ['-version']);
    await runProcess('ffprobe', ['-version']);
  } catch (error) {
    if (/ENOENT/.test(error.message)) return t.skip('FFmpeg/ffprobe disponiveis no Docker.');
    throw error;
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ajeita-codec-test-'));
  try {
    const input = path.join(dir, 'input.mp4');
    await runProcess('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-f', 'lavfi', '-i', 'color=c=blue:s=64x96:r=10',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
      '-t', '0.5', '-c:v', 'libx265', '-x265-params', 'log-level=error:pools=1:frame-threads=1',
      '-c:a', 'libmp3lame', input
    ]);
    const output = await prepareWhatsAppVideo(input);
    assert.notEqual(output, input);
    const probe = JSON.parse(await runProcess('ffprobe', [
      '-v', 'error', '-show_streams', '-show_format', '-of', 'json', output
    ]));
    const video = probe.streams.find(s => s.codec_type === 'video');
    const audio = probe.streams.find(s => s.codec_type === 'audio');
    assert.equal(video.codec_name, 'h264');
    assert.equal(video.pix_fmt, 'yuv420p');
    assert.equal(audio.codec_name, 'aac');
    assert.equal(audio.profile, 'LC');
    assert.ok(Number(probe.format.duration) >= 0.5);
    assert.equal(await prepareWhatsAppVideo(output), output, 'arquivo compativel nao precisa reconverter');
    await assert.rejects(prepareWhatsAppVideo(output, {maxDurationSeconds: 0.1}), /duracao/);
  } finally {
    await fs.rm(dir, {recursive:true, force:true});
  }
});

test('divide 181 segundos em tres videos de ate 90 segundos', async t => {
  try {
    await runProcess('ffmpeg', ['-version']);
    await runProcess('ffprobe', ['-version']);
  } catch (error) {
    if (/ENOENT/.test(error.message)) return t.skip('FFmpeg/ffprobe indisponiveis.');
    throw error;
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ajeita-parts-test-'));
  try {
    const input = path.join(dir, 'input.mp4');
    await runProcess('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-f', 'lavfi', '-i', 'testsrc2=s=64x96:r=10',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
      '-t', '181', '-c:v', 'libx264', '-c:a', 'aac', input
    ]);
    const parts = await prepareWhatsAppParts(input);
    assert.equal(parts.length, 3);
    let total = 0;
    for (const part of parts) {
      const probe = JSON.parse(await runProcess('ffprobe', [
        '-v', 'error', '-show_streams', '-show_format', '-of', 'json', part.filepath
      ]));
      const duration = Number(probe.format.duration);
      assert.ok(duration > 0 && duration <= 90, `duracao: ${duration}`);
      assert.ok(probe.streams.some(s => s.codec_type === 'audio'));
      total += duration;
    }
    assert.ok(Math.abs(total - 181) < 0.1);
    const single = await prepareWhatsAppParts(parts[0].filepath);
    assert.equal(single.length, 1);
  } finally {
    await fs.rm(dir, {recursive:true, force:true});
  }
});
