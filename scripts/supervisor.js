'use strict';

// Mantem o bot de pe: reinicia sempre que o processo sair, com espera crescente
// se ele cair repetidamente. Ctrl+C encerra tudo. Uso: npm run start:forever
const { spawn } = require('node:child_process');
const path = require('node:path');

const entry = path.join(__dirname, '..', 'src', 'bot.js');
let child;
let stopping = false;
let delay = 3000;

function log(text) { console.log('[supervisor ' + new Date().toLocaleTimeString('pt-BR') + '] ' + text); }

function start() {
  const startedAt = Date.now();
  child = spawn(process.execPath, [entry], {
    stdio: 'inherit',
    env: { ...process.env, AJEITA_SUPERVISED: '1' }
  });
  child.on('exit', (code, signal) => {
    if (stopping) process.exit(code ?? 0);
    // Rodou bem por mais de 1 minuto: zera a espera. Caso contrario, dobra (max 60s).
    delay = Date.now() - startedAt > 60000 ? 3000 : Math.min(delay * 2, 60000);
    log('bot saiu (codigo ' + (code ?? signal) + '). Reiniciando em ' + Math.round(delay / 1000) + 's...');
    setTimeout(start, delay);
  });
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  log('encerrando (' + signal + ')...');
  // No Windows o Ctrl+C ja chega ao filho; nos demais sistemas repassamos o sinal.
  if (process.platform !== 'win32') child?.kill(signal);
  setTimeout(() => { child?.kill(); process.exit(0); }, 12000).unref();
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

log('iniciando AJEITA com reinicio automatico');
start();
