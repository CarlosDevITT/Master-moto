(() => {
  const KEY = 'master-motos-brands-v1';
  const seeds = [
    ['PROX','https://www.pro-x.com/'], ['ATHENA','https://www.athena.eu/'],
    ['VEDAMOTORS','https://catalogo.vedamotors.com.br/'], ['MOTO-MASTER','https://products.moto-master.com/'],
    ['TWIN AIR','https://twinair.com/applications?s=&vehicle_id=&engine_id=&manufacturer_id=&type_id=&year=&shop=ROW&sort_by='],
    ['ALL BALLS','https://www.allballsracing.com/'], ['HIFLO FILTRO','https://www.hiflofiltro.com/'],
    ['DANIDREA','https://danidrea.com.br/produtos/'], ['KAWAPARTS','https://www.pecaskawasaki.com.br/'],
    ['PARTZILLA','https://www.partzilla.com/'], ['WOSSNER','https://wossnerpistons.com/collections'],
    ['JARVA','https://www.jarvaimports.com.br/'], ['ALL BALLS GROUP','https://www.allballsracinggroup.com/']
  ];
  function website(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw Error('Informe um link de site válido, começando com https:// ou http://.');
    let url; try { url = new URL(value.trim()); } catch { throw Error('Informe um link de site válido, começando com https:// ou http://.'); }
    if (!['https:','http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw Error('Use um link http:// ou https:// sem usuário ou senha.');
    return url.href;
  }
  function validate(value) {
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.items) || value.items.length > 200) throw Error('Lista de marcas inválida.');
    const ids = new Set();
    return {schemaVersion:1,items:value.items.map(item => {
      if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100 || typeof item.logo !== 'string') throw Error('Marca inválida.');
      ids.add(item.id);
      return {id:item.id,name:item.name.trim(),url:website(item.url),logo:item.logo.trim() ? website(item.logo) : ''};
    })};
  }
  let data = {schemaVersion:1,items:seeds.map(([name,url],i)=>({id:'brand-'+i,name,url,logo:''}))}, loadError = false;
  try { const saved=MMStorage.getItem(KEY); if(saved!==null)data=validate(JSON.parse(saved)); } catch { loadError=true; }
  $('.nav').insertAdjacentHTML('beforeend','<button class="nav-item" data-view="marcas"><span class="nav-icon">◇</span> Marcas</button>');
  $('.main').insertAdjacentHTML('beforeend', `<section class="content hidden" id="brandsView">
    <div class="hero-row"><div><p class="eyebrow">MASTER MOTOS · REFERÊNCIAS</p><h1>Marcas</h1><p class="lede">Seus catálogos e fornecedores, sempre à mão.</p></div><button type="button" class="primary-btn" id="brandAdd">+ Nova marca</button></div>
    <section class="workspace-card brand-editor hidden" id="brandEditor" aria-labelledby="brandEditorTitle"><h2 id="brandEditorTitle">Nova marca</h2><form id="brandForm"><input type="hidden" id="brandId"><div class="brand-fields"><label>Nome da marca<input id="brandName" maxlength="100" required placeholder="Ex.: PROX"></label><label>Link do site<input id="brandUrl" type="url" maxlength="2048" required placeholder="https://site.com"></label><label>Link do logo <small>opcional</small><input id="brandLogo" type="url" maxlength="2048" placeholder="https://site.com/logo.png"><small>Sem logo, usamos o ícone do site ou as iniciais.</small></label></div><p id="brandFormError" role="alert"></p><div class="brand-form-actions"><button type="button" class="subtle-btn" id="brandCancel">Cancelar</button><button class="primary-btn" type="submit">Salvar marca</button></div></form></section>
    <div class="workspace-card brand-toolbar"><label class="search"><input id="brandSearch" type="search" placeholder="Buscar marca ou site" aria-label="Buscar marcas"></label><span id="brandCount" role="status" aria-live="polite"></span><span class="brand-link-hint">Os sites abrem em uma nova guia ↗</span></div>
    <p id="brandStatus" class="brand-status" role="status" aria-live="polite"></p><div class="brand-grid" id="brandGrid"></div>
  </section>`);
  const el = id => document.getElementById(id);
  function render() {
    const term=el('brandSearch').value.trim().toLocaleLowerCase('pt-BR');
    const items=data.items.filter(item=>(item.name+' '+item.url).toLocaleLowerCase('pt-BR').includes(term)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    el('brandCount').textContent=`${items.length} de ${data.items.length} marcas`;
    el('brandGrid').innerHTML=items.map(item=>{
      const url=new URL(item.url), icon=item.logo || new URL('/favicon.ico',url).href;
      const initials=item.name.split(/[\s-]+/).map(word=>word[0]).join('').slice(0,3);
      return `<article class="workspace-card brand-card" data-brand-id="${esc(item.id)}"><a class="brand-destination" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${esc(item.name)} em uma nova guia"><span class="brand-icon"><span aria-hidden="true">${esc(initials)}</span><img src="${esc(icon)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span><span class="brand-info"><h2>${esc(item.name)}</h2><span>${esc(url.hostname)}</span></span><span class="brand-arrow" aria-hidden="true">↗</span></a><div class="brand-card-foot"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir site de ${esc(item.name)}">Abrir site ↗</a><div><button type="button" class="subtle-btn" data-brand-action="edit" aria-label="Editar ${esc(item.name)}">Editar</button><button type="button" class="subtle-btn" data-brand-action="remove" aria-label="Remover ${esc(item.name)}">Remover</button></div></div></article>`;
    }).join('') || '<div class="workspace-card brand-empty"><h2>Nenhuma marca encontrada</h2><p>Altere sua busca ou cadastre uma nova marca.</p></div>';
    el('brandGrid').querySelectorAll('img').forEach(img=>{
      img.addEventListener('load',()=>img.parentElement.classList.add('has-logo'));
      img.addEventListener('error',()=>{img.parentElement.classList.remove('has-logo');img.hidden=true;});
      if(img.complete&&img.naturalWidth)img.parentElement.classList.add('has-logo');
    });
  }
  function commit(next) {
    try { const clean=validate(next); MMStorage.setItem(KEY,JSON.stringify(clean));data=clean;render();el('brandStatus').textContent='Marcas salvas. Acompanhe a sincronização no indicador da conta.';return true; }
    catch(error) {el('brandFormError').textContent=error.message;el('brandStatus').textContent='Não foi possível salvar. Seus dados anteriores foram preservados.';return false;}
  }
  let trigger=null;
  function edit(item=null, button=el('brandAdd')) {
    trigger=button;el('brandForm').reset();el('brandFormError').textContent='';el('brandId').value=item?.id || '';
    el('brandEditorTitle').textContent=item?'Editar marca':'Nova marca';el('brandName').value=item?.name || '';el('brandUrl').value=item?.url || '';el('brandLogo').value=item?.logo || '';
    el('brandEditor').classList.remove('hidden');el('brandName').focus();
  }
  function close() {el('brandEditor').classList.add('hidden');(trigger?.isConnected?trigger:el('brandAdd')).focus();}
  el('brandAdd').addEventListener('click',()=>edit());el('brandCancel').addEventListener('click',close);
  el('brandEditor').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
  el('brandSearch').addEventListener('input',render);
  el('brandForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(loadError&&!confirm('A lista salva não pôde ser lida. Salvar agora substituirá essa lista pelos dados exibidos. Continuar?'))return;
    const id=el('brandId').value || 'brand-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    const item={id,name:el('brandName').value,url:el('brandUrl').value,logo:el('brandLogo').value};
    const items=el('brandId').value?data.items.map(old=>old.id===id?item:old):[...data.items,item];
    if(commit({schemaVersion:1,items})){loadError=false;close();toast('Marca salva.');}
  });
  el('brandGrid').addEventListener('click',event=>{
    const button=event.target.closest('[data-brand-action]');if(!button)return;
    const item=data.items.find(item=>item.id===button.closest('[data-brand-id]').dataset.brandId);
    if(button.dataset.brandAction==='edit')edit(item,button);
    else if(confirm(`Remover a marca “${item.name}”?`)&&(!loadError||confirm('A lista salva não pôde ser lida. Substituir pelos dados exibidos?'))&&commit({schemaVersion:1,items:data.items.filter(old=>old.id!==item.id)})){loadError=false;el('brandAdd').focus();toast('Marca removida.');}
  });
  window.MMBrands={storageKey:KEY,validateData:validate,exportData:()=>validate(data),replaceData(value){data=validate(value);loadError=false;close();render();}};
  render();if(loadError)el('brandStatus').textContent='Não foi possível ler suas marcas salvas. A lista inicial está sendo exibida; seus dados não foram substituídos.';
})();
