const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function checkScripts(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())checkScripts(file);
    else if(entry.name.endsWith('.js'))new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
  }
}
checkScripts(path.join(root,'js'));
const boot=fs.readFileSync(path.join(root,'js/account.js'),'utf8');
const scripts=boot.match(/const scripts=\[([^\]]+)\]/)[1];
for(const [,file] of scripts.matchAll(/'([^']+)'/g)) {
  if(!fs.existsSync(path.join(root,'js',file)))throw Error(`Script da aplicação ausente: ${file}`);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:css|js|assets)\/[^"?]+)"/g)) {
  if (!fs.existsSync(path.join(root, match[1]))) throw new Error(`Recurso ausente: ${match[1]}`);
}
console.log('Sintaxe e recursos locais válidos.');
require('../js/market-engine.js').validate(JSON.parse(fs.readFileSync(path.join(root, 'Data', 'market-sales.json'), 'utf8')));
console.log('Fonte e totais do mercado válidos.');
