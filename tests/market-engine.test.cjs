const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/market-engine');
const raw = require('./fixtures/market-september-2026.json');
test('Fonte oficial contém os 77 modelos extraídos e os totais do período', () => {
  const d = E.validate(raw), rows = E.rank(d);
  assert.equal(d.models.length, 77); assert.equal(d.totalYearToDate, 1783971); assert.equal(d.totalMonthly, 205032);
  assert.equal(rows[0].model, 'CG 160'); assert.equal(rows[0].units, 404628);
  assert.equal(rows[0].monthly, 48835); assert.equal(rows[0].curve, 'A');
  assert.ok(Math.abs(rows.at(-1).cumulative - 100) < 1e-8);
  assert.ok(rows.reduce((s, r) => s + r.nationalShare, 0) < 100);
});
test('ABC inclui o modelo que cruza o limite e classifica zero em C', () => {
  const d = { totalYearToDate: 100, models: [79, 10, 7, 4, 0].map((n, i) => ({ id: String(i), yearToDate: n, monthly: 0 })) };
  assert.deepEqual(E.rank(d).map(r => r.curve), ['A', 'A', 'B', 'C', 'C']);
});
test('Correspondência usa nomes exatos e equivalências revisadas, sem confundir cilindradas', () => {
  const rows = E.rank(E.validate(raw));
  assert.equal(E.match({ marca: 'Yamaha', modelo: 'Lander 250' }, rows).model, 'XTZ 250');
  assert.equal(E.match({ marca: 'Yamaha', modelo: 'MT-03' }, rows).model, 'MT03');
  assert.equal(E.match({ marca: 'Honda', modelo: 'CB 300R' }, rows), null);
  assert.equal(E.match({ marca: 'Honda', modelo: 'CG 125' }, rows), null);
  assert.equal(E.match({ marca: 'Honda', modelo: 'CRF 250F' }, rows), null);
});
test('Dados de origem, totais ou duplicações inválidas são recusados', () => {
  for (const change of [d => d.source = 'https://example.com/report.pdf', d => d.period = '2026-13', d => d.models.push(d.models[0]), d => d.models[0].monthly = -1, d => d.totalYearToDate = 1]) {
    const d = JSON.parse(JSON.stringify(raw)); change(d); assert.throws(() => E.validate(d));
  }
});
