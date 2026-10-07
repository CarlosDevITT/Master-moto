/* Local catalog tools: backups, saved filters, columns, cards and bulk edits. */
(() => {
  const PROFILE_KEY = 'master-motos-perfil-v1';
  const PREFS_KEY = 'mm-catalog-preferences-v1';
  const FAVORITES_KEY = 'mm-catalog-favorites-v1';
  const RECOVERY_KEY = 'mm-catalog-before-restore-v1';
  const CFG = window.MM_PERFIL_CFG;
  const columns = [
    ['select', 'Seleção'], ['brand', 'Marca'], ['model', 'Modelo'], ['cc', 'Cilindrada'],
    ['engine', 'Motor'], ['years', 'Anos'], ['category', 'Categoria'], ['profile', 'Perfil'],
    ['range', 'Faixa de valor'], ['curve', 'Curva'], ['notes', 'Notas'], ['title', 'Nome título'], ['actions', 'Ações']
  ];
  const requiredColumns = ['select', 'model', 'actions'];
  const optionalColumns = columns.filter(([key]) => !requiredColumns.includes(key));
  const allColumns = optionalColumns.map(([key]) => key);
  const clone = value => JSON.parse(JSON.stringify(value));
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string';
  const id = value => Number.isSafeInteger(value) && value > 0;
  function sanitizePreferences(value) {
    return {
      layout: ['auto', 'table', 'cards'].includes(value?.layout) ? value.layout : 'auto',
      columns: Array.isArray(value?.columns) ? [...new Set(value.columns.filter(key => allColumns.includes(key)))] : [...allColumns],
      compact: value?.compact === true,
      pageSize: [10, 15, 25, 50, 100].includes(value?.pageSize) ? value.pageSize : 50
    };
  }
  let preferences = sanitizePreferences(readLocalJson(PREFS_KEY, {}));
  function cleanFilter(value) {
    if (!isObject(value)) throw new Error('Filtro favorito inválido.');
    const result = {};
    for (const key of ['query', 'brand', 'category', 'yearMin', 'yearMax']) {
      if (value[key] != null && !text(value[key])) throw new Error('Filtro favorito inválido.');
      result[key] = value[key] || '';
    }
    const options = { tab: ['todos', 'offroad', 'onroad'], engine: ['', '2T', '4T'], year: ['', 'recent', 'classic', 'range'], perfil: ['', ...CFG.perfis], faixa: ['', ...CFG.faixas.map(f => f.id)], estrela: ['', 'A', 'B', 'C', 'any', 'none'], sort: ['marca', 'modelo', 'cilindrada', 'anoInicial'] };
    const defaults = { tab: 'todos', sort: 'marca' };
    for (const [key, allowed] of Object.entries(options)) {
      result[key] = value[key] ?? defaults[key] ?? '';
      if (!allowed.includes(result[key])) throw new Error('Filtro favorito inválido.');
    }
    result.notesOnly = value.notesOnly === true;
    result.pageSize = [10, 15, 25, 50, 100].includes(value.pageSize) ? value.pageSize : 50;
    result.dir = value.dir === -1 ? -1 : 1;
    return result;
  }
  function cleanFavorites(value) {
    if (!Array.isArray(value) || value.length > 100) throw new Error('Lista de favoritos inválida.');
    const seen = new Set();
    return value.map(item => {
      if (!isObject(item) || !text(item.id) || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || seen.has(item.id) || !text(item.name) || !item.name.trim() || item.name.length > 60) throw new Error('Favorito inválido.');
      seen.add(item.id);
      return { id: item.id, name: item.name.trim(), filter: cleanFilter(item.filter) };
    });
  }
  let favorites;
  try { favorites = cleanFavorites(readLocalJson(FAVORITES_KEY, [])); } catch { favorites = []; }
  let pendingRestore = null;
  let restoringRecovery = false;
  let lastVisible = [];

  // Write every part first. Only publish the new in-memory state after all writes succeed.
  function writeTransaction(entries) {
    const before = new Map();
    const changed = [];
    try {
      entries.forEach(([key]) => before.set(key, localStorage.getItem(key)));
      for (const [key, value] of entries) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, key === THEME_STORAGE_KEY ? value : JSON.stringify(value));
        changed.push(key);
      }
      return true;
    } catch {
      let recovered = true;
      for (const key of changed.reverse()) {
        try { before.get(key) === null ? localStorage.removeItem(key) : localStorage.setItem(key, before.get(key)); }
        catch { recovered = false; }
      }
      toast(recovered ? 'Não foi possível salvar. Nenhuma alteração foi aplicada.' : 'Falha ao salvar e recuperar o armazenamento. Mantenha o backup e tente restaurá-lo novamente.');
      return false;
    }
  }
  function snapshot() {
    return clone({ format: 'master-motos-backup', schemaVersion: 1, exportedAt: new Date().toISOString(), records, notes, profiles: MMPerfil.exportData(), guide: guideStore, favorites, preferences, pricing: window.MMPricing?.exportData() ?? null, theme: document.body.classList.contains('dark-mode') ? 'dark' : 'light' });
  }
  function validateBackup(value) {
    if (!isObject(value) || value.format !== 'master-motos-backup' || value.schemaVersion !== 1) throw new Error('Escolha um backup completo do Master Motos.');
    if (!Array.isArray(value.records) || value.records.length > 100000 || !Array.isArray(value.notes) || value.notes.length > 100000) throw new Error('A base do backup é inválida.');
    const unique = new Set();
    const cleanedRecords = value.records.map(record => {
      if (!validRecord(record) || !id(record.id) || unique.has(record.id) || !record.marca.trim() || !record.modelo.trim() || !record.categoria.trim() || !text(record.nomeTitulo) || !Number.isFinite(record.cilindrada) || record.cilindrada <= 0 || !Number.isInteger(record.anoInicial) || !Number.isInteger(record.anoFinal) || record.anoInicial < 1900 || record.anoFinal > 2100 || record.anoInicial > record.anoFinal || !['', '4T'].includes(record.quatroTempos) || !['', '2T'].includes(record.doisTempos) || Boolean(record.quatroTempos) === Boolean(record.doisTempos)) throw new Error('O backup contém uma moto inválida ou um identificador duplicado.');
      unique.add(record.id);
      return Object.fromEntries(['id', 'marca', 'modelo', 'categoria', 'nomeTitulo', 'cilindrada', 'anoInicial', 'anoFinal', 'quatroTempos', 'doisTempos'].map(key => [key, record[key]]));
    });
    const noteIds = new Set();
    const cleanedNotes = value.notes.map(note => {
      if (!validNote(note) || !id(note.id) || noteIds.has(note.id) || (note.motoId != null && !id(Number(note.motoId)))) throw new Error('O backup contém uma nota inválida.');
      noteIds.add(note.id);
      return { id: note.id, motoId: note.motoId == null ? null : Number(note.motoId), type: note.type, title: note.title, text: note.text, refs: (note.refs || []).filter(ref => /^https?:\/\//i.test(ref)), updatedAt: note.updatedAt || '' };
    });
    if (!isObject(value.profiles)) throw new Error('Classificações inválidas no backup.');
    const profiles = {};
    for (const [key, item] of Object.entries(value.profiles)) {
      if (!/^[1-9]\d*$/.test(key) || !isObject(item) || (item.perfil && !CFG.perfis.includes(item.perfil)) || (item.faixa && !CFG.faixas.some(f => f.id === item.faixa)) || (item.estrela && !['A', 'B', 'C'].includes(item.estrela)) || (item.valor && (!Number.isFinite(Number(item.valor)) || Number(item.valor) < 0))) throw new Error('Classificação inválida no backup.');
      profiles[key] = Object.fromEntries(['perfil', 'faixa', 'estrela', 'valor'].filter(field => item[field] != null).map(field => [field, String(item[field])]));
    }
    if (!isObject(value.guide) || value.guide.schemaVersion !== 1 || !isObject(value.guide.notes)) throw new Error('Notas de componentes inválidas no backup.');
    const guide = { schemaVersion: 1, notes: {} };
    for (const [key, list] of Object.entries(value.guide.notes)) {
      if (!/^[1-9]\d*:[a-zA-Z0-9_-]+$/.test(key) || !Array.isArray(list) || list.some(note => !isObject(note) || !text(note.id) || !text(note.text) || !text(note.createdAt) || !text(note.updatedAt))) throw new Error('Nota de componente inválida no backup.');
      guide.notes[key] = list.map(note => ({ id: note.id, text: note.text, createdAt: note.createdAt, updatedAt: note.updatedAt }));
    }
    const pricing = value.pricing == null ? null : window.MMPricing.validateData(value.pricing);
    return { format: value.format, schemaVersion: 1, records: cleanedRecords, notes: cleanedNotes, profiles, guide, favorites: cleanFavorites(value.favorites || []), preferences: sanitizePreferences(value.preferences), pricing, theme: value.theme === 'dark' ? 'dark' : 'light' };
  }
  function downloadBackup(data = snapshot()) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `master-motos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup completo exportado. Guarde o arquivo em um local seguro.');
  }
  function publishSnapshot(data) {
    records = clone(data.records); notes = clone(data.notes); guideStore = clone(data.guide);
    MMPerfil.replaceData(data.profiles);
    if (data.pricing) window.MMPricing.replaceData(data.pricing);
    favorites = clone(data.favorites); preferences = sanitizePreferences(data.preferences);
    applyTheme(data.theme); selectedMotoIds.clear();
    // Refresh both filter values and dynamically rebuilt options.
    state = { ...state, ...cleanFilter({}), page: 1, compact: preferences.compact, pageSize: preferences.pageSize };
    populateOptions(); syncFilters(); renderFavorites(); applyPreferences(); render();
    $('#lastUpdate').textContent = 'agora'; updateRecovery();
  }
  function restoreBackup(raw, recovery = false) {
    const data = validateBackup(raw);
    const entries = [[STORAGE_KEY, data.records], [NOTES_KEY, data.notes], [PROFILE_KEY, data.profiles], [GUIDE_STORAGE_KEY, data.guide], [FAVORITES_KEY, data.favorites], [PREFS_KEY, data.preferences], [THEME_STORAGE_KEY, data.theme], [`${NOTES_KEY}-backup`, data.notes], [RECOVERY_KEY, recovery ? null : snapshot()]];
    if (data.pricing) entries.push([window.MMPricing.storageKey, data.pricing]);
    if (!writeTransaction(entries)) return false;
    publishSnapshot(data);
    return true;
  }
  function stageRestore(raw, recovery = false) {
    pendingRestore = validateBackup(raw); restoringRecovery = recovery;
    $('#restoreTitle').textContent = recovery ? 'Recuperar a base anterior' : 'Restaurar backup completo';
    $('#restoreSummary').textContent = `${fmt(pendingRestore.records.length)} motos · ${fmt(pendingRestore.notes.length)} notas · ${fmt(Object.keys(pendingRestore.profiles).length)} classificações · ${fmt(pendingRestore.favorites.length)} filtros favoritos`;
    $('#restoreBackdrop').classList.remove('hidden'); $('#applyRestore').focus();
  }
  function updateRecovery() { $('#undoRestore').classList.toggle('hidden', !readLocalJson(RECOVERY_KEY, null)); }
  function syncFilters() {
    const fields = { search: 'query', searchLarge: 'query', brandFilter: 'brand', categoryFilter: 'category', engineFilter: 'engine', yearFilter: 'year', yearMin: 'yearMin', yearMax: 'yearMax', perfilFilter: 'perfil', faixaFilter: 'faixa', estrelaFilter: 'estrela', pageSize: 'pageSize' };
    for (const [field, key] of Object.entries(fields)) $('#' + field).value = state[key];
    $('#notesOnly').checked = state.notesOnly;
    $('#customYearFields').classList.toggle('hidden', state.year !== 'range');
    $$('[data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab));
  }
  function saveFavorite(name) {
    name = name.trim();
    if (!name || name.length > 60) { toast('Dê um nome de até 60 caracteres ao filtro.'); return false; }
    const existing = favorites.find(item => normalize(item.name) === normalize(name));
    if (!existing && favorites.length >= 100) { toast('Você já tem 100 filtros. Remova um antes de adicionar outro.'); return false; }
    const item = { id: existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, filter: cleanFilter(state) };
    const next = existing ? favorites.map(favorite => favorite.id === existing.id ? item : favorite) : [...favorites, item];
    if (!writeTransaction([[FAVORITES_KEY, next]])) return false;
    favorites = next; renderFavorites(); $('#favoriteList').value = item.id;
    toast(existing ? 'Filtro favorito atualizado.' : 'Filtro favorito salvo.'); return true;
  }
  function applyFavorite(favoriteId) {
    const item = favorites.find(favorite => favorite.id === favoriteId);
    if (!item) return;
    Object.assign(state, cleanFilter(item.filter), { page: 1 }); syncFilters(); render(false);
    toast(`Filtro aplicado: ${item.name}`);
  }
  function renderFavorites() {
    const chosen = $('#favoriteList').value;
    $('#favoriteList').innerHTML = '<option value="">Filtros favoritos...</option>' + favorites.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
    $('#favoriteList').value = favorites.some(item => item.id === chosen) ? chosen : '';
    $('#removeFavorite').disabled = !$('#favoriteList').value;
  }
  function savePreferences(next) {
    if (!writeTransaction([[PREFS_KEY, next]])) { applyPreferences(); return false; }
    preferences = next; applyPreferences(); render(false); return true;
  }
  function applyPreferences() {
    document.body.classList.toggle('compact', preferences.compact); state.compact = preferences.compact;
    $('#compactBtn').setAttribute('aria-pressed', String(preferences.compact));
    $('#compactBtn').textContent = preferences.compact ? '⊞ Expandir linhas' : '⊞ Compactar linhas';
    $$('[data-column-toggle]').forEach(input => input.checked = preferences.columns.includes(input.dataset.columnToggle));
  }
  function syncSelection() {
    $$('#catalogCards [data-card-id]').forEach(card => {
      const checked = selectedMotoIds.has(Number(card.dataset.cardId));
      card.classList.toggle('is-selected', checked); card.querySelector('.card-check').checked = checked;
    });
    const pageCheckbox = $('#selectCardsPage');
    if (!pageCheckbox) return;
    const selected = lastVisible.filter(record => selectedMotoIds.has(record.id)).length;
    pageCheckbox.checked = lastVisible.length > 0 && selected === lastVisible.length;
    pageCheckbox.indeterminate = selected > 0 && selected < lastVisible.length;
    pageCheckbox.disabled = !lastVisible.length;
  }
  function renderTools(visible) {
    lastVisible = visible;
    const cardMode = preferences.layout === 'cards' || (preferences.layout === 'auto' && window.innerWidth <= 620);
    $('#catalogCards').classList.toggle('hidden', !cardMode);
    $('#cardSelectionBar').classList.toggle('hidden', !cardMode);
    $('#catalogView .table-wrap').classList.toggle('hidden', cardMode);
    $$('[data-layout]').forEach(button => button.setAttribute('aria-pressed', String(cardMode === (button.dataset.layout === 'cards'))));
    const table = $('#catalogView .table-wrap table');
    table.style.minWidth = `${380 + preferences.columns.length * 92}px`;
    table.querySelectorAll('tr').forEach(row => [...row.children].forEach((cell, index) => {
      if (cell.colSpan > 1) return;
      const key = columns[index]?.[0];
      cell.dataset.column = key;
      cell.hidden = !requiredColumns.includes(key) && !preferences.columns.includes(key);
    }));
    if (cardMode) {
      $('#catalogCards').innerHTML = visible.map(record => {
        const profile = MMPerfil.get(record);
        return `<article class="moto-card" data-card-id="${record.id}"><div class="moto-card-top"><label><input class="card-check" type="checkbox" aria-label="Selecionar ${esc(record.marca)} ${esc(record.modelo)}"> <span>${esc(record.marca)}</span></label><span class="engine ${record.doisTempos ? 'two' : ''}">${record.doisTempos ? '2T' : '4T'}</span></div><h3>${esc(record.modelo)}</h3><p class="moto-card-specs">${fmt(record.cilindrada)} cc <span>·</span> ${esc(record.anoInicial)}–${esc(record.anoFinal)}</p>${categoryBadge(record.categoria)}<dl><div><dt>Perfil</dt><dd>${esc(profile.perfil)}</dd></div><div><dt>Faixa</dt><dd>${esc(MMPerfil.faixaLabel(record))}</dd></div><div><dt>Notas</dt><dd>${notesFor(record.id).length}</dd></div></dl><div class="moto-card-foot"><button class="subtle-btn" data-card-action="edit">Editar</button><button class="subtle-btn" data-card-action="add-note">+ Nota</button><button class="star-btn ${profile.estrela ? 'on' : ''}" data-card-action="star-btn" aria-label="Alterar curva de ${esc(record.modelo)}">${profile.estrela ? 'Curva ' + esc(profile.estrela) : '☆ Curva'}</button><button class="subtle-btn card-delete" data-card-action="delete" aria-label="Excluir ${esc(record.modelo)}">Excluir</button></div></article>`;
      }).join('') || '<div class="catalog-empty card-empty"><strong>Nenhuma moto encontrada</strong><p>Experimente outra busca ou cadastre uma moto.</p><div><button class="subtle-btn" data-card-empty="clear">Limpar filtros</button><button class="primary-btn" data-card-empty="new">+ Nova moto</button></div></div>';
    }
    syncSelection();
  }
  function applyBulk(patch) {
    const ids = new Set([...selectedMotoIds].filter(selected => records.some(record => record.id === selected)));
    if (!ids.size) { toast('Selecione pelo menos uma moto.'); return false; }
    const changedFields = Object.keys(patch).filter(key => ['category', 'profile', 'range', 'curve'].includes(key) && patch[key] !== '__keep__');
    if (!changedFields.length) { toast('Escolha ao menos um campo para alterar.'); return false; }
    if ((changedFields.includes('category') && !categoryOptions.includes(patch.category) && !records.some(record => record.categoria === patch.category)) || (changedFields.includes('profile') && !['', ...CFG.perfis].includes(patch.profile)) || (changedFields.includes('range') && !['', ...CFG.faixas.map(f => f.id)].includes(patch.range)) || (changedFields.includes('curve') && !['', 'A', 'B', 'C'].includes(patch.curve))) { toast('Os valores da edição são inválidos.'); return false; }
    const nextRecords = records.map(record => ids.has(record.id) && changedFields.includes('category') ? { ...record, categoria: patch.category } : record);
    const profiles = MMPerfil.exportData();
    for (const selected of ids) {
      const item = { ...(profiles[selected] || {}) };
      for (const [field, key] of [['profile', 'perfil'], ['range', 'faixa'], ['curve', 'estrela']]) {
        if (!changedFields.includes(field)) continue;
        if (patch[field] === '') delete item[key]; else item[key] = patch[field];
      }
      if (Object.keys(item).length) profiles[selected] = item; else delete profiles[selected];
    }
    if (!writeTransaction([[STORAGE_KEY, nextRecords], [PROFILE_KEY, profiles]])) return false;
    records = nextRecords; MMPerfil.replaceData(profiles); populateOptions(); syncFilters(); render();
    $('#lastUpdate').textContent = 'agora'; toast(`${ids.size} moto(s) atualizada(s).`); return true;
  }

  const optionList = values => values.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
  const modal = (backdrop, titleId, title, body) => `<div class="modal-backdrop hidden" id="${backdrop}"><section class="modal catalog-tool-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}"><div class="modal-head"><div><p class="eyebrow">CATÁLOGO</p><h2 id="${titleId}">${title}</h2></div><button class="close-btn" data-close-tool="${backdrop}" aria-label="Fechar">×</button></div>${body}</section></div>`;
  $('#catalogView .workspace-card .module-heading').insertAdjacentHTML('afterend', `<div class="catalog-tools"><div class="catalog-favorites"><label class="sr-only" for="favoriteList">Filtros favoritos</label><select id="favoriteList"><option value="">Filtros favoritos...</option></select><button class="subtle-btn" id="saveFavorite">☆ Salvar filtro</button><button class="subtle-btn" id="removeFavorite" disabled>Remover favorito</button></div><div class="catalog-view-tools"><div class="layout-toggle" role="group" aria-label="Visualização do catálogo"><button class="subtle-btn" data-layout="table">Tabela</button><button class="subtle-btn" data-layout="cards">Cartões</button></div><button class="subtle-btn" id="columnsBtn" aria-expanded="false" aria-controls="columnsPanel">Colunas</button><button class="subtle-btn" id="backupBtn">↧ Backup completo</button><button class="subtle-btn" id="restoreBtn">↥ Restaurar backup</button><button class="subtle-btn hidden" id="undoRestore">Recuperar base anterior</button><input type="file" id="backupFile" accept=".json,application/json" hidden></div></div><fieldset class="columns-panel hidden" id="columnsPanel"><legend>Colunas da tabela</legend><p>Modelo, seleção e ações ficam sempre disponíveis.</p><div>${optionalColumns.map(([key, label]) => `<label><input type="checkbox" data-column-toggle="${key}" checked> ${label}</label>`).join('')}</div><button class="subtle-btn" id="allColumns">Mostrar todas</button></fieldset>`);
  $('#catalogView .table-wrap').insertAdjacentHTML('afterend', '<div class="card-selection-bar hidden" id="cardSelectionBar"><label><input type="checkbox" id="selectCardsPage"> Selecionar motos desta página</label></div><div class="catalog-cards hidden" id="catalogCards"></div>');
  $('.bulk-actions').insertAdjacentHTML('beforeend', '<button class="subtle-btn" id="editSelected">Editar selecionados</button>');
  document.body.insertAdjacentHTML('beforeend',
    modal('favoriteBackdrop', 'favoriteTitle', 'Salvar filtro favorito', '<form id="favoriteForm"><label class="full-field">Nome do filtro<input id="favoriteName" maxlength="60" required placeholder="Ex.: Honda de trilha"></label><p class="tool-help">Guarda a busca, filtros, ordenação e quantidade por página. Um nome já existente será atualizado.</p><div class="modal-foot"><button class="subtle-btn" type="button" data-close-tool="favoriteBackdrop">Cancelar</button><button class="primary-btn" type="submit">Salvar filtro</button></div></form>') +
    modal('restoreBackdrop', 'restoreTitle', 'Restaurar backup completo', '<div class="restore-summary" id="restoreSummary"></div><p class="tool-help">A restauração substitui motos, notas, classificações e preferências atuais. A base anterior fica disponível para recuperação neste navegador.</p><div class="modal-foot"><button class="subtle-btn" id="backupBeforeRestore">Baixar backup atual</button><button class="subtle-btn" data-close-tool="restoreBackdrop">Cancelar</button><button class="primary-btn" id="applyRestore">Confirmar restauração</button></div>') +
    modal('bulkEditBackdrop', 'bulkEditTitle', 'Editar motos selecionadas', `<p class="tool-help" id="bulkEditCount"></p><form id="bulkEditForm"><div class="form-grid"><label>Categoria<select id="bulkCategory"></select></label><label>Perfil<select id="bulkProfile">${optionList([['__keep__', 'Manter atual'], ['', 'Automático pela categoria'], ...CFG.perfis.map(p => [p, p])])}</select></label><label>Faixa de valor<select id="bulkRange">${optionList([['__keep__', 'Manter atual'], ['', 'Automática pela moto'], ...CFG.faixas.map(f => [f.id, f.label])])}</select></label><label>Curva<select id="bulkCurve">${optionList([['__keep__', 'Manter atual'], ['', 'Remover curva'], ['A', 'Curva A'], ['B', 'Curva B'], ['C', 'Curva C']])}</select></label></div><p class="tool-help">Somente os campos escolhidos serão alterados. A seleção pode incluir motos de outras páginas.</p><div class="modal-foot"><button type="button" class="subtle-btn" data-close-tool="bulkEditBackdrop">Cancelar</button><button type="submit" class="primary-btn">Aplicar alterações</button></div></form>`)
  );
  document.querySelectorAll('[data-close-tool]').forEach(button => button.addEventListener('click', () => $('#' + button.dataset.closeTool).classList.add('hidden')));
  ['favoriteBackdrop', 'restoreBackdrop', 'bulkEditBackdrop'].forEach(name => $('#' + name).addEventListener('click', event => { if (event.target.id === name) $('#' + name).classList.add('hidden'); }));
  $('#backupBtn').addEventListener('click', () => downloadBackup());
  $('#backupBeforeRestore').addEventListener('click', () => downloadBackup());
  $('#restoreBtn').addEventListener('click', () => $('#backupFile').click());
  $('#backupFile').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('O backup deve ter até 20 MB.');
      stageRestore(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
    } catch (error) { toast(error instanceof SyntaxError ? 'O arquivo não contém um JSON válido.' : error.message || 'Backup inválido.'); }
    finally { event.target.value = ''; }
  });
  $('#undoRestore').addEventListener('click', () => { try { stageRestore(readLocalJson(RECOVERY_KEY, null), true); } catch (error) { toast(error.message); } });
  $('#applyRestore').addEventListener('click', () => {
    if (!pendingRestore) return;
    if (restoreBackup(pendingRestore, restoringRecovery)) { $('#restoreBackdrop').classList.add('hidden'); pendingRestore = null; toast('Base restaurada com sucesso.'); }
  });
  $('#saveFavorite').addEventListener('click', () => { $('#favoriteForm').reset(); $('#favoriteBackdrop').classList.remove('hidden'); $('#favoriteName').focus(); });
  $('#favoriteForm').addEventListener('submit', event => { event.preventDefault(); if (saveFavorite($('#favoriteName').value)) $('#favoriteBackdrop').classList.add('hidden'); });
  $('#favoriteList').addEventListener('change', event => { $('#removeFavorite').disabled = !event.target.value; applyFavorite(event.target.value); });
  $('#removeFavorite').addEventListener('click', () => {
    const chosen = $('#favoriteList').value;
    const next = favorites.filter(item => item.id !== chosen);
    if (writeTransaction([[FAVORITES_KEY, next]])) { favorites = next; renderFavorites(); toast('Filtro favorito removido.'); }
  });
  $('#columnsBtn').addEventListener('click', () => { const opened = $('#columnsPanel').classList.toggle('hidden') === false; $('#columnsBtn').setAttribute('aria-expanded', String(opened)); });
  $('#columnsPanel').addEventListener('change', event => {
    if (!event.target.matches('[data-column-toggle]')) return;
    savePreferences({ ...preferences, columns: $$('[data-column-toggle]').filter(input => input.checked).map(input => input.dataset.columnToggle) });
  });
  $('#allColumns').addEventListener('click', () => savePreferences({ ...preferences, columns: [...allColumns] }));
  $$('[data-layout]').forEach(button => button.addEventListener('click', () => savePreferences({ ...preferences, layout: button.dataset.layout })));
  $('#compactBtn').addEventListener('click', () => savePreferences({ ...preferences, compact: state.compact }));
  $('#pageSize').addEventListener('change', () => savePreferences({ ...preferences, pageSize: state.pageSize }));
  window.addEventListener('resize', () => { if (preferences.layout === 'auto') render(false); });
  $('#catalogCards').addEventListener('change', event => {
    if (!event.target.matches('.card-check')) return;
    const selected = Number(event.target.closest('[data-card-id]').dataset.cardId);
    if (event.target.checked) selectedMotoIds.add(selected); else selectedMotoIds.delete(selected);
    renderSelectionState();
  });
  $('#selectCardsPage').addEventListener('change', event => { $('#selectAll').checked = event.target.checked; $('#selectAll').dispatchEvent(new Event('change')); });
  $('#catalogCards').addEventListener('click', event => {
    const empty = event.target.closest('[data-card-empty]');
    if (empty) { empty.dataset.cardEmpty === 'clear' ? $('#catalogReset').click() : openMotoModal(); return; }
    const button = event.target.closest('[data-card-action]'); if (!button) return;
    const selected = Number(button.closest('[data-card-id]').dataset.cardId);
    $(`#motoRows tr[data-id="${selected}"] .${button.dataset.cardAction}`)?.click();
  });
  $('#editSelected').addEventListener('click', () => {
    if (!selectedMotoIds.size) return;
    $('#bulkEditForm').reset();
    $('#bulkCategory').innerHTML = optionList([['__keep__', 'Manter atual'], ...[...new Set([...categoryOptions, ...records.map(r => r.categoria)])].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(category => [category, category])]);
    $('#bulkEditCount').textContent = `${selectedMotoIds.size} moto(s) selecionada(s) serão atualizadas.`;
    $('#bulkEditBackdrop').classList.remove('hidden'); $('#bulkCategory').focus();
  });
  $('#bulkEditForm').addEventListener('submit', event => {
    event.preventDefault();
    if (applyBulk({ category: $('#bulkCategory').value, profile: $('#bulkProfile').value, range: $('#bulkRange').value, curve: $('#bulkCurve').value })) $('#bulkEditBackdrop').classList.add('hidden');
  });
  window.MMCatalogTools = { render: renderTools, syncSelection, snapshot, validateBackup, restoreBackup, stageRestore, saveFavorite, applyFavorite, applyBulk };
  state.pageSize = preferences.pageSize; $('#pageSize').value = String(state.pageSize);
  renderFavorites(); applyPreferences(); updateRecovery(); render(false);
})();
