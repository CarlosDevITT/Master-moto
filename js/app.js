const STORAGE_KEY = 'master-motos-records-v1';
const NOTES_KEY = 'master-motos-notes-v1';
function readLocalJson(key, fallback) {
  try {
    const value = JSON.parse(MMStorage.getItem(key) || 'null');
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
let state = { tab: 'todos', query: '', category: '', brand: '', engine: '', year: '', yearMin: '', yearMax: '', notesOnly: false, page: 1, pageSize: 50, sort: 'marca', dir: 1, compact: false, perfil: '', faixa: '', estrela: '' };
let notesUi = { type: 'all', sort: 'recent' };
const selectedMotoIds = new Set();
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const THEME_STORAGE_KEY = 'mm_theme_v1';
function readTheme() {
  try { return MMStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'; } catch (error) { return 'light'; }
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
function commitCatalog(nextRecords, nextNotes = notes, profileDraft = null, resetAux = false) {
  const ids = new Set(nextRecords.map(record => Number(record.id)));
  const profiles = Object.fromEntries(Object.entries(profileDraft || MMPerfil.exportData()).filter(([id]) => ids.has(Number(id))));
  if (!MMStore.commit([[STORAGE_KEY, nextRecords], [NOTES_KEY, nextNotes], ['master-motos-perfil-v1', profiles]])) return false;
  records = nextRecords; notes = nextNotes; MMPerfil.replaceData(profiles); window.dispatchEvent(new CustomEvent('mm:catalog-updated',{detail:{count:records.length}}));
  $('#lastUpdate').textContent = 'agora'; return true;
}
function notesFor(motoId) { return notes.filter((note) => Number(note.motoId) === Number(motoId)); }
function motoName(motoId) { if (!motoId) return 'Nota geral'; const moto = records.find((record) => Number(record.id) === Number(motoId)); return moto ? `${moto.marca} ${moto.modelo}` : 'Moto removida'; }
function typeLabel(type) { return ({ warning: 'Aviso', info: 'Aplicação', neutral: 'Compatibilidade' }[type] || 'Nota'); }

function matches(record) {
  const haystack = normalize(`${record.marca} ${record.modelo} ${record.nomeTitulo} ${record.categoria} ${record.cilindrada} ${record.doisTempos ? '2T' : '4T'}`).replace(/[^a-z0-9]/g, '');
  const terms = normalize(state.query).trim().split(/\s+/).filter(Boolean);
  if (!terms.every(term => {
    if (/^(19|20)\d{2}$/.test(term)) return Number(record.anoInicial) <= Number(term) && Number(record.anoFinal) >= Number(term);
    return haystack.includes(term.replace(/[^a-z0-9]/g, ''));
  })) return false;
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

function render(full = true) {
  if (full) stats();
  $$('[data-quick]').forEach(button => button.classList.toggle('active', button.dataset.quick === (state.notesOnly ? 'notes' : state.engine || 'all')));
  $$('th[data-sort]').forEach(header => header.setAttribute('aria-sort', header.dataset.sort === state.sort ? (state.dir === 1 ? 'ascending' : 'descending') : 'none'));
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  if (state.page > pages) state.page = pages;
  const visible = rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
  $('#resultSummary').textContent = rows.length ? `Exibindo ${fmt((state.page - 1) * state.pageSize + 1)}–${fmt(Math.min(state.page * state.pageSize, rows.length))} de ${fmt(rows.length)} motos` : 'Nenhuma moto encontrada'; $('#exportBtn').disabled = rows.length === 0; $('#pageInfo').textContent = `Página ${state.page} de ${pages}`; $('.pagination .current').textContent = state.page;
  $('#prevPage').disabled = state.page === 1; $('#nextPage').disabled = state.page === pages;
  $('#motoRows').innerHTML = visible.map((record) => `<tr data-id="${record.id}"><td><input class="row-check" type="checkbox" aria-label="Selecionar ${esc(record.modelo)}"></td><td class="brand-cell">${esc(record.marca)}</td><td class="model-cell">${esc(record.modelo)}</td><td class="cc">${fmt(record.cilindrada)} cc</td><td><span class="engine ${record.doisTempos ? 'two' : ''}">${record.doisTempos ? '2T' : '4T'}</span></td><td class="year">${record.anoInicial} — ${record.anoFinal}</td><td class="category">${categoryBadge(record.categoria)}</td>${MMPerfil.cells(record)}<td class="note-cell">${noteBadge(record)}</td><td class="title-cell">${esc(record.nomeTitulo)}</td><td><div class="row-actions"><button class="row-action add-note" title="Adicionar nota">▤</button><button class="row-action edit" title="Editar">✎</button><button class="row-action delete" title="Excluir">⌫</button></div></td></tr>`).join('') || '<tr><td colspan="13" class="catalog-empty"><strong>Nenhuma moto encontrada</strong><p>Experimente outra marca, modelo ou ano, ou limpe os filtros.</p><div><button class="subtle-btn" data-empty-action="clear">Limpar busca e filtros</button><button class="primary-btn" data-empty-action="new">+ Cadastrar moto</button></div></td></tr>';
  const activeFilters = [state.brand, state.category, state.engine, state.year, state.notesOnly, state.perfil, state.faixa, state.estrela].filter(Boolean).length;
  $('#filterCount').textContent = activeFilters; $('#filterCount').classList.toggle('visible', Boolean(activeFilters));
  renderSelectionState(); renderFilterSummary();
  window.MMCatalogTools?.render(visible);
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

function renderSelectionState() {
  const rows = [...$('#motoRows').querySelectorAll('tr[data-id]')];
  rows.forEach((row) => { const id = Number(row.dataset.id); const checked = selectedMotoIds.has(id); row.classList.toggle('is-selected', checked); const checkbox = row.querySelector('.row-check'); if (checkbox) checkbox.checked = checked; });
  const selectAll = $('#selectAll'); const allSelected = rows.length > 0 && rows.every((row) => selectedMotoIds.has(Number(row.dataset.id))); const someSelected = rows.some((row) => selectedMotoIds.has(Number(row.dataset.id)));
  if (selectAll) { selectAll.checked = allSelected; selectAll.indeterminate = !allSelected && someSelected; }
  $('#selectedCount').textContent = selectedMotoIds.size; $('#bulkBar').classList.toggle('hidden', selectedMotoIds.size === 0);
  window.MMCatalogTools?.syncSelection();
}

function populateOptions() {
  const categories = [...new Set([...categoryOptions, ...records.map(r => r.categoria)])].sort((a,b) => a.localeCompare(b, 'pt-BR')).map((category) => `<option value="${esc(category)}">${esc(category)}</option>`).join(''); const brands = [...new Set(records.map(r => r.marca))].sort((a,b) => a.localeCompare(b, 'pt-BR')).map((brand) => `<option value="${esc(brand)}">${esc(brand)}</option>`).join('');
  $('#categoryFilter').innerHTML = '<option value="">Todas as categorias</option>' + categories; $('#categoria').innerHTML = categories; $('#brandFilter').innerHTML = '<option value="">Todas as marcas</option>' + brands;
  $('#categoryFilter').value = state.category; $('#brandFilter').value = state.brand;
  $('#noteMotoSelect').innerHTML = '<option value="">Nota geral</option>' + records.map((record) => `<option value="${record.id}">${esc(record.marca)} ${esc(record.modelo)}</option>`).join('');
}

function openMotoModal(id = null) { const record = id ? records.find((item) => item.id === id) : null; $('#marketRegistrationSource')?.remove(); $('#motoForm').reset(); $('#motoId').value = record?.id || ''; $('#modalEyebrow').textContent = record ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'; $('#modalTitle').textContent = record ? 'Editar moto' : 'Adicionar moto'; if (record) { $('#marca').value = record.marca; $('#modelo').value = record.modelo; $('#cilindrada').value = record.cilindrada; $('#categoria').value = record.categoria; $('#anoInicial').value = record.anoInicial; $('#anoFinal').value = record.anoFinal; $('#motor').value = record.doisTempos ? '2T' : '4T'; $('#nomeTitulo').value = record.nomeTitulo; } $('#modalBackdrop').classList.remove('hidden'); setTimeout(() => $('#marca').focus(), 30); }
function readNoteRefs() { return ($('#noteRefs')?.value || '').split(/\n+/).map((value) => value.trim()).filter((value) => /^https?:\/\//i.test(value)).slice(0, 10); }
function openNoteModal(motoId = null, noteId = null) { const note = noteId ? notes.find((item) => item.id === noteId) : null; $('#noteForm').reset(); $('#noteId').value = note?.id || ''; $('#noteMotoId').value = motoId || note?.motoId || ''; $('#noteMotoSelect').value = motoId || note?.motoId || ''; $('#noteModalTitle').textContent = note ? 'Editar nota' : 'Adicionar nota'; if (note) { $('#noteType').value = note.type; $('#noteTitle').value = note.title; $('#noteText').value = note.text; $('#noteRefs').value = (note.refs || []).join('\n'); } $('#noteContext').textContent = motoName(motoId || note?.motoId); $('#noteModalBackdrop').classList.remove('hidden'); setTimeout(() => $('#noteTitle').focus(), 30); }
function closeMotoModal() { $('#modalBackdrop').classList.add('hidden'); } function closeNoteModal() { $('#noteModalBackdrop').classList.add('hidden'); }
function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); setTimeout(() => element.classList.remove('show'), 2200); }
function confirmCrud(title, text, confirmText = 'Confirmar') { if (window.Swal) return Swal.fire({ title, text, icon: 'warning', showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancelar', reverseButtons: true }).then((result) => result.isConfirmed); return Promise.resolve(window.confirm(`${title}\n\n${text}`)); }
function crudFeedback(title, text, icon = 'success') { if (window.Swal) return Swal.fire({ title, text, icon, timer: 1500, showConfirmButton: false }); toast(text || title); }
function exportCsv() { const rows = [['Marca', 'Modelo', 'Cilindrada', 'Motor', 'Ano inicial', 'Ano final', 'Categoria', 'Perfil', 'Faixa', 'Estrela', 'Notas', 'Nome título'], ...filtered().map((record) => [record.marca, record.modelo, record.cilindrada, record.doisTempos ? '2T' : '4T', record.anoInicial, record.anoFinal, record.categoria, MMPerfil.get(record).perfil, MMPerfil.faixaLabel(record), MMPerfil.estrela(record), notesFor(record.id).map((note) => note.text).join(' | '), record.nomeTitulo])]; const content = '\uFEFF' + rows.map((row) => row.map(MMCsv.cell).join(';')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })); link.download = 'master-motos-export.csv'; link.click(); URL.revokeObjectURL(link.href); toast('CSV exportado com sucesso'); }

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

setupCatalogModules(); setupNotesModule(); populateOptions(); MMPerfil.init(); render();
// Módulos aposentados: preservar dados históricos, retirar somente a navegação.
['guia','mercado'].forEach(name=>document.querySelectorAll('#sidebarNav [data-view="'+name+'"]').forEach(el=>el.remove()));
$('#search').addEventListener('input', (event) => { state.query = event.target.value; $('#searchLarge').value = state.query; state.page = 1; render(false); });
$('#searchLarge').addEventListener('input', (event) => { state.query = event.target.value; $('#search').value = state.query; state.page = 1; render(false); });
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#searchLarge').focus(); } });
$('#brandFilter').addEventListener('change', (event) => { state.brand = event.target.value; state.page = 1; render(false); }); $('#categoryFilter').addEventListener('change', (event) => { state.category = event.target.value; state.page = 1; render(false); }); $('#engineFilter').addEventListener('change', (event) => { state.engine = event.target.value; state.page = 1; render(false); });
$('#yearFilter').addEventListener('change', (event) => { state.year = event.target.value; $('#customYearFields').classList.toggle('hidden', state.year !== 'range'); state.page = 1; render(false); }); $('#yearMin').addEventListener('input', (event) => { state.yearMin = event.target.value; state.page = 1; render(false); }); $('#yearMax').addEventListener('input', (event) => { state.yearMax = event.target.value; state.page = 1; render(false); }); $('#notesOnly').addEventListener('change', (event) => { state.notesOnly = event.target.checked; state.page = 1; render(false); });
$('#filterBtn').addEventListener('click', () => { $('#filterPanel').classList.toggle('hidden'); $('#filterBtn').setAttribute('aria-expanded', String(!$('#filterPanel').classList.contains('hidden'))); }); $('#clearFilters').addEventListener('click', () => { state.page = 1; state.query = ''; $('#search').value = $('#searchLarge').value = ''; state.brand = state.category = state.engine = state.year = state.yearMin = state.yearMax = ''; state.notesOnly = false; $('#brandFilter').value = ''; $('#categoryFilter').value = ''; $('#engineFilter').value = ''; $('#yearFilter').value = ''; $('#yearMin').value = ''; $('#yearMax').value = ''; $('#notesOnly').checked = false; $('#customYearFields').classList.add('hidden'); render(); });
$$('[data-tab]').forEach((button) => button.addEventListener('click', () => { $$('[data-tab]').forEach((item) => item.classList.remove('active')); button.classList.add('active'); state.tab = button.dataset.tab; state.page = 1; render(false); })); $$('[data-quick]').forEach((button) => button.addEventListener('click', () => { $$('[data-quick]').forEach((item) => item.classList.remove('active')); button.classList.add('active'); const quick = button.dataset.quick; state.engine = quick === '2T' || quick === '4T' ? quick : ''; state.notesOnly = quick === 'notes'; $('#engineFilter').value = state.engine; $('#notesOnly').checked = state.notesOnly; state.page = 1; render(false); }));
$$('th[data-sort]').forEach((header) => header.addEventListener('click', () => { const key = header.dataset.sort; state.dir = state.sort === key ? -state.dir : 1; state.sort = key; render(false); })); $('#pageSize').addEventListener('change', (event) => { state.pageSize = Number(event.target.value); state.page = 1; render(false); }); $('#prevPage').addEventListener('click', () => { state.page -= 1; render(false); }); $('#nextPage').addEventListener('click', () => { state.page += 1; render(false); });
$('#newMoto').addEventListener('click', () => openMotoModal()); $('#dashboardNew').addEventListener('click', () => openMotoModal()); $('#newNote').addEventListener('click', () => openNoteModal()); $('#closeModal').addEventListener('click', closeMotoModal); $('#cancelModal').addEventListener('click', closeMotoModal); $('#closeNoteModal').addEventListener('click', closeNoteModal); $('#cancelNoteModal').addEventListener('click', closeNoteModal); $('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeMotoModal(); }); $('#noteModalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'noteModalBackdrop') closeNoteModal(); });
$('#notesSearch').addEventListener('input', renderNotes); $('#notesGrid').addEventListener('click', (event) => { const card = event.target.closest('[data-note-id]'); if (!card) { if (event.target.id === 'emptyNewNote') openNoteModal(); return; } const noteId = Number(card.dataset.noteId); if (event.target.closest('.note-edit')) openNoteModal(null, noteId); if (event.target.closest('.note-delete') && confirm('Excluir esta nota?')) { if (!commitCatalog(records, notes.filter((note) => note.id !== noteId))) return; render(); toast('Nota excluída'); } });
$('#motoRows').addEventListener('click', (event) => { const row = event.target.closest('tr'); if (!row) return; const motoId = Number(row.dataset.id); if (event.target.closest('.edit')) openMotoModal(motoId); if (event.target.closest('.add-note') || event.target.closest('.note-add') || event.target.closest('.note-badge')) openNoteModal(motoId); });
$('#motoForm').addEventListener('submit', (event) => { event.preventDefault(); const id = Number($('#motoId').value); const payload = { id: id || Math.max(0, ...records.map((record) => record.id)) + 1, marca: $('#marca').value.trim(), modelo: $('#modelo').value.trim(), cilindrada: Number($('#cilindrada').value), categoria: $('#categoria').value, anoInicial: Number($('#anoInicial').value), anoFinal: Number($('#anoFinal').value), nomeTitulo: $('#nomeTitulo').value.trim(), quatroTempos: $('#motor').value === '4T' ? '4T' : '', doisTempos: $('#motor').value === '2T' ? '2T' : '' }; if (!commitCatalog(id ? records.map((record) => record.id === id ? payload : record) : [payload, ...records], notes, MMPerfil.formData(payload.id))) return; closeMotoModal(); populateOptions(); render(); toast(id ? 'Registro atualizado' : 'Moto adicionada'); });
$('#noteForm').addEventListener('submit', (event) => { event.preventDefault(); const id = Number($('#noteId').value); const title = $('#noteTitle').value.trim(); const text = $('#noteText').value.trim(); if (!title || !text) return toast('Preencha o título e o conteúdo da nota'); const note = { id: id || Date.now(), motoId: Number($('#noteMotoSelect').value) || null, type: $('#noteType').value, title, text, refs: readNoteRefs(), updatedAt: new Date().toLocaleDateString('pt-BR') }; if (!commitCatalog(records, id ? notes.map((item) => item.id === id ? { ...item, ...note } : item) : [note, ...notes])) return; closeNoteModal(); render(); toast(id ? 'Nota atualizada' : 'Nota salva'); });
$('#exportBtn').addEventListener('click', exportCsv); $('#compactBtn').addEventListener('click', () => { state.compact = !state.compact; document.body.classList.toggle('compact', state.compact); $('#compactBtn').setAttribute('aria-pressed', String(state.compact)); $('#compactBtn').textContent = state.compact ? '⊞ Expandir linhas' : '⊞ Compactar linhas'; toast(state.compact ? 'Linhas compactadas' : 'Linhas expandidas'); }); $('#resetData').addEventListener('click', () => { if (confirm('Restaurar os dados originais da planilha?')) { if (!commitCatalog(initialData.map(record => ({ ...record })), [], {}, true)) return; selectedMotoIds.clear();  $('#clearFilters').click(); populateOptions(); render(); toast('Base original restaurada'); } });
$('.nav').addEventListener('click', event => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  const view = button.dataset.view;
  // Módulos externos possuem seu próprio controlador de navegação.
  if (!['catalogo','dashboard','notas','precificacao','marcas'].includes(view)) return;
  const views = { catalogo: 'catalogView', dashboard: 'dashboardView', notas: 'notesView', precificacao: 'pricingView', marcas: 'brandsView' };
  $$('.main > .content').forEach(section => section.classList.toggle('hidden', section.id !== views[view]));
  $$('.nav-item').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-current', item === button ? 'page' : 'false'); });
  const labels = { catalogo: 'Catálogo de motos', dashboard: 'Visão geral', notas: 'Notas e avisos', precificacao: 'Precificação', marcas: 'Marcas' };
  $('#pageTitle').textContent = labels[view] || 'Catálogo de motos';
});
applyTheme(savedTheme);
$('#themeBtn').addEventListener('click', () => {
  const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
  applyTheme(nextTheme);
  try { MMStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch (error) { toast('Tema aplicado somente nesta sessão.'); return; }
  toast(nextTheme === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado');
});

$('#motoRows').addEventListener('change', (event) => { if (!event.target.matches('.row-check')) return; const row = event.target.closest('tr'); const id = Number(row.dataset.id); if (event.target.checked) selectedMotoIds.add(id); else selectedMotoIds.delete(id); renderSelectionState(); });
$('#selectAll').addEventListener('change', (event) => { $('#motoRows').querySelectorAll('tr[data-id]').forEach((row) => { const id = Number(row.dataset.id); if (event.target.checked) selectedMotoIds.add(id); else selectedMotoIds.delete(id); }); renderSelectionState(); });
$('#clearSelection').addEventListener('click', () => { selectedMotoIds.clear(); renderSelectionState(); });
$('#deleteSelected').addEventListener('click', async () => { const ids = [...selectedMotoIds]; if (!ids.length) return; const confirmed = await confirmCrud('Apagar registros selecionados?', `${ids.length} registro(s) serão removidos do catálogo. Essa ação não pode ser desfeita.`, 'Apagar'); if (!confirmed) return; if (!commitCatalog(records.filter((record) => !ids.includes(Number(record.id))), notes.filter((note) => !ids.includes(Number(note.motoId))))) return;  selectedMotoIds.clear(); populateOptions(); render(); crudFeedback('Registros apagados', `${ids.length} registro(s) removido(s) com sucesso.`); });
$('#motoRows').addEventListener('click', (event) => { if (!event.target.closest('.row-check')) return; event.stopPropagation(); });
$('#motoRows').addEventListener('click', async (event) => { const deleteButton = event.target.closest('.delete'); if (!deleteButton) return; event.preventDefault(); event.stopImmediatePropagation(); const row = deleteButton.closest('tr'); const id = Number(row.dataset.id); const record = records.find((item) => Number(item.id) === id); if (!record) return; const confirmed = await confirmCrud(`Apagar ${record.modelo}?`, 'O registro será removido do catálogo.', 'Apagar'); if (!confirmed) return; if (!commitCatalog(records.filter((item) => Number(item.id) !== id), notes.filter((note) => Number(note.motoId) !== id))) return;  selectedMotoIds.delete(id); populateOptions(); render(); crudFeedback('Registro apagado', `${record.marca} ${record.modelo} foi removido.`); }, true);
$('#motoForm').addEventListener('submit', (event) => { const start = Number($('#anoInicial').value); const end = Number($('#anoFinal').value); const id = Number($('#motoId').value); const duplicate = records.some((record) => record.id !== id && record.marca.trim().toLowerCase() === $('#marca').value.trim().toLowerCase() && record.modelo.trim().toLowerCase() === $('#modelo').value.trim().toLowerCase()); if (!$('#marca').value.trim() || !$('#modelo').value.trim() || !$('#nomeTitulo').value.trim()) { event.preventDefault(); event.stopImmediatePropagation(); crudFeedback('Campos obrigatórios', 'Preencha marca, modelo e nome do título.', 'warning'); } else if (start > end) { event.preventDefault(); event.stopImmediatePropagation(); crudFeedback('Período inválido', 'O ano inicial não pode ser maior que o ano final.', 'warning'); } else if (duplicate) { event.preventDefault(); event.stopImmediatePropagation(); crudFeedback('Registro duplicado', 'Já existe uma moto com esta marca e modelo.', 'warning'); } }, true);

$('#catalogReset').addEventListener('click', () => {
  state.tab = 'todos';
  $$('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === 'todos'));
  $('#clearFilters').click();
});
$('#motoRows').addEventListener('click', event => {
  const action = event.target.closest('[data-empty-action]')?.dataset.emptyAction;
  if (action === 'clear') $('#catalogReset').click();
  if (action === 'new') openMotoModal();
});
