/* Perfil de uso, faixa de valor, estrela A/B/C (moto de curva). */
window.MMPerfil = (function () {
  const CFG = window.MM_PERFIL_CFG;
  const KEY = 'master-motos-perfil-v1';
  const ESTRELAS = ['A', 'B', 'C'];
  const faixaById = Object.fromEntries(CFG.faixas.map((f) => [f.id, f]));
  let over = {};
  try { const parsed = JSON.parse(MMStorage.getItem(KEY) || '{}'); over = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch (e) { over = {}; }
  const persist = (next = over) => { if (!MMStore.commit([[KEY, next]])) return false; over = next; return true; };
  const curveForRating = n => n >= 4 ? 'A' : n === 3 ? 'B' : n >= 1 ? 'C' : '';
  function rating(r) { const value = over[r.id]?.rating; return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0; }
  function catalogCurve(r) { return curveForRating(rating(r)) || over[r.id]?.estrela || ''; }
  function ratingMarkup(r) {
    const value = rating(r);
    return `<span class="moto-rating" role="group" aria-label="Avaliar ${esc(r.modelo)}">${[1,2,3,4,5].map(n => `<button type="button" class="rating-btn ${n <= value ? 'filled' : ''}" data-rating-moto="${r.id}" data-rating-value="${n}" aria-pressed="${n === value}" aria-label="${n} estrela${n > 1 ? 's' : ''} para ${esc(r.modelo)}" title="${n} estrela${n > 1 ? 's' : ''} · Curva ${curveForRating(n)}">${n <= value ? '★' : '☆'}</button>`).join('')}<button type="button" class="rating-clear" data-rating-moto="${r.id}" data-rating-value="0" aria-label="Limpar avaliação de ${esc(r.modelo)}" ${value ? '' : 'disabled'}>×</button></span>`;
  }
  function rate(id, value) {
    if (!Number.isInteger(value) || value < 0 || value > 5) return false;
    const next = JSON.parse(JSON.stringify(over)); next[id] = { ...(next[id] || {}) }; delete next[id].estrela;
    if (value) next[id].rating = value; else delete next[id].rating;
    if (!Object.keys(next[id]).length) delete next[id]; return persist(next);
  }

  function derivePerfil(r) { return CFG.perfilPorCategoria[r.categoria] || 'Estrada / Clássica'; }
  function deriveFaixa(r) {
    const cc = Number(r.cilindrada) || 0;
    if (r.categoria === 'SuperEsportiva' || CFG.marcasPremium.includes(r.marca)) return 'premium';
    if (CFG.marcasEconomica.includes(r.marca)) return 'economica';
    if (CFG.marcasMedia.includes(r.marca)) return 'media';
    if (CFG.marcasAlta.includes(r.marca)) return cc <= 150 ? 'media' : 'alta';
    if (CFG.marcasJaponesas.includes(r.marca)) return cc <= 160 ? 'economica' : cc <= 300 ? 'media' : 'alta';
    return 'media';
  }
  function formData(id) {
    const next = JSON.parse(JSON.stringify(over)), patch = { perfil: $('#fPerfil').value, faixa: $('#fFaixa').value, valor: $('#fValor').value, estrela: $('#fEstrela').value };
    next[id] = { ...(next[id] || {}), ...patch }; Object.keys(next[id]).forEach(key => { if (!next[id][key]) delete next[id][key]; });
    const stars = Number($('#fRating').value); if (stars) { next[id].rating = stars; delete next[id].estrela; } else delete next[id].rating;
    if (!Object.keys(next[id]).length) delete next[id]; return next;
  }
  function get(r) {
    const o = over[r.id] || {};
    const market = window.MMMarket?.get(r);
    return { perfil: o.perfil || derivePerfil(r), faixa: faixaById[o.faixa] ? o.faixa : deriveFaixa(r), valor: o.valor || '', rating: rating(r), estrela: catalogCurve(r), curveManual: Boolean(o.estrela), market, manual: Boolean(o.perfil || o.faixa) };
  }
  function set(id, patch) {
    const next = { ...(over[id] || {}), ...patch };
    if (Object.hasOwn(patch, 'estrela')) delete next.rating;
    Object.keys(next).forEach((k) => { if (!next[k]) delete next[k]; });
    const updated = { ...over }; if (Object.keys(next).length) updated[id] = next; else delete updated[id];
    return persist(updated);
  }
  const nextStar = (s) => (s === '' ? 'A' : s === 'A' ? 'B' : s === 'B' ? 'C' : '');

  function cells(r) {
    const g = get(r); const f = faixaById[g.faixa];
    const star = g.estrela ? `<button class="star-btn on" title="CURVA ${g.estrela} · ${over[r.id]?.estrela ? 'ajuste manual' : 'automática pelas estrelas'} — clique para trocar">CURVA <b>${g.estrela}</b>${over[r.id]?.estrela ? '' : ' <small>auto</small>'}</button>` : '<button class="star-btn" title="Marcar como CURVA A, B ou C">☆</button>';
    return `<td class="perfil-cell">${esc(g.perfil)}</td><td><span class="faixa-badge" style="--c:${f.cor}" title="${esc(f.faixa)}${g.manual ? ' · ajustada manualmente' : ''}">${esc(f.label)}</span></td><td class="star-cell">${ratingMarkup(r)}${star}${g.rating ? `<small>${g.rating}/5 estrelas</small>` : ''}</td>`;
  }
  function match(r, s) {
    if (!s.perfil && !s.faixa && !s.estrela) return true;
    const g = get(r);
    if (s.perfil && g.perfil !== s.perfil) return false;
    if (s.faixa && g.faixa !== s.faixa) return false;
    if (s.estrela === 'any' && !g.estrela) return false;
    if (s.estrela === 'none' && g.estrela) return false;
    if (ESTRELAS.includes(s.estrela) && g.estrela !== s.estrela) return false;
    return true;
  }
  const estrelaLabel = (v) => (v === 'any' ? 'Qualquer curva' : v === 'none' ? 'Sem curva' : `CURVA ${v}`);
  function summaryItems() {
    const items = [];
    if (state.perfil) items.push(['Perfil', state.perfil, () => { state.perfil = ''; $('#perfilFilter').value = ''; }]);
    if (state.faixa) items.push(['Faixa', faixaById[state.faixa].label, () => { state.faixa = ''; $('#faixaFilter').value = ''; }]);
    if (state.estrela) items.push(['Estrela', estrelaLabel(state.estrela), () => { state.estrela = ''; $('#estrelaFilter').value = ''; }]);
    return items;
  }

  /* ---------- Painel da visão geral ---------- */
  function renderDash() {
    const host = $('#perfilDash'); if (!host) return;
    const cont = {}; CFG.faixas.forEach((f) => { cont[f.id] = 0; });
    const est = { A: 0, B: 0, C: 0 }; const perf = {};
    records.forEach((r) => { const g = get(r); cont[g.faixa]++; perf[g.perfil] = (perf[g.perfil] || 0) + 1; if (g.estrela) est[g.estrela]++; });
    const max = Math.max(1, ...Object.values(cont));
    host.innerHTML = `<div class="card-heading"><div><span class="eyebrow">PERFIL DE COMPRA</span><h2>Motos por faixa de valor</h2></div><span class="card-note">CURVA A ${est.A} · CURVA B ${est.B} · CURVA C ${est.C}</span></div><div class="rank-list">${CFG.faixas.map((f, i) => `<div class="rank-row"><span class="rank-no">${i + 1}</span><span class="rank-name">${esc(f.label)} <small style="color:var(--muted)">${esc(f.faixa)}</small></span><span class="rank-count">${cont[f.id]}</span><div class="rank-bar"><i style="width:${Math.round(cont[f.id] / max * 100)}%;background:${f.cor}"></i></div></div>`).join('')}</div><p class="perfil-note">Perfis: ${CFG.perfis.map((p) => `${esc(p)} ${perf[p] || 0}`).join(' · ')}</p>`;
  }

  function init() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-rating-moto]'); if (!button) return;
      const id = Number(button.dataset.ratingMoto), value = Number(button.dataset.ratingValue);
      const host = button.closest('#catalogAbcRows, #catalogCards, #motoRows')?.id;
      if (!rate(id, value)) return;
      render();
      document.querySelector(`${host ? '#' + host + ' ' : ''}[data-rating-moto="${id}"][data-rating-value="${value}"]`)?.focus();
    });
    const opt = (list) => list.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    /* filtros */
    $('#clearFilters').insertAdjacentHTML('beforebegin',
      `<label>Perfil<select id="perfilFilter"><option value="">Todos os perfis</option>${opt(CFG.perfis.map((p) => [p, p]))}</select></label>` +
      `<label>Faixa de valor<select id="faixaFilter"><option value="">Todas as faixas</option>${opt(CFG.faixas.map((f) => [f.id, `${f.label} (${f.faixa})`]))}</select></label>` +
      `<label>Curva<select id="estrelaFilter"><option value="">Todas</option><option value="any">Qualquer curva</option><option value="A">CURVA A</option><option value="B">CURVA B</option><option value="C">CURVA C</option><option value="none">Sem curva</option></select></label>`);
    [['#perfilFilter', 'perfil'], ['#faixaFilter', 'faixa'], ['#estrelaFilter', 'estrela']].forEach(([sel, key]) => $(sel).addEventListener('change', (e) => { state[key] = e.target.value; state.page = 1; render(); }));
    $('#clearFilters').addEventListener('click', () => { state.perfil = state.faixa = state.estrela = ''; ['#perfilFilter', '#faixaFilter', '#estrelaFilter'].forEach((s) => { $(s).value = ''; }); render(); });
    /* estrela por linha */
    $('#motoRows').addEventListener('click', (e) => { const b = e.target.closest('.star-btn'); if (!b) return; const id = Number(b.closest('tr').dataset.id); const rec = records.find((r) => Number(r.id) === id); set(id, { estrela: nextStar(get(rec).estrela) }); render(); });
    /* estrela em lote */
    $('.bulk-actions').insertAdjacentHTML('afterbegin', '<span class="bulk-stars">Marcar selecionados: <button type="button" class="bulk-star" data-star="A">CURVA A</button><button type="button" class="bulk-star" data-star="B">CURVA B</button><button type="button" class="bulk-star" data-star="C">CURVA C</button><button type="button" class="bulk-star" data-star="">Limpar avaliação e curva</button></span>');
    $('#bulkBar').addEventListener('click', (e) => { const b = e.target.closest('.bulk-star'); if (!b) return; const ids = [...selectedMotoIds], next = JSON.parse(JSON.stringify(over)); ids.forEach(id => { next[id] = { ...(next[id] || {}), estrela: b.dataset.star }; delete next[id].rating; if (!b.dataset.star) delete next[id].estrela; }); if (!persist(next)) return; render(); toast(b.dataset.star ? `${ids.length} moto(s) marcada(s) ${estrelaLabel(b.dataset.star)}` : 'Avaliação e curva removidas.'); });
    /* campos no cadastro */
    $('#nomeTitulo').closest('label').insertAdjacentHTML('afterend',
      `<label>Perfil<select id="fPerfil"><option value="">Automático (pela categoria)</option>${opt(CFG.perfis.map((p) => [p, p]))}</select></label>` +
      `<label>Faixa de valor<select id="fFaixa"><option value="">Automática (marca e cilindrada)</option>${opt(CFG.faixas.map((f) => [f.id, `${f.label} (${f.faixa})`]))}</select></label>` +
      `<label>Valor médio da moto (R$)<input id="fValor" type="number" min="0" step="100" placeholder="Opcional"></label>` +
      `<label>Avaliação em estrelas<select id="fRating"><option value="">Sem avaliação</option>${[1,2,3,4,5].map(n => `<option value="${n}">${"★".repeat(n)} · Curva ${curveForRating(n)}</option>`).join("")}</select><small>4–5: A · 3: B · 1–2: C</small></label><label>Curva manual (opcional)<select id="fEstrela"><option value="">Pela avaliação em estrelas</option><option value="A">CURVA A</option><option value="B">CURVA B</option><option value="C">CURVA C</option></select></label>`);
    $('#fRating').addEventListener('change', () => { $('#fEstrela').disabled = Boolean($('#fRating').value); if ($('#fRating').value) $('#fEstrela').value = ''; });
    const origOpen = openMotoModal;
    openMotoModal = function (id = null) { origOpen(id); const rec = id ? records.find((r) => r.id === id) : null; const o = rec ? (over[rec.id] || {}) : {}; $('#fPerfil').value = o.perfil || ''; $('#fFaixa').value = o.faixa || ''; $('#fValor').value = o.valor || ''; $('#fEstrela').value = o.estrela || ''; $('#fRating').value = o.rating || ''; $('#fEstrela').disabled = Boolean(o.rating); };

    /* painel */
    $('#dashboardView').insertAdjacentHTML('beforeend', '<article class="chart-card" id="perfilDash" style="margin-top:16px"></article>');

  }

  return { rating, catalogCurve, ratingMarkup, rate, formData, exportData() { return JSON.parse(JSON.stringify(over)); }, replaceData(data) { over = JSON.parse(JSON.stringify(data)); }, saveForm(id) { set(id, { perfil: $('#fPerfil').value, faixa: $('#fFaixa').value, valor: $('#fValor').value, estrela: $('#fEstrela').value }); }, reset() { return persist({}); }, remove(ids) { const next = { ...over }; ids.forEach(id => delete next[id]); return persist(next); }, init, cells, match, get, summaryItems, estrelaLabel, render() { renderDash(); }, faixaLabel: (r) => faixaById[get(r).faixa].label, estrela: (r) => get(r).estrela };
})();
