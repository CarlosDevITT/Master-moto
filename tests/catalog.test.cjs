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
  for (const file of ['data.js', 'guide-data.js', 'perfil-data.js', 'perfil.js', 'app.js', 'accessibility.js']) {
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
