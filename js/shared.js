/* Shared storage transaction and spreadsheet-safe CSV cells. */
window.MMStore = {
  commit(entries) {
    const before = new Map();
    try {
      entries.forEach(([key]) => before.set(key, localStorage.getItem(key)));
      entries.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)));
      return true;
    } catch {
      let restored = true;
      for (const [key, value] of before) { try { if (localStorage.getItem(key) !== value) value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { restored = false; } }
      toast(restored ? 'Não foi possível salvar. As alterações não foram aplicadas.' : 'Não foi possível salvar nem restaurar o armazenamento. Exporte um backup antes de recarregar.'); return false;
    }
  }
};
window.MMCsv = {
  cell(value) {
    let text = String(value ?? '');
    if (typeof value !== 'number' && (/^[\s]*[=+@\-＝＋＠－]/u.test(text) || /^[\t\r\n]/.test(text))) text = '\t' + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
};
