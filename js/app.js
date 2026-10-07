const STORAGE_KEY = 'master-motos-records-v1';
const NOTES_KEY = 'master-motos-notes-v1';
function readLocalJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch (error) {
    return fallback;
  }
}
const brazilOffroadBrands = new Set(['Honda', 'Yamaha', 'KTM', 'Husqvarna', 'GasGas', 'Kawasaki', 'Beta']);
const offRoadCategories = new Set(['Off-Road / Trilha', 'Motocross', 'Cross Country', 'Dual Sport', 'Enduro', 'Supermoto']);
/* true = catálogo só com off-road das 7 marcas; false = base completa (necessário para motos de curva) */
const FILTRAR_SO_OFFROAD_BR = false;
const isBrazilOffroad = (record) => !FILTRAR_SO_OFFROAD_BR || (brazilOffroadBrands.has(record.marca) && offRoadCategories.has(record.categoria));

function normalizeKtmNames(list) {
  return list.map((record) => {
    if (record.marca !== 'KTM' || !/^\d+\s+/.test(String(record.modelo || ''))) return record;
    const modelo = String(record.modelo).replace(/^(\d+)\s+(.+)$/, '$2 $1');
    const nomeTitulo = String(record.nomeTitulo || '').replace(/^(\d+)\s+(.+)$/, '$2 $1');
    return { ...record, modelo, nomeTitulo };
  });
}
const sourceData = Array.isArray(window.MOTO_DATA) ? window.MOTO_DATA : [];
const initialData = normalizeKtmNames(sourceData.filter(isBrazilOffroad));
const storedRecords = readLocalJson(STORAGE_KEY, null);
// A saved array is a complete snapshot, including an intentionally empty catalog.
const validRecord = (record) => record && Number.isSafeInteger(Number(record.id)) && Number(record.id) > 0 && typeof record.marca === 'string' && typeof record.modelo === 'string' && typeof record.categoria === 'string';
let records = normalizeKtmNames((Array.isArray(storedRecords) ? storedRecords : initialData).filter(validRecord).filter(isBrazilOffroad).map(record => ({ ...record, id: Number(record.id) })));
const savedNotes = readLocalJson(NOTES_KEY, null);
const backupNotes = readLocalJson(`${NOTES_KEY}-backup`, []);
const validNote = (note) => note && Number.isSafeInteger(Number(note.id)) && Number(note.id) > 0 && typeof note.title === 'string' && typeof note.text === 'string' && ['warning', 'info', 'neutral'].includes(note.type) && (note.refs == null || (Array.isArray(note.refs) && note.refs.every(ref => typeof ref === 'string'))) && (note.updatedAt == null || typeof note.updatedAt === 'string');
let notes = (Array.isArray(savedNotes) ? savedNotes : Array.isArray(backupNotes) ? backupNotes : []).filter(validNote).map(note => ({ ...note, id: Number(note.id) }));
let state = { tab: 'todos', query: '', category: '', brand: '', engine: '', year: '', yearMin: '', yearMax: '', notesOnly: false, page: 1, pageSize: 15, sort: 'marca', dir: 1, compact: false, perfil: '', faixa: '', estrela: '' };
let notesUi = { type: 'all', sort: 'recent' };
let dataUi = { tab: 'products', query: '', category: '', status: '', page: 1, pageSize: 24 };
const selectedMotoIds = new Set();
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const THEME_STORAGE_KEY = 'mm_theme_v1';
function readTheme() {
  try { return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'; } catch (error) { return 'light'; }
}
function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  $('#themeBtn')?.setAttribute('aria-pressed', String(isDark));
  $('#themeBtn')?.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
  $('#themeBtn')?.setAttribute('title', isDark ? 'Tema claro' : 'Tema escuro');
}
const savedTheme = readTheme();
const categoryOptions = [...new Set(initialData.map((item) => item.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const categoryColors = { 'Enduro': '#dc2626', 'Motocross': '#ea580c', 'Cross Country': '#d97706', 'Dual Sport': '#16a34a', 'Off-Road / Trilha': '#15803d', 'Supermoto': '#2563eb', 'Sport': '#7c3aed', 'SuperEsportiva': '#be185d', 'Street / Naked': '#0891b2', 'Adventure / Trail': '#0f766e', 'Touring / Classic': '#92400e', 'Scrambler': '#64748b' };
const categoryColor = (category) => categoryColors[category] || '#64748b';
const categoryBadge = (category) => `<span class="category-badge" style="--category-color:${categoryColor(category)}">${esc(category)}</span>`;
const brandOptions = [...new Set(initialData.map((item) => item.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const isOffRoad = (record) => offRoadCategories.has(record.categoria);
const fmt = (value) => new Intl.NumberFormat('pt-BR').format(value);
const normalize = (value) => String(value ?? '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

// Commit both snapshots before changing the visible state. Roll back if storage fails.
function commitCatalog(nextRecords, nextNotes = notes) {
  let previousRecords, previousNotes;
  try {
    previousRecords = localStorage.getItem(STORAGE_KEY);
    previousNotes = localStorage.getItem(NOTES_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    localStorage.setItem(NOTES_KEY, JSON.stringify(nextNotes));
  } catch (error) {
    try {
      if (previousRecords !== undefined) previousRecords === null ? localStorage.removeItem(STORAGE_KEY) : localStorage.setItem(STORAGE_KEY, previousRecords);
      if (previousNotes !== undefined) previousNotes === null ? localStorage.removeItem(NOTES_KEY) : localStorage.setItem(NOTES_KEY, previousNotes);
    } catch {}
    toast('Não foi possível salvar. Seus dados anteriores foram mantidos; verifique o armazenamento do navegador.');
    return false;
  }
  records = nextRecords; notes = nextNotes;
  $('#lastUpdate').textContent = 'agora';
  return true;
}
function notesFor(motoId) { return notes.filter((note) => Number(note.motoId) === Number(motoId)); }
function motoName(motoId) { if (!motoId) return 'Nota geral'; const moto = records.find((record) => Number(record.id) === Number(motoId)); return moto ? `${moto.marca} ${moto.modelo}` : 'Moto removida'; }
function typeLabel(type) { return ({ warning: 'Aviso', info: 'Aplicação', neutral: 'Compatibilidade' }[type] || 'Nota'); }

const GUIDE_STORAGE_KEY = 'mm_guia_notes_v1';
const GUIDE_SCHEMA_VERSION = 1;
let guideStorageWarningShown = false;
function readGuideStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUIDE_STORAGE_KEY) || 'null');
    return parsed && parsed.schemaVersion === GUIDE_SCHEMA_VERSION && parsed.notes && typeof parsed.notes === 'object' ? parsed : { schemaVersion: GUIDE_SCHEMA_VERSION, notes: {} };
  } catch (error) {
    return { schemaVersion: GUIDE_SCHEMA_VERSION, notes: {} };
  }
}
let guideStore = readGuideStore();
function writeGuideStore() {
  try {
    localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(guideStore));
    return true;
  } catch (error) {
    if (!guideStorageWarningShown) { guideStorageWarningShown = true; toast('Não foi possível salvar as notas do guia neste navegador.'); }
    return false;
  }
}
function guideKey(motoId, componentId) { return `${motoId}:${componentId}`; }
function guideNotesFor(motoId, componentId) { return Array.isArray(guideStore.notes[guideKey(motoId, componentId)]) ? guideStore.notes[guideKey(motoId, componentId)] : []; }
function getGuideMotoId(record) { return record?.id ?? record?.motoId ?? null; }
function guideTypeFor(record) {
  const enduro = /enduro|cross country|dual sport/i.test(record?.categoria || '');
  if (record?.doisTempos) return enduro ? 'enduro-2t' : 'cross-2t';
  return enduro ? 'enduro-4t' : 'cross-4t';
}

function matches(record) {
  const haystack = normalize(`${record.marca} ${record.modelo} ${record.nomeTitulo} ${record.categoria}`);
  if (state.query && !haystack.includes(normalize(state.query))) return false;
  if (state.tab === 'offroad' && !isOffRoad(record)) return false;
  if (state.tab === 'onroad' && isOffRoad(record)) return false;
  if (state.category && record.categoria !== state.category) return false;
  if (state.brand && record.marca !== state.brand) return false;
  if (state.engine === '4T' && !record.quatroTempos) return false;
  if (state.engine === '2T' && !record.doisTempos) return false;
  if (state.year === 'recent' && Number(record.anoFinal) < 2020) return false;
  if (state.year === 'classic' && Number(record.anoInicial) > 2010) return false;
  if (state.year === 'range' && state.yearMin && Number(record.anoFinal) < Number(state.yearMin)) return false;
  if (state.year === 'range' && state.yearMax && Number(record.anoInicial) > Number(state.yearMax)) return false;
  if (state.notesOnly && !notesFor(record.id).length) return false;
  if (!MMPerfil.match(record, state)) return false;
  return true;
}

function filtered() {
  return records.filter(matches).sort((a, b) => {
    const av = a[state.sort] ?? '';
    const bv = b[state.sort] ?? '';
    const result = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'pt-BR');
    return result * state.dir;
  });
}

function stats() {
  const total = records.length;
  const offRoad = records.filter(isOffRoad).length;
  const twoStroke = records.filter((record) => record.doisTempos).length;
  $('#totalModels').textContent = fmt(total); $('#sideCount').textContent = total;
  $('#totalBrands').textContent = fmt(new Set(records.map((record) => record.marca)).size);
  $('#offRoadCount').textContent = fmt(offRoad); $('#onRoadCount').textContent = fmt(total - offRoad);
  $('#offRoadPct').textContent = `${Math.round((offRoad / (total || 1)) * 100)}% da base`; $('#onRoadPct').textContent = `${Math.round(((total - offRoad) / (total || 1)) * 100)}% da base`;
  $('#tabTodos').textContent = fmt(total); $('#tabOff').textContent = fmt(offRoad); $('#tabOn').textContent = fmt(total - offRoad);
  $('#quickAll').textContent = fmt(total); $('#quickTwo').textContent = fmt(twoStroke); $('#quickFour').textContent = fmt(total - twoStroke); $('#quickNotes').textContent = fmt(records.filter(record => notesFor(record.id).length).length); $('#notesCount').textContent = fmt(notes.length);
}

function noteBadge(record) {
  const recordNotes = notesFor(record.id);
  if (!recordNotes.length) return '<button class="note-add compact-note" title="Adicionar nota">+ nota</button>';
  const topNote = recordNotes[0];
  return `<button class="note-badge ${esc(topNote.type)}" title="Abrir notas"><i></i>${recordNotes.length} ${recordNotes.length === 1 ? 'nota' : 'notas'}</button>`;
}

function renderDataModule() {
  const data = window.PROJECT_DATA || { status: 'idle', categories: [], products: [] };
  const status = $('#dataStatus'); const summary = $('#dataSummary'); const categoryList = $('#dataCategoryList'); const productList = $('#dataProductList');
  if (!status || !summary || !categoryList || !productList) return;
  const categories = Array.isArray(data.categories) ? data.categories : []; const products = Array.isArray(data.products) ? data.products : [];
  if (data.status === 'loading' || data.status === 'idle') { status.textContent = 'Carregando base...'; summary.innerHTML = '<div class="data-stat-card data-stat-card-ghost">Lendo os arquivos da pasta Data...</div>'; return; }
  if (data.status === 'error') { status.textContent = 'Falha na importação'; status.className = 'stat-pill blue data-status-pill data-status-error'; summary.innerHTML = `<div class="data-stat-card data-stat-card-error">${esc(data.error || 'Não foi possível carregar os dados.')}</div>`; return; }
  status.textContent = `Dados prontos · ${fmt(products.length)} itens`; status.className = 'stat-pill green data-status-pill'; $('#productCount').textContent = fmt(products.length);
  $('#dataProductsTabCount').textContent = fmt(products.length); $('#dataCategoriesTabCount').textContent = fmt(categories.length);
  const active = products.filter((item) => normalize(item.situacao) === 'ativo').length;
  summary.innerHTML = `<div class="data-stat-card"><strong>${fmt(products.length)}</strong><small>Produtos importados</small></div><div class="data-stat-card"><strong>${fmt(active)}</strong><small>Produtos ativos</small></div><div class="data-stat-card"><strong>${fmt(categories.length)}</strong><small>Categorias cadastradas</small></div>`;
  const categoryNames = [...new Set(products.map((item) => item.categoria || item.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filter = $('#dataCategoryFilter'); if (filter && filter.options.length === 1) filter.insertAdjacentHTML('beforeend', categoryNames.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join(''));
  const q = normalize(dataUi.query); const filtered = products.filter((item) => normalize(`${item.id} ${item.codigo} ${item.descricao} ${item.marca} ${item.gtin}`).includes(q) && (!dataUi.category || (item.categoria || item.departamento) === dataUi.category) && (!dataUi.status || normalize(item.situacao) === normalize(dataUi.status)));
  const categoryCounts = products.reduce((map, item) => { const name = item.categoria || item.departamento || 'Sem categoria'; map[name] = (map[name] || 0) + 1; return map; }, {});
  const filteredCategories = categories.filter(item => normalize(`${item.id} ${item.nome}`).includes(q) && (!dataUi.status || normalize(item.status) === normalize(dataUi.status)));
  $('#dataCategoryFilter').disabled = dataUi.tab === 'categories';
  $('#dataSearch').placeholder = dataUi.tab === 'categories' ? 'Buscar categoria ou código...' : 'Buscar código, descrição, marca ou GTIN...';
  $('#dataNotice').textContent = data.notice || '';
  const total = dataUi.tab === 'products' ? filtered.length : filteredCategories.length; const pages = Math.max(1, Math.ceil(total / dataUi.pageSize)); dataUi.page = Math.min(dataUi.page, pages); const start = (dataUi.page - 1) * dataUi.pageSize;
  if (dataUi.tab === 'categories') { categoryList.classList.remove('hidden'); productList.classList.add('hidden'); categoryList.innerHTML = filteredCategories.slice(start, start + dataUi.pageSize).map((item) => `<article class="data-category-card"><div class="data-category-icon">${esc((item.nome || 'C').slice(0, 1))}</div><div><strong>${esc(item.nome || item.id || 'Categoria')}</strong><small>${esc(item.status || 'Ativa')} · nível ${esc(item.nivel || '1')}</small></div><b>${fmt(categoryCounts[item.nome] || 0)} itens</b></article>`).join('') || '<div class="data-empty data-empty-wide">Nenhuma categoria encontrada.</div>'; }
  else { categoryList.classList.add('hidden'); productList.classList.remove('hidden'); productList.innerHTML = filtered.slice(start, start + dataUi.pageSize).map((item) => `<article class="data-product-card"><div class="data-product-main"><span class="data-product-code">${esc(item.codigo || `ID ${item.id}`)}</span><strong>${esc(item.descricao || 'Produto sem descrição')}</strong><small>${esc(item.marca || 'Marca não informada')} · ${esc(item.categoria || item.departamento || 'Sem categoria')}</small></div><div class="data-product-meta"><span class="data-label">Preço</span><span class="data-price">${esc(window.MMData.formatPrice(item.preco))}</span></div><div class="data-product-meta"><span class="data-label">Estoque</span><span class="data-stock ${normalize(item.situacao) === 'ativo' ? 'is-active' : ''}">${esc(item.estoque || '0')}</span></div><div class="data-product-meta"><span class="data-label">Situação</span><small>${esc(item.situacao || 'Sem situação')}</small></div></article>`).join('') || '<div class="data-empty data-empty-wide">Nenhum produto encontrado para os filtros atuais.</div>'; }
  $('#dataResultSummary').textContent = `${fmt(total)} ${dataUi.tab === 'products' ? 'produtos' : 'categorias'}`; $('#dataCurrentPage').textContent = String(dataUi.page); $('#dataPrevPage').disabled = dataUi.page <= 1; $('#dataNextPage').disabled = dataUi.page >= pages;
}

function render(full = true) {
  if (full) stats();
  if (full && !$('#dataImportView').classList.contains('hidden')) renderDataModule();
  $$('[data-quick]').forEach(button => button.classList.toggle('active', button.dataset.quick === (state.notesOnly ? 'notes' : state.engine || 'all')));
  $$('th[data-sort]').forEach(header => header.setAttribute('aria-sort', header.dataset.sort === state.sort ? (state.dir === 1 ? 'ascending' : 'descending') : 'none'));
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  if (state.page > pages) state.page = pages;
  const visible = rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
  $('#resultSummary').textContent = `${fmt(rows.length)} registro${rows.length === 1 ? '' : 's'}`; $('#pageInfo').textContent = `Página ${state.page} de ${pages}`; $('.pagination .current').textContent = state.page;
  $('#prevPage').disabled = state.page === 1; $('#nextPage').disabled = state.page === pages;
  $('#motoRows').innerHTML = visible.map((record) => `<tr data-id="${record.id}"><td><input class="row-check" type="checkbox" aria-label="Selecionar ${esc(record.modelo)}"></td><td class="brand-cell">${esc(record.marca)}</td><td class="model-cell">${esc(record.modelo)}</td><td class="cc">${fmt(record.cilindrada)} cc</td><td><span class="engine ${record.doisTempos ? 'two' : ''}">${record.doisTempos ? '2T' : '4T'}</span></td><td class="year">${record.anoInicial} — ${record.anoFinal}</td><td class="category">${categoryBadge(record.categoria)}</td>${MMPerfil.cells(record)}<td class="note-cell">${noteBadge(record)}</td><td class="title-cell">${esc(record.nomeTitulo)}</td><td><div class="row-actions"><button class="row-action add-note" title="Adicionar nota">▤</button><button class="row-action edit" title="Editar">✎</button><button class="row-action delete" title="Excluir">⌫</button></div></td></tr>`).join('') || '<tr><td colspan="13" style="text-align:center;padding:40px;color:#8a909b">Nenhum registro encontrado. Tente limpar os filtros.</td></tr>';
  const activeFilters = [state.brand, state.category, state.engine, state.year, state.notesOnly, state.perfil, state.faixa, state.estrela].filter(Boolean).length;
  $('#filterCount').textContent = activeFilters; $('#filterCount').classList.toggle('visible', Boolean(activeFilters));
  ensureGuideButtons(); renderSelectionState(); renderFilterSummary();
  if (full) { renderDashboard(); renderNotes(); MMPerfil.render(); }
}

function renderDashboard() {
  const categories = {}; records.forEach((record) => { categories[record.categoria] = (categories[record.categoria] || 0) + 1; });
  const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 6); const max = topCategories[0]?.[1] || 1;
  $('#categoryChart').innerHTML = topCategories.map(([name, count]) => `<div class="bar-item"><span class="bar-value">${count}</span><i class="bar" style="height:${Math.max(12, (count / max) * 82)}%"></i><span class="bar-label">${esc(name.split(' / ')[0])}</span></div>`).join('');
  const brands = {}; records.forEach((record) => { brands[record.marca] = (brands[record.marca] || 0) + 1; }); const topBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 7); const maxBrand = topBrands[0]?.[1] || 1;
  $('#brandChart').innerHTML = topBrands.map(([name, count], index) => `<div class="rank-row"><span class="rank-no">0${index + 1}</span><span class="rank-name">${esc(name)}<span class="rank-bar"><i style="width:${(count / maxBrand) * 100}%"></i></span></span><b class="rank-count">${count}</b></div>`).join('');
}

function renderNotes() {
  const query = normalize($('#notesSearch')?.value || '');
  let visibleNotes = notes.filter((note) => `${normalize(note.title)} ${normalize(note.text)} ${normalize(motoName(note.motoId))}`.includes(query));
  if (notesUi.type !== 'all') visibleNotes = visibleNotes.filter((note) => note.type === notesUi.type);
  visibleNotes.sort((a, b) => notesUi.sort === 'title' ? String(a.title).localeCompare(String(b.title), 'pt-BR') : notesUi.sort === 'moto' ? motoName(a.motoId).localeCompare(motoName(b.motoId), 'pt-BR') : Number(b.id) - Number(a.id));
  const stats = $('#notesStats');
  if (stats) stats.innerHTML = `<span><b>${notes.length}</b> ${notes.length === 1 ? 'nota' : 'notas'}</span><span class="warning"><b>${notes.filter((n) => n.type === 'warning').length}</b> avisos</span><span class="info"><b>${notes.filter((n) => n.type === 'info').length}</b> aplicações</span><span class="neutral"><b>${notes.filter((n) => n.type === 'neutral').length}</b> compatibilidades</span>`;
  $('#notesGrid').innerHTML = visibleNotes.length ? visibleNotes.map((note) => `<article class="note-card ${esc(note.type)}" data-note-id="${note.id}"><div class="note-card-head"><span class="note-type"><i></i>${typeLabel(note.type)}</span><div class="note-card-actions"><button class="note-edit" title="Editar nota">✎</button><button class="note-delete" title="Excluir nota">⌫</button></div></div><h3>${esc(note.title)}</h3><p>${esc(note.text)}</p><div class="note-card-foot"><strong>${esc(motoName(note.motoId))}</strong><span>${esc(note.updatedAt || 'agora')}</span></div></article>`).join('') : '<div class="notes-empty"><div class="empty-icon">▤</div><h2>Nenhuma nota encontrada</h2><p>Use as notas para guardar limites de ano, aplicações e alertas de cadastro.</p><button class="primary-btn" id="emptyNewNote">+ Criar primeira nota</button></div>';
}

function ensureGuideButtons() {
  return;
}
function renderSelectionState() {
  const rows = [...$('#motoRows').querySelectorAll('tr[data-id]')];
  rows.forEach((row) => { const id = Number(row.dataset.id); const checked = selectedMotoIds.has(id); row.classList.toggle('is-selected', checked); const checkbox = row.querySelector('.row-check'); if (checkbox) checkbox.checked = checked; });
  const selectAll = $('#selectAll'); const allSelected = rows.length > 0 && rows.every((row) => selectedMotoIds.has(Number(row.dataset.id))); const someSelected = rows.some((row) => selectedMotoIds.has(Number(row.dataset.id)));
  if (selectAll) { selectAll.checked = allSelected; selectAll.indeterminate = !allSelected && someSelected; }
  $('#selectedCount').textContent = selectedMotoIds.size; $('#bulkBar').classList.toggle('hidden', selectedMotoIds.size === 0);
}

function guideComponentsFor(record) {
  return window.MM_GUIDE_COMPONENTS[guideTypeFor(record)] || window.MM_GUIDE_COMPONENTS['cross-4t'];
}

function renderGuideMotoOptions(selectedId) {
  const select = $('#guideMotoSelect');
  if (!select) return;
  select.innerHTML = records.map((record) => `<option value="${record.id}">${esc(record.marca)} ${esc(record.modelo)} · ${record.anoInicial}–${record.anoFinal}</option>`).join('');
  if (selectedId && records.some((record) => Number(record.id) === Number(selectedId))) select.value = selectedId;
}

function showGuideTooltip(button, component) {
  const stage = $('#guideStage'); const tooltip = $('#guideTooltip');
  if (!stage || !tooltip) return;
  tooltip.textContent = '';
  const title = document.createElement('strong'); title.textContent = component.nome;
  const description = document.createElement('span'); description.textContent = component.descricao;
  tooltip.append(title, description); tooltip.classList.add('is-visible');
  const maxLeft = Math.max(8, stage.clientWidth - 248); const maxTop = Math.max(8, stage.clientHeight - 90);
  tooltip.style.left = `${Math.min(maxLeft, Math.max(8, button.offsetLeft + 24))}px`;
  tooltip.style.top = `${Math.min(maxTop, Math.max(8, button.offsetTop - 18))}px`;
}
function hideGuideTooltip() { $('#guideTooltip')?.classList.remove('is-visible'); }

function renderGuide(recordId = null) {
  const select = $('#guideMotoSelect'); if (!select) return;
  const id = Number(recordId || select.value || records[0]?.id); const record = records.find((item) => Number(item.id) === id);
  if (!record) { $('#guideBody').innerHTML = '<div class="guide-error">Nenhuma moto disponível para o guia.</div>'; return; }
  select.value = id; const components = guideComponentsFor(record); const adjustments = window.MM_GUIDE_ADJUSTMENTS?.[id] || {};
  const svg = window.MM_GUIDE_DIAGRAMS?.[guideTypeFor(record)] || window.MM_GUIDE_DIAGRAMS?.base || '';
  $('#guideMeta').textContent = `${record.marca} ${record.modelo} · ${record.doisTempos ? '2T' : '4T'} · ${guideTypeFor(record)}`;
  $('#guideBody').innerHTML = `<div class="guide-grid"><article class="guide-card"><div class="guide-card-head"><h2>Diagrama lateral</h2><small>Selecione um ponto para abrir as notas</small></div><div id="guideStage" class="guide-stage">${svg}<div id="guideTooltip" class="guide-tooltip" role="tooltip"></div>${components.map((component) => { const point = adjustments[component.id] || component; const noteCount = guideNotesFor(id, component.id).length; return `<button type="button" class="guide-hotspot ${noteCount ? 'has-notes' : ''}" style="--hotspot-x:${point.x}%;--hotspot-y:${point.y}%" data-component-id="${esc(component.id)}" aria-label="${esc(component.nome)}">${noteCount ? `<span class="guide-hotspot-count">${noteCount}</span>` : ''}</button>`; }).join('')}</div><div class="guide-legend"><span><i></i>Componente</span><span><i class="notes"></i>Com nota salva</span><span>Tipo: ${esc(guideTypeFor(record))}</span></div></article><aside class="guide-card guide-components"><div class="guide-card-head"><h2>Componentes</h2><small>${components.length} pontos</small></div><div class="guide-component-list">${components.map((component) => { const count = guideNotesFor(id, component.id).length; return `<button type="button" class="guide-component ${count ? 'has-notes' : ''}" data-component-id="${esc(component.id)}"><i></i><span>${esc(component.nome)}</span>${count ? `<b>${count}</b>` : ''}</button>`; }).join('')}</div><div class="guide-footer-actions"><button type="button" class="subtle-btn" id="guideExportBtn">↧ Exportar notas</button><button type="button" class="subtle-btn" id="guideImportBtn">↥ Importar notas</button><input type="file" id="guideImportFile" accept="application/json"></div></aside></div>`;
  $('#guideBody').querySelectorAll('[data-component-id]').forEach((button) => {
    const component = components.find((item) => item.id === button.dataset.componentId);
    button.addEventListener('mouseenter', () => showGuideTooltip(button, component)); button.addEventListener('focus', () => showGuideTooltip(button, component)); button.addEventListener('mouseleave', hideGuideTooltip); button.addEventListener('blur', hideGuideTooltip);
    button.addEventListener('click', (event) => {
      if (event.pointerType === 'touch' && button.dataset.touchOpen !== '1') { button.dataset.touchOpen = '1'; showGuideTooltip(button, component); return; }
      button.dataset.touchOpen = '0'; openGuideNotes(id, component);
    });
  });
  $('#guideExportBtn').addEventListener('click', exportGuideNotes); $('#guideImportBtn').addEventListener('click', () => $('#guideImportFile').click()); $('#guideImportFile').addEventListener('change', importGuideNotes);
}

function openGuideNotes(motoId, component) {
  const record = records.find((item) => Number(item.id) === Number(motoId)); if (!record) return;
  $('#guideNoteMoto').textContent = `${record.marca} ${record.modelo} · ${record.anoInicial}–${record.anoFinal}`; $('#guideNoteComponent').textContent = component.nome; $('#guideNoteMotoId').value = motoId; $('#guideNoteComponentId').value = component.id; $('#guideNoteId').value = '';
  $('#guideNoteText').value = ''; renderGuideNoteList(motoId, component.id); $('#guideNoteBackdrop').classList.remove('hidden'); setTimeout(() => $('#guideNoteText').focus(), 20);
}
function renderGuideNoteList(motoId, componentId) {
  const list = $('#guideNoteList'); list.textContent = ''; const items = guideNotesFor(motoId, componentId);
  if (!items.length) { const empty = document.createElement('div'); empty.className = 'guide-note-empty'; empty.textContent = 'Nenhuma nota cadastrada para esta peça.'; list.append(empty); return; }
  items.forEach((note) => { const item = document.createElement('article'); item.className = 'guide-note-item'; const text = document.createElement('p'); text.textContent = note.text; const meta = document.createElement('div'); meta.className = 'guide-note-meta'; const date = document.createElement('span'); date.textContent = `Criada ${note.createdAt} · Editada ${note.updatedAt}`; const actions = document.createElement('span'); actions.className = 'guide-note-actions'; const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Editar'; edit.addEventListener('click', () => { $('#guideNoteId').value = note.id; $('#guideNoteText').value = note.text; $('#guideNoteText').focus(); }); const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Excluir'; remove.addEventListener('click', () => { if (!confirm('Excluir esta nota do guia?')) return; const key = guideKey(motoId, componentId); guideStore.notes[key] = guideNotesFor(motoId, componentId).filter((entry) => entry.id !== note.id); writeGuideStore(); renderGuideNoteList(motoId, componentId); renderGuide(motoId); }); actions.append(edit, remove); meta.append(date, actions); item.append(text, meta); list.append(item); });
}
function closeGuideNotes() { $('#guideNoteBackdrop')?.classList.add('hidden'); }
function exportGuideNotes() { const blob = new Blob([JSON.stringify(guideStore, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'master-motos-notas-guia.json'; link.click(); URL.revokeObjectURL(link.href); toast('Notas do guia exportadas'); }
function importGuideNotes(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); const valid = parsed?.schemaVersion === GUIDE_SCHEMA_VERSION && parsed.notes && typeof parsed.notes === 'object' && Object.values(parsed.notes).every((items) => Array.isArray(items) && items.every((note) => note.id && typeof note.text === 'string' && note.createdAt && note.updatedAt)); if (!valid) throw new Error('invalid'); if (!confirm('Importar este arquivo e substituir as notas atuais do guia?')) return; guideStore = parsed; writeGuideStore(); renderGuide($('#guideMotoSelect').value); toast('Notas do guia importadas'); } catch (error) { toast('Arquivo de notas inválido.'); } finally { event.target.value = ''; } }; reader.readAsText(file); }

function populateOptions() {
  const categories = [...new Set([...categoryOptions, ...records.map(r => r.categoria)])].sort((a,b) => a.localeCompare(b, 'pt-BR')).map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join(''); const brands = [...new Set(records.map(r => r.marca))].sort((a,b) => a.localeCompare(b, 'pt-BR')).map((brand) => `<option value="${esc(brand)}">${esc(brand)}</option>`).join('');
  $('#categoryFilter').innerHTML = '<option value="">Todas as categorias</option>' + categories; $('#categoria').innerHTML = categories; $('#brandFilter').innerHTML = '<option value="">Todas as marcas</option>' + brands;
  $('#categoryFilter').value = state.category; $('#brandFilter').value = state.brand;
  $('#noteMotoSelect').innerHTML = '<option value="">Nota geral</option>' + records.map((record) => `<option value="${record.id}">${esc(record.marca)} ${esc(record.modelo)}</option>`).join('');
}

function openMotoModal(id = null) { const record = id ? records.find((item) => item.id === id) : null; $('#motoForm').reset(); $('#motoId').value = record?.id || ''; $('#modalEyebrow').textContent = record ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'; $('#modalTitle').textContent = record ? 'Editar moto' : 'Adicionar moto'; if (record) { $('#marca').value = record.marca; $('#modelo').value = record.modelo; $('#cilindrada').value = record.cilindrada; $('#categoria').value = record.categoria; $('#anoInicial').value = record.anoInicial; $('#anoFinal').value = record.anoFinal; $('#motor').value = record.doisTempos ? '2T' : '4T'; $('#nomeTitulo').value = record.nomeTitulo; } $('#modalBackdrop').classList.remove('hidden'); setTimeout(() => $('#marca').focus(), 30); }
function readNoteRefs() { return ($('#noteRefs')?.value || '').split(/\n+/).map((value) => value.trim()).filter((value) => /^https?:\/\//i.test(value)).slice(0, 10); }
function openNoteModal(motoId = null, noteId = null) { const note = noteId ? notes.find((item) => item.id === noteId) : null; $('#noteForm').reset(); $('#noteId').value = note?.id || ''; $('#noteMotoId').value = motoId || note?.motoId || ''; $('#noteMotoSelect').value = motoId || note?.motoId || ''; $('#noteModalTitle').textContent = note ? 'Editar nota' : 'Adicionar nota'; if (note) { $('#noteType').value = note.type; $('#noteTitle').value = note.title; $('#noteText').value = note.text; $('#noteRefs').value = (note.refs || []).join('\n'); } $('#noteContext').textContent = motoName(motoId || note?.motoId); $('#noteModalBackdrop').classList.remove('hidden'); setTimeout(() => $('#noteTitle').focus(), 30); }
function closeMotoModal() { $('#modalBackdrop').classList.add('hidden'); } function closeNoteModal() { $('#noteModalBackdrop').classList.add('hidden'); }
function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); setTimeout(() => element.classList.remove('show'), 2200); }
function confirmCrud(title, text, confirmText = 'Confirmar') { if (window.Swal) return Swal.fire({ title, text, icon: 'warning', showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancelar', reverseButtons: true }).then((result) => result.isConfirmed); return Promise.resolve(window.confirm(`${title}\n\n${text}`)); }
function crudFeedback(title, text, icon = 'success') { if (window.Swal) return Swal.fire({ title, text, icon, timer: 1500, showConfirmButton: false }); toast(text || title); }
function removeGuideNotesFor(motoIds) { MMPerfil.remove(motoIds); Object.keys(guideStore.notes).forEach((key) => { if (motoIds.some((id) => key.startsWith(`${id}:`))) delete guideStore.notes[key]; }); writeGuideStore(); }
function exportCsv() { const rows = [['Marca', 'Modelo', 'Cilindrada', 'Motor', 'Ano inicial', 'Ano final', 'Categoria', 'Perfil', 'Faixa', 'Estrela', 'Notas', 'Nome título'], ...filtered().map((record) => [record.marca, record.modelo, record.cilindrada, record.doisTempos ? '2T' : '4T', record.anoInicial, record.anoFinal, record.categoria, MMPerfil.get(record).perfil, MMPerfil.faixaLabel(record), MMPerfil.estrela(record), notesFor(record.id).map((note) => note.text).join(' | '), record.nomeTitulo])]; const content = '\uFEFF' + rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })); link.download = 'master-motos-export.csv'; link.click(); URL.revokeObjectURL(link.href); toast('CSV exportado com sucesso'); }

function setupNotesModule() {
  const toolbar = $('.notes-toolbar');
  if (!toolbar || $('#notesStats')) return;
  toolbar.insertAdjacentHTML('afterend', '<div class="notes-summary" id="notesStats"></div><div class="notes-controls"><div class="note-filter-group" role="group" aria-label="Filtrar notas"><button type="button" class="note-filter active" data-note-filter="all">Todas</button><button type="button" class="note-filter" data-note-filter="warning">Avisos</button><button type="button" class="note-filter" data-note-filter="info">Aplicações</button><button type="button" class="note-filter" data-note-filter="neutral">Compatibilidade</button></div><label class="note-sort">Ordenar<select id="notesSort"><option value="recent">Mais recentes</option><option value="title">Título A–Z</option><option value="moto">Moto A–Z</option></select></label><div class="note-data-actions"><button type="button" class="subtle-btn" id="exportNotes">↧ Exportar</button><button type="button" class="subtle-btn" id="importNotes">↥ Importar</button><input type="file" id="importNotesFile" accept="application/json"></div></div>');
  $$('[data-note-filter]').forEach((button) => button.addEventListener('click', () => { notesUi.type = button.dataset.noteFilter; $$('[data-note-filter]').forEach((item) => item.classList.toggle('active', item === button)); renderNotes(); }));
  $('#notesSort').addEventListener('change', (event) => { notesUi.sort = event.target.value; renderNotes(); });
  $('#exportNotes').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), notes }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'master-motos-notas.json'; link.click(); URL.revokeObjectURL(link.href); toast('Notas exportadas'); });
  $('#importNotes').addEventListener('click', () => $('#importNotesFile').click());
  $('#importNotesFile').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); const imported = Array.isArray(parsed) ? parsed : parsed.notes; if (!Array.isArray(imported) || imported.some(note => !validNote(note)) || new Set(imported.map(note => Number(note.id))).size !== imported.length) throw new Error('invalid'); if (!commitCatalog(records, imported.map(note => ({ ...note, id: Number(note.id) })))) return; render(); toast('Notas importadas'); } catch (error) { toast('Arquivo de notas inválido'); } finally { event.target.value = ''; } }; reader.readAsText(file); });
  const type = $('#noteType'); const text = $('#noteText');
  const noteForm = $('#noteForm'); const motoField = $('#noteMotoSelect')?.closest('.full-field'); const titleField = $('#noteTitle')?.closest('label');
  if (noteForm && motoField && titleField) { noteForm.insertBefore(titleField, motoField); if (motoField.firstChild) motoField.firstChild.textContent = 'Moto relacionada (opcional)'; $('#noteMotoSelect')?.removeAttribute('required'); $('#noteMotoSelect')?.insertAdjacentHTML('afterbegin', '<option value="">Nota geral — sem moto específica</option>'); }
  if (noteForm && !$('#noteRefs')) noteForm.querySelector('.modal-foot').insertAdjacentHTML('beforebegin', '<div class="note-tabs" role="tablist"><button type="button" class="note-tab active" data-note-tab="content">Conteúdo</button><button type="button" class="note-tab" data-note-tab="refs">Referências</button></div><div class="note-tab-panel" data-note-panel="refs"><label class="full-field">Links de referência (opcional)<textarea id="noteRefs" rows="4" placeholder="Cole um link por linha: documentação, anúncio, catálogo ou fonte técnica"></textarea><small class="note-type-hint">Os links ficam salvos junto com a nota para consulta futura.</small></label></div>');
  $$('[data-note-tab]').forEach((tab) => tab.addEventListener('click', () => { $$('[data-note-tab]').forEach((item) => item.classList.toggle('active', item === tab)); $$('[data-note-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.notePanel === tab.dataset.noteTab)); ['#noteTitle', '#noteType', '#noteText', '#noteMotoSelect'].forEach((selector) => $(selector)?.closest('label')?.classList.toggle('note-content-field-hidden', tab.dataset.noteTab === 'refs')); }));
  noteForm?.addEventListener('reset', () => { const contentTab = $('[data-note-tab="content"]'); contentTab?.click(); setTimeout(() => { if ($('#noteTextCount')) $('#noteTextCount').textContent = $('#noteText').value.length; }, 0); });
  if (type && !$('#noteTypeHint')) type.insertAdjacentHTML('afterend', '<small id="noteTypeHint" class="note-type-hint">Use Aviso para restrições, Aplicação para uso recomendado e Compatibilidade para combinações específicas.</small>');
  if (text && !$('#noteTextMeta')) { text.maxLength = 500; text.insertAdjacentHTML('afterend', '<div id="noteTextMeta" class="note-text-meta"><span>Seja objetivo e registre a fonte quando necessário.</span><b><span id="noteTextCount">0</span>/500</b></div>'); text.addEventListener('input', () => { $('#noteTextCount').textContent = text.value.length; }); }
  type?.addEventListener('change', () => { const hints = { warning: 'Restrição, alerta ou limite que precisa de atenção.', info: 'Aplicação recomendada, uso ou contexto comercial.', neutral: 'Compatibilidade entre peça, moto, ano ou configuração.' }; const hint = $('#noteTypeHint'); if (hint) hint.textContent = hints[type.value]; });
}

function setupCatalogModules() {

  const statsGrid = $('.stats-grid');
  if (statsGrid) $('#dashboardView').insertBefore(statsGrid, $('#dashboardView').querySelector('.dashboard-grid'));
  const workspace = $('.workspace-card');
  workspace.insertAdjacentHTML('afterbegin', '<div class="module-heading"><div><span class="eyebrow">MÓDULO 01 · DADOS</span><h2>Tabela de aplicações</h2><p>Combine os filtros para encontrar a aplicação certa.</p></div><span class="module-status"><i></i>Base ativa</span></div>');
  $('#filterPanel').insertAdjacentHTML('afterend', '<div id="filterSummary" class="filter-summary" aria-live="polite"></div>');
  $('.table-meta').insertAdjacentHTML('afterend', '<div id="bulkBar" class="bulk-bar hidden"><span><strong id="selectedCount">0</strong> registros selecionados</span><div class="bulk-actions"><button type="button" id="clearSelection" class="bulk-clear">Limpar seleção</button><button type="button" id="deleteSelected" class="bulk-delete">Apagar selecionados</button></div></div>');
}

function setupGuideModule() {
  if (!$('[data-view="guia"]')) $('.nav').insertAdjacentHTML('beforeend', '<button class="nav-item" data-view="guia"><span class="nav-icon">◉</span> Guia de componentes</button>');
  $('#notesView').insertAdjacentHTML('afterend', '<section class="content hidden guide-view" id="guideView"><div class="guide-shell"><div class="guide-header"><div><p class="eyebrow">MÓDULO 02 · APLICAÇÃO</p><h1>Guia de componentes</h1><p>Selecione uma moto e clique nos pontos do diagrama para registrar avisos por peça.</p><div id="guideMeta" class="guide-note-context"></div></div><div class="guide-actions"><select id="guideMotoSelect" class="guide-select" aria-label="Selecionar moto para o guia"></select></div></div><div id="guideBody"></div></div></section><div class="modal-backdrop hidden guide-note-backdrop" id="guideNoteBackdrop"><section class="modal guide-note-modal" role="dialog" aria-modal="true" aria-labelledby="guideNoteTitle"><div class="modal-head"><div><p class="eyebrow">NOTA DO COMPONENTE</p><h2 id="guideNoteTitle">Notas e avisos</h2><p id="guideNoteComponent" class="modal-context"></p><p id="guideNoteMoto" class="guide-note-context"></p></div><button class="close-btn" id="closeGuideNotes" aria-label="Fechar">×</button></div><div id="guideNoteList" class="guide-note-list"></div><form id="guideNoteForm" class="guide-note-form"><input type="hidden" id="guideNoteId"><input type="hidden" id="guideNoteMotoId"><input type="hidden" id="guideNoteComponentId"><textarea id="guideNoteText" required placeholder="Ex.: Kawasaki 2 tempos até 2007."></textarea><div class="modal-foot"><button type="button" class="subtle-btn" id="cancelGuideNotes">Fechar</button><button class="primary-btn" type="submit">Salvar nota</button></div></form></section></div>');
}

function renderFilterSummary() {
  const items = [];
  if (state.query) items.push(['Busca', state.query, () => { state.query = ''; $('#search').value = ''; $('#searchLarge').value = ''; }]);
  if (state.brand) items.push(['Marca', state.brand, () => { state.brand = ''; $('#brandFilter').value = ''; }]);
  if (state.category) items.push(['Categoria', state.category, () => { state.category = ''; $('#categoryFilter').value = ''; }]);
  if (state.engine) items.push(['Motor', state.engine, () => { state.engine = ''; $('#engineFilter').value = ''; }]);
  if (state.year) items.push(['Ano', state.year === 'recent' ? '2020+' : state.year === 'classic' ? 'até 2010' : `${state.yearMin || '...'}–${state.yearMax || '...'}`, () => { state.year = state.yearMin = state.yearMax = ''; $('#yearFilter').value = ''; $('#yearMin').value = ''; $('#yearMax').value = ''; $('#customYearFields').classList.add('hidden'); }]);
  if (state.notesOnly) items.push(['Notas', 'Somente com notas', () => { state.notesOnly = false; $('#notesOnly').checked = false; }]);
  MMPerfil.summaryItems().forEach((item) => items.push(item));
  const summary = $('#filterSummary');
  summary.classList.toggle('has-filters', items.length > 0);
  summary.innerHTML = items.length ? `<span class="filter-summary-label">Filtros ativos</span>${items.map(([label, value], index) => `<button class="filter-chip" data-filter-index="${index}"><b>${esc(label)}:</b> ${esc(value)} <span>×</span></button>`).join('')}<button class="clear-summary">Limpar tudo</button>` : '<span class="filter-summary-empty">Nenhum filtro adicional aplicado</span>';
  summary._actions = items.map((item) => item[2]);
  summary.querySelectorAll('[data-filter-index]').forEach((chip) => chip.addEventListener('click', () => { summary._actions[Number(chip.dataset.filterIndex)](); state.page = 1; render(false); }));
  summary.querySelector('.clear-summary')?.addEventListener('click', () => $('#clearFilters').click());
}

setupGuideModule(); setupCatalogModules(); setupNotesModule(); populateOptions(); MMPerfil.init(); render();
$('#search').addEventListener('input', (event) => { state.query = event.target.value; $('#searchLarge').value = state.query; state.page = 1; render(false); });
$('#searchLarge').addEventListener('input', (event) => { state.query = event.target.value; $('#search').value = state.query; state.page = 1; render(false); });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#searchLarge').focus(); } });
$('#brandFilter').addEventListener('change', (event) => { state.brand = event.target.value; state.page = 1; render(false); }); $('#categoryFilter').addEventListener('change', (event) => { state.category = event.target.value; state.page = 1; render(false); }); $('#engineFilter').addEventListener('change', (event) => { state.engine = event.target.value; state.page = 1; render(false); });
$('#yearFilter').addEventListener('change', (event) => { state.year = event.target.value; $('#customYearFields').classList.toggle('hidden', state.year !== 'range'); state.page = 1; render(false); }); $('#yearMin').addEventListener('input', (event) => { state.yearMin = event.target.value; state.page = 1; render(false); }); $('#yearMax').addEventListener('input', (event) => { state.yearMax = event.target.value; state.page = 1; render(false); }); $('#notesOnly').addEventListener('change', (event) => { state.notesOnly = event.target.checked; state.page = 1; render(false); });
$('#filterBtn').addEventListener('click', () => { $('#filterPanel').classList.toggle('hidden'); $('#filterBtn').setAttribute('aria-expanded', String(!$('#filterPanel').classList.contains('hidden'))); }); $('#clearFilters').addEventListener('click', () => { state.page = 1; state.query = ''; $('#search').value = $('#searchLarge').value = ''; state.brand = state.category = state.engine = state.year = state.yearMin = state.yearMax = ''; state.notesOnly = false; $('#brandFilter').value = ''; $('#categoryFilter').value = ''; $('#engineFilter').value = ''; $('#yearFilter').value = ''; $('#yearMin').value = ''; $('#yearMax').value = ''; $('#notesOnly').checked = false; $('#customYearFields').classList.add('hidden'); render(); });
$$('[data-tab]').forEach((button) => button.addEventListener('click', () => { $$('[data-tab]').forEach((item) => item.classList.remove('active')); button.classList.add('active'); state.tab = button.dataset.tab; state.page = 1; render(false); })); $$('[data-quick]').forEach((button) => button.addEventListener('click', () => { $$('[data-quick]').forEach((item) => item.classList.remove('active')); button.classList.add('active'); const quick = button.dataset.quick; state.engine = quick === '2T' || quick === '4T' ? quick : ''; state.notesOnly = quick === 'notes'; $('#engineFilter').value = state.engine; $('#notesOnly').checked = state.notesOnly; state.page = 1; render(false); }));
$$('th[data-sort]').forEach((header) => header.addEventListener('click', () => { const key = header.dataset.sort; state.dir = state.sort === key ? -state.dir : 1; state.sort = key; render(); })); $('#pageSize').addEventListener('change', (event) => { state.pageSize = Number(event.target.value); state.page = 1; render(false); }); $('#prevPage').addEventListener('click', () => { state.page -= 1; render(); }); $('#nextPage').addEventListener('click', () => { state.page += 1; render(); });
$('#newMoto').addEventListener('click', () => openMotoModal()); $('#dashboardNew').addEventListener('click', () => openMotoModal()); $('#newNote').addEventListener('click', () => openNoteModal()); $('#closeModal').addEventListener('click', closeMotoModal); $('#cancelModal').addEventListener('click', closeMotoModal); $('#closeNoteModal').addEventListener('click', closeNoteModal); $('#cancelNoteModal').addEventListener('click', closeNoteModal); $('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeMotoModal(); }); $('#noteModalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'noteModalBackdrop') closeNoteModal(); });
$('#notesSearch').addEventListener('input', renderNotes); $('#notesGrid').addEventListener('click', (event) => { const card = event.target.closest('[data-note-id]'); if (!card) { if (event.target.id === 'emptyNewNote') openNoteModal(); return; } const noteId = Number(card.dataset.noteId); if (event.target.closest('.note-edit')) openNoteModal(null, noteId); if (event.target.closest('.note-delete') && confirm('Excluir esta nota?')) { if (!commitCatalog(records, notes.filter((note) => note.id !== noteId))) return; render(); toast('Nota excluída'); } });
$('#motoRows').addEventListener('click', (event) => { const row = event.target.closest('tr'); if (!row) return; const motoId = Number(row.dataset.id); if (event.target.closest('.edit')) openMotoModal(motoId); if (event.target.closest('.add-note') || event.target.closest('.note-add') || event.target.closest('.note-badge')) openNoteModal(motoId); });
$('#motoForm').addEventListener('submit', (event) => { event.preventDefault(); const id = Number($('#motoId').value); const payload = { id: id || Math.max(0, ...records.map((record) => record.id)) + 1, marca: $('#marca').value.trim(), modelo: $('#modelo').value.trim(), cilindrada: Number($('#cilindrada').value), categoria: $('#categoria').value, anoInicial: Number($('#anoInicial').value), anoFinal: Number($('#anoFinal').value), nomeTitulo: $('#nomeTitulo').value.trim(), quatroTempos: $('#motor').value === '4T' ? '4T' : '', doisTempos: $('#motor').value === '2T' ? '2T' : '' }; if (!commitCatalog(id ? records.map((record) => record.id === id ? payload : record) : [payload, ...records])) return; MMPerfil.saveForm(payload.id); closeMotoModal(); populateOptions(); render(); toast(id ? 'Registro atualizado' : 'Moto adicionada'); });
$('#noteForm').addEventListener('submit', (event) => { event.preventDefault(); const id = Number($('#noteId').value); const title = $('#noteTitle').value.trim(); const text = $('#noteText').value.trim(); if (!title || !text) return toast('Preencha o título e o conteúdo da nota'); const note = { id: id || Date.now(), motoId: Number($('#noteMotoSelect').value) || null, type: $('#noteType').value, title, text, refs: readNoteRefs(), updatedAt: new Date().toLocaleDateString('pt-BR') }; if (!commitCatalog(records, id ? notes.map((item) => item.id === id ? { ...item, ...note } : item) : [note, ...notes])) return; closeNoteModal(); render(); toast(id ? 'Nota atualizada' : 'Nota salva'); });
$('#exportBtn').addEventListener('click', exportCsv); $('#compactBtn').addEventListener('click', () => { state.compact = !state.compact; document.body.classList.toggle('compact', state.compact); toast(state.compact ? 'Linhas compactadas' : 'Linhas expandidas'); }); $('#resetData').addEventListener('click', () => { if (confirm('Restaurar os dados originais da planilha?')) { if (!commitCatalog(initialData.map(record => ({ ...record })), [])) return; selectedMotoIds.clear(); guideStore = { schemaVersion: GUIDE_SCHEMA_VERSION, notes: {} }; writeGuideStore(); MMPerfil.reset(); $('#clearFilters').click(); populateOptions(); render(); toast('Base original restaurada'); } });
$('.nav').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  const view = button.dataset.view;
  const views = { catalogo: 'catalogView', dashboard: 'dashboardView', produtos: 'dataImportView', 'data-import': 'dataImportView', notas: 'notesView', titulos: 'titulosView', guia: 'guideView' };
  $$('.main > .content').forEach(section => section.classList.toggle('hidden', section.id !== views[view]));
  $$('.nav-item').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-current', item === button ? 'page' : 'false'); });
  const labels = { catalogo: 'Catálogo de motos', dashboard: 'Visão geral', produtos: 'Produtos e categorias', notas: 'Notas e avisos', titulos: 'Parâmetros para títulos', guia: 'Guia de componentes' };
  $('#pageTitle').textContent = labels[view] || 'Produtos e categorias';
  if (views[view] === 'dataImportView') renderDataModule();
  if (view === 'guia') { renderGuideMotoOptions(); renderGuide(); }
});
$('#importProducts').addEventListener('click', () => $('#productsFile').click());
$('#productsFile').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo deve ter até 20 MB.');
    await window.MMData.importProducts(file);
    dataUi.page = 1; dataUi.category = ''; dataUi.status = ''; dataUi.query = '';
    $('#dataCategoryFilter').innerHTML = '<option value="">Todas as categorias</option>';
    $('#dataSearch').value = $('#dataStatusFilter').value = '';
    renderDataModule(); toast('Produtos importados nesta sessão.');
  } catch (error) { toast(error.message || 'Não foi possível importar o arquivo.'); }
  finally { event.target.value = ''; }
});
$$('[data-data-tab]').forEach((button) => button.addEventListener('click', () => { $$('[data-data-tab]').forEach((item) => item.classList.toggle('active', item === button)); dataUi.tab = button.dataset.dataTab; dataUi.page = 1; renderDataModule(); }));
$('#dataSearch').addEventListener('input', (event) => { dataUi.query = event.target.value; dataUi.page = 1; renderDataModule(); });
$('#dataCategoryFilter').addEventListener('change', (event) => { dataUi.category = event.target.value; dataUi.page = 1; renderDataModule(); });
$('#dataStatusFilter').addEventListener('change', (event) => { dataUi.status = event.target.value; dataUi.page = 1; renderDataModule(); });
$('#dataPageSize').addEventListener('change', (event) => { dataUi.pageSize = Number(event.target.value); dataUi.page = 1; renderDataModule(); });
$('#dataPrevPage').addEventListener('click', () => { dataUi.page -= 1; renderDataModule(); }); $('#dataNextPage').addEventListener('click', () => { dataUi.page += 1; renderDataModule(); });
applyTheme(savedTheme);
window.addEventListener('project-data-ready', () => {
  renderDataModule();
  render();
});
$('#themeBtn').addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  applyTheme(nextTheme);
  try { localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch (error) { toast('Tema aplicado somente nesta sessão.'); return; }
  toast(nextTheme === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado');
});

