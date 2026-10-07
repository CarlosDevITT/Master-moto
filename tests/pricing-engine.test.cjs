const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/pricing-engine.js');
test('Precificação preserva os exemplos e calcula sem lucro desejado, incluindo tarifa fixa', () => {
  const d = E.defaults(), c = d.categories[0];
  assert.equal(E.calculate(c, c.scenarios[0], d.settings, 'premium').price, 1179.84);
  c.cost = 100; c.shipping = 10; c.packaging = 5; c.extra = 5; c.fixedFees.premium = 5;
  c.commissions.premium = 10; d.settings.fixedPct = 5;
  const r = E.calculate(c, { feePct: 10, marginPct: 25 }, d.settings, 'premium');
  assert.equal(r.price, 153.34);
  assert.deepEqual(r, E.calculate(c, { feePct: 10, marginPct: 0 }, d.settings, 'premium'));
});
test('Comissões dos canais são independentes e o arredondamento cobre os custos', () => {
  const d = E.defaults(), c = d.categories[0], s = { feePct: 0 };
  c.cost = 100; c.shipping = 0; c.commissions.classic = 5; c.commissions.commerce6 = 15;
  const classic = E.calculate(c, s, d.settings, 'classic');
  const commerce = E.calculate(c, s, d.settings, 'commerce6');
  assert.ok(commerce.price > classic.price);
  for (const rounding of ['cent', 'whole', 'ending99']) {
    d.settings.rounding = rounding;
    const r = E.calculate(c, s, d.settings, 'premium');
    assert.ok(r.price >= r.rawPrice - 1e-8); assert.ok(r.actualMargin >= -1e-8);
    if (rounding === 'ending99') assert.equal(Math.round(r.price * 100) % 100, 99);
  }
});
test('Custos ausentes e taxas impossíveis não produzem preços ou infinito', () => {
  const d = E.defaults(), c = d.categories[0], s = c.scenarios[0];
  for (const cost of [null, '', -1, Infinity, NaN]) {
    c.cost = cost; assert.equal(E.calculate(c, s, d.settings, 'premium').valid, false);
  }
  c.cost = 0; c.shipping = 0; assert.equal(E.calculate(c, s, d.settings, 'premium').valid, false);
  c.cost = 100; s.feePct = 71;
  assert.equal(E.calculate(c, s, d.settings, 'premium').valid, false);
  s.feePct = 72; assert.equal(E.calculate(c, s, d.settings, 'premium').valid, false);
});
test('Valores brasileiros são interpretados e importações inválidas são recusadas', () => {
  assert.equal(E.parseNumber('R$ 1.234,56'), 1234.56); assert.equal(E.parseNumber('541,32'), 541.32);
  assert.equal(E.parseNumber('541.32'), 541.32);
  for (const value of ['', '1,2,3', '12abc', 'Infinity']) assert.equal(E.parseNumber(value), null);
  const d = E.defaults(); assert.deepEqual(E.validate(d), d);
  d.categories.push(d.categories[0]); assert.throws(() => E.validate(d));
});
test('Preferências antigas continuam válidas e a organização aceita apenas painéis conhecidos', () => {
  const d = E.defaults(); delete d.ui;
  assert.deepEqual(E.validate(d).ui, {});
  d.ui = { settings: true, 'example17:channels': false, 'example17:breakdown-premium': true };
  assert.deepEqual(E.validate(d).ui, d.ui);
  d.ui.unknown = true; assert.throws(() => E.validate(d));
});

 test('Migração preserva custos e taxas antigas, remove margens e não repete custos adicionais', () => {
  const legacy = E.defaults(); legacy.schemaVersion = 1;
  legacy.settings.taxPct = legacy.settings.feePct; delete legacy.settings.feePct;
  legacy.settings.marginPct = 30;
  for (const c of legacy.categories) {
    c.packaging = 5; c.extra = 7;
    for (const s of c.scenarios) { s.taxPct = s.feePct; delete s.feePct; s.marginPct = 40; s.label = 'Imposto antigo'; }
  }
  const migrated = E.validate(legacy);
  assert.equal(migrated.categories[0].cost, 553.32);
  assert.equal(migrated.categories[0].scenarios[0].feePct, 23);
  assert.equal(migrated.categories[0].scenarios[0].label, 'Taxa antigo');
  assert.equal(migrated.settings.marginPct, undefined);
  assert.equal(migrated.categories[0].scenarios[0].marginPct, undefined);
  assert.equal(migrated.categories[0].packaging, undefined);
  assert.equal(legacy.categories[0].cost, 541.32);
  assert.deepEqual(E.validate(migrated), migrated);
});
