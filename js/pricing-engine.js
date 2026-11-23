/* Motor puro de precificação. Percentuais incidem sobre o preço de venda. */
(function (root) {
  const channels = [
    { id: 'premium', label: 'ML Premium', group: 'marketplace', setting: 'premiumPct' },
    { id: 'classic', label: 'ML Clássico', group: 'marketplace', setting: 'classicPct' },
    { id: 'premiumAlt', label: 'ML Premium · tabela 14%', group: 'marketplace-alt', setting: 'premiumAltPct' },
    { id: 'classicAlt', label: 'ML Clássico · tabela 11%', group: 'marketplace-alt', setting: 'classicAltPct' },
    { id: 'commerce6', label: 'Tray · 6x sem juros', group: 'tray', setting: 'commerce6Pct' },
    { id: 'commerce3', label: 'Tray · 3x', group: 'tray', setting: 'commerce3Pct' },
    { id: 'store', label: 'Loja · balcão / PIX', group: 'store', setting: 'storePct' }
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || !value.trim()) return null;
    let clean = value.trim().replace(/^R\$\s*/, '').replace(/\s/g, '');
    if (clean.includes(',')) {
      if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(clean)) return null;
      clean = clean.replace(/\./g, '').replace(',', '.');
    }
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(clean)) return null;
    const number = Number(clean);
    return Number.isFinite(number) ? number : null;
  }
  function roundUp(value, method) {
    if (method === 'whole') return Math.ceil(value - 1e-9);
    if (method === 'ending99') return Math.ceil(value - .99 - 1e-9) + .99;
    return Math.ceil(value * 100 - 1e-7) / 100;
  }
  function trayFixedFee(cost) {
    if (cost < 50) return 10;
    if (cost <= 100) return 5;
    return 0;
  }
  function calculate(category, scenario, settings, channelId) {
    const channel = channels.find(item => item.id === channelId);
    const error = message => ({ valid: false, message });
    if (!channel) return error('Canal inválido.');
    const cost = parseNumber(category.cost);
    const shipping = parseNumber(category.shipping);
    if ([cost, shipping].some(value => value === null || value < 0 || value > 1e9)) return error('Revise o custo e o frete: use valores de zero a R$ 1 bilhão.');
    const base = cost + shipping;
    if (base <= 0) return error('Informe um custo maior que zero.');
    const commission = parseNumber(category.commissions[channelId] == null ? settings[channel.setting] : category.commissions[channelId]);
    const manualFixedFee = parseNumber(category.fixedFees[channelId] == null ? 0 : category.fixedFees[channelId]);
    const taxPct = parseNumber(settings.fixedPct);
    const feePct = parseNumber(scenario && (scenario.feePct == null ? scenario.taxPct : scenario.feePct));
    const profitPct = parseNumber(category.profitPct == null ? 0 : category.profitPct);
    const promotionPct = parseNumber(category.promotionPct == null ? 0 : category.promotionPct);
    const mlThreshold = parseNumber(settings.mlFreeShippingThreshold);
    const mlFixedFeeSetting = parseNumber(settings.mlFixedFeeBelowThreshold);
    if ([commission, manualFixedFee, taxPct, feePct, profitPct, promotionPct, mlThreshold, mlFixedFeeSetting].some(value => value === null)) return error('Preencha as taxas e tarifas.');
    if (commission < (channelId === 'store' ? -100 : 0) || commission > 100 || manualFixedFee < 0 || taxPct < 0 || taxPct > 100 || feePct < 0 || feePct > 100 || profitPct < 0 || profitPct > 95 || promotionPct < 0 || promotionPct >= 100 || mlThreshold < 0 || mlFixedFeeSetting < 0) return error('Revise os percentuais e as tarifas deste canal.');
    const combinedPct = commission + taxPct + feePct + profitPct;
    if (combinedPct >= 100) return error('As taxas e o lucro desejado somam 100% ou mais. Reduza os percentuais.');
    const trayFee = channel.group === 'tray' ? trayFixedFee(cost) : 0;
    const mlBaseFixedFee = channel.group.startsWith('marketplace') && mlThreshold > 0 ? mlFixedFeeSetting : 0;
    const baseFixedFee = manualFixedFee + trayFee;
    const rawWithoutMlFee = (base + baseFixedFee) / (1 - combinedPct / 100);
    const mlFixedFee = channel.group.startsWith('marketplace') && rawWithoutMlFee < mlThreshold ? mlBaseFixedFee : 0;
    const fixedFee = baseFixedFee + mlFixedFee;
    const rawPrice = (base + fixedFee) / (1 - combinedPct / 100);
    const price = roundUp(rawPrice, settings.rounding);
    const commissionAmount = price * commission / 100;
    const taxAmount = price * taxPct / 100;
    const feeAmount = price * feePct / 100;
    const profitTargetAmount = price * profitPct / 100;
    const profit = price - base - fixedFee - commissionAmount - taxAmount - feeAmount;
    const promotionPrice = channel.group.startsWith('marketplace') && promotionPct > 0
      ? roundUp(price / (1 - promotionPct / 100), 'cent')
      : null;
    const discountAmount = promotionPrice == null ? 0 : promotionPrice - price;
    const freeShippingRequired = channel.group.startsWith('marketplace') && mlThreshold > 0 && price >= mlThreshold;
    return {
      valid: true, rawPrice, price, base, cost, shipping, fixedFee, manualFixedFee, trayFee, mlFixedFee,
      commission, combinedPct, commissionAmount, taxPct, taxAmount, feePct, feeAmount,
      profitPct, profitTargetAmount, profit, actualMargin: profit / price * 100,
      promotionPct, promotionPrice, discountAmount, mlThreshold, freeShippingRequired,
      shippingIncludedOnce: shipping > 0
    };
  }
  function defaults() {
    const makeCategory = (id, name, cost, shipping, premium, classic) => ({
      id, name, cost, shipping, profitPct: 0, promotionPct: 0,
      commissions: { premium: null, classic: null, premiumAlt: null, classicAlt: null, commerce6: null, commerce3: null, store: null },
      fixedFees: Object.fromEntries(channels.map(channel => [channel.id, 0])),
      scenarios: [{ id: 'standard', label: 'Sem taxa adicional', feePct: 0 }, { id: 'custom', label: 'Personalizada', feePct: 0 }],
      selectedScenario: 'standard', collapsed: false
    });
    return {
      schemaVersion: 3, ui: {},
      settings: {
        fixedPct: 12, premiumPct: 17, classicPct: 12, premiumAltPct: 14, classicAltPct: 11,
        commerce6Pct: 12, commerce3Pct: 4, storePct: 0, feePct: 0,
        mlFreeShippingThreshold: 79, mlFixedFeeBelowThreshold: 0, rounding: 'cent'
      },
      knownPrice: 269.9,
      fees: [
        { id: 'fee17', name: 'ML Premium · tabela 17%', pct: 17 },
        { id: 'fee12', name: 'ML Clássico · tabela 12%', pct: 12 },
        { id: 'fee14', name: 'ML Premium · tabela 14%', pct: 14 },
        { id: 'fee11', name: 'ML Clássico · tabela 11%', pct: 11 }
      ],
      categories: [
        makeCategory('example17', 'Exemplo · tabela ML 17% / 12%', 541.32, 25, 17, 12),
        makeCategory('example14', 'Exemplo · tabela ML 14% / 11%', 140.3, 23.65, 17, 12)
      ]
    };
  }
  function validate(data) {
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
    const label = value => typeof value === 'string' && value.length <= 120;
    const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
    const fail = () => { throw new Error('Preferências de precificação inválidas. Revise os campos ou escolha um arquivo exportado pela calculadora.'); };
    if (object(data) && data.schemaVersion === 1) {
      if (!object(data.settings) || !Array.isArray(data.categories)) fail();
      data = clone(data); data.schemaVersion = 2; data.settings.feePct = data.settings.taxPct;
      for (const category of data.categories) {
        if (!object(category) || !Array.isArray(category.scenarios) || ['cost', 'packaging', 'extra'].some(key => !number(category[key], 0, 1e9))) fail();
        category.cost += category.packaging + category.extra;
        for (const scenario of category.scenarios) {
          if (!object(scenario)) fail();
          scenario.feePct = scenario.taxPct;
          if (typeof scenario.label === 'string') scenario.label = scenario.label.replace(/imposto/gi, 'Taxa');
        }
      }
    }
    if (object(data) && data.schemaVersion === 2) {
      data = clone(data);
      data.schemaVersion = 3;
      const defaultsSettings = defaults().settings;
      for (const key of Object.keys(defaultsSettings)) if (data.settings[key] == null) data.settings[key] = defaultsSettings[key];
      for (const category of data.categories || []) {
        if (category.profitPct == null) category.profitPct = 0;
        if (category.promotionPct == null) category.promotionPct = 0;
        category.commissions = category.commissions || {};
        category.fixedFees = category.fixedFees || {};
        for (const channel of channels) {
          if (category.commissions[channel.id] === undefined) category.commissions[channel.id] = null;
          if (category.fixedFees[channel.id] === undefined) category.fixedFees[channel.id] = 0;
        }
      }
    }
    if (!object(data) || data.schemaVersion !== 3 || !object(data.settings) || !['cent', 'whole', 'ending99'].includes(data.settings.rounding)) fail();
    const settingsDefaults = defaults().settings;
    const settings = { rounding: data.settings.rounding };
    for (const key of ['fixedPct', 'premiumPct', 'classicPct', 'premiumAltPct', 'classicAltPct', 'commerce6Pct', 'commerce3Pct', 'storePct', 'feePct']) {
      const value = data.settings[key] == null ? settingsDefaults[key] : data.settings[key];
      if (!number(value, key === 'storePct' ? -100 : 0, 100)) fail();
      settings[key] = value;
    }
    for (const key of ['mlFreeShippingThreshold', 'mlFixedFeeBelowThreshold']) {
      const value = data.settings[key] == null ? settingsDefaults[key] : data.settings[key];
      if (!number(value, 0, 1e9)) fail();
      settings[key] = value;
    }
    if (!number(data.knownPrice, 0, 1e9) || !Array.isArray(data.categories) || data.categories.length > 50 || !Array.isArray(data.fees) || data.fees.length > 50) fail();
    const categoryIds = new Set(), feeIds = new Set();
    const categories = data.categories.map(category => {
      if (!object(category) || !identifier(category.id) || categoryIds.has(category.id) || !label(category.name) || !object(category.commissions) || !object(category.fixedFees) || !Array.isArray(category.scenarios) || !category.scenarios.length || category.scenarios.length > 25) fail();
      categoryIds.add(category.id);
      const result = {
        id: category.id, name: category.name, commissions: {}, fixedFees: {},
        profitPct: category.profitPct == null ? 0 : category.profitPct,
        promotionPct: category.promotionPct == null ? 0 : category.promotionPct,
        collapsed: category.collapsed === true
      };
      for (const key of ['cost', 'shipping']) { if (!number(category[key], 0, 1e9)) fail(); result[key] = category[key]; }
      if (!number(result.profitPct, 0, 95) || !number(result.promotionPct, 0, 99.99)) fail();
      for (const channel of channels) {
        const rate = category.commissions[channel.id] === undefined ? null : category.commissions[channel.id];
        const fixed = category.fixedFees[channel.id] === undefined ? 0 : category.fixedFees[channel.id];
        if (rate !== null && !number(rate, channel.id === 'store' ? -100 : 0, 100)) fail();
        if (!number(fixed, 0, 1e9)) fail();
        result.commissions[channel.id] = rate;
        result.fixedFees[channel.id] = fixed;
      }
      const scenarioIds = new Set();
      result.scenarios = category.scenarios.map(scenario => {
        if (!object(scenario) || !identifier(scenario.id) || scenarioIds.has(scenario.id) || !label(scenario.label) || !number(scenario.feePct, 0, 100)) fail();
        scenarioIds.add(scenario.id);
        return { id: scenario.id, label: scenario.label, feePct: scenario.feePct };
      });
      result.selectedScenario = scenarioIds.has(category.selectedScenario) ? category.selectedScenario : result.scenarios[0].id;
      return result;
    });
    const fees = data.fees.map(fee => {
      if (!object(fee) || !identifier(fee.id) || feeIds.has(fee.id) || !label(fee.name) || !number(fee.pct, 0, 100)) fail();
      feeIds.add(fee.id);
      return { id: fee.id, name: fee.name, pct: fee.pct };
    });
    const ui = {};
    if (data.ui != null) {
      if (!object(data.ui) || Object.keys(data.ui).length > 405) fail();
      for (const [key, value] of Object.entries(data.ui)) {
        if (!/^(settings|fees|method|tools|[a-zA-Z0-9-]{1,80}:(costs|channels|scenarios|breakdown-[a-zA-Z0-9-]+))$/.test(key) || typeof value !== 'boolean') fail();
        ui[key] = value;
      }
    }
    return clone({ schemaVersion: 3, settings, categories, fees, knownPrice: data.knownPrice, ui });
  }
  const api = { channels, parseNumber, roundUp, trayFixedFee, calculate, defaults, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MMPricingEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