function openGuideForMoto(motoId) {
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'guia'));
  $('#catalogView').classList.add('hidden'); $('#dashboardView').classList.add('hidden'); $('#notesView').classList.add('hidden'); $('#guideView').classList.remove('hidden'); $('#pageTitle').textContent = 'Guia de componentes';
  renderGuideMotoOptions(motoId); renderGuide(motoId);
}
const guideNav = $('[data-view="guia"]');
guideNav?.addEventListener('click', () => openGuideForMoto($('#guideMotoSelect')?.value || records[0]?.id));
$('#guideMotoSelect').addEventListener('change', (event) => renderGuide(event.target.value));
$('#motoRows').addEventListener('click', (event) => { const guideButton = event.target.closest('.open-guide'); if (guideButton) { const row = guideButton.closest('tr'); openGuideForMoto(Number(row.dataset.id)); } });
$('#closeGuideNotes').addEventListener('click', closeGuideNotes); $('#cancelGuideNotes').addEventListener('click', closeGuideNotes); $('#guideNoteBackdrop').addEventListener('click', (event) => { if (event.target.id === 'guideNoteBackdrop') closeGuideNotes(); });
$('#guideNoteForm').addEventListener('submit', (event) => { event.preventDefault(); const motoId = Number($('#guideNoteMotoId').value); const componentId = $('#guideNoteComponentId').value; const key = guideKey(motoId, componentId); const now = new Date().toLocaleString('pt-BR'); const noteId = $('#guideNoteId').value; const list = guideNotesFor(motoId, componentId); const next = noteId ? list.map((note) => note.id === noteId ? { ...note, text: $('#guideNoteText').value.trim(), updatedAt: now } : note) : [...list, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: $('#guideNoteText').value.trim(), createdAt: now, updatedAt: now }]; guideStore.notes[key] = next; if (writeGuideStore()) { $('#guideNoteId').value = ''; $('#guideNoteText').value = ''; renderGuideNoteList(motoId, componentId); renderGuide(motoId); toast(noteId ? 'Nota do guia atualizada' : 'Nota do guia salva'); } });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeGuideNotes(); hideGuideTooltip(); } });

