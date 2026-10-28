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
const matchedMoto=link=>catalogSnapshot().filter(m=>norm(m.brand)===norm(link.brand)&&norm(m.model)===norm(link.model)&&m.start<=link.end&&m.end>=link.start);
const joined=()=>saved.links.map(link=>({...link,product:window.MMBlingCatalog?.findSku(link.sku)||null,motos:matchedMoto(link)}));
window.MMCompatibility={
  getLinks:()=>saved.links.slice(),
  findBySku:sku=>saved.links.filter(x=>norm(x.sku)===norm(sku)),
  findByMoto:moto=>saved.links.filter(x=>norm(x.brand)===norm(moto?.marca||moto?.brand)&&norm(x.model)===norm(moto?.modelo||moto?.model)&&Number(moto?.anoInicial||moto?.start)<=x.end&&Number(moto?.anoFinal||moto?.end)>=x.start),
  joined,
  catalogModels:catalogSnapshot
};
const view=document.createElement('section');view.id='compatView';view.className='content hidden mm-compat';
view.innerHTML='<div class="compat-hero"><p class="eyebrow">MASTER MOTOS · PEÇAS</p><h1>Compatibilidade de peças</h1><p>Encontre peças por moto e ano, ou confira onde um SKU é compatível.</p></div><div class="compat-panel"><h2>Buscar compatibilidade</h2><div class="compat-filters"><label>Marca<select id="compatBrand"><option value="">Todas as marcas</option></select></label><label>Modelo<select id="compatModel"><option value="">Todos os modelos</option></select></label><label>Ano<select id="compatYear"><option value="">Todos os anos</option></select></label><label>Categoria<select id="compatCategory"><option value="">Todas as categorias</option></select></label><label>SKU ou nome<input id="compatSku" type="search" placeholder="Código ou nome da peça"></label></div><div class="compat-summary" id="compatSummary"></div><div class="compat-summary" id="compatCoverage"></div><div id="compatResults"></div></div><div class="compat-panel"><h2>Importar relações de compatibilidade</h2><p>Importe uma planilha com colunas <b>SKU, Marca, Modelo, Ano Inicial, Ano Final</b>. Também aceita uma coluna <b>Ano</b> para aplicações de um único ano. Uma linha corresponde a uma aplicação; o mesmo SKU pode ter várias linhas.</p><p>O catálogo de produtos importado do Bling fornece os nomes das peças. <b>A planilha de produtos sozinha não comprova compatibilidade.</b></p><input type="file" id="compatFile" accept=".csv,.xlsx,.xls"><div id="compatPreview" aria-live="polite"></div><div class="compat-actions"><button type="button" class="subtle-btn" id="compatBackup">Exportar backup</button><button type="button" class="subtle-btn" id="compatTemplate">Baixar modelo CSV</button></div><small>Sem Supabase · sem conexão com a API · limite de 30 MB por arquivo · máximo de 100 mil aplicações.</small></div>';
$('#mainContent').append(view);
const nav=document.createElement('button');nav.className='nav-item';nav.dataset.view='compat';nav.innerHTML='<span class="nav-icon">◈</span> Compatibilidade';$('#sidebarNav').append(nav);
nav.onclick=()=>{document.querySelectorAll('.main > .content').forEach(x=>x.classList.toggle('hidden',x!==view));document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===nav));view.classList.remove('hidden');$('#pageTitle').textContent='Compatibilidade';refresh();};
document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/compat.css">');
const product=sku=>window.MMBlingCatalog?.findSku(sku);
const category=x=>String(product(x.sku)?.category||x.category||'Sem categoria').trim();
function catalogModels(){return catalogSnapshot();}
const unique=arr=>[...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true}));
function refresh(){
const b=$('#compatBrand').value,m=$('#compatModel').value,y=$('#compatYear').value,c=$('#compatCategory').value;
const models=[...catalogModels(),...saved.links.map(x=>({brand:x.brand,model:x.model,start:x.start,end:x.end}))];
const brands=unique(models.map(x=>x.brand));$('#compatBrand').innerHTML='<option value="">Todas as marcas</option>'+brands.map(x=>'<option>'+esc(x)+'</option>').join('');$('#compatBrand').value=brands.includes(b)?b:'';
const filtered=models.filter(x=>!$('#compatBrand').value||norm(x.brand)===norm($('#compatBrand').value));
const names=unique(filtered.map(x=>x.model));$('#compatModel').innerHTML='<option value="">Todos os modelos</option>'+names.map(x=>'<option>'+esc(x)+'</option>').join('');$('#compatModel').value=names.includes(m)?m:'';
const years=new Set();filtered.filter(x=>!$('#compatModel').value||norm(x.model)===norm($('#compatModel').value)).forEach(x=>{if(x.start>=1950&&x.end<=2100&&x.end>=x.start)for(let n=x.start;n<=x.end;n++)years.add(n);});
const ys=[...years].sort((a,b)=>b-a);$('#compatYear').innerHTML='<option value="">Todos os anos</option>'+ys.map(x=>'<option>'+x+'</option>').join('');$('#compatYear').value=ys.includes(Number(y))?y:'';
const categories=unique(saved.links.map(category));$('#compatCategory').innerHTML='<option value="">Todas as categorias</option>'+categories.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');$('#compatCategory').value=categories.includes(c)?c:'';
renderResults();
}
function renderResults(){
const brand=$('#compatBrand').value,model=$('#compatModel').value,year=Number($('#compatYear').value),sku=norm($('#compatSku').value),cat=$('#compatCategory').value;
const found=joined().filter(x=>(!brand||norm(x.brand)===norm(brand))&&(!model||norm(x.model)===norm(model))&&(!year||(year>=x.start&&year<=x.end))&&(!cat||category(x)===cat)&&(!sku||norm(x.sku).includes(sku)||norm(product(x.sku)?.name).includes(sku)));
$('#compatSummary').textContent=found.length+' aplicações encontradas · '+saved.links.length+' relações importadas';
const matched=found.filter(x=>x.motos.length),withProduct=found.filter(x=>x.product);
$('#compatCoverage').textContent=withProduct.length+' produtos encontrados no Bling · '+matched.length+' aplicações vinculadas a motos do catálogo';
$('#compatResults').innerHTML=found.length?found.slice(0,200).map(x=>'<article class="compat-result"><div><b>'+esc(x.sku)+'</b><p>'+esc(x.product?.name||'Produto não encontrado no catálogo Bling')+'</p></div><div><strong>'+esc(x.brand)+' · '+esc(x.model)+'</strong><small>'+x.start+(x.end!==x.start?'–'+x.end:'')+'</small><small>'+esc(x.motos.length?x.motos.length+' moto(s) no catálogo':'Moto não localizada no catálogo')+'</small></div></article>').join('')+(found.length>200?'<p>Exibindo os primeiros 200 resultados. Refine os filtros.</p>':''):'<p class="compat-empty">Nenhuma compatibilidade cadastrada para os filtros. Não significa que a peça seja incompatível: pode faltar informação na planilha.</p>';
}
['compatBrand','compatModel'].forEach(id=>$('#'+id).addEventListener('change',refresh));$('#compatYear').onchange=renderResults;$('#compatCategory').onchange=renderResults;$('#compatSku').oninput=renderResults;
const dl=(name,content,type)=>{const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
$('#compatBackup').onclick=()=>dl('master-motos-compatibilidade-backup.json',JSON.stringify(saved,null,2),'application/json');
$('#compatTemplate').onclick=()=>dl('modelo-compatibilidade.csv','SKU;Marca;Modelo;Ano Inicial;Ano Final\nABC123;Honda;CRF 250F;2019;2025\n','text/csv;charset=utf-8');
function csv(text){
const line=(text.replace(/^\uFEFF/,'').split(/\r?\n/)[0]||'');const sep=[';',',','\t'].sort((a,b)=>line.split(b).length-line.split(a).length)[0];
let out=[],row=[],field='',quote=false;
for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quote=false;else field+=c;}else if(c==='"')quote=true;else if(c===sep){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));out.push(row);row=[];field='';}else field+=c;}
if(quote)throw Error('CSV com aspas incompletas');row.push(field.replace(/\r$/,''));if(row.some(Boolean))out.push(row);return out;
}
function parse(rows){
const h=(rows[0]||[]).map(x=>norm(x).replace(/[^a-z0-9]/g,''));const col=(...keys)=>h.findIndex(x=>keys.includes(x));
const indices=[col('sku','codigo','codigoproduto','referencia'),col('marca','fabricante'),col('modelo','modelomoto'),col('anoinicial','de','anode'),col('anofinal','ate','anoate')],single=col('ano'),categoryIndex=col('categoria','categoriaproduto','grupo');
if(indices.slice(0,3).some(x=>x<0)||((indices[3]<0||indices[4]<0)&&single<0))throw Error('Colunas obrigatórias: SKU, Marca, Modelo e Ano (ou Ano Inicial e Ano Final).');
const links=[],seen=new Set();let ignored=0;
for(const r of rows.slice(1)){if(!r.some(Boolean))continue;const sku=String(r[indices[0]]||'').trim().slice(0,120),brand=String(r[indices[1]]||'').trim().slice(0,100),model=String(r[indices[2]]||'').trim().slice(0,120),start=Number(r[indices[3]>=0?indices[3]:single]),end=Number(r[indices[4]>=0?indices[4]:single]);
if(!sku||!brand||!model||!Number.isInteger(start)||!Number.isInteger(end)||start<1950||end>2100||start>end){ignored++;continue;}
const key=[sku,brand,model,start,end].map(norm).join('|');if(seen.has(key)){ignored++;continue;}seen.add(key);links.push({sku,brand,model,start,end,category:categoryIndex>=0?String(r[categoryIndex]||'').trim().slice(0,120):''});if(links.length>100000)throw Error('Máximo de 100 mil relações por importação.');}
return {links,ignored};
}
$('#compatFile').onchange=async e=>{
const f=e.target.files?.[0];if(!f)return;const preview=$('#compatPreview');preview.textContent='Lendo arquivo…';
try{if(f.size>30*1024*1024)throw Error('Arquivo maior que 30 MB.');let rows;
if(/\.csv$/i.test(f.name))rows=csv(await f.text());else if(/\.xlsx?$/i.test(f.name)){if(!window.XLSX)throw Error('Biblioteca XLS indisponível. Use CSV.');const book=XLSX.read(await f.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false});}else throw Error('Use CSV, XLS ou XLSX.');
const {links,ignored}=parse(rows);if(!links.length)throw Error('Nenhuma relação válida encontrada.');
preview.innerHTML='<div class="compat-preview"><b>'+links.length+' relações válidas</b><p>'+ignored+' linhas ignoradas. Amostra:</p>'+links.slice(0,5).map(x=>'<div>'+esc(x.sku)+' · '+esc(x.brand)+' '+esc(x.model)+' · '+x.start+'–'+x.end+'</div>').join('')+'<button class="primary-btn" type="button" id="compatConfirm">Confirmar importação</button></div>';
$('#compatConfirm').onclick=async()=>{const ok=window.Swal?(await Swal.fire({title:'Adicionar relações de compatibilidade?',text:'As relações existentes serão preservadas.',showCancelButton:true,confirmButtonText:'Importar'})).isConfirmed:confirm('Importar relações preservando as existentes?');if(!ok)return;
const map=new Map(saved.links.map(x=>[[x.sku,x.brand,x.model,x.start,x.end].map(norm).join('|'),x]));links.forEach(x=>map.set([x.sku,x.brand,x.model,x.start,x.end].map(norm).join('|'),x));const next={version:1,links:[...map.values()],updatedAt:new Date().toISOString()};
try{localStorage.setItem(KEY,JSON.stringify(next));saved=next;window.dispatchEvent(new CustomEvent('mm:compat-updated',{detail:{links:saved.links.length}}));preview.textContent='Importação concluída. Relações existentes preservadas.';refresh();}catch{alertUser('Armazenamento local insuficiente. Nenhum dado anterior foi substituído.','error');}
};
}catch(err){preview.textContent=err.message;alertUser('Falha ao importar compatibilidade','error');}
};
window.addEventListener('mm:bling-updated',refresh);
window.addEventListener('mm:catalog-updated',refresh);
refresh();
})();