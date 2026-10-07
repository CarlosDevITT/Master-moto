(() => {
  const KEY = 'master-motos-pricing-v1';
  const E = window.MMPricingEngine;
  const channels = E.channels;
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let data = E.defaults(), timer, savedAt = null, loadError = false;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) { data = E.validate(JSON.parse(stored)); savedAt = 'anteriormente'; }
  } catch { loadError = true; }
  let lastValid = clone(data);
  const q = selector => document.querySelector('#pricingView ' + selector);
  const qa = selector => [...document.querySelectorAll('#pricingView ' + selector)];
  const shown = value => value == null ? '' : String(value).replace('.', ',');
  const input = (value, attrs, label, optional = false) => `<label class="pricing-field">${label}<input type="text" inputmode="decimal" autocomplete="off" value="${esc(shown(value))}" ${attrs} ${optional ? '' : 'required'}><small>${optional ? 'Vazio = taxa padrão' : ''}</small></label>`;
  function setStatus(message, error = false) {
    q('#pricingSaveStatus').textContent = message;
    q('#pricingSaveStatus').classList.toggle('is-error', error);
  }
  function save(manual = false) {
    clearTimeout(timer);
    timer = null;
    try {
      const validated = E.validate(data);
      localStorage.setItem(KEY, JSON.stringify(validated));
      lastValid = clone(validated);
      savedAt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setStatus(`Preferências salvas neste navegador · ${savedAt}`);
      if (manual) toast('Preferências de precificação salvas.');
      return true;
    } catch (error) {
      const invalid = (() => { try { E.validate(data); return false; } catch { return true; } })();
      setStatus(invalid ? 'Há campos inválidos. Corrija-os para salvar.' : 'Não foi possível salvar. Exporte as preferências ou tente novamente.', true);
      if (manual) toast(invalid ? 'Revise os campos antes de salvar.' : 'Falha no armazenamento. As alterações estão apenas nesta sessão.');
      return false;
    }
  }
  function changed() { setStatus('Alterações não salvas · salvando automaticamente...'); clearTimeout(timer); timer = setTimeout(() => save(), 350); }
  function replaceData(next) {
    clearTimeout(timer); timer = null; data = E.validate(next); lastValid = clone(data); renderAll();
    setStatus('Preferências restauradas neste navegador.');
  }
  function getCategory(element) { return data.categories.find(item => item.id === element.closest('[data-pricing-category]')?.dataset.pricingCategory); }
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
  function categoryHtml(category, index) {
    const fields = [['cost', 'Custo do produto (R$)'], ['shipping', 'Frete pago por você (R$)'], ['packaging', 'Embalagem (R$)'], ['extra', 'Outros custos (R$)']];
    return `<article class="workspace-card pricing-category" data-pricing-category="${esc(category.id)}"><div class="pricing-category-head"><span class="pricing-index">${index + 1}</span><label class="pricing-name"><span class="sr-only">Nome do produto ou categoria</span><input type="text" maxlength="120" value="${esc(category.name)}" data-category-field="name" placeholder="Ex.: Kit de relação"></label><div><button class="subtle-btn" data-pricing-action="duplicate">Duplicar</button><button class="subtle-btn pricing-danger" data-pricing-action="remove-category">Remover</button><button class="subtle-btn" data-pricing-action="collapse" aria-expanded="${!category.collapsed}" aria-label="Expandir ou recolher ${esc(category.name)}">${category.collapsed ? 'Expandir' : 'Recolher'}</button></div></div><div class="pricing-category-body ${category.collapsed ? 'hidden' : ''}"><div class="pricing-cost-grid">${fields.map(([key, label]) => input(category[key], `data-category-field="${key}" data-min="0" data-max="1000000000"`, label)).join('')}</div><div class="pricing-base"><span>Custo total antes das taxas</span><strong data-base-total>—</strong></div><details class="pricing-channel-settings"><summary>Comissões e tarifas por canal</summary><p class="pricing-help">Cada canal tem sua própria taxa. Campos percentuais vazios usam as preferências gerais; a tarifa em reais é cobrada por venda.</p><div class="pricing-channel-grid">${channels.map(channel => `<fieldset><legend>${channel.label}</legend>${input(category.commissions[channel.id], `data-commission="${channel.id}" data-min="${channel.id === 'store' ? -100 : 0}" data-max="100" placeholder="${shown(data.settings[channel.setting])}"`, channel.id === 'store' ? 'Ajuste loja (%)' : 'Comissão (%)', true)}${input(category.fixedFees[channel.id], `data-fixed-fee="${channel.id}" data-min="0" data-max="1000000000"`, 'Tarifa por venda (R$)')}</fieldset>`).join('')}</div></details><div class="pricing-result-heading"><div><span class="eyebrow">PREÇOS SUGERIDOS</span><h2>Compare seus canais</h2></div><label>Faixa de imposto e lucro<select data-scenario-select>${category.scenarios.map(scenario => `<option value="${esc(scenario.id)}" ${scenario.id === category.selectedScenario ? 'selected' : ''}>${esc(scenario.label || 'Faixa sem nome')}</option>`).join('')}</select></label></div><div class="pricing-results">${channels.map(channel => `<section class="pricing-result ${channel.id === 'premium' ? 'pricing-result-featured' : ''}" data-result-channel="${channel.id}"><span class="pricing-channel-label">${channel.label}</span><strong data-result-price>—</strong><small data-result-profit>—</small><button type="button" class="subtle-btn" data-pricing-action="copy" data-copy-channel="${channel.id}">Copiar preço</button><details><summary>Ver composição</summary><dl data-result-breakdown></dl></details></section>`).join('')}</div><details class="pricing-scenarios" open><summary>Faixas de imposto e margem de lucro</summary><p class="pricing-help">Imposto e lucro são percentuais separados sobre o preço de venda. Renomeie a faixa e ajuste os valores para comparar cenários.</p><div class="pricing-table-wrap"><table><thead><tr><th>Faixa</th><th>Imposto %</th><th>Lucro desejado %</th>${channels.map(channel => `<th>${channel.label}</th>`).join('')}<th>Ações</th></tr></thead><tbody>${category.scenarios.map(scenario => `<tr data-scenario-id="${esc(scenario.id)}"><td><input type="text" maxlength="120" value="${esc(scenario.label)}" data-scenario-field="label" aria-label="Nome da faixa"></td><td><input type="text" inputmode="decimal" value="${shown(scenario.taxPct)}" data-scenario-field="taxPct" data-min="0" data-max="100" aria-label="Imposto em percentual"></td><td><input type="text" inputmode="decimal" value="${shown(scenario.marginPct)}" data-scenario-field="marginPct" data-min="0" data-max="100" aria-label="Margem de lucro em percentual"></td>${channels.map(channel => `<td data-scenario-result="${channel.id}">—</td>`).join('')}<td><button class="subtle-btn pricing-danger" data-pricing-action="remove-scenario" ${category.scenarios.length === 1 ? 'disabled' : ''} aria-label="Remover faixa ${esc(scenario.label)}">×</button></td></tr>`).join('')}</tbody></table></div><button class="subtle-btn" data-pricing-action="add-scenario">+ Adicionar faixa</button></details></div></article>`;
  }
  function updateCategory(category) {
    const host = q(`[data-pricing-category="${category.id}"]`);
    if (!host) return;
    const costs = ['cost', 'shipping', 'packaging', 'extra'].map(key => category[key]);
    host.querySelector('[data-base-total]').textContent = costs.every(value => value != null && value >= 0) ? money.format(costs.reduce((sum, value) => sum + value, 0)) : 'Revise os custos';
    host.querySelectorAll('[data-commission]').forEach(field => { field.placeholder = shown(data.settings[channels.find(channel => channel.id === field.dataset.commission).setting]); });
    host.querySelectorAll('[data-scenario-id]').forEach(row => {
      const scenario = category.scenarios.find(item => item.id === row.dataset.scenarioId);
      for (const channel of channels) {
        const result = E.calculate(category, scenario, data.settings, channel.id);
        const cell = row.querySelector(`[data-scenario-result="${channel.id}"]`);
        cell.textContent = result.valid ? money.format(result.price) : 'Revise as taxas';
        cell.title = result.valid ? `Lucro estimado: ${money.format(result.profit)}` : result.message;
        cell.classList.toggle('pricing-invalid', !result.valid);
      }
    });
    const scenario = category.scenarios.find(item => item.id === category.selectedScenario) || category.scenarios[0];
    for (const channel of channels) {
      const result = E.calculate(category, scenario, data.settings, channel.id);
      const card = host.querySelector(`[data-result-channel="${channel.id}"]`);
      card.querySelector('[data-result-price]').textContent = result.valid ? money.format(result.price) : '—';
      card.querySelector('[data-result-profit]').textContent = result.valid ? `Lucro: ${money.format(result.profit)} · ${decimal.format(result.actualMargin)}% da venda` : result.message;
      card.classList.toggle('pricing-invalid', !result.valid); card.querySelector('[data-pricing-action="copy"]').disabled = !result.valid;
      card.querySelector('[data-result-breakdown]').innerHTML = result.valid ? [['Produto, frete e custos', result.base], ['Tarifa fixa por venda', result.fixedFee], ['Comissão / ajuste', result.commissionAmount], ['Taxa operacional', result.operatingAmount], ['Imposto', result.taxAmount], ['Lucro estimado', result.profit]].map(([label, value]) => `<div><dt>${label}</dt><dd>${money.format(value)}</dd></div>`).join('') : '<p>Corrija os campos para calcular.</p>';
    }
  }
  function renderCategories() {
    q('#pricingCategories').innerHTML = data.categories.map(categoryHtml).join('') || '<div class="workspace-card pricing-empty"><h2>Comece uma simulação</h2><p>Adicione um produto ou categoria, informe os custos e compare os preços.</p><button class="primary-btn" data-pricing-action="add-category">+ Nova simulação</button></div>';
    data.categories.forEach(updateCategory);
    q('#pricingCategoryCount').textContent = `${data.categories.length} simulação(ões)`;
  }
  function renderAll() {
    qa('[data-pricing-setting]').forEach(field => { const value = data.settings[field.dataset.pricingSetting]; field.value = field.tagName === 'SELECT' ? value : shown(value); });
    q('#pricingKnownPrice').value = shown(data.knownPrice);
    renderCategories(); renderFeeRows();
  }
  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportPreferences() {
    try { const validated = E.validate(data); download(JSON.stringify({ format: 'master-motos-pricing', schemaVersion: 1, data: validated }, null, 2), 'application/json', 'master-motos-precificacao.json'); toast('Preferências exportadas.'); }
    catch { toast('Corrija os campos inválidos antes de exportar.'); }
  }
  function exportCsv() {
    const rows = [['Produto / categoria', 'Faixa', 'Imposto %', 'Lucro desejado %', 'Canal', 'Custo total', 'Preço sugerido', 'Lucro estimado', 'Margem efetiva %', 'Situação']];
    data.categories.forEach(category => category.scenarios.forEach(scenario => channels.forEach(channel => {
      const result = E.calculate(category, scenario, data.settings, channel.id);
      rows.push([category.name, scenario.label, scenario.taxPct, scenario.marginPct, channel.label, result.valid ? result.base.toFixed(2) : '', result.valid ? result.price.toFixed(2) : '', result.valid ? result.profit.toFixed(2) : '', result.valid ? result.actualMargin.toFixed(2) : '', result.valid ? 'Calculado' : result.message]);
    })));
    const cell = value => { const str = String(value ?? ''); return `"${(/^[\s]*[=+@-]/.test(str) ? "'" : '') + str.replace(/"/g, '""')}"`; };
    download('\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8', 'master-motos-precos.csv');
    toast('Comparação de preços exportada.');
  }
  $('.nav').insertAdjacentHTML('beforeend', '<button class="nav-item" data-view="precificacao"><span class="nav-icon">▥</span> Precificação</button>');
  $('.main').insertAdjacentHTML('beforeend', `<section class="content hidden" id="pricingView"><div class="hero-row"><div><p class="eyebrow">MASTER MOTOS · PREÇOS E MARGENS</p><h1>Precificação</h1><p class="lede">Informe seus custos, compare canais de venda e guarde suas preferências.</p></div><button class="primary-btn" id="pricingAddCategory">+ Nova simulação</button></div><div class="pricing-save-bar"><span id="pricingSaveStatus" role="status" aria-live="polite"></span><div><button class="subtle-btn" id="pricingSave">Salvar preferências</button><button class="subtle-btn" id="pricingExport">↧ Exportar preferências</button><button class="subtle-btn" id="pricingImport">↥ Importar preferências</button><button class="subtle-btn" id="pricingCsv">↧ Exportar preços CSV</button><input type="file" id="pricingFile" accept=".json,application/json" hidden></div></div><p class="pricing-example-note">Os valores iniciais são exemplos do HTML enviado. Ajuste comissões, impostos e custos à sua operação.</p><details class="workspace-card pricing-settings" open><summary>Preferências gerais <small>Taxas padrão para suas simulações</small></summary><div class="pricing-settings-body"><div class="pricing-settings-grid">${[['fixedPct', 'Taxa operacional sobre a venda (%)'], ['premiumPct', 'Comissão padrão · ML Premium (%)'], ['classicPct', 'Comissão padrão · ML Clássico (%)'], ['commerce6Pct', 'Taxa padrão · e-commerce 6x (%)'], ['commerce3Pct', 'Taxa padrão · e-commerce 3x (%)'], ['storePct', 'Ajuste padrão · loja (%)'], ['taxPct', 'Imposto para novas faixas (%)'], ['marginPct', 'Lucro desejado para novas faixas (%)']].map(([key, label]) => input(data.settings[key], `data-pricing-setting="${key}" data-min="${key === 'storePct' ? -100 : 0}" data-max="100"`, label)).join('')}<label class="pricing-field">Arredondar o preço para cima<select data-pricing-setting="rounding"><option value="cent">Próximo centavo</option><option value="whole">Próximo real inteiro</option><option value="ending99">Final ,99</option></select><small>Evita reduzir a margem pelo arredondamento.</small></label></div><p class="pricing-help">Taxas padrão são usadas quando a comissão do canal está vazia. A taxa operacional se soma às comissões. Um ajuste negativo na loja reduz a dedução total; use-o apenas se esse crédito fizer parte da sua operação. Imposto e lucro padrão se aplicam às novas faixas.</p></div></details><details class="workspace-card pricing-fee-check"><summary>Conferir taxas de um preço conhecido</summary><div class="pricing-settings-body">${input(data.knownPrice, 'id="pricingKnownPrice" data-min="0" data-max="1000000000"', 'Preço de venda conhecido (R$)')}<div id="pricingFeeRows"></div><button class="subtle-btn" data-pricing-action="add-fee">+ Adicionar taxa</button><p class="pricing-help">Esta conferência mostra o valor de cada percentual. Ela não adiciona essas taxas às simulações.</p></div></details><div class="pricing-section-title"><h2>Produtos e categorias</h2><span id="pricingCategoryCount"></span></div><div id="pricingCategories"></div><details class="workspace-card pricing-method"><summary>Entenda o cálculo</summary><div class="pricing-settings-body"><p>Preço = (produto + frete + embalagem + outros custos + tarifa do canal) ÷ [1 − (comissão + taxa operacional + imposto + margem de lucro) ÷ 100].</p><p class="pricing-help">Todos os percentuais incidem sobre o preço de venda. A margem representa lucro sobre a venda, não um acréscimo sobre o custo. O cálculo usa os valores que você configurou.</p><a href="https://vendedores.mercadolivre.com.br/nota/como-usar-o-simulador-de-custos-do-mercado-livre?guideKeyId=GE53&moduleKeyId=MO282" target="_blank" rel="noopener noreferrer">Conferir os custos no simulador oficial do Mercado Livre ↗</a></div></details></section>`);

  $('#pricingView').addEventListener('input', event => {
    const field = event.target;
    const numeric = field.inputMode === 'decimal';
    const parsed = numeric ? E.parseNumber(field.value) : field.value;
    if (numeric) {
      const optional = field.hasAttribute('data-commission') && field.value.trim() === '';
      field.setAttribute('aria-invalid', String(!optional && (parsed == null || parsed < Number(field.dataset.min) || parsed > Number(field.dataset.max))));
    }
    if (field.dataset.pricingSetting) { data.settings[field.dataset.pricingSetting] = parsed; data.categories.forEach(updateCategory); }
    else if (field.id === 'pricingKnownPrice') { data.knownPrice = parsed; updateFees(); }
    else if (field.dataset.feeField) {
      const fee = data.fees.find(item => item.id === field.closest('[data-fee-id]').dataset.feeId);
      fee[field.dataset.feeField] = parsed; updateFees();
    } else {
      const category = getCategory(field); if (!category) return;
      if (field.dataset.categoryField) category[field.dataset.categoryField] = parsed;
      else if (field.dataset.commission) category.commissions[field.dataset.commission] = field.value.trim() === '' ? null : parsed == null ? NaN : parsed;
      else if (field.dataset.fixedFee) category.fixedFees[field.dataset.fixedFee] = parsed;
      else if (field.dataset.scenarioField) {
        const scenario = category.scenarios.find(item => item.id === field.closest('[data-scenario-id]').dataset.scenarioId);
        scenario[field.dataset.scenarioField] = parsed;
        if (field.dataset.scenarioField === 'label') [...field.closest('[data-pricing-category]').querySelector('[data-scenario-select]').options].find(option => option.value === scenario.id).textContent = parsed || 'Faixa sem nome';
      } else return;
      updateCategory(category);
    }
    changed();
  });
  $('#pricingView').addEventListener('change', event => {
    const field = event.target;
    if (field.matches('select[data-pricing-setting]')) { data.settings[field.dataset.pricingSetting] = field.value; data.categories.forEach(updateCategory); changed(); }
    if (field.matches('[data-scenario-select]')) { const category = getCategory(field); category.selectedScenario = field.value; updateCategory(category); changed(); }
  });
  function addCategory() {
    if (data.categories.length >= 50) return toast('Limite de 50 simulações. Remova uma para adicionar outra.');
    const category = clone(E.defaults().categories[0]); category.id = uid('category'); category.name = 'Nova simulação'; category.cost = 0; category.shipping = 0;
    channels.forEach(channel => category.commissions[channel.id] = null);
    category.scenarios = [{ id: uid('scenario'), label: 'Minha faixa', taxPct: data.settings.taxPct, marginPct: data.settings.marginPct }]; category.selectedScenario = category.scenarios[0].id;
    data.categories.push(category); renderCategories(); changed();
    q(`[data-pricing-category="${category.id}"] [data-category-field="name"]`).focus();
  }
  $('#pricingView').addEventListener('click', async event => {
    const button = event.target.closest('[data-pricing-action]'); if (!button) return;
    const action = button.dataset.pricingAction;
    const category = getCategory(button);
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
    if (action === 'collapse') { category.collapsed = !category.collapsed; const host = button.closest('[data-pricing-category]'); host.querySelector('.pricing-category-body').classList.toggle('hidden', category.collapsed); button.textContent = category.collapsed ? 'Expandir' : 'Recolher'; button.setAttribute('aria-expanded', String(!category.collapsed)); }
    if (action === 'duplicate') {
      if (data.categories.length >= 50) return toast('Limite de 50 simulações.');
      try { E.validate(data); } catch { return toast('Corrija os campos inválidos antes de duplicar.'); }
      const duplicate = clone(category); duplicate.id = uid('category'); duplicate.name = category.name.slice(0, 112) + ' · cópia'; data.categories.push(duplicate); renderCategories();
    }
    if (action === 'remove-category') { if (!confirm(`Remover a simulação “${category.name || 'Sem nome'}”?`)) return; data.categories = data.categories.filter(item => item.id !== category.id); renderCategories(); }
    if (action === 'add-scenario') {
      if (category.scenarios.length >= 25) return toast('Limite de 25 faixas por simulação.');
      category.scenarios.push({ id: uid('scenario'), label: 'Nova faixa', taxPct: data.settings.taxPct, marginPct: data.settings.marginPct }); renderCategories();
    }
    if (action === 'remove-scenario') { if (category.scenarios.length <= 1) return; const id = button.closest('[data-scenario-id]').dataset.scenarioId; category.scenarios = category.scenarios.filter(item => item.id !== id); if (category.selectedScenario === id) category.selectedScenario = category.scenarios[0].id; renderCategories(); }
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
      localStorage.setItem(KEY, JSON.stringify(next)); replaceData(next); toast('Preferências importadas e salvas.');
    } catch (error) { toast(error instanceof SyntaxError ? 'Arquivo JSON inválido.' : error.message || 'Não foi possível importar.'); }
    finally { event.target.value = ''; }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && timer) save(); });
  window.addEventListener('pagehide', () => { if (timer) save(); });
  window.MMPricing = { storageKey: KEY, exportData() { try { return E.validate(data); } catch { return clone(lastValid); } }, validateData: E.validate, replaceData, save };
  renderAll();
  setStatus(loadError ? 'Não foi possível ler as preferências. Os exemplos foram carregados; revise e salve novamente.' : savedAt ? 'Preferências recuperadas deste navegador.' : 'Exemplos carregados · personalize e salve suas preferências.', loadError);
})();
