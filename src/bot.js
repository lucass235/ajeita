'use strict';

require('dotenv').config();
const { installLogBuffer, getLogs, loadRequests, saveRequests } = require('./log-buffer');
const { notify } = require('./notify');
installLogBuffer();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { ReliableRemoteAuth } = require('./remote-auth');
const { GcsSessionStore } = require('./gcs-store');
const qrcode = require('qrcode-terminal');
const { isAjeita, extractVideoLink, findLinkForCommand } = require('./link');
const { downloadVideo } = require('./downloader');
const { createStatusServer } = require('./status');
const { prepareRuntimeAuth } = require('./runtime-auth');
const { createBrowserHealthMonitor } = require('./browser-health');
const ERROR_FEEDBACK = 'eita deu alguma bronca aqui nesse video, nao conseguir baixar';

function boolSetting(name, fallback) {
  const value = process.env[name];
  return value === undefined ? fallback : /^(true|1|yes)$/i.test(value);
}
function numSetting(name, fallback, min, max) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}
const settings = {
  allowOtherPeople: boolSetting('ALLOW_OTHER_PEOPLE', true),
  allowGroups: boolSetting('ALLOW_GROUPS', false),
  sendProgress: boolSetting('SEND_PROGRESS', true),
  requestDelaySeconds: numSetting('REQUEST_DELAY_SECONDS', 10, 0, 300),
  chromeNoSandbox: boolSetting('CHROME_NO_SANDBOX', false),
  maxFileMB: numSetting('MAX_FILE_MB', 45, 1, 100),
  maxDurationSeconds: numSetting('MAX_DURATION_SECONDS', 1200, 30, 7200),
  timeoutSeconds: numSetting('DOWNLOAD_TIMEOUT_SECONDS', 180, 30, 900),
  maxQueue: numSetting('MAX_QUEUE', 5, 1, 30),
  chatCooldownSeconds: numSetting('CHAT_COOLDOWN_SECONDS', 30, 0, 3600),
  maxLinkAgeHours: numSetting('MAX_LINK_AGE_HOURS', 72, 1, 24 * 30),
  pythonBin: process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3'),
  tiktokCookiesFile: process.env.TIKTOK_COOKIES_FILE
};
const authPath = process.env.AUTH_DATA_PATH || (process.env.GCS_AUTH_BUCKET ? '/tmp/ajeita-auth' : undefined);
const authStrategy = process.env.GCS_AUTH_BUCKET
  ? new ReliableRemoteAuth({
      clientId: 'ajeita',
      dataPath: authPath,
      backupSyncIntervalMs: 60000,
      store: new GcsSessionStore(process.env.GCS_AUTH_BUCKET, authPath)
    })
  : new LocalAuth({
      clientId: 'ajeita',
      ...(authPath ? { dataPath: authPath } : {})
    });
const client = new Client({
  authStrategy,
  puppeteer: {
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: [...(settings.chromeNoSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []), '--disable-dev-shm-usage', '--disable-gpu', '--renderer-process-limit=2', '--disk-cache-size=67108864']
  }
});

function installWhatsAppWebCompatibilityShim() {
  if (!client.pupPage) return;
  void client.pupPage.evaluate(() => {
    // O WhatsApp Web renomeou `_serialized` para `$1` em MsgKey. A versão
    // oficial atual do whatsapp-web.js ainda lê o nome anterior ao montar ou
    // enviar mensagens, o que produz os erros minificados `r: r` e `t: t`.
    const proto = window.require('WAWebMsgKey')?.prototype;
    if (proto && !Object.getOwnPropertyDescriptor(proto, '_serialized')) {
      Object.defineProperty(proto, '_serialized', {
        get() { return this.$1 || (typeof this.toString === 'function' ? this.toString() : undefined); },
        set(value) {
          Object.defineProperty(this, '_serialized', {
            value, writable: true, enumerable: true, configurable: true
          });
        },
        configurable: true
      });
      return true;
    }
    return Boolean(proto);
  }).then(applied => console.log(applied
    ? 'Compatibilidade do WhatsApp Web aplicada.'
    : 'Compatibilidade do WhatsApp Web indisponivel nesta sessao.'))
    .catch(error => console.warn('Nao foi possivel aplicar compatibilidade do WhatsApp Web:', error.message));
}

