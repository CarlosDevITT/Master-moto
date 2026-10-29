/* Compatibilidade: vínculos explícitos SKU x marca/modelo/ano, importação local; adaptador de API futuro. */
(()=>{
'use strict';
if(document.getElementById('compatView'))return;
const KEY='mm-compat-v1', $=s=>document.querySelector(s);
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const alertUser=(s,icon='info')=>window.Swal?Swal.fire({title:s,icon}):alert(s);
let saved;try{saved=JSON.parse(localStorage.getItem(KEY)||'null')||{version:1,links:[],updatedAt:null};if(saved.version!==1||!Array.isArray(saved.links))throw Error('Dados inválidos');}catch{alertUser('Base de compatibilidade anterior não pôde ser lida; nenhuma alteração foi feita.','error');return;}
// Fonte única de motos: catálogo local existente. Os vínculos são sempre explícitos.
const CATALOG_KEY='master-motos-records-v1';
const catalogSnapshot=()=>{
  try{
    const raw=window.MMStorage?.getItem(CATALOG_KEY)??localStorage.getItem(CATALOG_KEY);
    const items=raw?JSON.parse(raw):(Array.isArray(window.initialData)?window.initialData:[]);
    return Array.isArray(items)?items.filter(x=>x&&x.marca&&x.modelo).map(x=>({
      id:x.id,brand:String(x.marca).trim(),model:String(x.modelo).trim(),
      start:Number(x.anoInicial),end:Number(x.anoFinal),category:String(x.categoria||'')
    })): [];
  }catch{return [];}
};
// A fonte é o XLS/CSV importado no Bling. Só vinculamos marca/modelo quando
// explicitamente mencionados na aplicação do produto; ano também precisa constar.
const allProducts=()=>window.MMBlingCatalog?.allProducts?.()||[];
const uniqueMotos=()=>{const m=new Map();catalogSnapshot().forEach(x=>{const k=norm(x.brand)+'|'+norm(x.model);const old=m.get(k);if(!old)m.set(k,{...x});else{old.start=Math.min(old.start,x.start);old.end=Math.max(old.end,x.end);}});return [...m.values()];};
const boundary=(text,term)=>{const escaped=norm(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(?:^|[^a-z0-9])'+escaped+'(?:$|[^a-z0-9])','i').test(norm(text));};
const explicitYears=text=>{
  const out=[];const source=String(text||'');
  for(const m of source.matchAll(/\b(19\d{2}|20\d{2})\s*(?:-|\/|a|até|ate)\s*(19\d{2}|20\d{2})\b/gi)){const start=+m[1],end=+m[2];if(end>=start&&end-start<=70)out.push([start,end]);}
  for(const m of source.matchAll(/\b(19\d{2}|20\d{2})\b/g)){const y=+m[1];if(!out.some(([a,b])=>y>=a&&y<=b))out.push([y,y]);}
  return out;
};
const autoLinks=()=>{
  const motos=uniqueMotos(),out=[],seen=new Set();
  for(const p of allProducts()){
    const application=String(p.fitment||'').trim();
    if(!application)continue;
    const years=explicitYears(application);
    if(!years.length)continue;
    for(const moto of motos){
      if(!boundary(application,moto.brand)||!boundary(application,moto.model))continue;
      for(const [start,end] of years){
        const from=Math.max(start,moto.start),to=Math.min(end,moto.end);
        if(from>to)continue;
        const key=[norm(p.sku),norm(moto.brand),norm(moto.model),from,to].join('|');
        if(seen.has(key))continue;seen.add(key);
        out.push({sku:p.sku,brand:moto.brand,model:moto.model,start:from,end:to,category:p.category||'',source:'bling'});
      }
    }
  }
  return out;
};
const currentLinks=()=>{const map=new Map();for(const x of [...saved.links,...autoLinks()])map.set([norm(x.sku),norm(x.brand),norm(x.model),x.start,x.end].join('|'),x);return [...map.values()];};
const matchedMoto=link=>catalogSnapshot().filter(m=>norm(m.brand)===norm(link.brand)&&norm(m.model)===norm(link.model)&&m.start<=link.end&&m.end>=link.start);
const joined=()=>currentLinks().map(link=>({...link,product:window.MMBlingCatalog?.findSku(link.sku)||null,motos:matchedMoto(link)}));
window.MMCompatibility={
  getLinks:currentLinks,
  findBySku:sku=>currentLinks().filter(x=>norm(x.sku)===norm(sku)),
  findByMoto:moto=>currentLinks().filter(x=>norm(x.brand)===norm(moto?.marca||moto?.brand)&&norm(x.model)===norm(moto?.modelo||moto?.model)&&Number(moto?.anoInicial||moto?.start)<=x.end&&Number(moto?.anoFinal||moto?.end)>=x.start),
  joined,catalogModels:catalogSnapshot
};
const view=document.createElement('section');view.id='compatView';view.className='content hidden mm-compat';
view.innerHTML='<div class="compat-hero"><p class="eyebrow">MASTER MOTOS · PEÇAS</p><h1>Compatibilidade de peças</h1><p>Encontre peças por moto e ano, ou confira onde um SKU é compatível.</p></div><div class="compat-panel"><h2>Buscar compatibilidade</h2><div class="compat-filters"><label>Marca<select id="compatBrand"><option value="">Todas as marcas</option></select></label><label>Modelo<select id="compatModel"><option value="">Todos os modelos</option></select></label><label>Ano<select id="compatYear"><option value="">Todos os anos</option></select></label><label>Categoria<select id="compatCategory"><option value="">Todas as categorias</option></select></label><label>SKU ou nome<input id="compatSku" type="search" placeholder="Código ou nome da peça"></label></div><div class="compat-summary" id="compatSummary"></div><div class="compat-summary" id="compatCoverage"></div><div class="compat-summary" id="compatTaxonomy"></div><div id="compatResults"></div></div><div class="compat-panel"><h2>Fonte dos dados: Integrações Bling</h2><p>Os produtos e SKUs são lidos automaticamente da planilha importada em Integrações Bling. Para vincular uma peça a uma moto, a exportação precisa informar marca, modelo e ano no campo de aplicação/compatibilidade.</p><p>Não é necessário importar uma segunda planilha aqui. Se a exportação do Bling não tiver aplicações, os produtos ficam disponíveis para busca, mas não recebem compatibilidade presumida.</p><button type="button" class="subtle-btn" id="compatOpenBling">Abrir Integrações Bling</button></div>';
$('#mainContent').append(view);
const nav=document.createElement('button');nav.className='nav-item';nav.dataset.view='compat';nav.innerHTML='<span class="nav-icon">◈</span> Compatibilidade';$('#sidebarNav').append(nav);
nav.onclick=()=>{document.querySelectorAll('.main > .content').forEach(x=>x.classList.toggle('hidden',x!==view));document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===nav));view.classList.remove('hidden');$('#pageTitle').textContent='Compatibilidade';refresh();};
document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/compat.css">');
const product=sku=>window.MMBlingCatalog?.findSku(sku);
const category=x=>{const p=product(x.sku);return String(p?.category||window.MMMotoCategories?.classify(p?.name||'')?.main||x.category||'Sem categoria').trim();};
function catalogModels(){return catalogSnapshot();}
const unique=arr=>[...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true}));
function refresh(){
const b=$('#compatBrand').value,m=$('#compatModel').value,y=$('#compatYear').value,c=$('#compatCategory').value;
const models=[...catalogModels(),...currentLinks().map(x=>({brand:x.brand,model:x.model,start:x.start,end:x.end}))];
const brands=unique(models.map(x=>x.brand));$('#compatBrand').innerHTML='<option value="">Todas as marcas</option>'+brands.map(x=>'<option>'+esc(x)+'</option>').join('');$('#compatBrand').value=brands.includes(b)?b:'';
const filtered=models.filter(x=>!$('#compatBrand').value||norm(x.brand)===norm($('#compatBrand').value));
const names=unique(filtered.map(x=>x.model));$('#compatModel').innerHTML='<option value="">Todos os modelos</option>'+names.map(x=>'<option>'+esc(x)+'</option>').join('');$('#compatModel').value=names.includes(m)?m:'';
const years=new Set();filtered.filter(x=>!$('#compatModel').value||norm(x.model)===norm($('#compatModel').value)).forEach(x=>{if(x.start>=1950&&x.end<=2100&&x.end>=x.start)for(let n=x.start;n<=x.end;n++)years.add(n);});
const ys=[...years].sort((a,b)=>b-a);$('#compatYear').innerHTML='<option value="">Todos os anos</option>'+ys.map(x=>'<option>'+x+'</option>').join('');$('#compatYear').value=ys.includes(Number(y))?y:'';
const categories=unique([...allProducts().map(p=>p.category||window.MMMotoCategories?.classify(p.name)?.main),...currentLinks().map(category),...(window.MMMotoCategories?.categories||[])]);$('#compatCategory').innerHTML='<option value="">Todas as categorias</option>'+categories.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');$('#compatCategory').value=categories.includes(c)?c:'';
renderResults();
}
function renderResults(){
const brand=$('#compatBrand').value,model=$('#compatModel').value,year=Number($('#compatYear').value),sku=norm($('#compatSku').value),cat=$('#compatCategory').value;
const found=joined().filter(x=>(!brand||norm(x.brand)===norm(brand))&&(!model||norm(x.model)===norm(model))&&(!year||(year>=x.start&&year<=x.end))&&(!cat||norm(category(x))===norm(cat)||x.motos.some(m=>norm(m.category)===norm(cat)))&&(!sku||norm(x.sku).includes(sku)||norm(product(x.sku)?.name).includes(sku)));
$('#compatSummary').textContent=found.length+' aplicações encontradas · '+currentLinks().length+' vínculos identificados';
const matched=found.filter(x=>x.motos.length),withProduct=found.filter(x=>x.product);
const taxonomy=window.MMMotoCategories;$('#compatTaxonomy').textContent=taxonomy?.status==='ready'?taxonomy.categories.length+' categorias principais e '+taxonomy.rows+' subcategorias carregadas da planilha Data':taxonomy?.status==='error'?'Categorias: '+taxonomy.error:'Carregando categorias da pasta Data…';
$('#compatCoverage').textContent=withProduct.length+' produtos encontrados no Bling · '+matched.length+' aplicações vinculadas a motos do catálogo';
const unverified=allProducts().filter(p=>(!cat||norm(p.category||window.MMMotoCategories?.classify(p.name)?.main)===norm(cat))&&(!sku||norm(p.sku).includes(sku)||norm(p.name).includes(sku))&&!found.some(x=>norm(x.sku)===norm(p.sku))).slice(0,40);
const unverifiedHtml=unverified.length?'<h3>Produtos do Bling sem aplicação confirmada</h3>'+unverified.map(p=>'<article class="compat-result"><div><b>'+esc(p.sku)+'</b><p>'+esc(p.name)+'</p></div><small>Compatibilidade não informada na planilha</small></article>').join(''):'';
$('#compatResults').innerHTML=found.length?found.slice(0,200).map(x=>'<article class="compat-result"><div><b>'+esc(x.sku)+'</b><p>'+esc(x.product?.name||'Produto não encontrado no catálogo Bling')+'</p></div><div><strong>'+esc(x.brand)+' · '+esc(x.model)+'</strong><small>'+x.start+(x.end!==x.start?'–'+x.end:'')+'</small><small>'+esc(x.motos.length?x.motos.length+' moto(s) no catálogo':'Moto não localizada no catálogo')+'</small></div></article>').join('')+(found.length>200?'<p>Exibindo os primeiros 200 resultados. Refine os filtros.</p>':''):'<p class="compat-empty">Nenhuma aplicação confirmada para os filtros. Isso não significa incompatibilidade.</p>'; 
$('#compatResults').insertAdjacentHTML('beforeend',unverifiedHtml);
}
['compatBrand','compatModel'].forEach(id=>$('#'+id).addEventListener('change',refresh));$('#compatYear').onchange=renderResults;$('#compatCategory').onchange=renderResults;$('#compatSku').oninput=renderResults;
$('#compatOpenBling').onclick=()=>document.querySelector('#sidebarNav [data-view="bling"]')?.click();
window.addEventListener('mm:bling-updated',refresh);
window.addEventListener('mm:catalog-updated',refresh);
window.addEventListener('mm:categories-updated',refresh);
refresh();
})();