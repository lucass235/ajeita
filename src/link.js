'use strict';

// Lista fechada de dominios permitidos: impede buscar URLs arbitrarias.
const ALLOWED_HOSTS = ['facebook.com', 'fb.watch', 'tiktok.com', 'instagram.com'];

function isAllowedHost(hostname) {
  const name = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return ALLOWED_HOSTS.some(domain => name === domain || name.endsWith('.' + domain));
}

function normalizeLink(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/[.,!?;:)>\]}]+$/g, '');
  try {
    const url = new URL(trimmed);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (!isAllowedHost(url.hostname)) return null;
    if (url.port && !['80', '443'].includes(url.port)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractVideoLink(body) {
  if (typeof body !== 'string') return null;
  const matches = body.match(/https?:\/\/[^\s<>"'\x60]+/gi) || [];
  for (const match of matches) {
    const url = normalizeLink(match);
    if (url) return url;
  }
  return null;
}

function isAjeita(body) {
  if (typeof body !== 'string') return false;
  const text = body
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (!text || text.length > 180) return false;

  // O link nao conta como parte da frase do comando.
  const withoutLinks = text.replace(/https?:\/\/\S+/g, ' ').trim();
  const words = withoutLinks.match(/[a-z]+/g) || [];
  if (words.length === 0 || words.length > 12) return false;

  // Inclui formas naturais e o erro comum com G, mas evita aproximacao generica
  // que poderia confundir palavras como "aceita" com um pedido de download.
  return words.some(word => /^(?:a[gj]eita+r?|a[gj]eite)$/.test(word));
}

async function findLinkForCommand(command, chat, { maxAgeHours = 72, now = Date.now() } = {}) {
  if (command.hasQuotedMsg && typeof command.getQuotedMessage === 'function') {
    try {
      const quoted = await command.getQuotedMessage();
      const link = extractVideoLink(quoted?.body || quoted?.caption);
      if (link) return link;
    } catch (error) {
      console.warn('Nao foi possivel ler mensagem respondida:', error.message);
    }
  }
  const directLink = extractVideoLink(command.body);
  if (directLink) return directLink;

  if (!chat?.fetchMessages) return null;

  const messages = await chat.fetchMessages({ limit: 80 });
  const commandId = command.id?._serialized;
  const index = messages.findIndex(msg => msg.id?._serialized === commandId);
  const before = index >= 0
    ? messages.slice(0, index)
    : messages.filter(msg => Number(msg.timestamp) <= Number(command.timestamp));
  const cutoffSeconds = now / 1000 - maxAgeHours * 3600;
  for (let i = before.length - 1; i >= 0; i--) {
    const msg = before[i];
    if (Number(msg.timestamp) < cutoffSeconds) continue;
    const link = extractVideoLink(msg.body || msg.caption);
    if (link) return link;
  }
  return null;
}

module.exports = { isAllowedHost, normalizeLink, extractVideoLink, isAjeita, findLinkForCommand };
