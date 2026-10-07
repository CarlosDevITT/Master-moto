const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/pricing-engine.js');
test('Precificação preserva os exemplos e calcula margem sobre a venda, incluindo tarifa fixa', () => {
  const d = E.defaults(), c = d.categories[0];
  assert.equal(E.calculate(c, c.scenarios[0], d.settings, 'premium').price, 1179.84);
  c.cost = 100; c.shipping = 10; c.packaging = 5; c.extra = 5; c.fixedFees.premium = 5;
  c.commissions.premium = 10; d.settings.fixedPct = 5;
  const r = E.calculate(c, { taxPct: 10, marginPct: 25 }, d.settings, 'premium');
  assert.equal(r.price, 250); assert.equal(r.profit, 62.5); assert.equal(r.actualMargin, 25);
});
test('Comissões dos canais são independentes e o arredondamento preserva a margem', () => {
  const d = E.defaults(), c = d.categories[0], s = { taxPct: 0, marginPct: 20 };
  c.cost = 100; c.shipping = 0; c.commissions.classic = 5; c.commissions.commerce6 = 15;
  const classic = E.calculate(c, s, d.settings, 'classic');
  const commerce = E.calculate(c, s, d.settings, 'commerce6');
  assert.ok(commerce.price > classic.price);
  for (const rounding of ['cent', 'whole', 'ending99']) {
    d.settings.rounding = rounding;
    const r = E.calculate(c, s, d.settings, 'premium');
    assert.ok(r.price >= r.rawPrice - 1e-8); assert.ok(r.actualMargin >= 20 - 1e-8);
    if (rounding === 'ending99') assert.equal(Math.round(r.price * 100) % 100, 99);
  }
});
test('Custos ausentes e taxas impossíveis não produzem preços ou infinito', () => {
  const d = E.defaults(), c = d.categories[0], s = c.scenarios[0];
  for (const cost of [null, '', -1, Infinity, NaN]) {
    c.cost = cost; assert.equal(E.calculate(c, s, d.settings, 'premium').valid, false);
  }
  c.cost = 0; c.shipping = 0; assert.equal(E.calculate(c, s, d.settings, 'premium').valid, false);
  c.cost = 100; s.taxPct = 71;
  assert.equal(E.calculate(c, s, d.settings, 'premium').valid, false);
  s.taxPct = 72; assert.equal(E.calculate(c, s, d.settings, 'premium').valid, false);
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
