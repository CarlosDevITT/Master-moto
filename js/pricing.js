(() => {
  const KEY = 'master-motos-pricing-v1';
  const E = window.MMPricingEngine;
  const channels = E.channels;
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let data = E.defaults(), timer, savedAt = null, loadError = false, migrated = false;
  try {
    const stored = MMStorage.getItem(KEY);
    if (stored) { const parsed=JSON.parse(stored); migrated=parsed.schemaVersion===1; data = E.validate(parsed); savedAt = 'anteriormente'; }
  } catch { loadError = true; }
  let lastValid = clone(data);
  const q = selector => document.querySelector('#pricingView ' + selector);
  const qa = selector => [...document.querySelectorAll('#pricingView ' + selector)];
  const shown = value => value == null ? '' : String(value).replace('.', ',');
  const input = (value, attrs, label, optional = false) => `<label class="pricing-field">${label}<input type="text" inputmode="decimal" autocomplete="off" value="${esc(shown(value))}" ${attrs} ${optional ? '' : 'required'}><small>${optional ? 'Vazio = taxa padrão' : ''}</small></label>`;
  const panelAttrs = key => `data-pricing-panel="${key}" ${data.ui[key] ? 'open' : ''}`;
  function snapshotValid() {
    const safe = clone(lastValid), problems = [];
    safe.ui = clone(data.ui);
    try { safe.settings = E.validate({ ...safe, settings: data.settings, categories: [], fees: [] }).settings; } catch { problems.push('preferências gerais'); }
    try { const values = E.validate({ ...safe, knownPrice: data.knownPrice, fees: data.fees, categories: [] }); safe.knownPrice = values.knownPrice; safe.fees = values.fees; } catch { problems.push('conferência de taxas'); }
    safe.categories = data.categories.flatMap(category => {
      try { return E.validate({ ...safe, categories: [category], ui: {} }).categories; }
      catch {
        const field = q(`[data-pricing-category="${category.id}"] input[aria-invalid="true"]`);
        problems.push((category.name || 'Produto sem nome') + (field ? ' · ' + (field.getAttribute('aria-label') || field.closest('label')?.firstChild?.textContent || 'campo inválido') : ' · revise os campos'));
        const previous = lastValid.categories.find(item => item.id === category.id);
        return previous ? [{ ...clone(previous), collapsed: category.collapsed }] : [];
      }
    });
    return { value: E.validate(safe), problems };
  }
  function saveLayout() {
    qa('details[data-pricing-panel]').forEach(panel => data.ui[panel.dataset.pricingPanel] = panel.open);
    persistValid(false, true);
  }
  function persistValid(manual = false, layout = false) {
    try {
      const { value, problems } = snapshotValid();
      MMStorage.setItem(KEY, JSON.stringify(value)); lastValid = clone(value);
      savedAt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (!layout || !timer) setStatus(problems.length ? `Valores válidos salvos · campos inválidos em: ${problems.join('; ')}` : `Preferências salvas neste navegador · ${savedAt}`, problems.length > 0);
      if (manual) toast(problems.length ? 'Produtos válidos salvos. Revise os campos indicados.' : 'Preferências de precificação salvas.');
      return problems.length === 0;
    } catch { setStatus('Não foi possível salvar. Exporte as preferências ou tente novamente.', true); if (manual) toast('Falha no armazenamento. As alterações estão apenas nesta sessão.'); return false; }
  }
  function setStatus(message, error = false) {
    q('#pricingSaveStatus').textContent = message;
    q('#pricingSaveStatus').classList.toggle('is-error', error);
    q('#pricingReview')?.classList.toggle('hidden', !error || !q('input[aria-invalid="true"]'));
  }
  function save(manual = false) { clearTimeout(timer); timer = null; return persistValid(manual); }
  function changed() { setStatus('Alterações não salvas · salvando automaticamente...'); clearTimeout(timer); timer = setTimeout(() => save(), 350); }
  function replaceData(next) {
    clearTimeout(timer); timer = null; data = E.validate(next); lastValid = clone(data); renderAll();
    setStatus('Preferências restauradas neste navegador.');
  }
  function getCategory(element) { return data.categories.find(item => item.id === element.closest('[data-pricing-category]')?.dataset.pricingCategory); }
  function categoryMarkup(category, index) {
    const scenario = category.scenarios.find(item => item.id === category.selectedScenario) || category.scenarios[0];
    return `<article class="workspace-card pricing-category ${category.collapsed ? 'is-collapsed' : ''}" data-pricing-category="${category.id}">
      <div class="pricing-category-head"><span class="pricing-index">${index + 1}</span><label class="pricing-name"><span class="sr-only">Nome do produto</span><input type="text" maxlength="120" value="${esc(category.name)}" data-category-field="name" placeholder="Nome do produto"></label><span class="pricing-mini-result" data-mini-result></span><div><button class="subtle-btn" data-pricing-action="duplicate" title="Criar uma cópia com os mesmos custos e taxas">Duplicar</button><button class="subtle-btn pricing-danger" data-pricing-action="remove-category">Remover</button><button class="subtle-btn" data-pricing-action="collapse" aria-expanded="${!category.collapsed}" aria-label="Expandir ou recolher ${esc(category.name)}">${category.collapsed ? 'Expandir' : 'Recolher'}</button></div></div>
      <div class="pricing-category-body ${category.collapsed ? 'hidden' : ''}">
        <div class="pricing-quick-grid">
          ${input(category.cost, 'data-category-field="cost" data-min="0" data-max="1000000000"', 'Custo do produto (R$)')}
          ${input(category.shipping, 'data-category-field="shipping" data-min="0" data-max="1000000000"', 'Frete por sua conta (R$)')}
          ${input(scenario.feePct, 'data-quick-scenario="feePct" data-min="0" data-max="100"', 'Taxa (%)')}
        </div>
        <div class="pricing-base"><span>Custo total</span><strong data-base-total>—</strong></div>
        <div class="pricing-result-heading"><div><span class="eyebrow">SEU PREÇO DE VENDA</span><h2>Resultados por canal</h2></div><span class="pricing-help">Calculados automaticamente</span></div>
        <div class="pricing-results">${channels.map(channel => `<section class="pricing-result ${channel.id === 'premium' ? 'pricing-result-featured' : ''}" data-result-channel="${channel.id}"><span class="pricing-channel-label">${channel.label}</span><strong data-result-price>—</strong><small data-result-profit>—</small><button class="subtle-btn" data-pricing-action="copy" data-copy-channel="${channel.id}">Copiar preço</button><details ${panelAttrs(category.id + ':breakdown-' + channel.id)}><summary>Detalhes do preço</summary><dl data-result-breakdown></dl></details></section>`).join('')}</div>
      </div></article>`;
  }
  function renderFeeRows() {
    q('#pricingFeeRows').innerHTML = data.fees.map(fee => `<div class="pricing-fee" data-fee-id="${esc(fee.id)}"><label><span class="sr-only">Nome da taxa</span><input type="text" maxlength="120" value="${esc(fee.name)}" data-fee-field="name"></label><label><span class="sr-only">Percentual da taxa</span><input type="text" inputmode="decimal" value="${esc(shown(fee.pct))}" data-fee-field="pct" data-min="0" data-max="100" aria-label="Percentual de ${esc(fee.name)}"></label><output data-fee-value>—</output><button type="button" class="subtle-btn pricing-danger" data-pricing-action="remove-fee" aria-label="Remover ${esc(fee.name)}">×</button></div>`).join('') || '<p class="pricing-help">Nenhuma taxa cadastrada. Adicione uma taxa para conferir seu valor.</p>';
    updateFees();
  }
  function updateFees() {
    qa('[data-fee-id]').forEach(row => {
      const fee = data.fees.find(item => item.id === row.dataset.feeId);
      row.querySelector('[data-fee-value]').textContent = data.knownPrice != null && data.knownPrice >= 0 && fee.pct != null && fee.pct >= 0 && fee.pct <= 100 ? money.format(data.knownPrice * fee.pct / 100) : 'Revise os valores';
    });
  }
  function updateCategory(category, sourceField = null) {
    const host = q(`[data-pricing-category="${category.id}"]`);
    if (!host) return;
    const costs = ['cost', 'shipping'].map(key => category[key]);
    host.querySelector('[data-base-total]').textContent = costs.every(value => value != null && value >= 0) ? money.format(costs.reduce((sum, value) => sum + value, 0)) : 'Revise os custos';
    const scenario = category.scenarios.find(item => item.id === category.selectedScenario) || category.scenarios[0];
    host.querySelectorAll('[data-quick-scenario]').forEach(field => {
      if (field !== sourceField) field.value = shown(scenario[field.dataset.quickScenario]);
      field.setAttribute('aria-invalid', String(scenario[field.dataset.quickScenario] == null || scenario[field.dataset.quickScenario] < 0 || scenario[field.dataset.quickScenario] > 100));
    });
    const mini = E.calculate(category, scenario, data.settings, 'premium');
    host.querySelector('[data-mini-result]').textContent = mini.valid ? `Premium ${money.format(mini.price)}` : 'Preencha os custos';
    for (const channel of channels) {
      const result = E.calculate(category, scenario, data.settings, channel.id);
      const card = host.querySelector(`[data-result-channel="${channel.id}"]`);
      card.querySelector('[data-result-price]').textContent = result.valid ? money.format(result.price) : '—';
      card.querySelector('[data-result-profit]').textContent = result.valid ? 'Custo, frete e taxas incluídos' : result.message;
      card.classList.toggle('pricing-invalid', !result.valid); card.querySelector('[data-pricing-action="copy"]').disabled = !result.valid;
      card.querySelector('[data-result-breakdown]').innerHTML = result.valid ? [['Custo + frete', result.base], ['Tarifa fixa por venda', result.fixedFee], ['Comissão / ajuste', result.commissionAmount], ['Taxa operacional', result.operatingAmount], ['Taxa informada', result.feeAmount]].map(([label, value]) => `<div><dt>${label}</dt><dd>${money.format(value)}</dd></div>`).join('') : '<p>Corrija os campos para calcular.</p>';
    }
  }
  function renderCategories() {
    q('#pricingCategories').innerHTML = data.categories.map(categoryMarkup).join('') || '<div class="workspace-card pricing-empty"><h2>Comece uma simulação</h2><p>Adicione um produto, preencha o custo e veja os preços.</p><button class="primary-btn" data-pricing-action="add-category">+ Novo produto</button></div>';
    data.categories.forEach(updateCategory);
    q('#pricingCategoryCount').textContent = `${data.categories.length} simulação(ões)`;
  }
  function renderAll() {
    qa('[data-pricing-setting]').forEach(field => { const value = data.settings[field.dataset.pricingSetting]; field.value = field.tagName === 'SELECT' ? value : shown(value); });
    q('#pricingKnownPrice').value = shown(data.knownPrice);
    renderCategories(); renderFeeRows();
    qa('details[data-pricing-panel]').forEach(panel => panel.open = panel.dataset.pricingPanel === 'fees' && data.ui.fees == null ? true : Boolean(data.ui[panel.dataset.pricingPanel]));
  }
  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportPreferences() {
    const { value, problems } = snapshotValid();
    download(JSON.stringify({ format: 'master-motos-pricing', schemaVersion: 1, data: value }, null, 2), 'application/json', 'master-motos-precificacao.json');
    toast(problems.length ? 'Preferências válidas exportadas. Produtos incompletos usam os últimos valores salvos.' : 'Preferências exportadas.');
  }
  function exportCsv() {
    const rows = [['Produto / categoria', 'Custo', 'Frete', 'Taxa %', 'Canal', 'Custo total', 'Preço sugerido', 'Situação']];
    data.categories.forEach(category => {
      const scenario=category.scenarios.find(item=>item.id===category.selectedScenario)||category.scenarios[0];
      channels.forEach(channel => {
        const result=E.calculate(category,scenario,data.settings,channel.id);
        rows.push([category.name, category.cost, category.shipping, scenario.feePct, channel.label, result.valid?result.base.toFixed(2):'',result.valid?result.price.toFixed(2):'',result.valid?'Calculado':result.message]);
      });
    });
    const cell = MMCsv.cell;
    download('\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8', 'master-motos-precos.csv');
    toast('Comparação de preços exportada.');
  }
  $('.nav').insertAdjacentHTML('beforeend', '<button class="nav-item" data-view="precificacao"><span class="nav-icon">▥</span> Precificação</button>');
  $('.main').insertAdjacentHTML('beforeend', `<section class="content hidden" id="pricingView"><div class="hero-row"><div><p class="eyebrow">MASTER MOTOS · PRECIFICAÇÃO</p><h1>Precificação</h1><p class="lede">Informe custo, frete e taxa. Os preços aparecem automaticamente.</p></div><button class="primary-btn" id="pricingAddCategory">+ Novo produto</button></div><div class="pricing-save-bar"><span id="pricingSaveStatus" role="status" aria-live="polite"></span><div><button class="subtle-btn" id="pricingSave">Salvar preferências</button><button class="subtle-btn" id="pricingExport">↧ Exportar preferências</button><button class="subtle-btn" id="pricingImport">↥ Importar preferências</button><button class="subtle-btn" id="pricingCsv">↧ Exportar preços CSV</button><input type="file" id="pricingFile" accept=".json,application/json" hidden></div></div><p class="pricing-example-note">Os valores iniciais são exemplos do HTML enviado. Ajuste as taxas dos canais à sua operação. Nos produtos, preencha apenas custo, frete e taxa.</p><details class="workspace-card pricing-settings" data-pricing-panel="settings"><summary>Preferências gerais <small>Taxas padrão para suas simulações</small></summary><div class="pricing-settings-body"><div class="pricing-settings-grid">${[['fixedPct', 'Taxa operacional sobre a venda (%)'], ['premiumPct', 'Comissão padrão · ML Premium (%)'], ['classicPct', 'Comissão padrão · ML Clássico (%)'], ['commerce6Pct', 'Taxa padrão · e-commerce 6x (%)'], ['commerce3Pct', 'Taxa padrão · e-commerce 3x (%)'], ['storePct', 'Ajuste padrão · loja (%)'], ['feePct', 'Taxa padrão para novos produtos (%)']].map(([key, label]) => input(data.settings[key], `data-pricing-setting="${key}" data-min="${key === 'storePct' ? -100 : 0}" data-max="100"`, label)).join('')}<label class="pricing-field">Arredondar o preço para cima<select data-pricing-setting="rounding"><option value="cent">Próximo centavo</option><option value="whole">Próximo real inteiro</option><option value="ending99">Final ,99</option></select><small>Arredondamento aplicado ao preço calculado.</small></label></div><p class="pricing-help">Taxas padrão são usadas quando a comissão do canal está vazia. A taxa operacional se soma às comissões. Um ajuste negativo na loja reduz a dedução total; use-o apenas se esse crédito fizer parte da sua operação. A taxa padrão se aplica aos novos produtos.</p></div></details><details class="workspace-card pricing-fee-check" data-pricing-panel="fees"><summary>Conferir taxas de um preço conhecido</summary><div class="pricing-settings-body">${input(data.knownPrice, 'id="pricingKnownPrice" data-min="0" data-max="1000000000"', 'Preço de venda conhecido (R$)')}<div id="pricingFeeRows"></div><button class="subtle-btn" data-pricing-action="add-fee">+ Adicionar taxa</button><p class="pricing-help">Esta conferência mostra o valor de cada percentual. Ela não adiciona essas taxas às simulações.</p></div></details><div class="pricing-section-title"><h2>Produtos e categorias</h2><span id="pricingCategoryCount"></span></div><div id="pricingCategories"></div><details class="workspace-card pricing-method" data-pricing-panel="method"><summary>Entenda o cálculo</summary><div class="pricing-settings-body"><p>Preço = (custo + frete + tarifa do canal) ÷ [1 − (comissão do canal + taxa operacional + taxa informada) ÷ 100].</p><p class="pricing-help">Todos os percentuais incidem sobre o preço de venda. Não há lucro desejado acrescentado ao cálculo. As taxas dos canais usam as preferências já salvas.</p><a href="https://vendedores.mercadolivre.com.br/nota/como-usar-o-simulador-de-custos-do-mercado-livre?guideKeyId=GE53&moduleKeyId=MO282" target="_blank" rel="noopener noreferrer">Conferir os custos no simulador oficial do Mercado Livre ↗</a></div></details></section>`);

  // Keep optional tools away from the everyday cost → price flow.
  const toolsPanel = document.createElement('details');
  q('#pricingSaveStatus').insertAdjacentHTML('afterend', '<button class="subtle-btn hidden" id="pricingReview">Revisar campo pendente</button>');
  q('#pricingReview').addEventListener('click', () => {
    const field = q('input[aria-invalid="true"]'); if (!field) return;
    const product = field.closest('[data-pricing-category]');
    if (product?.classList.contains('is-collapsed')) product.querySelector('[data-pricing-action="collapse"]').click();
    for (let parent = field.parentElement; parent && parent.id !== 'pricingView'; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    field.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); field.focus(); field.select();
  });
  toolsPanel.className = 'pricing-tools'; toolsPanel.dataset.pricingPanel = 'tools';
  toolsPanel.innerHTML = '<summary>Backup e exportação</summary>';
  toolsPanel.append(q('.pricing-save-bar > div')); q('.pricing-save-bar').append(toolsPanel);
  const settingsPanel = q('.pricing-settings'), feesPanel = q('.pricing-fee-check');
  q('.pricing-example-note').before(feesPanel); q('.pricing-method').before(settingsPanel);
  q('.pricing-section-title').insertAdjacentHTML('beforeend', '<div class="pricing-organize"><button class="subtle-btn" data-pricing-action="expand-all">Expandir todos</button><button class="subtle-btn" data-pricing-action="collapse-all">Recolher todos</button><button class="subtle-btn" id="pricingSettingsShortcut">Taxas e preferências</button></div>');
  q('#pricingSettingsShortcut').addEventListener('click', () => { settingsPanel.open = true; settingsPanel.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); settingsPanel.querySelector('summary').focus(); });
  $('#pricingView').addEventListener('toggle', event => {
    const panel = event.target;
    if (!panel.isConnected || !panel.dataset.pricingPanel || Boolean(data.ui[panel.dataset.pricingPanel]) === panel.open) return;
    data.ui[panel.dataset.pricingPanel] = panel.open; saveLayout();
  }, true);
  $('#pricingView').addEventListener('focusin', event => { if (event.target.inputMode === 'decimal') event.target.select(); });
  $('#pricingView').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target.inputMode !== 'decimal') return;
    const grid = event.target.closest('.pricing-quick-grid'); if (!grid) return;
    event.preventDefault(); const fields = [...grid.querySelectorAll('input')], next = fields[fields.indexOf(event.target) + 1];
    if (next) next.focus(); else getCategory(event.target) && event.target.closest('[data-pricing-category]').querySelector('[data-pricing-action="copy"]')?.focus();
  });
  $('#pricingView').addEventListener('input', event => {
    const field = event.target;
    const numeric = field.inputMode === 'decimal';
    const optionalCost = field.dataset.categoryField === 'shipping' && !field.value.trim();
    const parsed = numeric ? optionalCost ? 0 : E.parseNumber(field.value) : field.value;
    if (numeric) {
      field.setAttribute('aria-invalid', String(parsed == null || parsed < Number(field.dataset.min) || parsed > Number(field.dataset.max)));
    }
    if (field.dataset.pricingSetting) { data.settings[field.dataset.pricingSetting] = parsed; data.categories.forEach(updateCategory); }
    else if (field.id === 'pricingKnownPrice') { data.knownPrice = parsed; updateFees(); }
    else if (field.dataset.feeField) {
      const fee = data.fees.find(item => item.id === field.closest('[data-fee-id]').dataset.feeId);
      fee[field.dataset.feeField] = parsed; updateFees();
    } else {
      const category = getCategory(field); if (!category) return;
      if (field.dataset.categoryField) category[field.dataset.categoryField] = parsed;
      else if (field.dataset.quickScenario) {
        const scenario = category.scenarios.find(item => item.id === category.selectedScenario);
        scenario[field.dataset.quickScenario] = parsed;
      }
      else return;
      updateCategory(category, field);
    }
    changed();
  });
  $('#pricingView').addEventListener('change', event => {
    const field = event.target;
    if (field.matches('select[data-pricing-setting]')) { data.settings[field.dataset.pricingSetting] = field.value; data.categories.forEach(updateCategory); changed(); }
  });
  function addCategory() {
    if (data.categories.length >= 50) return toast('Limite de 50 simulações. Remova uma para adicionar outra.');
    const category = clone(E.defaults().categories[0]); category.id = uid('category'); category.name = 'Nova simulação'; category.cost = 0; category.shipping = 0;
    channels.forEach(channel => category.commissions[channel.id] = null);
    category.scenarios = [{ id: uid('scenario'), label: 'Minha faixa', feePct: data.settings.feePct }]; category.selectedScenario = category.scenarios[0].id;
    data.categories.push(category); renderCategories(); changed();
    q(`[data-pricing-category="${category.id}"] [data-category-field="cost"]`).focus();
  }
  $('#pricingView').addEventListener('click', async event => {
    const button = event.target.closest('[data-pricing-action]'); if (!button) return;
    const action = button.dataset.pricingAction;
    const category = getCategory(button);
    if (action === 'collapse-all' || action === 'expand-all') { data.categories.forEach(item => item.collapsed = action === 'collapse-all'); renderCategories(); saveLayout(); return; }
    if (action === 'add-category') return addCategory();
    if (action === 'add-fee') { if (data.fees.length >= 50) return toast('Limite de 50 taxas.'); data.fees.push({ id: uid('fee'), name: 'Nova taxa', pct: 0 }); renderFeeRows(); }
    if (action === 'remove-fee') { data.fees = data.fees.filter(item => item.id !== button.closest('[data-fee-id]').dataset.feeId); renderFeeRows(); }
    if (!category) { changed(); return; }
    if (action === 'copy') {
      const scenario = category.scenarios.find(item => item.id === category.selectedScenario);
      const result = E.calculate(category, scenario, data.settings, button.dataset.copyChannel);
      if (!result.valid) return;
      try { await navigator.clipboard.writeText(result.price.toFixed(2).replace('.', ',')); toast('Preço copiado.'); } catch { toast('Não foi possível copiar. Selecione o preço para copiá-lo.'); }
      return;
    }
    if (action === 'collapse') { category.collapsed = !category.collapsed; const host = button.closest('[data-pricing-category]'); host.classList.toggle('is-collapsed', category.collapsed); host.querySelector('.pricing-category-body').classList.toggle('hidden', category.collapsed); button.textContent = category.collapsed ? 'Expandir' : 'Recolher'; button.setAttribute('aria-expanded', String(!category.collapsed)); saveLayout(); return; }
    if (action === 'duplicate') {
      if (data.categories.length >= 50) return toast('Limite de 50 simulações.');
      try { E.validate(data); } catch { return toast('Corrija os campos inválidos antes de duplicar.'); }
      const duplicate = clone(category); duplicate.id = uid('category'); duplicate.name = category.name.slice(0, 112) + ' · cópia';
      Object.entries(data.ui).filter(([key]) => key.startsWith(category.id + ':')).forEach(([key, value]) => data.ui[key.replace(category.id + ':', duplicate.id + ':')] = value);
      data.categories.push(duplicate); renderCategories();
    }
    if (action === 'remove-category') { if (!confirm(`Remover a simulação “${category.name || 'Sem nome'}”?`)) return; data.categories = data.categories.filter(item => item.id !== category.id); Object.keys(data.ui).filter(key => key.startsWith(category.id + ':')).forEach(key => delete data.ui[key]); renderCategories(); }
    changed();
  });
  q('#pricingAddCategory').addEventListener('click', addCategory);
  q('#pricingSave').addEventListener('click', () => save(true));
  q('#pricingExport').addEventListener('click', exportPreferences);
  q('#pricingCsv').addEventListener('click', exportCsv);
  q('#pricingImport').addEventListener('click', () => q('#pricingFile').click());
  q('#pricingFile').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('O arquivo deve ter até 5 MB.');
      const parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      if (parsed.format !== 'master-motos-pricing' || parsed.schemaVersion !== 1) throw new Error('Escolha um arquivo de preferências da precificação.');
      const next = E.validate(parsed.data);
      if (!confirm(`Importar ${next.categories.length} simulação(ões) e substituir suas preferências?`)) return;
      MMStorage.setItem(KEY, JSON.stringify(next)); replaceData(next); toast('Preferências importadas e salvas.');
    } catch (error) { toast(error instanceof SyntaxError ? 'Arquivo JSON inválido.' : error.message || 'Não foi possível importar.'); }
    finally { event.target.value = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && timer) save(); });
  window.addEventListener('pagehide', () => { saveLayout(); if (timer) save(); });
  window.MMPricing = { storageKey: KEY, exportData() { return snapshotValid().value; }, validateData: E.validate, replaceData, save };
  renderAll();
  setStatus(loadError ? 'Não foi possível ler as preferências. Os exemplos foram carregados; revise e salve novamente.' : migrated ? 'Preferências atualizadas: custos adicionais incluídos no custo; lucro desejado removido.' : savedAt ? 'Preferências recuperadas deste navegador.' : 'Exemplos carregados · personalize e salve suas preferências.', loadError);
})();
