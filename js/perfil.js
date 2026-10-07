/* Perfil de uso, faixa de valor, estrela A/B/C (moto de curva) e gerador de títulos. */
window.MMPerfil = (function () {
  const CFG = window.MM_PERFIL_CFG;
  const KEY = 'master-motos-perfil-v1';
  const ESTRELAS = ['A', 'B', 'C'];
  const faixaById = Object.fromEntries(CFG.faixas.map((f) => [f.id, f]));
  const pecaById = Object.fromEntries(CFG.pecas.map((p) => [p.id, p]));
  let over = {};
  try { over = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { over = {}; }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(over)); } catch (e) { toast('Não foi possível salvar no navegador.'); } };
  const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  function get(r) {
    const o = over[r.id] || {};
    return { perfil: o.perfil || derivePerfil(r), faixa: o.faixa || deriveFaixa(r), valor: o.valor || '', estrela: o.estrela || '', manual: Boolean(o.perfil || o.faixa) };
  }
  function set(id, patch) {
    const next = { ...(over[id] || {}), ...patch };
    Object.keys(next).forEach((k) => { if (!next[k]) delete next[k]; });
    if (Object.keys(next).length) over[id] = next; else delete over[id];
    persist();
  }
  const nextStar = (s) => (s === '' ? 'A' : s === 'A' ? 'B' : s === 'B' ? 'C' : '');

  function cells(r) {
    const g = get(r); const f = faixaById[g.faixa];
    const star = g.estrela ? `<button class="star-btn on" title="CURVA ${g.estrela} — clique para trocar">CURVA <b>${g.estrela}</b></button>` : '<button class="star-btn" title="Marcar como CURVA A, B ou C">☆</button>';
    return `<td class="perfil-cell">${esc(g.perfil)}</td><td><span class="faixa-badge" style="--c:${f.cor}" title="${esc(f.faixa)}${g.manual ? ' · ajustada manualmente' : ''}">${esc(f.label)}</span></td><td class="star-cell">${star}</td>`;
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
    const steps = [{ a1: 1, a2: 1, marca: 1, anos: 1 }, { a1: 1, a2: 1, marca: 1, anos: 0 }, { a1: 1, a2: 0, marca: 1, anos: 0 }, { a1: 1, a2: 0, marca: 0, anos: 0 }, { a1: 0, a2: 0, marca: 0, anos: 0 }];
    for (const s of steps) { const t = build(s); if (t.length <= CFG.limiteTitulo) return t; }
    return build(steps[steps.length - 1]);
  }
  function nivelPorPreco(p) { const n = Number(p); if (!n) return ''; return CFG.pecas.find((x) => n <= x.ate).id; }
  function listaTitulos() {
    const peca = $('#tgPeca').value.trim(); const preco = $('#tgPreco').value;
    const nivel = $('#tgNivel').value || nivelPorPreco(preco);
    const escopo = $('#tgEscopo').value; const so = $('#tgCompat').checked;
    let base = escopo === 'filtradas' ? filtered() : escopo === 'estrelas' ? records.filter((r) => get(r).estrela) : records.slice();
    if (nivel && so) base = base.filter((r) => pecaById[nivel].faixas.includes(get(r).faixa));
    return { peca, nivel, rows: base.map((r) => ({ r, t: peca ? titulo(r, peca, nivel) : '' })) };
  }
  function renderTitulos() {
    if (!$('#tgBody')) return;
    const { peca, nivel, rows } = listaTitulos();
    $('#tgInfo').textContent = !peca ? 'Use esta tela para consultar os parâmetros que serão usados na criação dos títulos.' : `${rows.length} moto(s) com parâmetros para a peça ${peca}`;
    $('#tgBody').innerHTML = rows.slice(0, 200).map(({ r, t }, i) => { const g = get(r); const f = faixaById[g.faixa]; return `<tr><td>${esc(r.marca)} ${esc(r.modelo)}</td><td><span class="faixa-badge" style="--c:${f.cor}">${esc(f.label)}</span></td><td>${g.estrela ? '★ ' + g.estrela : ''}</td><td class="tg-title">${esc(t)}</td><td class="tg-len ${t.length > CFG.limiteTitulo ? 'over' : ''}">${t ? t.length : ''}</td><td><button class="subtle-btn tg-copy" data-i="${i}" ${t ? '' : 'disabled'}>Copiar</button></td></tr>`; }).join('') || '<tr><td colspan="6" style="text-align:center;padding:30px;color:#8a909b">Nenhuma moto para os critérios escolhidos.</td></tr>';
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
    if (view === 'titulos') { ['#catalogView', '#dashboardView', '#notesView'].forEach((s) => $(s)?.classList.add('hidden')); $('#pageTitle').textContent = 'Parâmetros para títulos'; renderTitulos(); }
  }

  function init() {
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
    $('.bulk-actions').insertAdjacentHTML('afterbegin', '<span class="bulk-stars">Marcar selecionados: <button type="button" class="bulk-star" data-star="A">CURVA A</button><button type="button" class="bulk-star" data-star="B">CURVA B</button><button type="button" class="bulk-star" data-star="C">CURVA C</button><button type="button" class="bulk-star" data-star="">Tirar curva</button></span>');
    $('#bulkBar').addEventListener('click', (e) => { const b = e.target.closest('.bulk-star'); if (!b) return; const ids = [...selectedMotoIds]; ids.forEach((id) => set(id, { estrela: b.dataset.star })); render(); toast(b.dataset.star ? `${ids.length} moto(s) marcada(s) ${estrelaLabel(b.dataset.star)}` : `${ids.length} moto(s) sem curva`); });
    /* campos no cadastro */
    $('#nomeTitulo').closest('label').insertAdjacentHTML('afterend',
      `<label>Perfil<select id="fPerfil"><option value="">Automático (pela categoria)</option>${opt(CFG.perfis.map((p) => [p, p]))}</select></label>` +
      `<label>Faixa de valor<select id="fFaixa"><option value="">Automática (marca e cilindrada)</option>${opt(CFG.faixas.map((f) => [f.id, `${f.label} (${f.faixa})`]))}</select></label>` +
      `<label>Valor médio da moto (R$)<input id="fValor" type="number" min="0" step="100" placeholder="Opcional"></label>` +
      `<label>Curva<select id="fEstrela"><option value="">Sem curva</option><option value="A">CURVA A</option><option value="B">CURVA B</option><option value="C">CURVA C</option></select></label>`);
    const origOpen = openMotoModal;
    openMotoModal = function (id = null) { origOpen(id); const rec = id ? records.find((r) => r.id === id) : null; const o = rec ? (over[rec.id] || {}) : {}; $('#fPerfil').value = o.perfil || ''; $('#fFaixa').value = o.faixa || ''; $('#fValor').value = o.valor || ''; $('#fEstrela').value = o.estrela || ''; };
    $('#motoForm').addEventListener('submit', () => { const id = Number($('#motoId').value) || records[0]?.id; if (id) { set(id, { perfil: $('#fPerfil').value, faixa: $('#fFaixa').value, valor: $('#fValor').value, estrela: $('#fEstrela').value }); render(); } });
    /* painel */
    $('#dashboardView').insertAdjacentHTML('beforeend', '<article class="chart-card" id="perfilDash" style="margin-top:16px"></article>');
    /* gerador de títulos */
    $('.nav').insertAdjacentHTML('beforeend', '<button class="nav-item" data-view="titulos"><span class="nav-icon">✎</span> Gerador de títulos</button>');
    $('.nav').insertAdjacentHTML('beforeend', '<button class="nav-item" data-view="data-import"><span class="nav-icon">▣</span> Produtos importados</button>');
    $('#notesView').insertAdjacentHTML('afterend', `<section class="content hidden" id="titulosView"><div class="hero-row"><div><p class="eyebrow">MÓDULO 03 · ANÚNCIOS</p><h1>Gerador de títulos</h1><p class="lede">Combine a peça com o perfil da moto: peça simples para moto simples, peça premium para moto de valor alto.</p></div></div>
<div class="workspace-card tg-card"><div class="tg-form"><label>Nome da peça<input id="tgPeca" placeholder="Ex.: Pastilha de Freio Dianteira"></label><label>Preço da peça (R$)<input id="tgPreco" type="number" min="0" placeholder="Opcional"></label><label>Nível da peça<select id="tgNivel"><option value="">Automático (preço ou moto)</option>${opt(CFG.pecas.map((p) => [p.id, p.label]))}</select></label><label>Motos<select id="tgEscopo"><option value="filtradas">Filtradas no catálogo</option><option value="estrelas">Só com ★ (A, B, C)</option><option value="todas">Todas</option></select></label><label class="check-filter"><input id="tgCompat" type="checkbox" checked> Só motos compatíveis com o nível</label></div>
<div class="table-meta"><span id="tgInfo"></span><div class="table-meta-actions"><button class="subtle-btn" id="tgCopyAll">Copiar todos</button><button class="subtle-btn" id="tgCsv">↧ Baixar CSV</button></div></div>
<div class="table-wrap"><table class="tg-table"><thead><tr><th>Moto</th><th>Faixa</th><th>★</th><th>Título sugerido</th><th>Letras</th><th></th></tr></thead><tbody id="tgBody"></tbody></table></div></div>
<div class="workspace-card tg-card" style="margin-top:16px"><div class="module-heading"><div><span class="eyebrow">REGRA</span><h2>Moto × peça</h2><p>Edite faixas e níveis em perfil-data.js.</p></div></div><div class="table-wrap"><table class="tg-table"><thead><tr><th>Faixa da moto</th><th>Valor de referência</th><th>Peça indicada</th><th>Adjetivos no título</th></tr></thead><tbody>${CFG.faixas.map((f) => `<tr><td><span class="faixa-badge" style="--c:${f.cor}">${esc(f.label)}</span></td><td>${esc(f.faixa)}</td><td>${CFG.pecas.filter((p) => p.faixas.includes(f.id)).map((p) => esc(p.label)).join(' ou ')}</td><td>${f.adj.map(esc).join(', ')}</td></tr>`).join('')}</tbody></table></div></div></section>`);
    ['#tgPeca', '#tgPreco', '#tgNivel', '#tgEscopo', '#tgCompat'].forEach((s) => $(s).addEventListener('input', renderTitulos));
    $('#tgBody').addEventListener('click', async (e) => { const b = e.target.closest('.tg-copy'); if (!b) return; const row = renderTitulos.last[Number(b.dataset.i)]; try { await navigator.clipboard.writeText(row.t); toast('Título copiado'); } catch (err) { toast('Não foi possível copiar'); } });
    $('#tgCopyAll').addEventListener('click', async () => { const t = (renderTitulos.last || []).map((x) => x.t).filter(Boolean).join('\n'); if (!t) return toast('Nada para copiar'); try { await navigator.clipboard.writeText(t); toast('Títulos copiados'); } catch (err) { toast('Não foi possível copiar'); } });
    $('#tgCsv').addEventListener('click', () => { const rows = (renderTitulos.last || []).filter((x) => x.t); if (!rows.length) return toast('Nada para exportar'); const csv = '\uFEFF' + [['Marca', 'Modelo', 'Faixa', 'Estrela', 'Título'], ...rows.map(({ r, t }) => [r.marca, r.modelo, faixaById[get(r).faixa].label, get(r).estrela, t])].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'master-motos-titulos.csv'; a.click(); URL.revokeObjectURL(a.href); });
    const paramsNav = $('[data-view="titulos"]');
    if (paramsNav) paramsNav.innerHTML = '<span class="nav-icon">☷</span> Parâmetros para títulos';
    const paramsView = $('#titulosView');
    if (paramsView) {
      const heading = paramsView.querySelector('h1');
      const lede = paramsView.querySelector('.lede');
      if (heading) heading.textContent = 'Parâmetros para títulos';
      if (lede) lede.textContent = 'Consulte os parâmetros da moto e da peça para montar seus títulos manualmente.';
      paramsView.insertAdjacentHTML('afterbegin', '<div class="workspace-card curve-card" style="margin-bottom:16px"><div class="module-heading"><div><span class="eyebrow">CLASSIFICAÇÃO DE CURVA</span><h2>Parâmetros de curva</h2><p>Use a curva da moto como referência na montagem do título.</p></div></div><div class="rank-list"><div class="rank-row"><span class="rank-no">A</span><span class="rank-name"><strong>CURVA A</strong><small style="color:var(--muted)">Maior prioridade comercial</small></span></div><div class="rank-row"><span class="rank-no">B</span><span class="rank-name"><strong>CURVA B</strong><small style="color:var(--muted)">Prioridade comercial intermediária</small></span></div><div class="rank-row"><span class="rank-no">C</span><span class="rank-name"><strong>CURVA C</strong><small style="color:var(--muted)">Prioridade comercial básica</small></span></div></div></div>');
    }
    $$('.nav-item').forEach((b) => b.addEventListener('click', () => { showView(b.dataset.view); if (b.dataset.view === 'titulos') $('#pageTitle').textContent = 'Parâmetros para títulos'; }));
  }

  return { init, cells, match, get, summaryItems, estrelaLabel, render() { renderDash(); }, faixaLabel: (r) => faixaById[get(r).faixa].label, estrela: (r) => get(r).estrela };
})();
