'use strict';

const { spawn } = require('node:child_process');

const lastShown = new Map();

// Alerta remoto opcional: ALERT_WEBHOOK_URL (ntfy.sh, Discord, Slack ou qualquer endpoint JSON).
function sendWebhook(title, body) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || typeof fetch !== 'function') return;
  const isNtfy = /ntfy/i.test(url);
  const init = isNtfy
    ? { method: 'POST', headers: { Title: String(title).replace(/[^ -~]/g, ''), 'Content-Type': 'text/plain; charset=utf-8' }, body: String(body) }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, text: title + ': ' + body, content: title + ': ' + body }) };
  fetch(url, { ...init, signal: AbortSignal.timeout(5000) }).catch(() => {});
}

function notify(title, body, key = title) {
  const now = Date.now();
  if (now - (lastShown.get(key) || 0) < 10 * 60 * 1000) return;
  lastShown.set(key, now);
  sendWebhook(title, body);
  if (process.platform !== 'win32') return;
  const clean = text => String(text).replace(/[^\p{L}\p{N} .,:;()\-_/+]/gu, ' ').slice(0, 120);
  const script = [
    "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
    "$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
    "$n = $t.GetElementsByTagName('text')",
    "$n.Item(0).AppendChild($t.CreateTextNode('" + clean(title) + "')) | Out-Null",
    "$n.Item(1).AppendChild($t.CreateTextNode('" + clean(body) + "')) | Out-Null",
    "$toast = [Windows.UI.Notifications.ToastNotification]::new($t)",
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($toast)"
  ].join('\n');
  try {
    spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {}
}

module.exports = { notify };
