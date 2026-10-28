'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { ReliableRemoteAuth: RemoteAuth } = require('../src/remote-auth');
const { GcsSessionStore } = require('../src/gcs-store');

test('RemoteAuth 1.34.7 salva e restaura ZIP pelo contrato GCS, sem WhatsApp real', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ajeita-contract-'));
  const objects = new Map();
  const bucket = {
    file: name => ({name, exists: async () => [objects.has(name)],
      download: async ({destination}) => fs.writeFile(destination, objects.get(name)),
      delete: async () => objects.delete(name)}),
    upload: async (file, {destination}) => objects.set(destination, await fs.readFile(file))
  };
  const storage = {bucket: () => bucket};
  const dataPath = path.join(root, 'first');
  const store = new GcsSessionStore('ajeita-tests', dataPath, storage);
  const auth = new RemoteAuth({clientId:'ajeita', dataPath, store, backupSyncIntervalMs:60000});
  auth.setup({options:{puppeteer:{}}});
  try {
    await auth.beforeBrowserInitialized();
    await fs.mkdir(path.join(auth.userDataDir, 'Default', 'IndexedDB'), {recursive:true});
    await fs.writeFile(path.join(auth.userDataDir, 'Default', 'IndexedDB', 'fixture'), 'session-test');
    await auth.storeRemoteSession();
    assert.equal(await store.sessionExists({session:'RemoteAuth-ajeita'}), true);
    const restoredPath = path.join(root, 'new-instance');
    const restoredStore = new GcsSessionStore('ajeita-tests', restoredPath, storage);
    const restored = new RemoteAuth({clientId:'ajeita', dataPath:restoredPath, store:restoredStore, backupSyncIntervalMs:60000});
    restored.setup({options:{puppeteer:{}}});
    await restored.beforeBrowserInitialized();
    assert.equal(await fs.readFile(path.join(restored.userDataDir, 'Default', 'IndexedDB', 'fixture'), 'utf8'), 'session-test');
    await restoredStore.delete({session:'RemoteAuth-ajeita'});
    assert.equal(await restoredStore.sessionExists({session:'RemoteAuth-ajeita'}), false);
  } finally { await fs.rm(root, {recursive:true, force:true}); }
});
