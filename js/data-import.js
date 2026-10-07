(function () {
  const FILES = {
    categories: 'Data/categorias_1438293_0857c526-ec46-4318-834c-5c9d81a62f32.csv',
    products: 'Data/produtos_2026-09-23-12-02-22.csv'
  };

  const sanitize = (value) => String(value ?? '').trim();
  const normalizeHeader = (value) => sanitize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  function parseCsv(text, delimiter = ';') {
    const rows = [];
    let row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        row.push(current);
        current = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        if (row.length || current) {
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (row.length || current || rows.length) {
      row.push(current);
      rows.push(row);
    }

    return rows
      .filter((lines) => lines.some((cell) => sanitize(cell).length > 0))
      .map((lines) => lines.map((cell) => sanitize(cell).replace(/\\r/g, '').replace(/\\n/g, ' ')));
  }

  function buildIndex(headers) {
    return Object.fromEntries(headers.map((header, index) => [normalizeHeader(header), index]));
  }

  function firstValue(row, map, key) {
    const idx = map[key];
    if (idx === undefined) return '';
    return row[idx] ?? '';
  }

  function mapCategoryRows(rows) {
    if (!rows.length) return [];
    const header = rows[0];
    const index = buildIndex(header);

    return rows.slice(1).map((row) => ({
      id: firstValue(row, index, 'codigo_categoria') || firstValue(row, index, 'codigo'),
      codigoCategoriaMae: firstValue(row, index, 'codigo_categoria_mae') || firstValue(row, index, 'codigo_categoria_m_e'),
      nome: firstValue(row, index, 'categoria'),
      nivel: firstValue(row, index, 'nivel_categoria'),
      status: firstValue(row, index, 'status'),
      seoUrl: firstValue(row, index, 'seo_url') || firstValue(row, index, 'url'),
      seoTitulo: firstValue(row, index, 'seo_titulo'),
      seoDescricao: firstValue(row, index, 'seo_descricao'),
      palavrasChave: firstValue(row, index, 'seo_palavras_chaves') || firstValue(row, index, 'seo_palavras_chave'),
      termoAceite: firstValue(row, index, 'termo_de_aceite_sim_ou_nao') || firstValue(row, index, 'termo_de_aceite')
    })).filter((item) => item.nome || item.id);
  }

  function mapProductRows(rows) {
    if (!rows.length) return [];
    const header = rows[0];
    const index = buildIndex(header);

    return rows.slice(1).map((row) => ({
      id: firstValue(row, index, 'id'),
      codigo: firstValue(row, index, 'codigo'),
      descricao: firstValue(row, index, 'descricao'),
      unidade: firstValue(row, index, 'unidade'),
      ncm: firstValue(row, index, 'ncm'),
      origem: firstValue(row, index, 'origem'),
      preco: firstValue(row, index, 'preco'),
      estoque: firstValue(row, index, 'estoque'),
      fornecedor: firstValue(row, index, 'fornecedor'),
      marca: firstValue(row, index, 'marca'),
      categoria: firstValue(row, index, 'categoria_do_produto') || firstValue(row, index, 'grupo_de_produtos') || firstValue(row, index, 'departamento'),
      grupo: firstValue(row, index, 'grupo_de_produtos'),
      departamento: firstValue(row, index, 'departamento'),
      situacao: firstValue(row, index, 'situacao'),
      codigoFornecedor: firstValue(row, index, 'cod_no_fornecedor'),
      gtin: firstValue(row, index, 'gtin_ean'),
      descricaoComplementar: firstValue(row, index, 'descricao_complementar'),
      descricaoCurta: firstValue(row, index, 'descricao_curta'),
      linkExterno: firstValue(row, index, 'link_externo'),
      urlImagensExternas: firstValue(row, index, 'url_imagens_externas'),
      observacoes: firstValue(row, index, 'observacoes'),
      informacoesAdicionais: firstValue(row, index, 'informacoes_adicionais'),
      integration: {
        provider: 'bling',
        status: 'pending',
        externalId: firstValue(row, index, 'id'),
        sku: firstValue(row, index, 'codigo'),
        gtin: firstValue(row, index, 'gtin_ean')
      }
    })).filter((item) => item.descricao || item.codigo || item.id);
  }

  async function loadCsvFile(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Não foi possível carregar ${url}: ${response.status}`);
    }
    return response.text();
  }

  async function loadData() {
    window.PROJECT_DATA = {
      source: FILES,
      status: 'loading',
      categories: [],
      products: [],
      loadedAt: null,
      error: null,
      counts: { categories: 0, products: 0 }
    };

    try {
      const [categoriesText, productsText] = await Promise.all([
        loadCsvFile(FILES.categories),
        loadCsvFile(FILES.products)
      ]);

      const categories = mapCategoryRows(parseCsv(categoriesText));
      const products = mapProductRows(parseCsv(productsText));

      window.PROJECT_DATA = {
        source: FILES,
        status: 'ready',
        categories,
        products,
        loadedAt: new Date().toISOString(),
        error: null,
        counts: {
          categories: categories.length,
          products: products.length
        }
      };

      window.dispatchEvent(new CustomEvent('project-data-ready', { detail: window.PROJECT_DATA }));
      console.info('[MASTER MOTOS] Dados importados da pasta Data:', window.PROJECT_DATA.counts);
    } catch (error) {
      console.warn('[MASTER MOTOS] Falha ao importar dados da pasta Data:', error);
      window.PROJECT_DATA = {
        source: FILES,
        status: 'error',
        categories: [],
        products: [],
        loadedAt: null,
        error: String(error && error.message ? error.message : error),
        counts: { categories: 0, products: 0 }
      };
      window.dispatchEvent(new CustomEvent('project-data-ready', { detail: window.PROJECT_DATA }));
    }
  }

  if (typeof window !== 'undefined') {
    window.PROJECT_DATA = {
      source: FILES,
      status: 'idle',
      categories: [],
      products: [],
      loadedAt: null,
      error: null,
      counts: { categories: 0, products: 0 }
    };
    loadData();
  }
})();
