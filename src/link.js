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
  return extractVideoLinks(body)[0] || null;
}

function extractVideoLinks(body) {
  if (typeof body !== 'string') return [];
  const matches = body.match(/https?:\/\/[^\s<>"'\x60]+/gi) || [];
  const links = [];
  for (const match of matches) {
    const url = normalizeLink(match);
    if (url && !links.includes(url)) links.push(url);
  }
  return links;
}

function getSerializedMessageId(message) {
  const id = message?.id || message?._data?.id;
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id._serialized === 'string' && id._serialized) return id._serialized;
  // O WhatsApp Web atual renomeou internamente `_serialized` para `$1`.
  if (typeof id.$1 === 'string' && id.$1) return id.$1;
  const text = typeof id.toString === 'function' ? id.toString() : '';
  return text && text !== '[object Object]' ? text : null;
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
  const items = await findLinksForCommand(command, chat, { maxAgeHours, now });
  return items.length ? items[items.length - 1].link : null;
}

async function findLinksForCommand(command, chat, { maxAgeHours = 72, now = Date.now(), maxLinks = 5 } = {}) {
  if (command.hasQuotedMsg && typeof command.getQuotedMessage === 'function') {
    try {
      const quoted = await command.getQuotedMessage();
      const links = extractVideoLinks(quoted?.body || quoted?.caption);
      if (links.length) return links.slice(0, maxLinks).map(link => ({link, messageId: getSerializedMessageId(quoted)}));
    } catch (error) {
      console.warn('Nao foi possivel ler mensagem respondida:', error.message);
    }
  }
  const directLinks = extractVideoLinks(command.body);
  if (directLinks.length) return directLinks.slice(0, maxLinks).map(link => ({link, messageId: getSerializedMessageId(command)}));

  if (!chat?.fetchMessages) return [];

  const messages = await chat.fetchMessages({ limit: 80 });
  const commandId = command.id?._serialized;
  const index = messages.findIndex(msg => msg.id?._serialized === commandId);
  const before = index >= 0
    ? messages.slice(0, index)
    : messages.filter(msg => Number(msg.timestamp) <= Number(command.timestamp));
  const cutoffSeconds = now / 1000 - maxAgeHours * 3600;
  const found = [];
  for (let i = before.length - 1; i >= 0 && found.length < maxLinks; i--) {
    const msg = before[i];
    if (Number(msg.timestamp) < cutoffSeconds) break;
    const links = extractVideoLinks(msg.body || msg.caption);
    // O lote e formado somente pelos links consecutivos logo antes do comando.
    if (!links.length) break;
    for (let j = links.length - 1; j >= 0 && found.length < maxLinks; j--) {
      found.unshift({link: links[j], messageId: getSerializedMessageId(msg)});
    }
  }
  const unique = [];
  const seen = new Set();
  for (const item of found) {
    if (!seen.has(item.link)) { seen.add(item.link); unique.push(item); }
  }
  return unique;
}

module.exports = { isAllowedHost, normalizeLink, extractVideoLink, extractVideoLinks, getSerializedMessageId, isAjeita, findLinkForCommand, findLinksForCommand };
