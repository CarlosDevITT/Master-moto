/* Catalog priority comes from the seller's saved ratings, independent of national sales. */
(() => {
  const view = $('#marketView'), hero = view.querySelector('.hero-row');
  const reference = document.createElement('div'); reference.id = 'nationalReference'; reference.className = 'hidden';
  [...view.children].filter(node => node !== hero).forEach(node => reference.append(node)); view.append(reference);
  hero.querySelector('.eyebrow').textContent = 'SEU CATÁLOGO · PRIORIDADE COMERCIAL';
  hero.querySelector('h1').textContent = 'Curva ABC do catálogo';
  hero.querySelector('.lede').textContent = 'Avalie suas motos em estrelas e organize a prioridade dos seus anúncios.';
  $('[data-view="mercado"]').innerHTML = '<span class="nav-icon">★</span> Curva ABC do catálogo';
  hero.insertAdjacentHTML('afterend', `<div class="workspace-card catalog-abc-source"><label>Base da classificação<select id="abcSource"><option value="catalog">Meu catálogo · avaliações</option><option value="national">Brasil · referência Fenabrave</option></select></label><p>4–5 estrelas: A · 3 estrelas: B · 1–2 estrelas: C. Sem avaliação fica pendente. Ajustes manuais anteriores são preservados.</p></div><div id="catalogAbcPanel"><div class="market-kpis" id="catalogAbcKpis"></div><div class="workspace-card"><div class="market-toolbar"><label class="search"><span>⌕</span><input type="search" id="catalogAbcSearch" placeholder="Buscar moto do catálogo" aria-label="Buscar na curva do catálogo"></label><label>Classificação<select id="catalogAbcCurve"><option value="">Todas as motos</option><option value="A">Curva A</option><option value="B">Curva B</option><option value="C">Curva C</option><option value="none">Sem avaliação</option></select></label><button class="subtle-btn" id="catalogAbcExport">Exportar avaliações</button></div><p class="table-meta" id="catalogAbcCount" aria-live="polite"></p><div class="table-wrap"><table><thead><tr><th>Moto</th><th>Anos</th><th>Avaliação</th><th>Curva</th><th>Ação</th></tr></thead><tbody id="catalogAbcRows"></tbody></table></div><div class="catalog-abc-pagination"><button class="subtle-btn" id="catalogAbcPrev">← Anterior</button><span id="catalogAbcPage"></span><button class="subtle-btn" id="catalogAbcNext">Próxima →</button></div></div><p class="pricing-help">A classificação representa sua avaliação comercial. As estrelas não medem emplacamentos nem volume de vendas. As notas ficam salvas neste navegador e acompanham o backup completo.</p></div>`);
  let page = 1, rows = [];
  function renderPanel() {
    const counts = { A:0, B:0, C:0, none:0 };
    records.forEach(record => counts[MMPerfil.catalogCurve(record) || 'none']++);
    $('#catalogAbcKpis').innerHTML = [['Curva A · prioridade alta', counts.A], ['Curva B · prioridade média', counts.B], ['Curva C · prioridade baixa', counts.C], ['Sem avaliação', counts.none]].map(([label, count]) => `<article class="workspace-card"><span>${label}</span><strong>${fmt(count)}</strong></article>`).join('');
    const terms = normalize($('#catalogAbcSearch').value).trim().split(/\s+/).filter(Boolean), curve = $('#catalogAbcCurve').value;
    rows = records.filter(record => terms.every(term => normalize(`${record.marca} ${record.modelo} ${record.nomeTitulo}`).includes(term)) && (!curve || (MMPerfil.catalogCurve(record) || 'none') === curve)).sort((a,b) => MMPerfil.rating(b) - MMPerfil.rating(a) || a.marca.localeCompare(b.marca,'pt-BR') || a.modelo.localeCompare(b.modelo,'pt-BR'));
    const pages = Math.max(1, Math.ceil(rows.length / 50)); page = Math.min(page, pages);
    $('#catalogAbcCount').textContent = `${fmt(rows.length)} de ${fmt(records.length)} motos do catálogo · ${fmt(records.length - counts.none)} classificadas`;
    $('#catalogAbcRows').innerHTML = rows.slice((page - 1)*50, page*50).map(record => {
      const curve = MMPerfil.catalogCurve(record), rating = MMPerfil.rating(record);
      return `<tr data-abc-id="${record.id}"><td><strong>${esc(record.marca)} ${esc(record.modelo)}</strong></td><td>${esc(record.anoInicial)}–${esc(record.anoFinal)}</td><td>${MMPerfil.ratingMarkup(record)}<small>${rating ? `${rating}/5 estrelas` : curve ? 'Ajuste manual anterior' : 'Clique para avaliar'}</small></td><td>${curve ? `<span class="market-curve curve-${curve}">${curve}</span>` : 'Sem avaliação'}</td><td><button class="subtle-btn" data-abc-edit="${record.id}">Editar moto</button></td></tr>`;
    }).join('') || '<tr><td colspan="5" class="catalog-empty">Nenhuma moto corresponde aos filtros.</td></tr>';
    $('#catalogAbcPage').textContent = `Página ${page} de ${pages}`; $('#catalogAbcPrev').disabled = page === 1; $('#catalogAbcNext').disabled = page === pages; $('#catalogAbcExport').disabled = !rows.length;
  }
  $('#abcSource').addEventListener('change', event => { const national = event.target.value === 'national'; reference.classList.toggle('hidden', !national); $('#catalogAbcPanel').classList.toggle('hidden', national); $('#marketRefresh').classList.toggle('hidden', !national); renderPanel(); });
  $('#marketRefresh').classList.add('hidden');
  ['catalogAbcSearch','catalogAbcCurve'].forEach(id => $('#'+id).addEventListener(id.endsWith('Search') ? 'input' : 'change', () => { page = 1; renderPanel(); }));
  $('#catalogAbcPrev').addEventListener('click', () => { page--; renderPanel(); }); $('#catalogAbcNext').addEventListener('click', () => { page++; renderPanel(); });
  $('#catalogAbcRows').addEventListener('click', event => { const button = event.target.closest('[data-abc-edit]'); if (button) openMotoModal(Number(button.dataset.abcEdit)); });
  $('#catalogAbcExport').addEventListener('click', () => {
    const csv = '\uFEFF' + [['Marca','Modelo','Ano inicial','Ano final','Estrelas','Curva','Origem'], ...rows.map(record => [record.marca, record.modelo, record.anoInicial, record.anoFinal, MMPerfil.rating(record) || '', MMPerfil.catalogCurve(record), MMPerfil.rating(record) ? 'Avaliação em estrelas' : MMPerfil.catalogCurve(record) ? 'Ajuste manual' : 'Sem avaliação'])].map(row => row.map(MMCsv.cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), link = document.createElement('a'); link.href=url; link.download='master-motos-avaliacoes-abc.csv'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('.nav').addEventListener('click', event => { if (event.target.closest('[data-view]')?.dataset.view === 'mercado') renderPanel(); });
  window.MMCatalogABC = { render() { if (!view.classList.contains('hidden') && $('#abcSource').value === 'catalog') renderPanel(); } }; renderPanel();
})();
