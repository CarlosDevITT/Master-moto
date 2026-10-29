const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/orders-engine.js');
const order = { number: 'PED-001', supplier: 'PROX', items: [{sku:'ABC', description:'Pistão', quantity:2}] };
test('valida e normaliza pedido', () => {
  const result = engine.normalizeOrder(order);
  assert.equal(result.items[0].received, 0);
  assert.equal(result.items[0].unitPrice, null);
});
test('rejeita quantidade inválida', () => {
  assert.throws(() => engine.normalizeOrder({...order,items:[{sku:'ABC',description:'Pistão',quantity:0}]}));
});
test('respeita transições de status', () => {
  assert.equal(engine.canTransition('draft','confirmed'), true);
  assert.equal(engine.canTransition('draft','received'), false);
  assert.equal(engine.canTransition('received','cancelled'), false);
});
test('calcula recebimento parcial e total', () => {
  assert.equal(engine.receivingStatus([{...order.items[0],received:1}]), 'partially_received');
  assert.equal(engine.receivingStatus([{...order.items[0],received:2}]), 'received');
});
test('gera CSV com proteção contra fórmula', () => {
  const csv = engine.exportCsv({...order,items:[{sku:'=1+1',description:'Pistão',quantity:2}]});
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /Fornecedor/);
});
test('formata mensagem para WhatsApp', () => {
  const msg = engine.whatsappMessage(order);
  assert.match(msg, /PROX/);
  assert.match(msg, /2 un\./);
});
