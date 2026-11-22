const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/pricing-engine.js');
test('Precificação preserva os exemplos e calcula sem lucro desejado, incluindo tarifa fixa', () => {
  const d = E.defaults(), c = d.categories[0];
  assert.equal(E.calculate(c, c.scenarios[0], d.settings, 'premium').price, 797.64);
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
  assert.equal(migrated.categories[0].scenarios[0].feePct, 0);
  assert.equal(migrated.categories[0].scenarios[0].label, 'Taxa antigo');
  assert.equal(migrated.settings.marginPct, undefined);
  assert.equal(migrated.categories[0].scenarios[0].marginPct, undefined);
  assert.equal(migrated.categories[0].packaging, undefined);
  assert.equal(legacy.categories[0].cost, 541.32);
  assert.deepEqual(E.validate(migrated), migrated);
});


test('Regras fixas Tray respeitam os limites de custo informados', () => {
  assert.equal(E.trayFixedFee(49.99), 10);
  assert.equal(E.trayFixedFee(50), 5);
  assert.equal(E.trayFixedFee(100), 5);
  assert.equal(E.trayFixedFee(100.01), 0);
  assert.equal(E.trayFixedFee(101), 0);
  assert.equal(E.trayFixedFee(101.01), 0);
  const d = E.defaults();
  assert.equal(d.settings.commerce3Pct, 4);
  assert.equal(d.settings.commerce6Pct, 12);
});

test('Lucro desejado entra no divisor e promoção calcula o preço De sem alterar o Por', () => {
  const d = E.defaults(), c = d.categories[0], s = { feePct: 0 };
  c.cost = 80; c.shipping = 10; c.profitPct = 20; c.promotionPct = 10;
  const result = E.calculate(c, s, d.settings, 'commerce3');
  assert.equal(result.valid, true);
  assert.equal(result.trayFee, 5);
  assert.equal(result.price, 148.44);
  assert.equal(result.promotionPrice, 164.94);
  assert.equal(result.discountAmount, 16.5);
  assert.ok(Math.abs(result.actualMargin - 20) < 0.02);
});

test('Mercado Livre aplica tarifa unitária abaixo do limite e não duplica frete informado', () => {
  const d = E.defaults(), c = d.categories[0], s = { feePct: 0 };
  d.settings.mlFixedFeeBelowThreshold = 6.5;
  c.cost = 30; c.shipping = 4;
  const below = E.calculate(c, s, d.settings, 'premium');
  assert.equal(below.valid, true);
  assert.equal(below.base, 34);
  assert.equal(below.shipping, 4);
  assert.equal(below.mlFixedFee, 6.5);
  assert.equal(below.freeShippingRequired, false);
  c.cost = 100; c.shipping = 12;
  const above = E.calculate(c, s, d.settings, 'premium');
  assert.equal(above.valid, true);
  assert.equal(above.base, 112);
  assert.equal(above.mlFixedFee, 0);
  assert.equal(above.freeShippingRequired, true);
});
