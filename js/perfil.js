/* Perfil de uso, faixa de valor, estrela A/B/C (moto de curva) e gerador de títulos. */
window.MMPerfil = (function () {
  const CFG = window.MM_PERFIL_CFG;
  const KEY = 'master-motos-perfil-v1';
  const ESTRELAS = ['A', 'B', 'C'];
  const faixaById = Object.fromEntries(CFG.faixas.map((f) => [f.id, f]));
  const pecaById = Object.fromEntries(CFG.pecas.map((p) => [p.id, p]));
  let over = {};
  try { const parsed = JSON.parse(localStorage.getItem(KEY) || '{}'); over = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch (e) { over = {}; }
  const persist = (next = over) => { if (!MMStore.commit([[KEY, next]])) return false; over = next; return true; };
  const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

  /* ---------- Parâmetros para títulos ---------- */
  function adjetivos(r, nivelId) {
    const g = get(r);
    const ranking = ['economica', 'media', 'alta', 'premium'];
    const allowed = nivelId ? (pecaById[nivelId]?.faixas || [g.faixa]) : [g.faixa];
    const faixaAdj = allowed.includes(g.faixa)
      ? g.faixa
      : allowed
          .map((faixa) => ({ faixa, distance: Math.abs(ranking.indexOf(faixa) - ranking.indexOf(g.faixa || 'media')) }))
          .sort((a, b) => a.distance - b.distance)[0]?.faixa || g.faixa;
    const base = faixaById[faixaAdj].adj.slice();
    if (['alta', 'premium'].includes(faixaAdj)) base[1] = CFG.adjPerfil[g.perfil] || base[1];
    return base;
  }
  function titulo(r, peca, nivelId) {
    const [a1, a2] = adjetivos(r, nivelId);
    const nome = norm(r.nomeTitulo).includes(norm(r.marca)) ? r.nomeTitulo : `${r.marca} ${r.nomeTitulo}`;
    const anos = r.anoInicial && r.anoFinal ? (r.anoInicial === r.anoFinal ? `${r.anoInicial}` : `${r.anoInicial}-${r.anoFinal}`) : '';
    const build = (o) => [peca, o.a1 && a1, o.a2 && a2, o.marca ? nome : r.nomeTitulo, o.anos && anos].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const steps = [{ a1: 0, a2: 0, marca: 1, anos: 1 }, { a1: 0, a2: 0, marca: 0, anos: 1 }];
    for (const s of steps) { const t = build(s); if (t.length <= CFG.limiteTitulo) return t; }
    return build(steps[steps.length - 1]);
  }
  function nivelPorPreco(p) { const n = Number(p); if (!n) return ''; return CFG.pecas.find((x) => n <= x.ate).id; }
  function listaTitulos() {
    const peca = $('#tgPeca').value.trim(); const preco = $('#tgPreco').value;
    const nivel = $('#tgNivel').value || nivelPorPreco(preco);
    const escopo = $('#tgEscopo').value; const so = $('#tgCompat').checked;
    let base = escopo === 'filtradas' ? filtered() : escopo === 'estrelas' ? records.filter((r) => get(r).estrela) : records.slice();
    if (escopo === 'catalogoA') base = records.filter(r => catalogCurve(r) === 'A').sort((a,b) => rating(b) - rating(a) || a.modelo.localeCompare(b.modelo, 'pt-BR'));
    if (escopo === 'mercadoA' || escopo === 'mercado') base = base.filter(r => window.MMMarket?.get(r) && (escopo !== 'mercadoA' || window.MMMarket.get(r).curve === 'A')).sort((a, b) => window.MMMarket.get(b).units - window.MMMarket.get(a).units);
    if (nivel && so) base = base.filter((r) => pecaById[nivel].faixas.includes(get(r).faixa));
    return { peca, nivel, rows: base.map((r) => ({ r, t: peca ? titulo(r, peca, nivel) : '' })) };
  }
  function renderTitulos() {
    if (!$('#tgBody')) return;
    const { peca, nivel, rows } = listaTitulos();
    const oversized = rows.filter(row => row.t.length > CFG.limiteTitulo).length;
    $('#tgInfo').textContent = !peca ? 'Informe o nome da peça para gerar os títulos.' : `${rows.length} moto(s) para ${peca}${oversized ? ` · ${oversized} título(s) acima do limite: reduza o nome da peça` : ''}${rows.length > 200 ? ' · exibindo os primeiros 200; exportação inclui os títulos válidos' : ''}`;
    $('#tgBody').innerHTML = rows.slice(0, 200).map(({ r, t }, i) => { const g = get(r); const f = faixaById[g.faixa]; return `<tr><td>${esc(r.marca)} ${esc(r.modelo)}</td><td><span class="faixa-badge" style="--c:${f.cor}">${esc(f.label)}</span></td><td>${g.estrela ? '★ ' + g.estrela : ''}</td><td class="tg-title">${esc(t)}</td><td class="tg-len ${t.length > CFG.limiteTitulo ? 'over' : ''}">${t ? t.length : ''}</td><td><button class="subtle-btn tg-copy" data-i="${i}" ${t && t.length <= CFG.limiteTitulo ? '' : 'disabled'}>Copiar</button></td></tr>`; }).join('') || '<tr><td colspan="6" style="text-align:center;padding:30px;color:#8a909b">Nenhuma moto para os critérios escolhidos.</td></tr>';
    renderTitulos.last = rows;
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

  function showView(view) {
    const t = $('#titulosView'); if (!t) return;
    t.classList.toggle('hidden', view !== 'titulos');
    if (view !== 'guia') $('#guideView')?.classList.add('hidden');
    if (view === 'titulos') { ['#catalogView', '#dashboardView', '#notesView'].forEach((s) => $(s)?.classList.add('hidden')); $('#pageTitle').textContent = 'Gerador de títulos'; renderTitulos(); }
  }

  function init() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-rating-moto]'); if (!button) return;
      const id = Number(button.dataset.ratingMoto), value = Number(button.dataset.ratingValue);
      const host = button.closest('#catalogAbcRows, #catalogCards, #motoRows')?.id;
      if (!rate(id, value)) return;
      render(); if (!$('#titulosView')?.classList.contains('hidden')) renderTitulos();
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
    /* gerador de títulos */
    $('.nav').insertAdjacentHTML('beforeend', '<button class="nav-item" data-view="titulos"><span class="nav-icon">✎</span> Gerador de títulos</button>');

    $('#notesView').insertAdjacentHTML('afterend', `<section class="content hidden" id="titulosView"><div class="hero-row"><div><p class="eyebrow">MÓDULO 03 · ANÚNCIOS</p><h1>Gerador de títulos</h1><p class="lede">Combine a peça com o perfil da moto: peça simples para moto simples, peça premium para moto de valor alto.</p></div></div>
<div class="workspace-card tg-card"><div class="tg-form"><label>Nome da peça<input id="tgPeca" placeholder="Ex.: Pastilha de Freio Dianteira"></label><label>Preço da peça (R$)<input id="tgPreco" type="number" min="0" placeholder="Opcional"></label><label>Nível da peça<select id="tgNivel"><option value="">Automático (preço ou moto)</option>${opt(CFG.pecas.map((p) => [p.id, p.label]))}</select></label><label>Motos<select id="tgEscopo"><option value="filtradas">Filtradas no catálogo</option><option value="estrelas">Só com ★ (A, B, C)</option><option value="todas">Todas</option></select></label><label class="check-filter"><input id="tgCompat" type="checkbox" checked> Filtrar faixa de valor da moto</label></div>
<div class="table-meta"><span id="tgInfo"></span><div class="table-meta-actions"><button class="subtle-btn" id="tgCopyAll">Copiar todos</button><button class="subtle-btn" id="tgCsv">↧ Baixar CSV</button></div></div>
<div class="table-wrap"><table class="tg-table"><thead><tr><th>Moto</th><th>Faixa</th><th>★</th><th>Título sugerido</th><th>Letras</th><th></th></tr></thead><tbody id="tgBody"></tbody></table></div></div>
<div class="workspace-card tg-card" style="margin-top:16px"><div class="module-heading"><div><span class="eyebrow">REGRA</span><h2>Moto × peça</h2><p>As faixas orientam o posicionamento comercial. A aplicação da peça precisa ser confirmada.</p></div></div><div class="table-wrap"><table class="tg-table"><thead><tr><th>Faixa da moto</th><th>Valor de referência</th><th>Peça indicada</th><th>Adjetivos no título</th></tr></thead><tbody>${CFG.faixas.map((f) => `<tr><td><span class="faixa-badge" style="--c:${f.cor}">${esc(f.label)}</span></td><td>${esc(f.faixa)}</td><td>${CFG.pecas.filter((p) => p.faixas.includes(f.id)).map((p) => esc(p.label)).join(' ou ')}</td><td>${f.adj.map(esc).join(', ')}</td></tr>`).join('')}</tbody></table></div></div></section>`);
    ['#tgPeca', '#tgPreco', '#tgNivel', '#tgEscopo', '#tgCompat'].forEach((s) => $(s).addEventListener('input', renderTitulos));
    $('#tgBody').addEventListener('click', async (e) => { const b = e.target.closest('.tg-copy'); if (!b) return; const row = renderTitulos.last[Number(b.dataset.i)]; try { await navigator.clipboard.writeText(row.t); toast('Título copiado'); } catch (err) { toast('Não foi possível copiar'); } });
    $('#tgCopyAll').addEventListener('click', async () => { const t = (renderTitulos.last || []).map((x) => x.t).filter(t => t && t.length <= CFG.limiteTitulo).join('\n'); if (!t) return toast('Nada para copiar'); try { await navigator.clipboard.writeText(t); toast('Títulos copiados'); } catch (err) { toast('Não foi possível copiar'); } });
    $('#tgCsv').addEventListener('click', () => { const rows = (renderTitulos.last || []).filter((x) => x.t && x.t.length <= CFG.limiteTitulo); if (!rows.length) return toast('Nada para exportar'); const csv = '\uFEFF' + [['Marca', 'Modelo', 'Faixa', 'Estrela', 'Título'], ...rows.map(({ r, t }) => [r.marca, r.modelo, faixaById[get(r).faixa].label, get(r).estrela, t])].map((l) => l.map(MMCsv.cell).join(';')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'master-motos-titulos.csv'; a.click(); URL.revokeObjectURL(a.href); });
    const paramsNav = $('[data-view="titulos"]');
    if (paramsNav) paramsNav.innerHTML = '<span class="nav-icon">✎</span> Gerador de títulos';
    const paramsView = $('#titulosView');
    if (paramsView) {
      const heading = paramsView.querySelector('h1');
      const lede = paramsView.querySelector('.lede');
      if (heading) heading.textContent = 'Gerador de títulos';
      if (lede) lede.textContent = 'Gere títulos com peça, modelo e anos cadastrados. Priorize a curva do mercado e confirme a compatibilidade antes de publicar.';
      $('#tgEscopo').insertAdjacentHTML('beforeend', '<option value="mercadoA">Curva A do mercado</option><option value="mercado">Ranking de mercado</option>');
      paramsView.insertAdjacentHTML('afterbegin', '<div class="workspace-card curve-card" style="margin-bottom:16px"><div class="module-heading"><div><span class="eyebrow">CLASSIFICAÇÃO DE CURVA</span><h2>Parâmetros de curva</h2><p>Use a curva da moto como referência na montagem do título.</p></div></div><div class="rank-list"><div class="rank-row"><span class="rank-no">A</span><span class="rank-name"><strong>CURVA A</strong><small style="color:var(--muted)">Maior prioridade comercial</small></span></div><div class="rank-row"><span class="rank-no">B</span><span class="rank-name"><strong>CURVA B</strong><small style="color:var(--muted)">Prioridade comercial intermediária</small></span></div><div class="rank-row"><span class="rank-no">C</span><span class="rank-name"><strong>CURVA C</strong><small style="color:var(--muted)">Prioridade comercial básica</small></span></div></div></div>');
    }
    $('.nav').addEventListener('click', event => { const b = event.target.closest('[data-view]'); if (b) showView(b.dataset.view); });
  }

  return { rating, catalogCurve, ratingMarkup, rate, formData, refreshTitles: renderTitulos, exportData() { return JSON.parse(JSON.stringify(over)); }, replaceData(data) { over = JSON.parse(JSON.stringify(data)); }, saveForm(id) { set(id, { perfil: $('#fPerfil').value, faixa: $('#fFaixa').value, valor: $('#fValor').value, estrela: $('#fEstrela').value }); }, reset() { return persist({}); }, remove(ids) { const next = { ...over }; ids.forEach(id => delete next[id]); return persist(next); }, init, cells, match, get, summaryItems, estrelaLabel, render() { renderDash(); }, faixaLabel: (r) => faixaById[get(r).faixa].label, estrela: (r) => get(r).estrela };
})();
