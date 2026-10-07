(function (root) {
  const key = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function validate(data) {
    if (!data || data.schemaVersion !== 1 || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(data.period) || !/^https:\/\/www\.fenabrave\.org\.br\/portal\/files\/20\d{2}_\d{2}_02\.pdf$/.test(data.source) || data.source.split('/').pop() !== data.period.replace('-', '_') + '_02.pdf' || !Number.isFinite(Date.parse(data.checkedAt)) || !Array.isArray(data.models) || !data.models.length || data.models.length > 500) throw Error('Fonte de mercado inválida.');
    for (const name of ['totalMonthly', 'totalYearToDate']) if (!Number.isSafeInteger(data[name]) || data[name] <= 0) throw Error('Totais inválidos.');
    const seen = new Set();
    const models = data.models.map(row => {
      if (!row || typeof row.brand !== 'string' || typeof row.model !== 'string' || !key(row.brand) || !key(row.model) || row.brand.length > 100 || row.model.length > 100) throw Error('Modelo inválido.');
      const id = key(row.brand) + '/' + key(row.model);
      if (seen.has(id)) throw Error('Modelo repetido.'); seen.add(id);
      for (const field of ['monthly', 'previous', 'yearToDate']) if (!Number.isSafeInteger(row[field]) || row[field] < 0) throw Error('Emplacamentos inválidos.');
      return { brand: row.brand, model: row.model, monthly: row.monthly, previous: row.previous, yearToDate: row.yearToDate, id };
    });
    if (models.reduce((sum, row) => sum + row.yearToDate, 0) > data.totalYearToDate || models.reduce((sum, row) => sum + row.monthly, 0) > data.totalMonthly) throw Error('Amostra maior que o mercado.');
    return { schemaVersion: 1, period: data.period, source: data.source, checkedAt: data.checkedAt, totalMonthly: data.totalMonthly, totalYearToDate: data.totalYearToDate, models };
  }
  function rank(data, measure = 'yearToDate') {
    const field = measure === 'monthly' ? 'monthly' : 'yearToDate';
    const total = data.models.reduce((sum, row) => sum + row[field], 0);
    let cumulative = 0;
    return [...data.models].sort((a, b) => b[field] - a[field] || a.id.localeCompare(b.id)).map((row, index) => {
      const before = total ? cumulative / total * 100 : 100;
      cumulative += row[field];
      return { ...row, rank: index + 1, units: row[field], curve: row[field] === 0 ? 'C' : before < 80 ? 'A' : before < 95 ? 'B' : 'C', share: total ? row[field] / total * 100 : 0, cumulative: total ? cumulative / total * 100 : 0, nationalShare: row[field] / data[field === 'monthly' ? 'totalMonthly' : 'totalYearToDate'] * 100 };
    });
  }
  const aliases = {
    'YAMAHA/XTZ250': ['LANDER250'], 'YAMAHA/XTZ690': ['TENERE700'],
    'YAMAHA/FAZER250': ['FZ25'], 'YAMAHA/FAZER150': ['FZ15'],
    'YAMAHA/YZFR3': ['R3'], 'YAMAHA/YZFR15': ['R15'],
    'YAMAHA/NMAX': ['NMAX160'], 'HONDA/CRF1100L': ['AFRICATWINCRF1100L'],
    'HONDA/GOLDWING': ['GOLDWING1800'], 'BMW/S1000RR': ['S1000RR']
  };
  function match(record, ranked) {
    const brand = key(record.marca), model = key(record.modelo);
    // Exact names and reviewed aliases only: no fuzzy displacement/substring matching.
    return ranked.find(row => key(row.brand) === brand && (key(row.model) === model || (aliases[row.id] || []).includes(model))) || null;
  }
  const api = { validate, rank, match };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MMMarketEngine = api;
})(typeof window === 'undefined' ? globalThis : window);