const session = { phase: 'starting', qr: null };
const recentRequests = loadRequests();
for (const r of recentRequests) {
  if (r.status === 'na fila' || r.status === 'processando') {
    r.status = 'erro';
    r.detail = 'Interrompido por reinicio do bot';
  }
}
let requestSeq = recentRequests.reduce((max, r) => Math.max(max, r.id || 0), 0);
const persistRequests = () => saveRequests(recentRequests);
function addRequest(info) {
  const request = { id: ++requestSeq, time: new Date().toISOString(), ...info };
  recentRequests.unshift(request);
  if (recentRequests.length > 50) recentRequests.pop();
  persistRequests();
  return request;
}
let consecutiveFailures = 0;
async function describeSender(message) {
  if (message.fromMe) return { name: 'Eu (conta do bot)', number: '' };
  try {
    const contact = await withTimeout(message.getContact(), 3000, 'contato indisponivel');
    return { name: contact.name || contact.pushname || message._data?.notifyName || '', number: contact.number || '' };
  } catch {
    return { name: message._data?.notifyName || '', number: String(message.author || message.from || '').split('@')[0] };
  }
}
async function getDiagnostics() {
  const result = {
    phase:session.phase,
    browserConnected:Boolean(client.pupBrowser?.isConnected()),
    pageClosed:client.pupPage ? client.pupPage.isClosed() : true,
    receivedMessages:session.receivedMessages || 0,
    receivedCommands:session.receivedCommands || 0,
    lastMessageAt:session.lastMessageAt || null,
    working, queued:queue.length,
    requests: recentRequests,
    settings: {
      allowGroups: settings.allowGroups, allowOtherPeople: settings.allowOtherPeople,
      cooldownSeconds: settings.chatCooldownSeconds, maxQueue: settings.maxQueue, maxFileMB: settings.maxFileMB
    }
  };
  if (!result.browserConnected || result.pageClosed) return result;
  let timeout;
  try {
    result.web = await Promise.race([
      client.pupPage.evaluate(() => {
        return {
          state:window.AuthStore?.AppState?.state,
          hasSynced:Boolean(window.AuthStore?.AppState?.hasSynced),
          messageBridge:typeof window.onAddMessageEvent === 'function',
          version:window.Debug?.VERSION || null
        };
      }),
      new Promise((_,reject) => {timeout=setTimeout(()=>reject(new Error('timeout')),5000);})
    ]);
  } catch (error) {result.browserProbeError=error.name;}
  finally {clearTimeout(timeout);}
  return result;
}
if (process.env.K_SERVICE && (process.env.ADMIN_TOKEN || '').length < 32) {
  throw new Error('Cloud Run exige ADMIN_TOKEN com pelo menos 32 caracteres.');
}
const port = Number(process.env.PORT || 0);
const httpServer = port > 0 ? createStatusServer({
  port,
  adminToken: process.env.ADMIN_TOKEN || '',
  getStatus: () => session,
  getDiagnostics,
  getLogs
}) : null;

