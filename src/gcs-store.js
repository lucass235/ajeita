'use strict';

// RemoteAuth do whatsapp-web.js guarda um ZIP no GCS; o Chromium usa /tmp local.
// Nunca monte um bucket como diretorio de perfil do Chromium.
const path = require('node:path');
const fs = require('node:fs/promises');
const { Storage } = require('@google-cloud/storage');

class GcsSessionStore {
  constructor(bucketName, authPath, storage = new Storage()) {
    if (!/^[a-z0-9][a-z0-9._-]{2,222}$/i.test(bucketName || '')) {
      throw new Error('GCS_AUTH_BUCKET nao configurado ou invalido.');
    }
    this.bucket = storage.bucket(bucketName);
    this.authPath = path.resolve(authPath || '/tmp/ajeita-auth');
  }
  file(session) {
    if (!/^RemoteAuth(?:-[\w-]+)?$/.test(session)) throw new Error('Nome de sessao invalido.');
    return this.bucket.file('sessions/' + session + '.zip');
  }
  async sessionExists({ session }) {
    const [exists] = await this.file(session).exists();
    return exists;
  }
  async save({ session }) {
    const file = this.file(session);
    await this.bucket.upload(path.join(this.authPath, session + '.zip'), {
      destination: file.name,
      resumable: false,
      metadata: { cacheControl: 'no-store' }
    });
  }
  async extract({ session, path: destination }) {
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await this.file(session).download({ destination });
    await fs.chmod(destination, 0o600);
  }
  async delete({ session }) {
    await this.file(session).delete({ ignoreNotFound: true });
  }
}

module.exports = { GcsSessionStore };

