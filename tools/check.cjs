const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
for (const file of fs.readdirSync(path.join(root, 'js'))) {
  if (file.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(root, 'js', file), 'utf8'), { filename: file });
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:css|js)\/[^"?]+)"/g)) {
  if (!fs.existsSync(path.join(root, match[1]))) throw new Error(`Recurso ausente: ${match[1]}`);
}
console.log('Sintaxe e recursos locais válidos.');
require('../js/market-engine.js').validate(JSON.parse(fs.readFileSync(path.join(root, 'Data', 'market-sales.json'), 'utf8')));
console.log('Fonte e totais do mercado válidos.');
