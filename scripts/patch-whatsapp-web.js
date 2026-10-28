'use strict';

const fs = require('node:fs');
const path = require('node:path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'whatsapp-web.js',
  'src',
  'util',
  'Injected',
  'Utils.js'
);

const anchor = `        // Bot's won't reply if canonicalUrl is set (linking)`;
const fix = `        // MediaData carries an internal __x_id field. If it is spread into
        // the outgoing message it replaces the real Msg id and media sending fails.
        if (message.__x_id) {
            delete message.__x_id;
        }

${anchor}`;

function patchSource(source) {
  if (source.includes('delete message.__x_id;')) return source;
  if (!source.includes(anchor)) {
    throw new Error('whatsapp-web.js mudou e o ponto da correcao nao foi encontrado.');
  }
  return source.replace(anchor, fix);
}

function applyPatch(filename = target) {
  const source = fs.readFileSync(filename, 'utf8');
  const patched = patchSource(source);
  if (patched !== source) {
    fs.writeFileSync(filename, patched, 'utf8');
    console.log('Correcao de envio de midia aplicada ao whatsapp-web.js.');
  }
}

if (require.main === module) applyPatch();

module.exports = { patchSource };
