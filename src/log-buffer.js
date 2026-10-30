'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { format } = require('node:util');

const MAX_ENTRIES = 2000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const dir = path.resolve(process.env.HISTORY_DIR || 'data');
const logFile = path.join(dir, 'ajeita-log.jsonl');
const requestsFile = path.join(dir, 'requests.json');
const entries = [];
let nextId = 1;
let writes = 0;

function persist(entry) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    if (++writes % 200 === 0 && fs.statSync(logFile).size > MAX_FILE_BYTES) fs.renameSync(logFile, logFile + '.old');
  } catch {}
}

function restore() {
  try {
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).slice(-MAX_ENTRIES);
    for (const line of lines) {
      try { entries.push({ ...JSON.parse(line), id: nextId++ }); } catch {}
    }
  } catch {}
}

function stamp(date) {
  const pad = n => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
    pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

function installLogBuffer() {
  restore();
  const original = {};
  for (const [method, level] of [['log', 'info'], ['warn', 'warn'], ['error', 'error']]) {
    original[method] = console[method].bind(console);
    console[method] = (...args) => {
      const now = new Date();
      const text = format(...args);
      const entry = { time: now.toISOString(), level, text };
      entries.push({ id: nextId++, ...entry });
      if (entries.length > MAX_ENTRIES) entries.shift();
      persist(entry);
      original[method]('[' + stamp(now) + '] ' + (level === 'info' ? '' : level.toUpperCase() + ' ') + text);
    };
  }
}

function getLogs({ after = 0, level } = {}) {
  const rank = { info: 0, warn: 1, error: 2 };
  const min = rank[level] ?? 0;
  return entries.filter(e => e.id > after && rank[e.level] >= min);
}

function loadRequests() {
  try {
    const list = JSON.parse(fs.readFileSync(requestsFile, 'utf8'));
    return Array.isArray(list) ? list.slice(0, 50) : [];
  } catch { return []; }
}

let saveTimer;
function saveRequests(list) {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(requestsFile, JSON.stringify(list));
    } catch {}
  }, 1000);
  saveTimer.unref?.();
}

module.exports = { installLogBuffer, getLogs, loadRequests, saveRequests };
