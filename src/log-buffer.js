'use strict';

const { format } = require('node:util');

const MAX_ENTRIES = 2000;
const entries = [];
let nextId = 1;

function stamp(date) {
  const pad = n => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
    pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

function installLogBuffer() {
  const original = {};
  for (const [method, level] of [['log', 'info'], ['warn', 'warn'], ['error', 'error']]) {
    original[method] = console[method].bind(console);
    console[method] = (...args) => {
      const now = new Date();
      const text = format(...args);
      entries.push({ id: nextId++, time: now.toISOString(), level, text });
      if (entries.length > MAX_ENTRIES) entries.shift();
      original[method]('[' + stamp(now) + '] ' + (level === 'info' ? '' : level.toUpperCase() + ' ') + text);
    };
  }
}

function getLogs({ after = 0, level } = {}) {
  const rank = { info: 0, warn: 1, error: 2 };
  const min = rank[level] ?? 0;
  return entries.filter(e => e.id > after && rank[e.level] >= min);
}

module.exports = { installLogBuffer, getLogs };