client.on('qr', qr => {
  session.phase = 'pairing';
  session.qr = qr;
  if (port > 0 && process.env.ADMIN_TOKEN) {
    console.log('QR disponivel no painel privado /pair. Nunca compartilhe credenciais.');
  } else {
    console.log('Abra WhatsApp - Aparelhos conectados - Conectar aparelho.');
    qrcode.generate(qr, { small: true });
  }
});
client.on('remote_session_saved', () => {
  session.backupError = false;
  session.backupSavedAt = new Date().toISOString();
  console.log('Backup de sessao salvo no Cloud Storage.');
});
client.on('ajeita_backup_error', () => {
  session.backupError = true;
  console.error('Backup da sessao falhou; nova tentativa no proximo intervalo.');
});
client.on('authenticated', () => {
  session.phase = 'authenticated';
  session.qr = null;
  console.log('Sessao autenticada.');
});
let browserMonitor;
client.on('ready', () => {
  session.phase = 'ready';
  session.qr = null;
  installWhatsAppWebCompatibilityShim();
  if (client.pupPage && !browserMonitor) {
    browserMonitor=createBrowserHealthMonitor({
      client,
      isEnabled:()=>!shuttingDown && session.phase==='ready',
      onUnhealthy:()=>{
        session.phase='browser_error';
        console.error('Reiniciando AJEITA para recuperar o navegador do WhatsApp.');
        notify('AJEITA reiniciando', 'O navegador do WhatsApp travou e foi reiniciado.', 'browser');
        setTimeout(()=>process.exit(1),500);
      }
    });
  }
  console.log('AJEITA pronto! Envie link e escreva "ajeita" no mesmo chat.');
});
client.on('auth_failure', reason => {
  session.phase = 'auth_failure';
  session.qr = null;
  console.error('Falha de autenticacao:', reason);
  notify('AJEITA precisa de atencao', 'Falha de login no WhatsApp. Pareie de novo pelo painel.', 'auth');
});
client.on('disconnected', reason => {
  session.phase = 'disconnected';
  session.qr = null;
  console.warn('WhatsApp desconectado:', reason);
  notify('AJEITA desconectado', 'O WhatsApp desconectou (' + reason + '). O bot vai reiniciar.', 'disconnected');
  setTimeout(() => process.exit(1), 1000);
});

const seenIds = new Set();
const lastChatRequest = new Map();
const lastVideoLinkByChat = new Map();
const queue = [];
let working = false;
let resolving = 0;

// Serializa todos os envios, inclusive avisos e erros de pedidos concorrentes.
let outgoing = Promise.resolve();
function pacedSend(chatId, body, options, timeoutMs, timeoutMessage) {
  const task = outgoing.then(async () => {
    if (shuttingDown) return;
    try {
      return await withTimeout(client.sendMessage(chatId, body, options), timeoutMs, timeoutMessage);
    } finally {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  });
  outgoing = task.catch(() => {});
  return task;
}

async function safeText(chatId, body) {
  try { await pacedSend(chatId, body, { linkPreview: false, sendSeen:false, waitUntilMsgSent:true },10000,'Envio de texto sem resposta'); }
  catch (err) { console.error('Falha enviando mensagem:', err.message); }
}

async function withTimeout(promise, milliseconds, message) {
  let timeout;
  try {
    return await Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error(message)),milliseconds);})]);
  } finally {clearTimeout(timeout);}
}

async function sendErrorFeedback(chatId) {
  await new Promise(resolve => setTimeout(resolve, 5000));
  if (!shuttingDown) await safeText(chatId, ERROR_FEEDBACK);
}

async function getChatWhenAvailable(message, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await message.getChat(); }
    catch (error) {
      lastError = error;
      // Logo apos o "ready", o WhatsApp Web pode ainda nao ter indexado o chat.
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 750));
    }
  }
  throw lastError;
}

