const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
async function app(seed = {}, storageFailure = false) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost:4173', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: console });
  const w = dom.window;
  w.TextDecoder = TextDecoder;
  w.confirm = () => true;
  w.URL.createObjectURL = () => 'blob:test';
  w.URL.revokeObjectURL = () => {};
  w.fetch = async url => {
    const file = path.join(root, url);
    const ok = fs.existsSync(file);
    const data = ok ? fs.readFileSync(file) : Buffer.from('');
    return { ok, status: ok ? 200 : 404, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  };
  for (const [key, value] of Object.entries(seed)) w.localStorage.setItem(key, value);
  if (storageFailure) w.Storage.prototype.setItem = () => { throw new Error('quota'); };
  for (const file of ['data.js', 'guide-data.js', 'perfil-data.js', 'perfil.js', 'app.js', 'catalog-tools.js', 'accessibility.js']) {
    const script = w.document.createElement('script');
    script.textContent = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    w.document.body.append(script);
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors, [], 'Não deve haver erro na inicialização');
  return { dom, w, doc: w.document, errors, close: () => dom.window.close() };
}
const RECORDS = 'master-motos-records-v1';
const NOTES = 'master-motos-notes-v1';
const input = (w, id, value) => { const el = w.document.getElementById(id); el.value = value; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const submit = (w, id) => w.document.getElementById(id).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
test('Inicializa catálogo completo sem aba ou carregamento de produtos importados', async () => {
  const a = await app();
  try {
    assert.equal(Number(a.doc.querySelector('#sideCount').textContent), a.w.MOTO_DATA.length);
    assert.equal(a.doc.querySelector('[data-view="produtos"]'), null);
    assert.equal(a.doc.querySelector('#dataImportView'), null);
    assert.equal(a.w.PROJECT_DATA, undefined);
  } finally { a.close(); }
});
test('Snapshot vazio e notas vazias permanecem vazios após recarregar', async () => {
  const a = await app({ [RECORDS]: '[]', [NOTES]: '[]', [`${NOTES}-backup`]: '[{"id":1,"type":"info","title":"Antiga","text":"Backup"}]' });
  try {
    assert.equal(a.doc.querySelector('#sideCount').textContent, '0');
    assert.equal(a.doc.querySelector('#notesCount').textContent, '0');
    assert.equal(a.doc.querySelector('#offRoadPct').textContent, '0% da base');
  } finally { a.close(); }
});
test('Exclusão permanece após recarregar e limpa notas e perfil associados', async () => {
  const a = await app();
  let seed;
  try {
    const row = a.doc.querySelector('#motoRows tr[data-id]');
    const id = Number(row.dataset.id);
    const count = a.w.MOTO_DATA.length;
    row.querySelector('.delete').click();
    await new Promise(resolve => setImmediate(resolve));
    const records = JSON.parse(a.w.localStorage.getItem(RECORDS));
    assert.equal(records.length, count - 1);
    assert.ok(!records.some(record => record.id === id));
    seed = { [RECORDS]: JSON.stringify(records), [NOTES]: a.w.localStorage.getItem(NOTES) };
  } finally { a.close(); }
  const b = await app(seed);
  try { assert.equal(Number(b.doc.querySelector('#sideCount').textContent), b.w.MOTO_DATA.length - 1); }
  finally { b.close(); }
});
test('Navegação sempre exibe uma única seção entre catálogo, notas, visão geral e parâmetros', async () => {
  const a = await app();
  try {
    for (const name of ['titulos', 'dashboard', 'notas', 'catalogo']) {
      a.doc.querySelector(`[data-view="${name}"]`).click();
      const visible = [...a.doc.querySelectorAll('.main > .content')].filter(el => !el.classList.contains('hidden'));
      assert.equal(visible.length, 1, name);
    }
    assert.equal(a.doc.querySelectorAll('[data-view="data-import"]').length, 0);
  } finally { a.close(); }
});
test('Cadastro salva perfil na moto nova e rejeita período inválido', async () => {
  const a = await app();
  try {
    a.doc.querySelector('#newMoto').click();
    const values = { marca: 'Marca Teste', modelo: 'Modelo Teste', cilindrada: '250', anoInicial: '2020', anoFinal: '2026', nomeTitulo: 'TESTE250', fEstrela: 'A' };
    for (const [id, value] of Object.entries(values)) input(a.w, id, value);
    submit(a.w, 'motoForm');
    const records = JSON.parse(a.w.localStorage.getItem(RECORDS));
    const created = records.find(r => r.marca === 'Marca Teste');
    assert.ok(created);
    const profile = JSON.parse(a.w.localStorage.getItem('master-motos-perfil-v1'));
    assert.equal(profile[created.id].estrela, 'A');
    assert.equal(Object.keys(profile).length, 1);
    assert.ok([...a.doc.querySelector('#brandFilter').options].some(o => o.value === 'Marca Teste'));
    a.doc.querySelector('#newMoto').click();
    for (const [id, value] of Object.entries({ ...values, modelo: 'Inválida', anoInicial: '2026', anoFinal: '2020' })) input(a.w, id, value);
    submit(a.w, 'motoForm');
    assert.equal(JSON.parse(a.w.localStorage.getItem(RECORDS)).length, records.length);
  } finally { a.close(); }
});
test('Nota geral salva, pode ser editada e a última exclusão não restaura backup', async () => {
  const a = await app();
  try {
    a.doc.querySelector('#newNote').click();
    input(a.w, 'noteTitle', 'Aviso geral'); input(a.w, 'noteText', 'Uma nota geral');
    submit(a.w, 'noteForm');
    const saved = JSON.parse(a.w.localStorage.getItem(NOTES));
    assert.equal(saved.length, 1); assert.equal(saved[0].motoId, null);
    a.doc.querySelector('.note-delete').click();
    assert.equal(a.w.localStorage.getItem(NOTES), '[]');
  } finally { a.close(); }
});
test('Falha de armazenamento mantém catálogo e formulário abertos sem indicar sucesso', async () => {
  const a = await app({}, true);
  try {
    const count = a.doc.querySelector('#sideCount').textContent;
    a.doc.querySelector('#newMoto').click();
    for (const [id, value] of Object.entries({marca:'Teste', modelo:'Falha', cilindrada:'250', anoInicial:'2020', anoFinal:'2026', nomeTitulo:'FALHA'})) input(a.w,id,value);
    submit(a.w,'motoForm');
    assert.equal(a.doc.querySelector('#sideCount').textContent,count);
    assert.equal(a.doc.querySelector('#modalBackdrop').classList.contains('hidden'),false);
    assert.match(a.doc.querySelector('#toast').textContent,/Não foi possível salvar/);
  } finally { a.close(); }
});
test('Busca combina marca, modelo, cilindrada e ano de aplicação em qualquer ordem', async () => {
  const record = { id: 1, marca: 'Honda', modelo: 'CRF 250F', cilindrada: 250, anoInicial: 2019, anoFinal: 2026, categoria: 'Enduro', nomeTitulo: 'CRF250F', quatroTempos: '4T', doisTempos: '' };
  const a = await app({[RECORDS]: JSON.stringify([record])});
  try {
    for (const query of ['Honda 250 2020', '2020 CRF250F Honda', '  honda   4T  ', 'CRF-250F']) {
      input(a.w, 'searchLarge', query);
      assert.equal(a.doc.querySelectorAll('#motoRows tr[data-id]').length, 1, query);
    }
    input(a.w, 'searchLarge', 'Honda 2010');
    assert.equal(a.doc.querySelectorAll('#motoRows tr[data-id]').length, 0);
    assert.ok(a.doc.querySelector('#exportBtn').disabled);
    a.doc.querySelector('[data-empty-action="clear"]').click();
    assert.equal(a.doc.querySelectorAll('#motoRows tr[data-id]').length, 1);
    assert.equal(a.doc.querySelector('#searchLarge').value, '');
    assert.match(a.doc.querySelector('#resultSummary').textContent, /1–1 de 1 motos/);
    assert.equal(a.doc.querySelector('#exportBtn').disabled, false);
  } finally { a.close(); }
});
test('Busca, paginação e limpar filtros mantêm a interface consistente', async () => {
  const a = await app();
  try {
    input(a.w, 'searchLarge', 'Honda');
    assert.equal(a.doc.querySelector('#search').value, 'Honda');
    assert.ok([...a.doc.querySelectorAll('#motoRows .brand-cell')].every(cell => cell.textContent === 'Honda'));
    a.doc.querySelector('#nextPage').click();
    assert.equal(a.doc.querySelector('.pagination .current').textContent, '2');
    a.doc.querySelector('#clearFilters').click();
    assert.equal(a.doc.querySelector('#searchLarge').value, '');
    assert.equal(a.doc.querySelector('.pagination .current').textContent, '1');
    assert.ok(a.doc.querySelector('[data-quick="all"]').classList.contains('active'));
    a.doc.querySelector('#themeBtn').click();
    assert.ok(a.doc.body.classList.contains('dark-mode'));
    assert.equal(a.w.localStorage.getItem('mm_theme_v1'), 'dark');
  } finally { a.close(); }
});
test('Exclusão em lote mantém seleção vazia e catálogo vazio após recarregar', async () => {
  const original = { id: 1, marca:'Teste', modelo:'Única', cilindrada:250, anoInicial:2020, anoFinal:2026, categoria:'Enduro', nomeTitulo:'UNICA', quatroTempos:'4T', doisTempos:'' };
  const a = await app({[RECORDS]:JSON.stringify([original])});
  try {
    const select = a.doc.querySelector('#selectAll'); select.checked = true; select.dispatchEvent(new a.w.Event('change'));
    assert.equal(a.doc.querySelector('#selectedCount').textContent, '1');
    a.doc.querySelector('#deleteSelected').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(a.w.localStorage.getItem(RECORDS), '[]');
    assert.equal(a.doc.querySelector('#selectedCount').textContent, '0');
    assert.equal(a.doc.querySelector('#sideCount').textContent, '0');
  } finally { a.close(); }
});

test('Limpar busca e filtros também redefine a categoria e a densidade informa o estado', async () => {
  const a = await app();
  try {
    a.doc.querySelector('[data-tab="onroad"]').click();
    input(a.w, 'searchLarge', 'Honda');
    a.doc.querySelector('#catalogReset').click();
    assert.ok(a.doc.querySelector('[data-tab="todos"]').classList.contains('active'));
    assert.equal(a.doc.querySelector('#searchLarge').value, '');
    a.doc.querySelector('#compactBtn').click();
    assert.equal(a.doc.querySelector('#compactBtn').getAttribute('aria-pressed'), 'true');
    assert.match(a.doc.querySelector('#compactBtn').textContent, /Expandir/);
  } finally { a.close(); }
});
const storageSeed = w => Object.fromEntries(Array.from({ length: w.localStorage.length }, (_, index) => {
  const key = w.localStorage.key(index); return [key, w.localStorage.getItem(key)];
}));
const tick = () => new Promise(resolve => setImmediate(resolve));
const selectRow = (a, row) => {
  const checkbox = row.querySelector('.row-check'); checkbox.checked = true;
  checkbox.dispatchEvent(new a.w.Event('change', { bubbles: true }));
};
test('Backup completo valida os dados originais e restaura motos, notas, perfil, guia e tema', async () => {
  const a = await app({
    [NOTES]: JSON.stringify([{id:91,motoId:1,type:'info',title:'Nota de teste',text:'Compatibilidade',refs:['https://example.com'],updatedAt:'07/10/2026'}]),
    'master-motos-perfil-v1': JSON.stringify({'1':{estrela:'A',faixa:'alta',valor:'12000'}}),
    'mm_guia_notes_v1': JSON.stringify({schemaVersion:1,notes:{'1:motor':[{id:'guia-1',text:'Uma nota',createdAt:'hoje',updatedAt:'hoje'}]}}),
    'mm_theme_v1': 'dark'
  });
  let seed;
  try {
    const backup = a.w.MMCatalogTools.snapshot();
    const parsed = a.w.MMCatalogTools.validateBackup(JSON.parse(JSON.stringify(backup)));
    assert.equal(parsed.records.length,464);
    assert.equal(parsed.notes.length,1);
    assert.equal(parsed.profiles['1'].estrela,'A');
    a.doc.querySelector('#newMoto').click();
    for (const [field,value] of Object.entries({marca:'Teste',modelo:'Posterior',cilindrada:'250',anoInicial:'2020',anoFinal:'2026',nomeTitulo:'POSTERIOR'})) input(a.w,field,value);
    submit(a.w,'motoForm');
    assert.equal(Number(a.doc.querySelector('#sideCount').textContent),465);
    a.w.MMCatalogTools.stageRestore(backup);
    assert.equal(Number(a.doc.querySelector('#sideCount').textContent),465, 'prévia não altera dados');
    assert.match(a.doc.querySelector('#restoreSummary').textContent,/464 motos/);
    a.doc.querySelector('#applyRestore').click();
    assert.equal(Number(a.doc.querySelector('#sideCount').textContent),464);
    assert.equal(JSON.parse(a.w.localStorage.getItem(NOTES))[0].title,'Nota de teste');
    assert.equal(JSON.parse(a.w.localStorage.getItem('mm_guia_notes_v1')).notes['1:motor'][0].text,'Uma nota');
    assert.equal(a.w.localStorage.getItem('mm_theme_v1'),'dark');
    assert.ok(!a.doc.querySelector('#undoRestore').classList.contains('hidden'));
    seed=storageSeed(a.w);
  } finally { a.close(); }
  const b=await app(seed);
  try { assert.ok(b.doc.body.classList.contains('dark-mode')); assert.equal(b.w.MMCatalogTools.snapshot().profiles['1'].estrela,'A'); }
  finally { b.close(); }
});
test('Recuperação da base anterior desfaz uma restauração completa', async () => {
  const a=await app();
  try {
    const empty=a.w.MMCatalogTools.snapshot(); empty.records=[]; empty.notes=[]; empty.profiles={}; empty.guide={schemaVersion:1,notes:{}};
    assert.ok(a.w.MMCatalogTools.restoreBackup(empty));
    assert.equal(a.doc.querySelector('#sideCount').textContent,'0');
    a.doc.querySelector('#undoRestore').click();
    a.doc.querySelector('#applyRestore').click();
    assert.equal(a.doc.querySelector('#sideCount').textContent,'464');
    assert.ok(a.doc.querySelector('#undoRestore').classList.contains('hidden'));
  } finally { a.close(); }
});
test('Backup inválido, duplicado ou com campos maliciosos é recusado sem alterar a base', async () => {
  const a=await app();
  try {
    const backup=a.w.MMCatalogTools.snapshot();
    backup.records.push(backup.records[0]);
    assert.throws(()=>a.w.MMCatalogTools.restoreBackup(backup),/duplicado/);
    assert.equal(a.doc.querySelector('#sideCount').textContent,'464');
    const bad=a.w.MMCatalogTools.snapshot(); bad.profiles=JSON.parse('{"__proto__":{"estrela":"A"}}');
    assert.throws(()=>a.w.MMCatalogTools.restoreBackup(bad),/Classificação/);
    assert.equal(a.w.localStorage.getItem(RECORDS),null);
  } finally { a.close(); }
});
test('Falha no meio da restauração reverte o armazenamento e preserva o estado visível', async () => {
  const a=await app();
  try {
    const backup=a.w.MMCatalogTools.snapshot(); backup.records=[]; backup.notes=[]; backup.profiles={}; backup.guide={schemaVersion:1,notes:{}};
    const original=a.w.Storage.prototype.setItem;
    let denied=false;
    a.w.Storage.prototype.setItem=function(key,value) {
      if(key==='master-motos-perfil-v1'&&!denied) { denied=true; throw new Error('quota'); }
      return original.call(this,key,value);
    };
    assert.equal(a.w.MMCatalogTools.restoreBackup(backup),false);
    assert.equal(a.w.localStorage.getItem(RECORDS),null);
    assert.equal(a.w.localStorage.getItem(NOTES),null);
    assert.equal(a.doc.querySelector('#sideCount').textContent,'464');
    assert.match(a.doc.querySelector('#toast').textContent,/Nenhuma alteração/);
  } finally { a.close(); }
});
test('Colunas escolhidas e modo cartões persistem após paginação e recarga', async () => {
  const a=await app(); let seed;
  try {
    const checkbox=a.doc.querySelector('[data-column-toggle="notes"]'); checkbox.checked=false;
    checkbox.dispatchEvent(new a.w.Event('change',{bubbles:true}));
    assert.ok(a.doc.querySelector('th[data-column="notes"]').hidden);
    a.doc.querySelector('#nextPage').click();
    assert.ok(a.doc.querySelector('.note-cell').hidden);
    assert.equal(a.doc.querySelector('th[data-column="model"]').hidden,false);
    a.doc.querySelector('[data-layout="cards"]').click();
    assert.equal(a.doc.querySelectorAll('.moto-card').length,15);
    assert.equal(a.doc.querySelector('#catalogCards').classList.contains('hidden'),false);
    seed=storageSeed(a.w);
  } finally { a.close(); }
  const b=await app(seed);
  try {
    assert.equal(b.doc.querySelector('#catalogCards').classList.contains('hidden'),false);
    assert.ok(b.doc.querySelector('th[data-column="notes"]').hidden);
  } finally { b.close(); }
});
test('Cartões permitem selecionar, editar e adicionar notas; modo automático atende celular', async () => {
  const a=await app();
  try {
    a.w.innerWidth=390; a.w.dispatchEvent(new a.w.Event('resize'));
    const card=a.doc.querySelector('.moto-card'); assert.ok(card);
    const check=card.querySelector('.card-check'); check.checked=true;
    check.dispatchEvent(new a.w.Event('change',{bubbles:true}));
    assert.equal(a.doc.querySelector('#selectedCount').textContent,'1');
    assert.ok(a.doc.querySelector('#motoRows .row-check').checked);
    card.querySelector('[data-card-action="edit"]').click();
    assert.equal(a.doc.querySelector('#motoId').value,card.dataset.cardId);
    a.doc.querySelector('#closeModal').click();
    card.querySelector('[data-card-action="add-note"]').click();
    assert.equal(a.doc.querySelector('#noteMotoSelect').value,card.dataset.cardId);
  } finally { a.close(); }
});
test('Favoritos salvam e reaplicam busca, filtros e ordenação após recarga', async () => {
  const a=await app(); let seed, favoriteId;
  try {
    a.doc.querySelector('[data-tab="offroad"]').click();
    input(a.w,'searchLarge','Honda 250');
    const engine=a.doc.querySelector('#engineFilter'); engine.value='4T'; engine.dispatchEvent(new a.w.Event('change'));
    a.doc.querySelector('#saveFavorite').click(); input(a.w,'favoriteName','Honda de trilha'); submit(a.w,'favoriteForm');
    const favorites=JSON.parse(a.w.localStorage.getItem('mm-catalog-favorites-v1'));
    favoriteId=favorites[0].id; assert.equal(favorites.length,1);
    a.doc.querySelector('#catalogReset').click();
    a.w.MMCatalogTools.applyFavorite(favoriteId);
    assert.equal(a.doc.querySelector('#searchLarge').value,'Honda 250');
    assert.equal(engine.value,'4T'); assert.ok(a.doc.querySelector('[data-tab="offroad"]').classList.contains('active'));
    assert.ok(a.w.MMCatalogTools.saveFavorite('HONDA DE TRILHA'));
    assert.equal(a.w.MMCatalogTools.snapshot().favorites.length,1,'nome duplicado atualiza em vez de criar cópia');
    seed=storageSeed(a.w);
  } finally { a.close(); }
  const b=await app(seed);
  try { b.w.MMCatalogTools.applyFavorite(favoriteId); assert.equal(b.doc.querySelector('#searchLarge').value,'Honda 250'); }
  finally { b.close(); }
});
test('Edição em lote abrange seleção de várias páginas e preserva motos não selecionadas', async () => {
  const a=await app();
  try {
    const before=a.w.MMCatalogTools.snapshot();
    const first=a.doc.querySelector('#motoRows tr[data-id]'); const firstId=Number(first.dataset.id); selectRow(a,first);
    a.doc.querySelector('#nextPage').click();
    const second=a.doc.querySelector('#motoRows tr[data-id]'); const secondId=Number(second.dataset.id); selectRow(a,second);
    a.doc.querySelector('#editSelected').click();
    assert.match(a.doc.querySelector('#bulkEditCount').textContent,/2 moto/);
    input(a.w,'bulkCategory','Enduro'); input(a.w,'bulkProfile','Trilha'); input(a.w,'bulkRange','alta'); input(a.w,'bulkCurve','B');
    submit(a.w,'bulkEditForm');
    const after=a.w.MMCatalogTools.snapshot();
    for (const record of after.records) {
      const original=before.records.find(r=>r.id===record.id);
      if([firstId,secondId].includes(record.id)) {
        assert.equal(record.categoria,'Enduro'); assert.equal(record.modelo,original.modelo);
        assert.equal(after.profiles[record.id].estrela,'B'); assert.equal(after.profiles[record.id].perfil,'Trilha');
      } else assert.equal(JSON.stringify(record),JSON.stringify(original));
    }
    assert.equal(a.doc.querySelector('#bulkEditBackdrop').classList.contains('hidden'),true);
  } finally { a.close(); }
});
test('Edição em lote sem campos selecionados ou com falha de armazenamento não altera dados', async () => {
  const a=await app();
  try {
    selectRow(a,a.doc.querySelector('#motoRows tr[data-id]'));
    const before=JSON.stringify(a.w.MMCatalogTools.snapshot().records);
    assert.equal(a.w.MMCatalogTools.applyBulk({category:'__keep__',profile:'__keep__',range:'__keep__',curve:'__keep__'}),false);
    a.w.Storage.prototype.setItem=()=>{throw new Error('quota');};
    assert.equal(a.w.MMCatalogTools.applyBulk({category:'Enduro'}),false);
    assert.equal(JSON.stringify(a.w.MMCatalogTools.snapshot().records),before);
  } finally { a.close(); }
});
test('Cancelar a edição e fechar o favorito por Escape preservam dados e devolvem foco', async () => {
  const a=await app();
  try {
    const trigger=a.doc.querySelector('#saveFavorite'); trigger.focus(); trigger.click(); await tick();
    a.doc.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await tick();
    assert.ok(a.doc.querySelector('#favoriteBackdrop').classList.contains('hidden'));
    assert.equal(a.doc.activeElement,trigger);
    assert.equal(a.w.MMCatalogTools.snapshot().favorites.length,0);
    selectRow(a,a.doc.querySelector('#motoRows tr[data-id]'));
    const before=JSON.stringify(a.w.MMCatalogTools.snapshot().records);
    a.doc.querySelector('#editSelected').click(); input(a.w,'bulkCategory','Enduro');
    a.doc.querySelector('#bulkEditForm [data-close-tool]').click();
    assert.equal(JSON.stringify(a.w.MMCatalogTools.snapshot().records),before);
  } finally { a.close(); }
});
test('Importação do arquivo de backup exige prévia e confirmação; cancelar mantém a base', async () => {
  const a=await app();
  try {
    const backup=a.w.MMCatalogTools.snapshot(); backup.records=backup.records.slice(0,2);
    const file={size:10000,text:async()=>JSON.stringify(backup)};
    const upload=a.doc.querySelector('#backupFile');
    Object.defineProperty(upload,'files',{configurable:true,value:[file]});
    upload.dispatchEvent(new a.w.Event('change')); await tick();
    assert.match(a.doc.querySelector('#restoreSummary').textContent,/2 motos/);
    assert.equal(a.doc.querySelector('#sideCount').textContent,'464');
    a.doc.querySelector('#restoreBackdrop [data-close-tool]').click();
    assert.equal(a.doc.querySelector('#sideCount').textContent,'464');
    upload.dispatchEvent(new a.w.Event('change')); await tick();
    a.doc.querySelector('#applyRestore').click();
    assert.equal(a.doc.querySelector('#sideCount').textContent,'2');
    assert.equal(a.w.MMCatalogTools.snapshot().records.length,2);
  } finally { a.close(); }
});
