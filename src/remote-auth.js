'use strict';
const fs = require('node:fs/promises');
const { RemoteAuth } = require('whatsapp-web.js');
const unzipper = require('unzipper');

// Contrato fixado em whatsapp-web.js 1.34.7. A extracao deve terminar antes
// de Chromium abrir o perfil; o evento finish do stream pode ocorrer cedo.
class ReliableRemoteAuth extends RemoteAuth {
  async unCompressSession(zipPath) {
    const archive = await unzipper.Open.file(zipPath);
    await archive.extract({ path: this.userDataDir, concurrency: 1 });
    await fs.unlink(zipPath);
  }

  async storeRemoteSession(options) {
    if (this.pendingBackup) return this.pendingBackup;
    this.pendingBackup = super.storeRemoteSession(options).catch(() => {
      // O timer upstream nao trata rejeicoes. Preservar a copia remota anterior
      // e tentar novamente no proximo intervalo, sem expor dados da sessao.
      this.client.emit('ajeita_backup_error');
    }).finally(() => { this.pendingBackup = null; });
    return this.pendingBackup;
  }
}
module.exports = { ReliableRemoteAuth };