async function processJob(job) {
  let result;
  let stage = 'download/conversao';
  const startedAt = Date.now();
  const host = new URL(job.link).hostname;
  job.request.status = 'processando';
  persistRequests();
  console.log('Processando pedido de ' + job.request.who + ' | ' + host + ' | ' + job.link);
  try {
    if (settings.requestDelaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, settings.requestDelaySeconds * 1000));
    }
    if (shuttingDown) return;
    if (settings.sendProgress) await safeText(job.chatId, 'perai');
    result = await downloadVideo(job.link, settings);
    console.log('Video preparado para WhatsApp: ' + Math.round(result.bytes / 1024) + ' KB | ' +
      result.parts.length + ' parte(s) | download+conversao em ' + ((Date.now() - startedAt) / 1000).toFixed(1) + 's');
    stage = 'envio ao WhatsApp';
    for (const [index, part] of result.parts.entries()) {
      if (shuttingDown) break;
      const media = MessageMedia.fromFilePath(part.filepath);
      const sent = await pacedSend(job.chatId, media, {
        ...(result.parts.length > 1 ? { caption: `Parte ${index + 1} \u{1F446}` } : {}),
        sendMediaAsDocument: part.bytes > 14 * 1024 * 1024,
        sendSeen: false,
        waitUntilMsgSent: true
      },90000,'Envio do video sem resposta do WhatsApp');
      if (!sent?.id) throw new Error('WhatsApp nao confirmou a criacao da mensagem.');
      console.log('Video enviado: ' + Math.round(part.bytes / 1024) + ' KB');
    }
    consecutiveFailures = 0;
    job.request.status = 'concluido';
    job.request.seconds = Math.round((Date.now() - startedAt) / 100) / 10;
    persistRequests();
    console.log('Pedido de ' + job.request.who + ' concluido em ' + job.request.seconds + 's | ' + host);
  } catch (error) {
    job.request.status = 'erro';
    job.request.seconds = Math.round((Date.now() - startedAt) / 100) / 10;
    job.request.detail = 'Falha em ' + stage + ': ' + String(error?.message || error).split('\n')[0].slice(0, 200);
    persistRequests();
    if (++consecutiveFailures === 3) {
      notify('AJEITA com problemas', '3 pedidos seguidos falharam. Veja o painel de logs.', 'falhas');
      const selfId = client.info?.wid?._serialized;
      if (selfId) await safeText(selfId, 'AJEITA: 3 pedidos seguidos falharam. Pode ser o yt-dlp desatualizado ou bloqueio da plataforma. Veja o painel de logs.');
    }
    console.error('Falha em ' + stage + ' apos ' + ((Date.now() - startedAt) / 1000).toFixed(1) + 's | ' + job.link + ':', error);
    await sendErrorFeedback(job.chatId);
  } finally {
    if (result) await result.cleanup().catch(err => console.warn('Limpeza falhou:', err.message));
  }
}

async function drainQueue() {
  if (working) return;
  working = true;
  try { while (queue.length) await processJob(queue.shift()); }
  finally { working = false; }
}

