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
  for (const file of ['data.js', 'guide-data.js', 'perfil-data.js', 'data-import.js', 'perfil.js', 'app.js', 'accessibility.js']) {
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
test('Inicializa catálogo completo e mantém categorias quando CSV de produtos está ausente', async () => {
  const a = await app();
  try {
    assert.equal(Number(a.doc.querySelector('#sideCount').textContent), a.w.MOTO_DATA.length);
    assert.equal(a.w.PROJECT_DATA.status, 'ready');
    assert.ok(a.w.PROJECT_DATA.categories.length > 0);
    assert.ok(a.w.PROJECT_DATA.categories.every(c => c.id));
    assert.ok(!JSON.stringify(a.w.PROJECT_DATA.categories).includes('\uFFFD'));
    assert.match(a.w.PROJECT_DATA.notice, /ausente/);
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
test('Navegação sempre exibe uma única seção, inclusive produtos e parâmetros', async () => {
  const a = await app();
  try {
    for (const name of ['produtos', 'titulos', 'dashboard', 'notas', 'catalogo']) {
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
test('CSV suporta UTF-8, Windows-1252, valores brasileiros e pesquisa de categorias', async () => {
  const a = await app();
  try {
    assert.equal(a.w.MMData.formatPrice('1.234,56'), 'R$\u00a01.234,56');
    assert.equal(a.w.MMData.formatPrice('1234.56'), 'R$\u00a01.234,56');
    assert.equal(a.w.MMData.formatPrice('0'), 'R$\u00a00,00');
    const csv = Buffer.from('\uFEFFCódigo;Descrição;Preço;Estoque;Situação;Categoria do produto\n001;"Peça; especial";"1.234,56";2;Ativo;ROLAMENTOS');
    await a.w.MMData.importProducts({arrayBuffer:async()=>csv.buffer.slice(csv.byteOffset,csv.byteOffset+csv.byteLength)});
    assert.equal(a.w.PROJECT_DATA.products[0].codigo,'001');
    assert.equal(a.w.PROJECT_DATA.products[0].descricao,'Peça; especial');
    a.doc.querySelector('[data-view="produtos"]').click();
    a.doc.querySelector('[data-data-tab="categories"]').click();
    input(a.w, 'dataSearch', 'INEXISTENTE');
    assert.match(a.doc.querySelector('#dataResultSummary').textContent, /^0 categorias/);
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
