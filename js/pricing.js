(() => {
  const KEY = 'master-motos-pricing-v1';
  const E = window.MMPricingEngine;
  if (!E || !window.MMStorage) return;
  const channels = E.channels;
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let data = E.defaults(), timer = null, savedAt = null, loadError = false, migrated = false;
  try {
    const stored = MMStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      migrated = parsed.schemaVersion !== 3;
      data = E.validate(parsed);
      savedAt = 'anteriormente';
    }
  } catch { loadError = true; }
  let lastValid = clone(data);
  const q = selector => document.querySelector('#pricingView ' + selector);
  const qa = selector => Array.from(document.querySelectorAll('#pricingView ' + selector));
  const shown = value => value == null ? '' : String(value).replace('.', ',');
  const notify = message => {
    if (typeof window.toast === 'function') window.toast(message);
    else {
      const node = document.querySelector('#toast');
      if (node) { node.textContent = message; node.classList.add('show'); }
    }
  };
  const input = (value, attrs, label, hint) =>
    '<label class="pricing-field">' + label +
    '<input type="text" inputmode="decimal" autocomplete="off" value="' + escapeHtml(shown(value)) + '" ' + attrs + '>' +
    '<small>' + (hint || '') + '</small></label>';
  const panelAttrs = key => 'data-pricing-panel="' + escapeHtml(key) + '" ' + (data.ui[key] ? 'open' : '');
  function snapshotValid() {
    const safe = clone(lastValid), problems = [];
    safe.ui = clone(data.ui);
    try {
      safe.settings = E.validate({ ...safe, settings: data.settings, categories: [], fees: [] }).settings;
    } catch { problems.push('parâmetros gerais'); }
    try {
      const values = E.validate({ ...safe, knownPrice: data.knownPrice, fees: data.fees, categories: [] });
      safe.knownPrice = values.knownPrice; safe.fees = values.fees;
    } catch { problems.push('conferência de taxas'); }
    safe.categories = data.categories.flatMap(category => {
      try { return E.validate({ ...safe, categories: [category], ui: {} }).categories; }
      catch {
        const field = q('[data-pricing-category="' + category.id + '"] input[aria-invalid="true"]');
        problems.push((category.name || 'Simulação sem nome') + (field ? ' · revise o campo destacado' : ' · revise os campos'));
        const previous = lastValid.categories.find(item => item.id === category.id);
        return previous ? [{ ...clone(previous), collapsed: category.collapsed }] : [];
      }
    });
    return { value: E.validate(safe), problems };
  }
  function setStatus(message, error) {
    q('#pricingSaveStatus').textContent = message;
    q('#pricingSaveStatus').classList.toggle('is-error', Boolean(error));
    q('#pricingReview').classList.toggle('hidden', !error || !q('input[aria-invalid="true"]'));
  }
  function persistValid(manual, layout) {
    try {
      const result = snapshotValid();
      MMStorage.setItem(KEY, JSON.stringify(result.value));
      lastValid = clone(result.value);
      savedAt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (!layout || !timer) setStatus(result.problems.length
        ? 'Valores válidos salvos · revise: ' + result.problems.join('; ')
        : 'Salvo neste dispositivo · ' + savedAt, result.problems.length > 0);
      if (manual) notify(result.problems.length ? 'Dados válidos salvos. Revise os campos destacados.' : 'Preferências de precificação salvas.');
      return result.problems.length === 0;
    } catch {
      setStatus('Não foi possível salvar. Exporte uma cópia das preferências.', true);
      if (manual) notify('Falha ao salvar. As alterações continuam nesta sessão.');
      return false;
    }
  }
  function save(manual) {
    clearTimeout(timer); timer = null;
    return persistValid(Boolean(manual), false);
  }
  function changed() {
    setStatus('Alterações não salvas · salvando automaticamente...', false);
    clearTimeout(timer);
    timer = setTimeout(() => save(false), 400);
  }
  function saveLayout() {
    qa('details[data-pricing-panel]').forEach(panel => { data.ui[panel.dataset.pricingPanel] = panel.open; });
    persistValid(false, true);
  }
  function replaceData(next) {
    clearTimeout(timer); timer = null;
    data = normalizeSections(E.validate(next)); lastValid = clone(data);
    renderAll();
    setStatus('Preferências restauradas neste dispositivo.', false);
  }
  function getCategory(element) {
    const host = element.closest('[data-pricing-category]');
    return host && data.categories.find(item => item.id === host.dataset.pricingCategory);
  }
  function resultCardMarkup(channel, categoryId) {
    const ml = channel.group.indexOf('marketplace') === 0;
    const label = channel.label;
    return '<section class="pricing-result pricing-result-' + channel.group + '" data-result-channel="' + channel.id + '">' +
      '<div class="pricing-result-top"><span class="pricing-channel-label">' + label + '</span><span class="pricing-rate" data-result-rate></span></div>' +
      '<span class="pricing-result-caption">PREÇO DE VENDA · POR</span>' +
      '<strong data-result-price>—</strong>' +
      '<small data-result-profit>Preencha os dados para calcular.</small>' +
      '<button type="button" class="subtle-btn pricing-copy" data-pricing-action="copy" data-copy-channel="' + channel.id + '" disabled>Copiar preço</button>' +
      (ml ? '<div class="pricing-promo"><div><span>Preço de referência · DE</span><strong data-result-promotion>—</strong><small data-result-discount>Informe a taxa de promoção.</small></div><button type="button" class="subtle-btn" data-copy-kind="promotion" data-pricing-action="copy-promotion" data-copy-channel="' + channel.id + '" disabled>Copiar preço De</button></div>' : '') +
      '<details ' + panelAttrs(categoryId + ':breakdown-' + channel.id) + '><summary>Detalhamento</summary><dl data-result-breakdown></dl></details>' +
      '</section>';
  }
  function groupMarkup(title, subtitle, groupClass, ids, categoryId) {
    return '<section class="pricing-platform ' + groupClass + '"><header class="pricing-platform-head"><div><span class="eyebrow">' + subtitle + '</span><h3>' + title + '</h3></div></header><div class="pricing-results">' +
      channels.filter(channel => ids.includes(channel.id)).map(channel => resultCardMarkup(channel, categoryId)).join('') +
      '</div></section>';
  }
  const fixedSections = [
    { id: 'fixed-marketplace', name: 'Mercado Livre', eyebrow: 'TABELAS PADRÃO E ALTERNATIVA', channels: ['premium', 'classic', 'premiumAlt', 'classicAlt'], fields: ['cost', 'shipping', 'profitPct', 'promotionPct'] },
    { id: 'fixed-tray', name: 'Tray · E-commerce', eyebrow: '3X COM DESCONTO E 6X SEM JUROS', channels: ['commerce6', 'commerce3'], fields: ['cost', 'shipping', 'profitPct'] },
    { id: 'fixed-store', name: 'Loja', eyebrow: 'VENDA DIRETA · PIX', channels: ['store'], fields: ['cost', 'shipping', 'profitPct'] }
  ];
  function normalizeSections(value) {
    if (value.settings.storePct === -2) value.settings.storePct = 0;
    const ids = fixedSections.map(section => section.id);
    if (value.categories.length === 3 && value.categories.every((item, index) => item.id === ids[index])) return value;
    try { if (!MMStorage.getItem('master-motos-pricing-archive-v3')) MMStorage.setItem('master-motos-pricing-archive-v3', JSON.stringify(value.categories)); } catch {}
    const base = E.defaults().categories[0];
    value.categories = fixedSections.map(section => {
      const item = clone(base);
      item.id = section.id; item.name = section.name; item.cost = 0; item.shipping = 0; item.profitPct = 0; item.promotionPct = 0;
      item.commissions = Object.fromEntries(channels.map(channel => [channel.id, null]));
      item.fixedFees = Object.fromEntries(channels.map(channel => [channel.id, 0]));
      item.scenarios = [{ id: 'standard', label: 'Sem taxa adicional', feePct: 0 }]; item.selectedScenario = 'standard'; item.collapsed = false;
      return item;
    });
    value.ui = {};
    return E.validate(value);
  }
  function categoryMarkup(category, index) {
    const section = fixedSections[index];
    const scenario = category.scenarios.find(item => item.id === category.selectedScenario) || category.scenarios[0];
    const fields = [
      ['cost', 'Custo do produto (R$)', 'Informe o custo de aquisição.'],
      ['shipping', 'Frete informado (R$)', 'Se não houver, deixe zero.'],
      ['profitPct', 'Lucro desejado (%)', 'Margem sobre o preço de venda.'],
      ['promotionPct', 'Promoção Mercado Livre (%)', 'Calcula o preço De sem alterar o Por.']
    ].filter(([key]) => section.fields.includes(key));
    return '<article class="pricing-fixed-card pricing-fixed-' + index + '" data-pricing-category="' + section.id + '">' +
      '<header class="pricing-fixed-head"><div><span class="eyebrow">' + section.eyebrow + '</span><h2>' + section.name + '</h2></div><span class="pricing-fixed-mark" aria-hidden="true"></span></header>' +
      '<div class="pricing-fixed-inputs">' + fields.map(([key, label, hint]) => input(category[key], 'data-category-field="' + key + '" data-min="0" data-max="' + (key === 'profitPct' ? '95' : key === 'promotionPct' ? '99.99' : '1000000000') + '" aria-label="' + label + '" ' + (key === 'cost' ? 'required' : ''), label, hint)).join('') + '</div>' +
      '<div class="pricing-fixed-summary"><div><span>Custo total</span><strong data-base-total>—</strong></div>' +
      (index === 0 ? '<div><span>Regra de frete</span><strong data-ml-rule>Informe os custos</strong></div>' : index === 1 ? '<div><span>Taxa fixa Tray</span><strong data-tray-fee>—</strong></div>' : '<div><span>Lucro líquido estimado</span><strong data-summary-profit>—</strong></div>') + '</div>' +
      '<div class="pricing-fixed-results">' + section.channels.map(id => resultCardMarkup(channels.find(channel => channel.id === id), section.id)).join('') + '</div>' +
      '<details class="pricing-fixed-details"><summary>Detalhamento e taxas adicionais</summary><div class="pricing-advanced-grid">' +
      input(scenario.feePct, 'data-quick-scenario="feePct" data-min="0" data-max="100" aria-label="Taxa adicional"', 'Taxa adicional (%)', 'Opcional; não substitui o imposto base.') +
      '</div></details></article>';
  }
  if (data.settings.storePct === -2) data.settings.storePct = 0;
  data = normalizeSections(data);
  lastValid = clone(data);
  function renderFeeRows() {
    q('#pricingFeeRows').innerHTML = data.fees.map(fee =>
      '<div class="pricing-fee" data-fee-id="' + escapeHtml(fee.id) + '">' +
      '<label><span class="sr-only">Nome da taxa</span><input type="text" maxlength="120" value="' + escapeHtml(fee.name) + '" data-fee-field="name"></label>' +
      '<label><span class="sr-only">Percentual da taxa</span><input type="text" inputmode="decimal" value="' + escapeHtml(shown(fee.pct)) + '" data-fee-field="pct" data-min="0" data-max="100" aria-label="Percentual de ' + escapeHtml(fee.name) + '"></label>' +
      '<output data-fee-value>—</output><button type="button" class="subtle-btn pricing-danger" data-pricing-action="remove-fee" aria-label="Remover ' + escapeHtml(fee.name) + '">×</button></div>'
    ).join('') || '<p class="pricing-help">Nenhuma taxa cadastrada. Adicione uma taxa para conferir seu valor.</p>';
    updateFees();
  }
  function updateFees() {
    qa('[data-fee-id]').forEach(row => {
      const fee = data.fees.find(item => item.id === row.dataset.feeId);
      row.querySelector('[data-fee-value]').textContent = data.knownPrice != null && fee && fee.pct != null && fee.pct >= 0 && fee.pct <= 100
        ? money.format(data.knownPrice * fee.pct / 100) : 'Revise os valores';
    });
  }
  function updateCategory(category, sourceField) {
    const host = q('[data-pricing-category="' + category.id + '"]');
    if (!host) return;
    const section = fixedSections.find(item => item.id === category.id);
    const scenario = category.scenarios.find(item => item.id === category.selectedScenario) || category.scenarios[0];
    const cost = category.cost, shipping = category.shipping;
    const validCosts = cost != null && shipping != null && cost >= 0 && shipping >= 0;
    host.querySelector('[data-base-total]').textContent = validCosts ? money.format(cost + shipping) : 'Revise os custos';
    host.querySelectorAll('[data-quick-scenario]').forEach(field => {
      if (field !== sourceField) field.value = shown(scenario[field.dataset.quickScenario]);
      field.setAttribute('aria-invalid', String(scenario[field.dataset.quickScenario] == null || scenario[field.dataset.quickScenario] < 0 || scenario[field.dataset.quickScenario] > 100));
    });
    const primary = E.calculate(category, scenario, data.settings, section.channels[0]);
    const trayFee = E.trayFixedFee(cost == null || cost < 0 ? 0 : cost);
    const trayNode = host.querySelector('[data-tray-fee]');
    if (trayNode) trayNode.textContent = money.format(trayFee);
    const mlRule = host.querySelector('[data-ml-rule]');
    if (mlRule) mlRule.textContent = primary.valid
      ? (primary.freeShippingRequired ? 'A partir de ' + money.format(primary.mlThreshold) + ': frete grátis; frete informado contado uma vez.' :
        'Abaixo de ' + money.format(primary.mlThreshold) + ': tarifa fixa configurada de ' + money.format(primary.mlFixedFee) + '.')
      : 'Informe os custos para verificar a regra.';
    const profitNode = host.querySelector('[data-summary-profit]');
    if (profitNode) profitNode.textContent = primary.valid ? money.format(primary.profit) : '—';
    for (const channelId of section.channels) {
      const channel = channels.find(item => item.id === channelId);
      const result = E.calculate(category, scenario, data.settings, channelId);
      const card = host.querySelector('[data-result-channel="' + channelId + '"]');
      if (!card) continue;
      card.querySelector('[data-result-rate]').textContent = result.valid ? shown(result.commission) + '%' : '';
      card.querySelector('[data-result-price]').textContent = result.valid ? money.format(result.price) : '—';
      card.querySelector('[data-result-profit]').textContent = result.valid ? 'Lucro líquido: ' + money.format(result.profit) : result.message;
      card.classList.toggle('pricing-invalid', !result.valid);
      const copy = card.querySelector('[data-pricing-action="copy"]');
      copy.disabled = !result.valid;
      const promo = card.querySelector('[data-result-promotion]');
      if (promo) {
        promo.textContent = result.valid && result.promotionPrice != null ? money.format(result.promotionPrice) : '—';
        card.querySelector('[data-result-discount]').textContent = result.valid && result.promotionPrice != null
          ? 'Preço promocional calculado com ' + shown(result.promotionPct) + '%.'
          : 'Informe a taxa de promoção no início do painel.';
        card.querySelector('[data-pricing-action="copy-promotion"]').disabled = !(result.valid && result.promotionPrice != null);
      }
      const breakdown = card.querySelector('[data-result-breakdown]');
      breakdown.innerHTML = result.valid ? [
        ['Custo do produto', result.cost], ['Frete informado (uma única vez)', result.shipping],
        ['Custo total', result.base], ['Taxa fixa do canal', result.fixedFee],
        ['Comissão do canal', result.commissionAmount], ['Imposto base (' + shown(result.taxPct) + '%)', result.taxAmount],
        ['Taxa adicional', result.feeAmount], ['Lucro desejado (' + shown(result.profitPct) + '%)', result.profitTargetAmount],
        ['Lucro líquido estimado', result.profit]
      ].map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + money.format(value) + '</dd></div>').join('') : '<p>Corrija os campos para calcular.</p>';
    }
  }
  function renderCategories() {
    q('#pricingCategories').innerHTML = data.categories.map(categoryMarkup).join('');
    data.categories.forEach(updateCategory);

  }
  function renderAll() {
    qa('[data-pricing-setting]').forEach(field => {
      const value = data.settings[field.dataset.pricingSetting];
      field.value = field.tagName === 'SELECT' ? value : shown(value);
    });
    q('#pricingKnownPrice').value = shown(data.knownPrice);
    renderCategories(); renderFeeRows();
    qa('details[data-pricing-panel]').forEach(panel => {
      panel.open = panel.dataset.pricingPanel === 'fees' && data.ui.fees == null
        ? true : Boolean(data.ui[panel.dataset.pricingPanel]);
    });
  }
  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportPreferences() {
    const result = snapshotValid();
    download(JSON.stringify({ format: 'master-motos-pricing', schemaVersion: 2, data: result.value }, null, 2),
      'application/json', 'master-motos-precificacao.json');
    notify(result.problems.length ? 'Preferências válidas exportadas. Revise os campos pendentes.' : 'Backup da precificação exportado.');
  }
  function exportCsv() {
    const rows = [['Painel', 'Custo', 'Frete', 'Lucro desejado %', 'Promoção ML %', 'Canal', 'Taxa canal %', 'Custo total', 'Preço Por', 'Preço De', 'Lucro líquido', 'Situação']];
    data.categories.forEach(category => {
      const scenario = category.scenarios.find(item => item.id === category.selectedScenario) || category.scenarios[0];
      const section = fixedSections.find(item => item.id === category.id);
      section.channels.forEach(channelId => {\n        const channel = channels.find(item => item.id === channelId);
        const result = E.calculate(category, scenario, data.settings, channel.id);
        rows.push([
          category.name, category.cost, category.shipping, category.profitPct, category.promotionPct, channel.label,
          data.settings[channel.setting], result.valid ? result.base.toFixed(2) : '',
          result.valid ? result.price.toFixed(2) : '', result.valid && result.promotionPrice != null ? result.promotionPrice.toFixed(2) : '',
          result.valid ? result.profit.toFixed(2) : '', result.valid ? 'Calculado' : result.message
        ]);
      });
    });
    download('\uFEFF' + rows.map(row => row.map(MMCsv.cell).join(';')).join('\r\n'),
      'text/csv;charset=utf-8', 'master-motos-precos.csv');
    notify('Comparativo de preços exportado.');
  }
  function settingInput(key, label, min, max, hint) {
    return input(data.settings[key], 'data-pricing-setting="' + key + '" data-min="' + min + '" data-max="' + max + '" aria-label="' + label + '"',
      label, hint || '');
  }
  $('.nav').insertAdjacentHTML('beforeend', '<button class="nav-item" data-view="precificacao"><span class="nav-icon">▥</span> Precificação</button>');
  $('.main').insertAdjacentHTML('beforeend',
    '<section class="content hidden" id="pricingView">' +
    '<div class="hero-row"><div><p class="eyebrow">MASTER MOTOS · FORMAÇÃO DE PREÇO</p><h1>Precificação</h1><p class="lede">Informe os custos em cada canal e compare preços de venda e lucro estimado.</p></div></div>' +
    '<div class="pricing-save-bar"><span id="pricingSaveStatus" role="status" aria-live="polite"></span><div><button type="button" class="subtle-btn" id="pricingSave">Salvar agora</button><details class="pricing-tools" data-pricing-panel="tools"><summary>Backup e exportação</summary><div><button type="button" class="subtle-btn" id="pricingExport">Exportar backup</button><button type="button" class="subtle-btn" id="pricingImport">Importar backup</button><button type="button" class="subtle-btn" id="pricingCsv">Exportar preços CSV</button><input type="file" id="pricingFile" accept=".json,application/json" hidden></div></details></div></div>' +
    '<p class="pricing-example-note">O cálculo usa markup divisor: taxas, imposto base e lucro desejado são considerados sobre o preço de venda. O frete informado entra uma única vez no custo.</p>' +
    '<details class="workspace-card pricing-settings" data-pricing-panel="settings"><summary>Parâmetros avançados <small>Imposto, comissões, frete grátis e taxas fixas</small></summary><div class="pricing-settings-body">' +
    '<div class="pricing-settings-grid">' +
    settingInput('fixedPct', 'Imposto base da planilha (%)', 0, 100, 'Padrão da planilha: 12%.') +
    settingInput('premiumPct', 'ML Premium · tabela padrão (%)', 0, 100) +
    settingInput('classicPct', 'ML Clássico · tabela padrão (%)', 0, 100) +
    settingInput('premiumAltPct', 'ML Premium · tabela alternativa (%)', 0, 100) +
    settingInput('classicAltPct', 'ML Clássico · tabela alternativa (%)', 0, 100) +
    settingInput('commerce6Pct', 'Tray · E-commerce 6x (%)', 0, 100) +
    settingInput('commerce3Pct', 'Tray · E-commerce 3x (%)', 0, 100, 'Condição informada: 4%.') +
    settingInput('storePct', 'Loja · balcão / PIX (%)', -100, 100) +
    settingInput('mlFreeShippingThreshold', 'Limite de frete grátis ML (R$)', 0, 1000000000, 'Padrão inicial: R$ 79,00. Use zero para desativar a regra.') +
    settingInput('mlFixedFeeBelowThreshold', 'Taxa fixa ML abaixo do limite (R$)', 0, 1000000000, 'Informe o valor cobrado por unidade; zero não adiciona tarifa.') +
    settingInput('feePct', 'Taxa adicional padrão (%)', 0, 100) +
    '<label class="pricing-field">Arredondamento do preço<select data-pricing-setting="rounding"><option value="cent">Próximo centavo</option><option value="whole">Próximo real inteiro</option><option value="ending99">Final ,99</option></select><small>Arredonda o preço calculado para cima.</small></label>' +
    '</div><p class="pricing-help">Tray: custo abaixo de R$ 50,00 = R$ 10,00; de R$ 50,00 até R$ 100,00 = R$ 5,00; acima de R$ 100,00 = isento. A regra também cobre R$ 100,01 a R$ 101,00 como isento. O valor é calculado automaticamente pelo custo do produto.</p>' +
    '<p class="pricing-help">Mercado Livre: abaixo do limite configurado, aplica a taxa fixa unitária informada. A partir do limite, indica frete grátis obrigatório. O valor digitado em “Frete informado” já compõe o custo uma única vez e não é duplicado.</p>' +
    '</div></details>' +
    '<details class="workspace-card pricing-fee-check" data-pricing-panel="fees"><summary>Conferir taxas de um preço conhecido</summary><div class="pricing-settings-body">' +
    input(data.knownPrice, 'id="pricingKnownPrice" data-min="0" data-max="1000000000" aria-label="Preço de venda conhecido"', 'Preço de venda conhecido (R$)') +
    '<div id="pricingFeeRows"></div><button type="button" class="subtle-btn" data-pricing-action="add-fee">+ Adicionar taxa</button><p class="pricing-help">Consulta o valor percentual de cada taxa sem alterar os preços das simulações.</p></div></details>' +
    '<div class="pricing-section-title"><div><h2>Canais de venda</h2><span>Os três painéis ficam disponíveis para edição simultânea.</span></div><div class="pricing-organize"><button type="button" class="subtle-btn" id="pricingSettingsShortcut">Parâmetros avançados</button></div></div>' +
    '<div id="pricingCategories"></div>' +
    '<details class="workspace-card pricing-method" data-pricing-panel="method"><summary>Como o preço é calculado</summary><div class="pricing-settings-body">' +
    '<p>Preço de venda = (custo do produto + frete informado + taxas fixas) ÷ [1 − (comissão + imposto base + taxa adicional + lucro desejado) ÷ 100].</p>' +
    '<p>O preço “De” da promoção é calculado por: preço “Por” ÷ (1 − percentual de promoção ÷ 100). O preço “Por” permanece como o preço de venda calculado.</p>' +
    '<p class="pricing-help">A taxa fixa Tray depende do custo do produto. A regra de frete do Mercado Livre usa o limite configurável e não duplica o frete já informado.</p>' +
    '<a href="https://vendedores.mercadolivre.com.br/nota/como-usar-o-simulador-de-custos-do-mercado-livre?guideKeyId=GE53&moduleKeyId=MO282" target="_blank" rel="noopener noreferrer">Consultar o simulador oficial do Mercado Livre ↗</a>' +
    '</div></details></section>'
  );
  q('#pricingSaveStatus').insertAdjacentHTML('afterend', '<button type="button" class="subtle-btn hidden" id="pricingReview">Revisar campo pendente</button>');
  q('#pricingReview').addEventListener('click', () => {
    const field = q('input[aria-invalid="true"]');
    if (!field) return;
    const product = field.closest('[data-pricing-category]');
    if (product && product.classList.contains('is-collapsed')) product.querySelector('[data-pricing-action="collapse"]').click();
    for (let parent = field.parentElement; parent && parent.id !== 'pricingView'; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' }); field.focus(); field.select();
  });
  q('#pricingSettingsShortcut').addEventListener('click', () => {
    const panel = q('.pricing-settings'); panel.open = true;
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); panel.querySelector('summary').focus();
  });
  $('#pricingView').addEventListener('toggle', event => {
    const panel = event.target;
    if (!panel.isConnected || !panel.dataset.pricingPanel || data.ui[panel.dataset.pricingPanel] === panel.open) return;
    data.ui[panel.dataset.pricingPanel] = panel.open; saveLayout();
  }, true);
  $('#pricingView').addEventListener('focusin', event => {
    if (event.target.inputMode === 'decimal') event.target.select();
  });
  $('#pricingView').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target.inputMode !== 'decimal') return;
    const grid = event.target.closest('.pricing-quick-grid');
    if (!grid) return;
    event.preventDefault();
    const fields = Array.from(grid.querySelectorAll('input'));
    const next = fields[fields.indexOf(event.target) + 1];
    if (next) next.focus();
    else event.target.closest('[data-pricing-category]').querySelector('[data-pricing-action="copy"]:not(:disabled)')?.focus();
  });
  $('#pricingView').addEventListener('input', event => {
    const field = event.target;
    const numeric = field.inputMode === 'decimal';
    const emptyAsZero = field.dataset.categoryField === 'shipping' || field.dataset.categoryField === 'profitPct' ||
      field.dataset.categoryField === 'promotionPct' || field.dataset.quickScenario === 'feePct' ||
      field.dataset.pricingSetting === 'mlFixedFeeBelowThreshold';
    const parsed = numeric ? (emptyAsZero && !field.value.trim() ? 0 : E.parseNumber(field.value)) : field.value;
    if (numeric) field.setAttribute('aria-invalid', String(parsed == null || parsed < Number(field.dataset.min) || parsed > Number(field.dataset.max)));
    if (field.dataset.pricingSetting) {
      data.settings[field.dataset.pricingSetting] = parsed;
      data.categories.forEach(category => updateCategory(category));
    } else if (field.id === 'pricingKnownPrice') {
      data.knownPrice = parsed; updateFees();
    } else if (field.dataset.feeField) {
      const fee = data.fees.find(item => item.id === field.closest('[data-fee-id]').dataset.feeId);
      fee[field.dataset.feeField] = parsed; updateFees();
    } else {
      const category = getCategory(field);
      if (!category) return;
      if (field.dataset.categoryField) category[field.dataset.categoryField] = parsed;
      else if (field.dataset.quickScenario) {
        const scenario = category.scenarios.find(item => item.id === category.selectedScenario);
        scenario[field.dataset.quickScenario] = parsed;
      } else return;
      updateCategory(category, field);
    }
    changed();
  });
  $('#pricingView').addEventListener('change', event => {
    const field = event.target;
    if (field.matches('select[data-pricing-setting]')) {
      data.settings[field.dataset.pricingSetting] = field.value;
      data.categories.forEach(category => updateCategory(category)); changed();
    }
  });
  async function confirmAction(title, text, confirmText) {
    if (!window.Swal) return false;
    const result = await Swal.fire({
      title, text, icon: 'warning', showCancelButton: true,
      confirmButtonText: confirmText, cancelButtonText: 'Cancelar',
      reverseButtons: true, focusCancel: true
    });
    return result.isConfirmed;
  }
  async function copyValue(button, value) {
    if (!Number.isFinite(value)) return;
    try {
      await navigator.clipboard.writeText(value.toFixed(2).replace('.', ','));
      button.classList.add('is-copied'); button.textContent = 'Copiado!';
      notify('Preço copiado.');
      setTimeout(() => { button.classList.remove('is-copied'); button.textContent = button.dataset.copyKind === 'promotion' ? 'Copiar preço De' : 'Copiar preço'; }, 1600);
    } catch { notify('Não foi possível copiar. Verifique a permissão da área de transferência.'); }
  }
  $('#pricingView').addEventListener('click', async event => {
    const button = event.target.closest('[data-pricing-action]');
    if (!button) return;
    const action = button.dataset.pricingAction;
    const category = getCategory(button);
    if (action === 'collapse-all' || action === 'expand-all') {
      data.categories.forEach(item => { item.collapsed = action === 'collapse-all'; });
      renderCategories(); changed(); return;
    }

    if (action === 'add-fee') {
      if (data.fees.length >= 50) return notify('Limite de 50 taxas.');
      data.fees.push({ id: uid('fee'), name: 'Nova taxa', pct: 0 }); renderFeeRows(); changed(); return;
    }
    if (action === 'remove-fee') {
      data.fees = data.fees.filter(item => item.id !== button.closest('[data-fee-id]').dataset.feeId);
      renderFeeRows(); changed(); return;
    }
    if (!category) return;
    if (action === 'copy' || action === 'copy-promotion') {
      const scenario = category.scenarios.find(item => item.id === category.selectedScenario) || category.scenarios[0];
      const result = E.calculate(category, scenario, data.settings, button.dataset.copyChannel);
      if (!result.valid) return;
      return copyValue(button, action === 'copy-promotion' ? result.promotionPrice : result.price);
    }
    if (action === 'collapse') {
      category.collapsed = !category.collapsed;
      const host = button.closest('[data-pricing-category]');
      host.classList.toggle('is-collapsed', category.collapsed);
      host.querySelector('.pricing-category-body').classList.toggle('hidden', category.collapsed);
      button.textContent = category.collapsed ? 'Expandir' : 'Recolher';
      button.setAttribute('aria-expanded', String(!category.collapsed));
      changed(); return;
    }
    if (action === 'duplicate') {
      if (data.categories.length >= 50) return notify('Limite de 50 simulações.');
      try { E.validate(data); } catch { return notify('Corrija os campos inválidos antes de duplicar.'); }
      const duplicate = clone(category);
      duplicate.id = uid('category'); duplicate.name = category.name.slice(0, 112) + ' · cópia';
      Object.entries(data.ui).filter(([key]) => key.startsWith(category.id + ':')).forEach(([key, value]) => {
        data.ui[key.replace(category.id + ':', duplicate.id + ':')] = value;
      });
      data.categories.push(duplicate); renderCategories(); changed(); return;
    }
    if (action === 'remove-category') {
      const confirmed = await confirmAction('Remover simulação?', 'A simulação “' + (category.name || 'Sem nome') + '” será removida desta calculadora.', 'Remover simulação');
      if (!confirmed) return;
      data.categories = data.categories.filter(item => item.id !== category.id);
      Object.keys(data.ui).filter(key => key.startsWith(category.id + ':')).forEach(key => delete data.ui[key]);
      renderCategories(); changed(); return;
    }
  });

  q('#pricingSave').addEventListener('click', () => save(true));
  q('#pricingExport').addEventListener('click', exportPreferences);
  q('#pricingCsv').addEventListener('click', exportCsv);
  q('#pricingImport').addEventListener('click', () => q('#pricingFile').click());
  q('#pricingFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('O arquivo deve ter até 5 MB.');
      const parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      if (parsed.format !== 'master-motos-pricing' || ![1, 2].includes(parsed.schemaVersion)) throw new Error('Escolha um backup da calculadora de precificação.');
      const next = E.validate(parsed.data);
      const confirmed = await confirmAction('Importar backup?', 'Serão importadas ' + next.categories.length + ' simulação(ões), substituindo as preferências atuais.', 'Importar backup');
      if (!confirmed) return;
      MMStorage.setItem(KEY, JSON.stringify(next)); replaceData(next); notify('Backup importado e salvo.');
    } catch (error) {
      notify(error instanceof SyntaxError ? 'Arquivo JSON inválido.' : error.message || 'Não foi possível importar.');
    } finally { event.target.value = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) save(false);
  });
  window.addEventListener('pagehide', () => {
    saveLayout();
    if (timer) save(false);
  });
  window.MMPricing = {
    storageKey: KEY,
    exportData() { return snapshotValid().value; },
    validateData: E.validate,
    replaceData,
    save
  };
  renderAll();
  setStatus(loadError
    ? 'Não foi possível ler as preferências. Os exemplos foram carregados; revise e salve novamente.'
    : migrated
      ? 'Calculadora atualizada. Seus produtos, custos e preferências anteriores foram preservados.'
      : savedAt
        ? 'Preferências recuperadas deste dispositivo.'
        : 'Exemplos carregados · personalize custo, frete e lucro desejado.', loadError);
})();
