'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { patchSource } = require('../scripts/patch-whatsapp-web');

test('remove o id interno da midia antes de montar a mensagem', () => {
  const source = "        // Bot's won't reply if canonicalUrl is set (linking)";
  const patched = patchSource(source);

  assert.match(patched, /delete message\.__x_id;/);
  assert.match(patched, /Bot's won't reply/);
});

test('a correcao pode rodar mais de uma vez sem duplicar codigo', () => {
  const source = "        // Bot's won't reply if canonicalUrl is set (linking)";
  const once = patchSource(source);

  assert.equal(patchSource(once), once);
});
