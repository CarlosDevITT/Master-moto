/* Domain rules for purchase orders. No DOM, storage or network side effects. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MMOrdersEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const STATUSES = Object.freeze(['draft','confirmed','sent','partially_received','received','cancelled']);
  const TRANSITIONS = Object.freeze({
    draft: ['confirmed','cancelled'],
    confirmed: ['sent','cancelled'],
    sent: ['partially_received','received','cancelled'],
    partially_received: ['received'],
    received: [],
    cancelled: []
  });
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function text(value, max, label) {
    const s = String(value ?? '').trim();
    assert(s.length > 0 && s.length <= max, label + ' inválido');
    return s;
  }
  function normalizeItem(item) {
    assert(item && typeof item === 'object', 'Item inválido');
    const quantity = Number(item.quantity);
    assert(Number.isSafeInteger(quantity) && quantity > 0, 'Quantidade inválida');
    const received = item.received == null ? 0 : Number(item.received);
    assert(Number.isSafeInteger(received) && received >= 0 && received <= quantity, 'Recebimento inválido');
    const unitPrice = item.unitPrice == null || item.unitPrice === '' ? null : Number(item.unitPrice);
    assert(unitPrice === null || (Number.isFinite(unitPrice) && unitPrice >= 0), 'Preço inválido');
    return { sku: text(item.sku, 100, 'Código'), description: text(item.description, 500, 'Descrição'),
      application: String(item.application ?? '').trim().slice(0, 300),
      quantity, received, unitPrice };
  }
  function normalizeOrder(order) {
    assert(order && typeof order === 'object', 'Pedido inválido');
    const items = order.items;
    assert(Array.isArray(items) && items.length > 0 && items.length <= 500, 'Pedido deve conter de 1 a 500 itens');
    return { supplier: text(order.supplier, 150, 'Fornecedor'),
      number: text(order.number, 80, 'Número do pedido'),
      notes: String(order.notes ?? '').trim().slice(0, 2000),
      items: items.map(normalizeItem) };
  }
  function canTransition(from, to) { return !!TRANSITIONS[from]?.includes(to); }
  function receivingStatus(items) {
    assert(Array.isArray(items) && items.length > 0, 'Itens inválidos');
    const normalized = items.map(normalizeItem);
    const total = normalized.reduce((sum, i) => sum + i.quantity, 0);
    const received = normalized.reduce((sum, i) => sum + i.received, 0);
    return received === total ? 'received' : received > 0 ? 'partially_received' : 'sent';
  }
  function csvCell(value) {
    let s = String(value ?? '');
    // Prevent formula execution when opened in spreadsheet applications.
    if (/^[\s\uFEFF]*[=+@\-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportCsv(order) {
    const data = normalizeOrder(order);
    const rows = [['Pedido', data.number], ['Fornecedor', data.supplier], ['Observações', data.notes], [],
      ['Código','Descrição','Aplicação','Quantidade','Recebido','Preço unitário']];
    for (const item of data.items) rows.push([item.sku,item.description,item.application,item.quantity,item.received,item.unitPrice ?? '']);
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
  }
  function whatsappMessage(order) {
    const data = normalizeOrder(order);
    const lines = ['*MASTER MOTOS — PEDIDO '+data.number+'*','Fornecedor: '+data.supplier,''];
    data.items.forEach((item, index) => lines.push((index + 1)+'. '+item.sku+' — '+item.description+' — '+item.quantity+' un.'+(item.application ? ' ('+item.application+')' : '')));
    if (data.notes) lines.push('', 'Observações: '+data.notes);
    lines.push('', 'Favor confirmar disponibilidade e prazo de entrega.');
    return lines.join('\n');
  }
  return Object.freeze({ STATUSES, TRANSITIONS, normalizeItem, normalizeOrder, canTransition, receivingStatus, exportCsv, whatsappMessage });
});