$('#motoRows').addEventListener('change', (event) => { if (!event.target.matches('.row-check')) return; const row = event.target.closest('tr'); const id = Number(row.dataset.id); if (event.target.checked) selectedMotoIds.add(id); else selectedMotoIds.delete(id); renderSelectionState(); });
$('#selectAll').addEventListener('change', (event) => { $('#motoRows').querySelectorAll('tr[data-id]').forEach((row) => { const id = Number(row.dataset.id); if (event.target.checked) selectedMotoIds.add(id); else selectedMotoIds.delete(id); }); renderSelectionState(); });
$('#clearSelection').addEventListener('click', () => { selectedMotoIds.clear(); renderSelectionState(); });
$('#deleteSelected').addEventListener('click', async () => { const ids = [...selectedMotoIds]; if (!ids.length) return; const confirmed = await confirmCrud('Apagar registros selecionados?', `${ids.length} registro(s) serão removidos do catálogo. Essa ação não pode ser desfeita.`, 'Apagar'); if (!confirmed) return; if (!commitCatalog(records.filter((record) => !ids.includes(Number(record.id))), notes.filter((note) => !ids.includes(Number(note.motoId))))) return; removeGuideNotesFor(ids); selectedMotoIds.clear(); populateOptions(); render(); crudFeedback('Registros apagados', `${ids.length} registro(s) removido(s) com sucesso.`); });
$('#motoRows').addEventListener('click', (event) => { if (!event.target.closest('.row-check')) return; event.stopPropagation(); });
$('#motoRows').addEventListener('click', async (event) => { const deleteButton = event.target.closest('.delete'); if (!deleteButton) return; event.preventDefault(); event.stopImmediatePropagation(); const row = deleteButton.closest('tr'); const id = Number(row.dataset.id); const record = records.find((item) => Number(item.id) === id); if (!record) return; const confirmed = await confirmCrud(`Apagar ${record.modelo}?`, 'O registro será removido do catálogo.', 'Apagar'); if (!confirmed) return; if (!commitCatalog(records.filter((item) => Number(item.id) !== id), notes.filter((note) => Number(note.motoId) !== id))) return; removeGuideNotesFor([id]); selectedMotoIds.delete(id); populateOptions(); render(); crudFeedback('Registro apagado', `${record.marca} ${record.modelo} foi removido.`); }, true);
$('#motoForm').addEventListener('submit', (event) => { const start = Number($('#anoInicial').value); const end = Number($('#anoFinal').value); const id = Number($('#motoId').value); const duplicate = records.some((record) => record.id !== id && record.marca.trim().toLowerCase() === $('#marca').value.trim().toLowerCase() && record.modelo.trim().toLowerCase() === $('#modelo').value.trim().toLowerCase()); if (!$('#marca').value.trim() || !$('#modelo').value.trim() || !$('#nomeTitulo').value.trim()) { event.preventDefault(); event.stopImmediatePropagation(); crudFeedback('Campos obrigatórios', 'Preencha marca, modelo e nome do título.', 'warning'); } else if (start > end) { event.preventDefault(); event.stopImmediatePropagation(); crudFeedback('Período inválido', 'O ano inicial não pode ser maior que o ano final.', 'warning'); } else if (duplicate) { event.preventDefault(); event.stopImmediatePropagation(); crudFeedback('Registro duplicado', 'Já existe uma moto com esta marca e modelo.', 'warning'); } }, true);
