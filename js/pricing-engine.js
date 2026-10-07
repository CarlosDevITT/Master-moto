/* Pure pricing arithmetic. All rates are user-defined, not live marketplace fees. */
(function (root) {
  const channels = [
    { id: 'premium', label: 'ML Premium', setting: 'premiumPct' },
    { id: 'classic', label: 'ML Clássico', setting: 'classicPct' },
    { id: 'commerce6', label: 'E-commerce 6x', setting: 'commerce6Pct' },
    { id: 'commerce3', label: 'E-commerce 3x', setting: 'commerce3Pct' },
    { id: 'store', label: 'Loja', setting: 'storePct' }
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
  function calculate(category, scenario, settings, channelId) {
    const channel = channels.find(item => item.id === channelId);
    const error = message => ({ valid: false, message });
    if (!channel) return error('Canal inválido.');
    const costs = ['cost', 'shipping'].map(key => parseNumber(category[key]));
    if (costs.some(value => value === null || value < 0 || value > 1e9)) return error('Revise os custos: use valores de zero a R$ 1 bilhão.');
    const base = costs.reduce((total, value) => total + value, 0);
    if (base <= 0) return error('Informe um custo maior que zero.');
    const commission = parseNumber(category.commissions[channelId] ?? settings[channel.setting]);
    const fixedFee = parseNumber(category.fixedFees[channelId]);
    const operatingPct = parseNumber(settings.fixedPct);
    const feePct = parseNumber(scenario.feePct ?? scenario.taxPct);
    if ([commission, operatingPct, feePct, fixedFee].some(value => value === null)) return error('Preencha as taxas e tarifas.');
    if (commission < (channelId === 'store' ? -100 : 0) || commission > 100 || operatingPct < 0 || operatingPct > 100 || feePct < 0 || feePct > 100 || fixedFee < 0 || fixedFee > 1e9) return error('Revise os percentuais e a tarifa fixa deste canal.');
    const combinedPct = commission + operatingPct + feePct;
    if (combinedPct >= 100) return error('As taxas somam 100% ou mais. Reduza os percentuais.');
    const rawPrice = (base + fixedFee) / (1 - combinedPct / 100);
    const price = roundUp(rawPrice, settings.rounding);
    const commissionAmount = price * commission / 100;
    const operatingAmount = price * operatingPct / 100;
    const feeAmount = price * feePct / 100;
    const profit = price - base - fixedFee - commissionAmount - operatingAmount - feeAmount;
    return { valid: true, rawPrice, price, base, fixedFee, commission, combinedPct, commissionAmount, operatingAmount, feeAmount, profit, actualMargin: profit / price * 100 };
  }
  function defaults() {
    const makeCategory = (id, name, cost, shipping, premium, classic) => ({
      id, name, cost, shipping,
      commissions: { premium, classic, commerce6: classic, commerce3: null, store: null },
      fixedFees: Object.fromEntries(channels.map(channel => [channel.id, 0])),
      scenarios: [{ id: 'tax23', label: 'Taxa 23%', feePct: 23 }, { id: 'tax18', label: 'Taxa 18%', feePct: 18 }, { id: 'custom', label: 'Personalizada', feePct: 0 }],
      selectedScenario: 'tax23', collapsed: false
    });
    return {
      schemaVersion: 2, ui: {},
      settings: { fixedPct: 12, premiumPct: 17, classicPct: 12, commerce6Pct: 12, commerce3Pct: 6, storePct: -2, feePct: 23, rounding: 'cent' },
      knownPrice: 269.9,
      fees: [{ id: 'fee12', name: 'Comissão Clássico 17/12', pct: 12 }, { id: 'fee17', name: 'Comissão Premium 17/12', pct: 17 }, { id: 'fee11', name: 'Comissão Clássico 14/11', pct: 11 }, { id: 'fee14', name: 'Comissão Premium 14/11', pct: 14 }],
      categories: [makeCategory('example17', 'Exemplo · comissões 17/12', 541.32, 25, 17, 12), makeCategory('example14', 'Exemplo · comissões 14/11', 140.3, 23.65, 14, 11)]
    };
  }
  function validate(data) {
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
    const label = value => typeof value === 'string' && value.length <= 120;
    const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
    const fail = () => { throw new Error('Preferências de precificação inválidas. Revise os campos ou escolha um arquivo exportado pela calculadora.'); };
    // Old backups keep their costs; desired margins never enter the new calculation.
    if (object(data) && data.schemaVersion === 1) {
      if (!object(data.settings) || !Array.isArray(data.categories)) fail();
      data = clone(data); data.schemaVersion = 2; data.settings.feePct = data.settings.taxPct;
      for (const category of data.categories) {
        if (!object(category) || !Array.isArray(category.scenarios) || ['cost','packaging','extra'].some(key => !number(category[key],0,1e9))) fail();
        category.cost += category.packaging + category.extra;
        for (const scenario of category.scenarios) {
          if (!object(scenario)) fail();
          scenario.feePct = scenario.taxPct;
          if (typeof scenario.label === 'string') scenario.label = scenario.label.replace(/imposto/gi,'Taxa');
        }
      }
    }
    if (!object(data) || data.schemaVersion !== 2 || !object(data.settings) || !['cent', 'whole', 'ending99'].includes(data.settings.rounding)) fail();
    const settings = { rounding: data.settings.rounding };
    for (const key of ['fixedPct', 'premiumPct', 'classicPct', 'commerce6Pct', 'commerce3Pct', 'storePct', 'feePct']) {
      if (!number(data.settings[key], key === 'storePct' ? -100 : 0, 100)) fail();
      settings[key] = data.settings[key];
    }
    if (!number(data.knownPrice, 0, 1e9) || !Array.isArray(data.categories) || data.categories.length > 50 || !Array.isArray(data.fees) || data.fees.length > 50) fail();
    const categoryIds = new Set(), feeIds = new Set();
    const categories = data.categories.map(category => {
      if (!object(category) || !identifier(category.id) || categoryIds.has(category.id) || !label(category.name) || !object(category.commissions) || !object(category.fixedFees) || !Array.isArray(category.scenarios) || !category.scenarios.length || category.scenarios.length > 25) fail();
      categoryIds.add(category.id);
      const result = { id: category.id, name: category.name, commissions: {}, fixedFees: {}, collapsed: category.collapsed === true };
      for (const key of ['cost', 'shipping']) { if (!number(category[key], 0, 1e9)) fail(); result[key] = category[key]; }
      for (const channel of channels) {
        const rate = category.commissions[channel.id];
        if (rate !== null && !number(rate, channel.id === 'store' ? -100 : 0, 100)) fail();
        if (!number(category.fixedFees[channel.id], 0, 1e9)) fail();
        result.commissions[channel.id] = rate; result.fixedFees[channel.id] = category.fixedFees[channel.id];
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
      feeIds.add(fee.id); return { id: fee.id, name: fee.name, pct: fee.pct };
    });
    const ui = {};
    if (data.ui != null) {
      if (!object(data.ui) || Object.keys(data.ui).length > 405) fail();
      for (const [key, value] of Object.entries(data.ui)) {
        if (!/^(settings|fees|method|tools|[a-zA-Z0-9-]{1,80}:(costs|channels|scenarios|breakdown-(premium|classic|commerce6|commerce3|store)))$/.test(key) || typeof value !== 'boolean') fail();
        ui[key] = value;
      }
    }
    return clone({ schemaVersion: 2, settings, categories, fees, knownPrice: data.knownPrice, ui });
  }
  const api = { channels, parseNumber, calculate, defaults, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MMPricingEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
