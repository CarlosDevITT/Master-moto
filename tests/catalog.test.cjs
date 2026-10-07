const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
async function app(seed = {}, storageFailure = false, marketFailure = false) {
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
    if (marketFailure && url === 'Data/market-sales.json') throw new Error('offline');
    const file = path.join(root, url === 'Data/market-sales.json' ? 'tests/fixtures/market-september-2026.json' : url);
    const ok = fs.existsSync(file);
    const data = ok ? fs.readFileSync(file) : Buffer.from('');
    return { ok, status: ok ? 200 : 404, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  };
  for (const [key, value] of Object.entries(seed)) w.localStorage.setItem(key, value);
  if (storageFailure) w.Storage.prototype.setItem = () => { throw new Error('quota'); };
  for (const file of ['shared.js', 'data.js', 'guide-data.js', 'perfil-data.js', 'perfil.js', 'app.js', 'pricing-engine.js', 'pricing.js', 'market-engine.js', 'market.js', 'brands.js', 'catalog-tools.js', 'catalog-abc.js', 'accessibility.js']) {
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
const pricingInput = (a, selector, value) => { const el = a.doc.querySelector(selector); el.value = value; el.dispatchEvent(new a.w.Event('input', { bubbles: true })); return el; };

test('Conferir taxas vem antes dos produtos, abre por padrão e respeita painel salvo fechado', async () => {
  const a = await app(); let seed;
  try {
    const panel = a.doc.querySelector('.pricing-fee-check'), products = a.doc.querySelector('.pricing-section-title');
    assert.ok(panel.compareDocumentPosition(products) & a.w.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.equal(panel.open, true);
    panel.open = false; panel.dispatchEvent(new a.w.Event('toggle'));
    seed = {[a.w.MMPricing.storageKey]:a.w.localStorage.getItem(a.w.MMPricing.storageKey)};
  } finally { a.close(); }
  const b = await app(seed); try { assert.equal(b.doc.querySelector('.pricing-fee-check').open, false); } finally { b.close(); }
});

test('Estrelas classificam o catálogo, persistem e acompanham o backup', async () => {
  const a = await app(); let seed;
  try {
    const record = a.w.MOTO_DATA[0], id = record.id;
    input(a.w, 'searchLarge', 'Honda CRF50F');
    a.doc.querySelector(`[data-rating-moto="${id}"][data-rating-value="5"]`).click();
    assert.equal(a.w.MMPerfil.get(record).estrela, 'A');
    assert.equal(a.w.MMPerfil.rating(record), 5);
    assert.equal(a.w.MMCatalogTools.validateBackup(a.w.MMCatalogTools.snapshot()).profiles[id].rating, 5);
    a.doc.querySelector('[data-view="mercado"]').click();
    assert.equal(a.doc.querySelector('#abcSource').value, 'catalog');
    assert.equal(a.doc.querySelector('#nationalReference').classList.contains('hidden'), true);
    assert.equal(a.doc.querySelectorAll('#catalogAbcRows tr[data-abc-id]').length, 50);
    assert.match(a.doc.querySelector('#catalogAbcCount').textContent, /464/);
    a.doc.querySelector('[data-view="catalogo"]').click();
    for (const [stars, curve] of [[4,'A'],[3,'B'],[2,'C'],[1,'C']]) {
      a.doc.querySelector(`#motoRows [data-rating-moto="${id}"][data-rating-value="${stars}"]`).click();
      assert.equal(a.w.MMPerfil.catalogCurve(record), curve);
    }
    seed = storageSeed(a.w);
  } finally { a.close(); }
  const b = await app(seed); try {
    const record = b.w.MOTO_DATA[0]; assert.equal(b.w.MMPerfil.rating(record), 1); assert.equal(b.w.MMPerfil.catalogCurve(record), 'C');
    b.doc.querySelector(`[data-rating-moto="${record.id}"][data-rating-value="0"]`).click();
    assert.equal(b.w.MMPerfil.catalogCurve(record), '');
  } finally { b.close(); }
});

test('Avaliação recusada pelo armazenamento mantém estrelas anteriores', async () => {
  const a = await app();
  try {
    const record = a.w.MOTO_DATA[0]; assert.equal(a.w.MMPerfil.rate(record.id, 4), true);
    a.w.Storage.prototype.setItem = () => { throw Error('quota'); };
    assert.equal(a.w.MMPerfil.rate(record.id, 2), false);
    assert.equal(a.w.MMPerfil.rating(record), 4); assert.equal(a.w.MMPerfil.catalogCurve(record), 'A');
    const bad = a.w.MMCatalogTools.snapshot(); bad.profiles[record.id].rating = 6;
    assert.throws(() => a.w.MMCatalogTools.validateBackup(bad), /estrelas/);
  } finally { a.close(); }
});

test('Um produto incompleto não impede salvar os valores válidos dos outros', async () => {
  const a = await app();
  try {
    a.w.MMPricing.save();
    const products = [...a.doc.querySelectorAll('[data-pricing-category]')];
    pricingInput(a, `[data-pricing-category="${products[0].dataset.pricingCategory}"] [data-category-field="cost"]`, '');
    pricingInput(a, `[data-pricing-category="${products[1].dataset.pricingCategory}"] [data-category-field="cost"]`, '999');
    assert.equal(a.w.MMPricing.save(), false);
    const saved = JSON.parse(a.w.localStorage.getItem(a.w.MMPricing.storageKey));
    assert.equal(saved.categories[0].cost, 541.32);
    assert.equal(saved.categories[1].cost, 999);
    assert.equal(a.w.MMPricing.exportData().categories[1].cost, 999);
  } finally { a.close(); }
});

test('Falha ao gravar curva individual ou em lote preserva os perfis', async () => {
  const a = await app();
  try {
    const before = JSON.stringify(a.w.MMPerfil.exportData());
    a.w.Storage.prototype.setItem = () => { throw Error('quota'); };
    a.doc.querySelector('#motoRows .star-btn').click();
    assert.equal(JSON.stringify(a.w.MMPerfil.exportData()), before);
    selectRow(a, a.doc.querySelector('#motoRows tr[data-id]'));
    a.doc.querySelector('.bulk-star[data-star="B"]').click();
    assert.equal(JSON.stringify(a.w.MMPerfil.exportData()), before);
    assert.equal(a.w.localStorage.getItem('master-motos-perfil-v1'), null);
  } finally { a.close(); }
});

test('Família de mercado mostra todas as aplicações e mantém o filtro no favorito', async () => {
  const base = {marca:'Yamaha', cilindrada:250, categoria:'Adventure / Trail', anoInicial:2020, anoFinal:2026, quatroTempos:'4T', doisTempos:''};
  const a = await app({[RECORDS]:JSON.stringify([{...base,id:1,modelo:'Lander 250',nomeTitulo:'LANDER250'}, {...base,id:2,modelo:'XTZ 250',nomeTitulo:'XTZ250'}, {...base,id:3,modelo:'Outra',nomeTitulo:'OUTRA'}])});
  try {
    a.doc.querySelector('[data-market-model="YAMAHA/XTZ250"]').click();
    assert.equal(a.doc.querySelectorAll('#motoRows tr[data-id]').length, 2);
    assert.match(a.doc.querySelector('#filterSummary').textContent, /Família de mercado/);
    a.w.MMCatalogTools.saveFavorite('Lander');
    const favorite = a.w.MMCatalogTools.snapshot().favorites[0];
    a.doc.querySelector('#catalogReset').click();
    assert.equal(a.doc.querySelectorAll('#motoRows tr[data-id]').length, 3);
    a.w.MMCatalogTools.applyFavorite(favorite.id);
    assert.equal(a.doc.querySelectorAll('#motoRows tr[data-id]').length, 2);
  } finally { a.close(); }
});

test('Exportações neutralizam fórmulas em textos e preservam números e aspas', async () => {
  const a = await app();
  try {
    for (const value of ['=1+1', '+CMD', '@SUM(1)', '-CMD', '  =1+1', '\t=1', '＝1']) assert.equal(a.w.MMCsv.cell(value), '"\t' + value + '"');
    assert.equal(a.w.MMCsv.cell(-25), '"-25"');
    assert.equal(a.w.MMCsv.cell('Peça "A"; Honda'), '"Peça ""A""; Honda"');
  } finally { a.close(); }
});

test('Falha ao salvar nota de componente mantém o conteúdo salvo e o formulário', async () => {
  const a = await app();
  try {
    const record = a.w.MOTO_DATA[0];
    input(a.w, 'guideNoteMotoId', String(record.id)); input(a.w, 'guideNoteComponentId', 'engine'); input(a.w, 'guideNoteText', 'Primeira');
    submit(a.w, 'guideNoteForm');
    const before = JSON.stringify(a.w.MMCatalogTools.snapshot().guide);
    a.w.Storage.prototype.setItem = () => { throw Error('quota'); };
    input(a.w, 'guideNoteText', 'Segunda'); submit(a.w, 'guideNoteForm');
    assert.equal(JSON.stringify(a.w.MMCatalogTools.snapshot().guide), before);
    assert.equal(a.doc.querySelector('#guideNoteText').value, 'Segunda');
  } finally { a.close(); }
});

test('Ranking permite cadastrar modelo com ano revisado e mantém referência nacional separada', async () => {
  const a = await app();
  try {
    const before = a.w.MMCatalogTools.snapshot().records.length;
    a.doc.querySelector('[data-market-add="HONDA/CG160"]').click();
    assert.equal(a.doc.querySelector('#modelo').value, 'CG 160 Fan');
    assert.equal(a.doc.querySelector('#anoInicial').value, '2025');
    assert.equal(a.doc.querySelector('#anoFinal').value, '2025');
    assert.equal(a.doc.querySelector('#cilindrada').checkValidity(), true);
    assert.match(a.doc.querySelector('#marketRegistrationSource a').href, /saladeimprensa.honda.com.br/);
    submit(a.w, 'motoForm');
    const snapshot = a.w.MMCatalogTools.snapshot();
    assert.equal(snapshot.records.length, before + 1);
    const added = snapshot.records.find(record => record.modelo === 'CG 160 Fan');
    assert.equal(a.w.MMMarket.get(added).id, 'HONDA/CG160');
    assert.equal(a.w.MMPerfil.get(added).estrela, '');
    a.doc.querySelector('#newMoto').click();
    assert.equal(a.doc.querySelector('#marketRegistrationSource'), null);
  } finally { a.close(); }
});

test('Falha de perfil durante cadastro desfaz os registros e mantém o formulário editável', async () => {
  const a = await app();
  try {
    const stableSnapshot = () => { const snapshot = a.w.MMCatalogTools.snapshot(); delete snapshot.exportedAt; return JSON.stringify(snapshot); };
    const before = stableSnapshot();
    const original = a.w.Storage.prototype.setItem;
    let calls = 0;
    a.w.Storage.prototype.setItem = function(key, value) { if (++calls === 3) throw Error('quota'); return original.call(this, key, value); };
    a.doc.querySelector('#newMoto').click();
    for (const [id, value] of Object.entries({marca:'Teste',modelo:'Nova',cilindrada:'250',categoria:'Enduro',anoInicial:'2020',anoFinal:'2026',nomeTitulo:'NOVA',fEstrela:'B'})) input(a.w,id,value);
    submit(a.w, 'motoForm');
    assert.equal(stableSnapshot(), before);
    assert.equal(a.w.localStorage.getItem(RECORDS), null);
    assert.equal(a.doc.querySelector('#modalBackdrop').classList.contains('hidden'), false);
  } finally { a.close(); }
});

test('Importação de notas do guia com falha de armazenamento preserva a base anterior', async () => {
  const a = await app();
  try {
    a.doc.querySelector('[data-view="guia"]').click();
    const before = JSON.stringify(a.w.MMCatalogTools.snapshot().guide);
    a.w.FileReader = class { readAsText(file) { this.result = file.content; this.onload(); } };
    const upload = a.doc.querySelector('#guideImportFile');
    Object.defineProperty(upload, 'files', { value:[{content:JSON.stringify({schemaVersion:1,notes:{'1:engine':[{id:'n1',text:'Nova nota',createdAt:'hoje',updatedAt:'hoje'}]}})}] });
    a.w.Storage.prototype.setItem = () => { throw Error('quota'); };
    upload.dispatchEvent(new a.w.Event('change'));
    assert.equal(JSON.stringify(a.w.MMCatalogTools.snapshot().guide), before);
    assert.match(a.doc.querySelector('#toast').textContent, /Não foi possível salvar/);
  } finally { a.close(); }
});
test('Precificação tem somente custo, frete e taxa, recalcula e salva sem lucro desejado', async () => {
  const a = await app();
  try {
    const host = a.doc.querySelector('[data-pricing-category="example17"]');
    assert.equal(host.querySelectorAll('.pricing-quick-grid input').length, 3);
    assert.equal(host.querySelector('[data-quick-scenario="marginPct"]'), null);
    assert.equal(host.querySelector('.pricing-scenarios'), null);
    const before = host.querySelector('[data-result-price]').textContent;
    pricingInput(a, '[data-pricing-category="example17"] [data-quick-scenario="feePct"]', '20');
    assert.notEqual(host.querySelector('[data-result-price]').textContent, before);
    assert.equal(a.w.MMPricing.exportData().categories[0].scenarios[0].feePct, 20);
    pricingInput(a, '[data-pricing-category="example17"] [data-category-field="shipping"]', '');
    assert.equal(a.w.MMPricing.exportData().categories[0].shipping, 0);
    assert.notEqual(host.querySelector('[data-result-price]').textContent, '—');
  } finally { a.close(); }
});

test('Precificação guarda painéis abertos e produtos recolhidos após recarga e backup', async () => {
  const a = await app(); let seed;
  try {
    for (const key of ['settings', 'example17:breakdown-premium']) {
      const panel = a.doc.querySelector(`[data-pricing-panel="${key}"]`); panel.open = true; panel.dispatchEvent(new a.w.Event('toggle'));
    }
    a.doc.querySelector('[data-pricing-category="example17"] [data-pricing-action="collapse"]').click();
    const exported = a.w.MMCatalogTools.snapshot().pricing;
    assert.equal(exported.ui.settings, true); assert.equal(exported.categories[0].collapsed, true);
    seed = { [a.w.MMPricing.storageKey]: a.w.localStorage.getItem(a.w.MMPricing.storageKey) };
    a.doc.querySelector('[data-pricing-action="expand-all"]').click(); assert.equal(a.w.MMPricing.exportData().categories[0].collapsed, false);
    a.doc.querySelector('[data-pricing-action="collapse-all"]').click(); assert.ok(a.w.MMPricing.exportData().categories.every(c => c.collapsed));
  } finally { a.close(); }
  const b = await app(seed);
  try {
    assert.equal(b.doc.querySelector('[data-pricing-panel="settings"]').open, true);
    assert.equal(b.doc.querySelector('[data-pricing-panel="example17:breakdown-premium"]').open, true);
    assert.ok(b.doc.querySelector('[data-pricing-category="example17"] .pricing-category-body').classList.contains('hidden'));
    const panel = b.doc.querySelector('[data-pricing-panel="settings"]'); panel.open = false; panel.dispatchEvent(new b.w.Event('toggle'));
    assert.equal(JSON.parse(b.w.localStorage.getItem(b.w.MMPricing.storageKey)).ui.settings, false);
  } finally { b.close(); }
});
test('Recolher com um custo inválido preserva o último custo salvo e guarda a organização', async () => {
  const a = await app();
  try {
    a.w.MMPricing.save(); pricingInput(a, '[data-category-field="cost"]', '');
    a.doc.querySelector('[data-pricing-action="collapse"]').click();
    const saved = JSON.parse(a.w.localStorage.getItem(a.w.MMPricing.storageKey));
    assert.equal(saved.categories[0].cost, 541.32); assert.equal(saved.categories[0].collapsed, true);
    const panel = a.doc.querySelector('[data-pricing-panel="fees"]'); panel.open = true; panel.dispatchEvent(new a.w.Event('toggle'));
    assert.equal(JSON.parse(a.w.localStorage.getItem(a.w.MMPricing.storageKey)).ui.fees, true);
    assert.equal(a.w.MMPricing.save(), false);
  } finally { a.close(); }
});
test('Precificação navega, salva automaticamente valores brasileiros e recupera simulações após recarregar', async () => {
  const a = await app(); let seed;
  try {
    a.doc.querySelector('[data-view="precificacao"]').click();
    const visible = [...a.doc.querySelectorAll('.main > .content')].filter(el => !el.classList.contains('hidden'));
    assert.equal(visible.length, 1); assert.equal(visible[0].id, 'pricingView');
    pricingInput(a, '[data-pricing-category="example17"] [data-category-field="cost"]', '1.234,56');
    const rate = pricingInput(a, '[data-pricing-setting="commerce6Pct"]', '7,5');
    rate.dispatchEvent(new a.w.Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 420));
    const saved = JSON.parse(a.w.localStorage.getItem(a.w.MMPricing.storageKey));
    assert.equal(saved.categories[0].cost, 1234.56); assert.equal(saved.settings.commerce6Pct, 7.5);
    assert.match(a.doc.querySelector('#pricingSaveStatus').textContent, /salvas/);
    seed = { [a.w.MMPricing.storageKey]: JSON.stringify(saved) };
    a.doc.querySelector('[data-view="catalogo"]').click(); assert.ok(a.doc.querySelector('#pricingView').classList.contains('hidden'));
  } finally { a.close(); }
  const b = await app(seed);
  try { assert.equal(b.doc.querySelector('[data-category-field="cost"]').value, '1234,56'); assert.match(b.doc.querySelector('#pricingSaveStatus').textContent, /recuperadas/); }
  finally { b.close(); }
});
test('Precificação rejeita campo inválido e mostra taxas impossíveis sem substituir o último salvamento', async () => {
  const a = await app();
  try {
    a.w.MMPricing.save(); const previous = a.w.localStorage.getItem(a.w.MMPricing.storageKey);
    const cost = pricingInput(a, '[data-category-field="cost"]', '');
    assert.equal(cost.getAttribute('aria-invalid'), 'true'); assert.equal(a.w.MMPricing.save(), false);
    assert.equal(a.w.localStorage.getItem(a.w.MMPricing.storageKey), previous);
    assert.equal(a.doc.querySelector('[data-result-price]').textContent, '—');
    pricingInput(a, '[data-category-field="cost"]', '100');
    pricingInput(a, '[data-pricing-category="example17"] [data-quick-scenario="feePct"]', '71');
    assert.equal(a.doc.querySelector('[data-result-price]').textContent, '—');
    assert.match(a.doc.querySelector('[data-result-profit]').textContent, /100%/);
  } finally { a.close(); }
});
test('Backup completo inclui precificação e mantém compatibilidade com backups antigos', async () => {
  const a = await app();
  try {
    pricingInput(a, '[data-category-field="cost"]', '222,22'); a.w.MMPricing.save();
    const backup = a.w.MMCatalogTools.snapshot(); assert.equal(backup.pricing.categories[0].cost, 222.22);
    pricingInput(a, '[data-category-field="cost"]', '333');
    assert.equal(a.w.MMCatalogTools.restoreBackup(backup), true);
    assert.equal(a.w.MMPricing.exportData().categories[0].cost, 222.22);
    assert.equal(JSON.parse(a.w.localStorage.getItem(a.w.MMPricing.storageKey)).categories[0].cost, 222.22);
    delete backup.pricing; pricingInput(a, '[data-category-field="cost"]', '444'); a.w.MMPricing.save();
    assert.equal(a.w.MMCatalogTools.restoreBackup(backup), true); assert.equal(a.w.MMPricing.exportData().categories[0].cost, 444);
  } finally { a.close(); }
});
test('Simulações podem ser duplicadas, removidas e importadas com validação', async () => {
  const a = await app();
  try {
    a.doc.querySelector('[data-pricing-action="duplicate"]').click(); assert.equal(a.w.MMPricing.exportData().categories.length, 3);
    a.doc.querySelector('[data-pricing-action="remove-category"]').click(); assert.equal(a.w.MMPricing.exportData().categories.length, 2);
    assert.equal(a.doc.querySelectorAll('[data-pricing-category] .pricing-quick-grid input').length, 6);
    const file = a.doc.querySelector('#pricingFile');
    const imported = a.w.MMPricing.exportData(); imported.categories[0].cost = 99;
    Object.defineProperty(file, 'files', { configurable: true, value: [{ size: 100, text: async () => JSON.stringify({ format: 'master-motos-pricing', schemaVersion: 1, data: imported }) }] });
    file.dispatchEvent(new a.w.Event('change', { bubbles: true })); await new Promise(resolve => setImmediate(resolve));
    assert.equal(a.w.MMPricing.exportData().categories[0].cost, 99);
    Object.defineProperty(file, 'files', { configurable: true, value: [{ size: 1, text: async () => '{invalid' }] });
    file.dispatchEvent(new a.w.Event('change', { bubbles: true })); await new Promise(resolve => setImmediate(resolve));
    assert.equal(a.w.MMPricing.exportData().categories[0].cost, 99);
  } finally { a.close(); }
});
test('Falha ao salvar precificação informa o problema e preserva o armazenamento', async () => {
  const a = await app({}, true);
  try { pricingInput(a, '[data-category-field="cost"]', '999'); assert.equal(a.w.MMPricing.save(), false); assert.equal(a.w.localStorage.getItem(a.w.MMPricing.storageKey), null); assert.match(a.doc.querySelector('#pricingSaveStatus').textContent, /Não foi possível salvar/); }
  finally { a.close(); }
});
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
test('Navegação sempre exibe uma única seção entre as abas disponíveis sem o gerador de títulos', async () => {
  const a = await app();
  try {
    for (const name of ['dashboard', 'notas', 'catalogo', 'guia', 'precificacao', 'mercado', 'marcas']) {
      a.doc.querySelector(`[data-view="${name}"]`).click();
      const visible = [...a.doc.querySelectorAll('.main > .content')].filter(el => !el.classList.contains('hidden'));
      assert.equal(visible.length, 1, name);
    }
    assert.equal(a.doc.querySelectorAll('[data-view="data-import"]').length, 0);
    assert.equal(a.doc.querySelectorAll('[data-view="titulos"], #titulosView, #tgEscopo, #marketTitles, #catalogAbcTitles').length, 0);
    assert.equal(a.w.MMPerfil.refreshTitles, undefined);
  } finally { a.close(); }
});
test('Barra lateral recolhe, persiste após recarga, acompanha backup e preserva estado se a gravação falhar', async () => {
  const a=await app(); let seed;
  try {
    a.doc.getElementById('sidebarToggle').click();
    assert.ok(a.doc.body.classList.contains('sidebar-collapsed'));
    assert.equal(a.doc.getElementById('sidebarToggle').getAttribute('aria-expanded'),'false');
    assert.equal(a.w.MMCatalogTools.snapshot().preferences.sidebarCollapsed,true);
    seed={'mm-catalog-preferences-v1':a.w.localStorage.getItem('mm-catalog-preferences-v1')};
  } finally {a.close();}
  const b=await app(seed);
  try {
    assert.ok(b.doc.body.classList.contains('sidebar-collapsed'));
    b.doc.getElementById('sidebarToggle').click();
    assert.equal(b.doc.body.classList.contains('sidebar-collapsed'),false);
    assert.equal(b.doc.getElementById('sidebarToggle').getAttribute('aria-label'),'Recolher menu');
    const before=b.w.localStorage.getItem('mm-catalog-preferences-v1');
    b.w.Storage.prototype.setItem=()=>{throw Error('quota');};
    b.doc.getElementById('sidebarToggle').click();
    assert.equal(b.doc.body.classList.contains('sidebar-collapsed'),false);
    assert.equal(b.w.localStorage.getItem('mm-catalog-preferences-v1'),before);
    Object.defineProperty(b.w,'innerWidth',{value:390,configurable:true});
    b.w.MMCatalogTools.restoreBackup({...b.w.MMCatalogTools.snapshot(),preferences:{sidebarCollapsed:true}},false);
    assert.equal(b.doc.getElementById('sidebarNav').hidden,false,'Falha de gravação não oculta o menu');
  } finally {b.close();}
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
    a.doc.querySelector('#pageSize').value = '10';
    a.doc.querySelector('#pageSize').dispatchEvent(new a.w.Event('change', { bubbles: true }));
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
test('Painel ABC carrega fonte, mantém curva ao filtrar e abre aplicações cadastradas', async () => {
  const a = await app();
  try {
    assert.equal(a.w.MMMarket.ranked().length, 77);
    a.doc.querySelector('[data-view="mercado"]').click();
    assert.equal([...a.doc.querySelectorAll('.main > .content')].filter(el => !el.classList.contains('hidden')).length, 1);
    assert.match(a.doc.querySelector('#marketPeriod').textContent, /setembro de 2026/);
    assert.match(a.doc.querySelector('#marketKpis').textContent, /93,55%/);
    input(a.w, 'marketSearch', 'Honda XRE 190');
    assert.equal(a.doc.querySelectorAll('#marketRows tr').length, 1);
    assert.equal(a.doc.querySelector('#marketRows .market-curve').textContent, 'A');
    a.doc.querySelector('#marketRows [data-market-model]').click();
    assert.ok(!a.doc.querySelector('#catalogView').classList.contains('hidden'));
    assert.ok([...a.doc.querySelectorAll('#motoRows .model-cell')].every(el => el.textContent.includes('XRE 190')));
  } finally { a.close(); }
});
test('Curva do catálogo é independente do mercado', async () => {
  const a = await app();
  try {
    const rec = a.w.MOTO_DATA.find(r => r.modelo === 'XRE 190');
    assert.equal(a.w.MMPerfil.get(rec).estrela, '');
    a.w.MMPerfil.replaceData({ [rec.id]: { estrela: 'C' } });
    assert.equal(a.w.MMPerfil.get(rec).estrela, 'C'); assert.equal(a.w.MMMarket.get(rec).curve, 'A');

  } finally { a.close(); }
});
test('Ranking salvo continua disponível sem rede e informa a falha de atualização', async () => {
  const raw = fs.readFileSync(path.join(root, 'tests/fixtures/market-september-2026.json'), 'utf8');
  const a = await app({ 'mm-market-cache-v1': raw }, false, true);
  try { assert.equal(a.w.MMMarket.ranked().length, 77); assert.match(a.doc.querySelector('#marketStatus').textContent, /último período salvo/); }
  finally { a.close(); }
});
test('Catálogo ampliado exibe 100 motos e preserva a preferência após recarga', async () => {
  const a = await app(); let seed;
  try {
    assert.equal(a.doc.querySelectorAll('#motoRows tr[data-id]').length, 50);
    const select = a.doc.querySelector('#pageSize'); select.value = '100'; select.dispatchEvent(new a.w.Event('change', { bubbles: true }));
    assert.equal(a.doc.querySelectorAll('#motoRows tr[data-id]').length, 100); seed = storageSeed(a.w);
  } finally { a.close(); }
  const b = await app(seed);
  try { assert.equal(b.doc.querySelector('#pageSize').value, '100'); assert.equal(b.doc.querySelectorAll('#motoRows tr[data-id]').length, 100); }
  finally { b.close(); }
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
    assert.equal(a.doc.querySelectorAll('.moto-card').length,50);
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


test('Marcas têm 13 links em nova guia, cadastro persistente, busca, edição, remoção e backup', async () => {
  const a = await app(); let seed;
  try {
    a.doc.querySelector('[data-view="marcas"]').click();
    assert.equal(a.doc.querySelector('#brandsView').classList.contains('hidden'), false);
    assert.equal(a.doc.querySelectorAll('.brand-card').length, 13);
    const prox = a.doc.querySelector('[data-brand-id="brand-0"] a');
    assert.equal(prox.href, 'https://www.pro-x.com/'); assert.equal(prox.target, '_blank'); assert.match(prox.rel, /noopener/);
    a.doc.querySelector('#brandAdd').click();
    input(a.w,'brandName','Marca teste');input(a.w,'brandUrl','https://example.com/catalogo?modelo=1&ano=2026');
    submit(a.w,'brandForm');assert.equal(a.w.MMBrands.exportData().items.length,14);
    input(a.w,'brandSearch','Marca teste');assert.equal(a.doc.querySelectorAll('.brand-card').length,1);
    a.doc.querySelector('[data-brand-action="edit"]').click();input(a.w,'brandName','Marca revisada');submit(a.w,'brandForm');
    assert.equal(a.w.MMBrands.exportData().items.at(-1).name,'Marca revisada');
    const backup=a.w.MMCatalogTools.snapshot();assert.equal(backup.brands.items.length,14);
    assert.equal(a.w.MMCatalogTools.restoreBackup(backup),true);
    seed={[a.w.MMBrands.storageKey]:a.w.localStorage.getItem(a.w.MMBrands.storageKey)};
  } finally {a.close();}
  const b=await app(seed);
  try {
    input(b.w,'brandSearch','Marca revisada');assert.equal(b.doc.querySelectorAll('.brand-card').length,1);
    b.doc.querySelector('[data-brand-action="remove"]').click();assert.equal(b.w.MMBrands.exportData().items.length,13);
    const backup=b.w.MMCatalogTools.snapshot();delete backup.brands;
    assert.equal(b.w.MMCatalogTools.restoreBackup(backup),true);assert.equal(b.w.MMBrands.exportData().items.length,13);
  } finally {b.close();}
});

test('Marcas recusam links executáveis e falhas de gravação preservam lista e formulário', async () => {
  const a=await app();
  try {
    const before=JSON.stringify(a.w.MMBrands.exportData());
    const invalid=a.w.MMBrands.exportData();invalid.items[0].url='javascript:alert(1)';
    assert.throws(()=>a.w.MMBrands.validateData(invalid));
    invalid.items[0].url='https://user:password@example.com/';assert.throws(()=>a.w.MMBrands.validateData(invalid));
    a.doc.querySelector('#brandAdd').click();input(a.w,'brandName','<img src=x onerror=alert(1)>');input(a.w,'brandUrl','https://example.com/');
    a.w.Storage.prototype.setItem=()=>{throw Error('quota');};submit(a.w,'brandForm');
    assert.equal(JSON.stringify(a.w.MMBrands.exportData()),before);assert.equal(a.doc.querySelector('#brandEditor').classList.contains('hidden'),false);
    assert.match(a.doc.querySelector('#brandStatus').textContent,/preservados/);
  } finally {a.close();}
});