// message_create inclui mensagens da propria conta e de terceiros.
client.on('message_create', async message => {
  session.receivedMessages = (session.receivedMessages || 0) + 1;
  session.lastMessageAt = new Date().toISOString();
  if (shuttingDown || session.phase !== 'ready') return;
  // Em contas multi-dispositivo, `from`/`to` pode ser um LID do contato;
  // `id.remote` é o identificador da conversa que o WhatsApp Web espera.
  const eventChatId = message.id?.remote || (message.fromMe ? message.to : message.from);
  const eventLink = extractVideoLink(message.body || message.caption);
  if (eventChatId && eventLink) {
    lastVideoLinkByChat.set(eventChatId, { link: eventLink, receivedAt: Date.now() });
    if (lastVideoLinkByChat.size > 2000) lastVideoLinkByChat.delete(lastVideoLinkByChat.keys().next().value);
  }
  if (!isAjeita(message.body)) return;
  session.receivedCommands = (session.receivedCommands || 0) + 1;
  const messageId = message.id?._serialized;
  if (messageId && seenIds.has(messageId)) return;
  if (messageId) {
    seenIds.add(messageId);
    if (seenIds.size > 1000) seenIds.delete(seenIds.values().next().value);
  }
  const sender = await describeSender(message);
  const who = (sender.name || 'Sem nome') + (sender.number ? ' (+' + sender.number + ')' : '');
  const typed = String(message.body || '').trim().slice(0, 300);
  const chatKind = /@g\.us$/i.test(eventChatId || '') ? 'grupo' : 'individual';
  console.log('Comando de ' + who + ' [' + chatKind + ']: "' + typed + '"');
  const requestInfo = { who, name: sender.name, number: sender.number, typed, chatKind, fromMe: Boolean(message.fromMe) };
  const ignore = reason => {
    console.log('Comando de ' + who + ' ignorado: ' + reason);
    addRequest({ ...requestInfo, status: 'ignorado', detail: reason });
  };
  try {
    // O evento já traz o identificador do chat e não depende do cache interno
    // do WhatsApp Web, que pode estar indisponível numa mensagem recém-chegada.
    const chatId = eventChatId;
    if (!chatId || /@(broadcast|newsletter)\b/.test(chatId)) { ignore('chat de transmissao/canal'); return; }
    if (!settings.allowGroups && chatKind === 'grupo') { ignore('grupos desativados (ALLOW_GROUPS=false)'); return; }
    if (!settings.allowOtherPeople && !message.fromMe) { ignore('pedido de outra pessoa desativado (ALLOW_OTHER_PEOPLE=false)'); return; }
    const last = lastChatRequest.get(chatId) || 0;
    if (Date.now() - last < settings.chatCooldownSeconds * 1000) {
      ignore('cooldown de ' + settings.chatCooldownSeconds + 's nesse chat');
      return;
    }
    if (queue.length + resolving + Number(working) >= settings.maxQueue) {
      ignore('fila cheia');
      await sendErrorFeedback(chatId);
      return;
    }
    // Reservar capacidade e cooldown antes de consultar o historico assincrono.
    lastChatRequest.set(chatId, Date.now());
    if (lastChatRequest.size > 2000) lastChatRequest.delete(lastChatRequest.keys().next().value);
    resolving++;
    let link;
    try {
      // Uma resposta ao link ou "ajeita <link>" não precisa do histórico.
      link = await findLinkForCommand(message, null, { maxAgeHours: settings.maxLinkAgeHours });
      const cached = lastVideoLinkByChat.get(chatId);
      if (!link && cached && Date.now() - cached.receivedAt <= settings.maxLinkAgeHours * 3600 * 1000) {
        link = cached.link;
      }
      if (!link) {
        try {
          const chat = await getChatWhenAvailable(message);
          link = await findLinkForCommand(message, chat, { maxAgeHours: settings.maxLinkAgeHours });
        } catch (error) {
          console.warn('Historico do chat indisponivel; use "ajeita <link>" ou responda ao link:', error.message);
        }
      }
    } finally { resolving--; }
    if (shuttingDown) return;
    if (!link) {
      ignore('nenhum link recente encontrado');
      await sendErrorFeedback(chatId);
      return;
    }
    lastChatRequest.set(chatId, Date.now());
    const request = addRequest({ ...requestInfo, status: 'na fila', link, host: new URL(link).hostname });
    queue.push({ chatId, link, request });
    console.log('Pedido de ' + who + ' na fila | posicao ' + queue.length + ' | ' + request.host);
    void drainQueue();
  } catch (error) {
    console.error('Falha interpretando comando:', error);
    if (eventChatId) await sendErrorFeedback(eventChatId);
  }
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  browserMonitor?.stop();
  queue.length = 0;
  console.log('Encerrando AJEITA: ' + signal);
  const deadline = setTimeout(() => process.exit(0), 9000);
  deadline.unref();
  try { await client.destroy(); } catch {}
  if (httpServer) httpServer.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
console.log('Iniciando AJEITA...');
prepareRuntimeAuth().then(() => client.initialize()).catch(err => {
  session.phase = 'startup_error';
  console.error('Nao consegui iniciar WhatsApp Web:', err);
  notify('AJEITA nao iniciou', 'Nao consegui abrir o WhatsApp Web. Veja o painel de logs.', 'startup');
  setTimeout(() => process.exit(1), 1000).unref();
});

