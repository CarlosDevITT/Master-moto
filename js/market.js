/* Public-market ABC: independent from seller overrides and actual part compatibility. */
(() => {
  const E = window.MMMarketEngine, KEY = 'mm-market-cache-v1';
  let data = null, ranking = [], loading = false, lastCheck = 0;
  const nf = new Intl.NumberFormat('pt-BR'), pf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const matches = new Map();
  const reviewed = {
    'HONDA/CG160': { modelo: 'CG 160 Fan', cc: 162.7, year: 2025, category: 'Street / Naked', source: 'https://saladeimprensa.honda.com.br/releases/honda-cg-160-2025-nova-geracao-da-motocicleta-preferida-dos-brasileiros-traz-importantes' },
    'HONDA/BIZ': { modelo: 'Biz 125', cc: 123.9, year: 2025, category: 'Street / Naked', source: 'https://saladeimprensa.honda.com.br/motocicletas/street/biz-125' },
    'HONDA/POP110I': { modelo: 'Pop 110i ES', cc: 109.5, year: 2025, category: 'Street / Naked', source: 'https://saladeimprensa.honda.com.br/motocicletas/street/pop-110i' },
    'HONDA/NXR160': { modelo: 'NXR 160 Bros', cc: 162.7, year: 2026, category: 'Adventure / Trail', source: 'https://prodsalaimp.honda.com.br/releases/honda-nxr-160-bros-2026-nova-cor-para-versao-cbs' }
  };
  const find = record => {
    const key = record.marca + '\u0000' + record.modelo;
    if (!matches.has(key)) matches.set(key, E.match(record, ranking));
    return matches.get(key);
  };
  try { const cached = MMStorage.getItem(KEY); if (cached) { data = E.validate(JSON.parse(cached)); ranking = E.rank(data); } } catch { /* Invalid cache cannot drive classification. */ }
  window.MMMarket = { get: find, ranked: () => ranking.slice(), refresh, data: () => data };
  $('.nav').insertAdjacentHTML('beforeend', '<button class="nav-item" data-view="mercado"><span class="nav-icon">◴</span> Curva ABC Brasil</button>');
  $('.main').insertAdjacentHTML('beforeend', `<section class="content hidden" id="marketView"><div class="hero-row"><div><p class="eyebrow">BRASIL · INTELIGÊNCIA DE MERCADO</p><h1>Curva ABC das motos</h1><p class="lede">Priorize aplicações e prepare anúncios com referência nos emplacamentos nacionais.</p></div><button class="primary-btn" id="marketRefresh">↻ Verificar atualização</button></div><div class="workspace-card market-source"><strong id="marketPeriod">Carregando fonte oficial...</strong><p id="marketStatus" role="status" aria-live="polite"></p><a id="marketSource" target="_blank" rel="noopener noreferrer">Abrir relatório da Fenabrave ↗</a></div><div class="market-kpis" id="marketKpis"></div><div class="workspace-card market-method"><strong>Como usar a curva</strong><p>A: primeiros modelos até atingir 80% do volume da amostra; B: próximos até atingir 95%; C: restantes. O modelo que cruza o limite permanece na faixa anterior. A classificação usa o acumulado do ano; os filtros não recalculam a curva.</p><p>São emplacamentos de motos novas, não vendas de peças no Mercado Livre nem tamanho da frota em circulação. O relatório agrupa algumas famílias e publica líderes por segmento. Modelos ausentes ficam sem curva automática. Marcas e nomes precisam corresponder exatamente ou ter uma equivalência revisada.</p></div><div class="workspace-card"><div class="market-toolbar"><label class="search"><span>⌕</span><input id="marketSearch" type="search" placeholder="Buscar marca ou modelo" aria-label="Buscar no ranking"></label><label>Curva<select id="marketCurve"><option value="">Todas</option><option>A</option><option>B</option><option>C</option></select></label><label>Catálogo<select id="marketCoverage"><option value="">Todos os modelos</option><option value="matched">Com aplicação cadastrada</option><option value="missing">Ainda sem aplicação</option></select></label><button class="subtle-btn" id="marketExport">Exportar ranking CSV</button></div><div class="table-meta"><span id="marketCount" role="status"></span></div><div class="table-wrap market-table"><table><thead><tr><th>Posição</th><th>Modelo / família</th><th>Curva</th><th>Acumulado no ano</th><th>Mês do relatório</th><th>Variação mensal</th><th>% da amostra</th><th>% acumulado</th><th>Aplicações</th></tr></thead><tbody id="marketRows"></tbody></table></div></div></section>`);
  function renderPanel() {
    const applications = new Map();
    records.forEach(record => { const row = find(record); if (row) applications.set(row.id, (applications.get(row.id) || 0) + 1); });
    const query = normalize($('#marketSearch').value).split(/\s+/).filter(Boolean);
    const rows = ranking.filter(row => {
      const name = normalize(row.brand + ' ' + row.model);
      const count = applications.get(row.id) || 0;
      return query.every(term => name.includes(term)) && (!$('#marketCurve').value || row.curve === $('#marketCurve').value) && (!$('#marketCoverage').value || ($('#marketCoverage').value === 'matched' ? count > 0 : !count));
    });
    $('#marketCount').textContent = `${nf.format(rows.length)} de ${ranking.length} modelos publicados · curva sobre o acumulado do ano`;
    $('#marketRows').innerHTML = rows.map(row => {
      const matched = applications.get(row.id) || 0;
      const change = row.previous ? (row.monthly / row.previous - 1) * 100 : null;
      return `<tr><td>${row.rank}</td><td><strong>${esc(row.brand)} ${esc(row.model)}</strong><span class="market-volume-bar"><i style="width:${Math.max(1, row.units / ranking[0].units * 100)}%"></i></span></td><td><span class="market-curve curve-${row.curve}">${row.curve}</span></td><td>${nf.format(row.units)}</td><td>${nf.format(row.monthly)}</td><td>${change == null ? 'Sem base anterior' : (change > 0 ? '+' : '') + pf.format(change) + '%'}</td><td>${pf.format(row.share)}%</td><td>${pf.format(row.cumulative)}%</td><td>${matched ? `<button class="subtle-btn" data-market-model="${esc(row.id)}">Ver ${matched} aplicação(ões)</button>` : `<button class="subtle-btn" data-market-add="${esc(row.id)}">+ Cadastrar</button>`}</td></tr>`;
    }).join('') || '<tr><td colspan="9" class="catalog-empty">Nenhum modelo disponível para esses critérios.</td></tr>';
    $('#marketExport').disabled = !data;
    if (!data) return;
    const sum = ranking.reduce((total, row) => total + row.units, 0);
    $('#marketPeriod').textContent = `Fenabrave · janeiro a ${new Date(data.period + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
    $('#marketSource').href = data.source;
    $('#marketKpis').innerHTML = [['Emplacamentos no Brasil', nf.format(data.totalYearToDate)], ['Cobertura da amostra publicada', pf.format(sum / data.totalYearToDate * 100) + '%'], ['Modelos na curva A', ranking.filter(row => row.curve === 'A').length], ['Modelos sem aplicação cadastrada', ranking.filter(row => !applications.has(row.id)).length]].map(([label, value]) => `<article class="workspace-card"><span>${label}</span><strong>${value}</strong></article>`).join('');
  }
  async function refresh(manual = false) {
    if (loading) return; loading = true; $('#marketRefresh').disabled = true;
    $('#marketStatus').textContent = 'Verificando os dados publicados...';
    try {
      const response = await fetch('Data/market-sales.json', { cache: 'no-store', signal: AbortSignal.timeout?.(15000) });
      if (!response.ok) throw Error('Fonte indisponível');
      // arrayBuffer also supports the static test harness and avoids encoding ambiguity.
      const next = E.validate(JSON.parse(new TextDecoder().decode(await response.arrayBuffer())));
      if (!data || next.period >= data.period) { data = next; ranking = E.rank(data); matches.clear(); }
      try { MMStorage.setItem(KEY, JSON.stringify(data)); } catch { /* Live dataset remains usable without local cache. */ }
      lastCheck = Date.now();
      const stale = Date.now() - Date.parse(data.period + '-01T00:00:00Z') > 65 * 86400000;
      $('#marketStatus').textContent = `${stale ? 'Período antigo: confira a atualização da fonte. ' : ''}Dados disponíveis carregados. Extração oficial: ${new Date(data.checkedAt).toLocaleDateString('pt-BR')}. Verificação automática ao abrir e a cada 6 horas com o site ativo.`;
      renderPanel(); render();
      if (manual) toast('Ranking disponível verificado.');
    } catch {
      $('#marketStatus').textContent = data ? 'Sem acesso à atualização. Exibindo o último período salvo; tente novamente quando estiver conectado.' : 'Não foi possível carregar o ranking. Abra o site pelo servidor e tente novamente.';
      renderPanel();
    } finally { loading = false; $('#marketRefresh').disabled = false; }
  }
  $('#marketRefresh').addEventListener('click', () => refresh(true));
  ['marketSearch', 'marketCurve', 'marketCoverage'].forEach(id => $('#' + id).addEventListener(id === 'marketSearch' ? 'input' : 'change', renderPanel));
  $('#marketRows').addEventListener('click', event => {
    const add = event.target.closest('[data-market-add]');
    if (add) {
      const row = ranking.find(item => item.id === add.dataset.marketAdd); if (!row) return;
      const preset = reviewed[row.id]; openMotoModal();
      $('#marca').value = row.brand[0] + row.brand.slice(1).toLowerCase();
      $('#modelo').value = preset?.modelo || row.model;
      $('#nomeTitulo').value = $('#modelo').value;
      $('#cilindrada').value = preset?.cc || '';
      $('#anoInicial').value = $('#anoFinal').value = preset?.year || '';
      $('#categoria').value = preset?.category || '';
      $('#motor').value = preset ? '4T' : '';
      document.querySelector('#marketRegistrationSource')?.remove();
      $('#motoForm').insertAdjacentHTML('afterbegin', `<p class="market-registration-source" id="marketRegistrationSource">${preset ? `Modelo e ano de referência: <a href="${esc(preset.source)}" target="_blank" rel="noopener noreferrer">fonte do fabricante ↗</a>.` : 'Informe cilindrada, motor, categoria e anos após conferir o fabricante.'} Revise a versão e os anos de aplicação antes de salvar.</p>`);
      $('#modelo').focus(); return;
    }
    const button = event.target.closest('[data-market-model]'); if (!button) return;
    const row = ranking.find(item => item.id === button.dataset.marketModel);
    const record = records.find(item => find(item)?.id === row.id); if (!record) return;
    $('#catalogReset').click(); state.query = ''; state.brand = ''; state.marketFamily = row.id; state.page = 1;
    $('#search').value = $('#searchLarge').value = state.query; $('#brandFilter').value = state.brand;
    $('[data-view="catalogo"]').click(); render();
  });
  $('#marketExport').addEventListener('click', () => {
    if (!data) return;
    const quote = MMCsv.cell;
    const csv = '\uFEFF' + [['Posição', 'Marca', 'Modelo', 'Curva', 'Acumulado', 'Mês', '% amostra', '% acumulado', 'Período', 'Fonte'], ...ranking.map(row => [row.rank, row.brand, row.model, row.curve, row.units, row.monthly, pf.format(row.share), pf.format(row.cumulative), data.period, data.source])].map(row => row.map(quote).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `master-motos-curva-abc-${data.period}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('.nav').addEventListener('click', event => { if (event.target.closest('[data-view]')?.dataset.view === 'mercado') renderPanel(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 6 * 3600000) refresh(); });
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 6 * 3600000);
  renderPanel(); refresh();
})();
