/* Master Motos — Bling: importação manual isolada, sem API ou Supabase. */
(()=>{
'use strict';
if(document.getElementById('blingView'))return;
const KEY='mm-bling-import-v1', MAX_FILE_MB=50, $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const normalize=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const notify=(t,icon='success')=>window.Swal?Swal.fire({title:t,icon,timer:2200,showConfirmButton:false}):alert(t);
const confirmAction=async(t)=>window.Swal?(await Swal.fire({title:t,icon:'question',showCancelButton:true,confirmButtonText:'Confirmar',cancelButtonText:'Cancelar'})).isConfirmed:confirm(t);
let db;
try{db=JSON.parse(localStorage.getItem(KEY)||'null')||{version:1,products:[],suppliers:[],updatedAt:null};if(db.version!==1||!Array.isArray(db.products)||!Array.isArray(db.suppliers))throw Error('Formato inválido');}catch{alert('Os dados anteriores do Bling não puderam ser lidos. Nada foi sobrescrito.');return;}
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));window.MMImportedBling=db;window.dispatchEvent(new CustomEvent('mm:bling-updated',{detail:{products:db.products.length,suppliers:db.suppliers.length}}));return true;}catch{notify('Espaço insuficiente para salvar. Dados existentes preservados.','error');return false;}};
window.MMImportedBling=db;
window.MMBlingCatalog={
  findSku(sku){return db.products.find(p=>p.sku.toLocaleUpperCase('pt-BR')===String(sku||'').trim().toLocaleUpperCase('pt-BR'))||null;},
  search(term,limit=12){const q=String(term||'').trim().toLocaleLowerCase('pt-BR');if(!q)return [];return db.products.filter(p=>(p.sku+' '+p.name).toLocaleLowerCase('pt-BR').includes(q)).slice(0,Math.min(limit,30));},
  suppliers(){return db.suppliers.slice();},
  stats(){return {products:db.products.length,suppliers:db.suppliers.length,updatedAt:db.updatedAt};}
};
const view=document.createElement('section');view.id='blingView';view.className='content hidden mm-bling';
view.innerHTML='<div class="bling-hero"><div><p class="eyebrow">MASTER MOTOS · INTEGRAÇÕES</p><h1>Central Bling</h1><p>Importação manual de catálogo e fornecedores. Sem conexão com a API.</p></div><span class="bling-tag">Modo local</span></div><div class="bling-metrics" id="blingMetrics"></div><div class="bling-panel"><h2>Importar planilha</h2><p>Selecione um arquivo exportado do Bling. Confira a prévia antes de confirmar. Nenhum pedido existente será alterado.</p><div class="bling-controls"><label>Tipo de dados<select id="blingType"><option value="products">Produtos</option><option value="suppliers">Fornecedores</option></select></label><label class="bling-file">Escolher arquivo<input type="file" id="blingFile" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label></div><p class="bling-hint">CSV separado por ponto e vírgula ou vírgula, ou Excel XLSX/XLS. Para produtos: Código/SKU e Descrição. Para fornecedores: Nome (e opcionalmente Código, Telefone). Limite de arquivo: 50 MB. Arquivos grandes podem exceder o armazenamento disponível no navegador.</p><div id="blingPreview" aria-live="polite"></div></div><div class="bling-panel"><div class="bling-line"><h2>Catálogo importado</h2><button type="button" class="subtle-btn" id="blingExport">Exportar backup</button></div><input id="blingSearch" type="search" placeholder="Buscar SKU, produto ou fornecedor"><div id="blingList"></div></div>';
$('#mainContent').append(view);
const nav=document.createElement('button');nav.className='nav-item';nav.dataset.view='bling';nav.innerHTML='<span class="nav-icon">⇄</span> Integrações Bling';$('#sidebarNav').append(nav);
nav.onclick=e=>{e.stopPropagation();document.querySelectorAll('.main > .content').forEach(el=>el.classList.toggle('hidden',el!==view));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el===nav));view.classList.remove('hidden');$('#pageTitle').textContent='Integrações Bling';render();};
document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="css/bling.css">');
let staged=null;
function render(){
$('#blingMetrics').innerHTML='<div><strong>'+db.products.length+'</strong><span>Produtos</span></div><div><strong>'+db.suppliers.length+'</strong><span>Fornecedores</span></div><div><strong>'+(db.updatedAt?new Date(db.updatedAt).toLocaleDateString('pt-BR'):'—')+'</strong><span>Última importação</span></div>';
const q=$('#blingSearch').value.toLocaleLowerCase('pt-BR');
const entries=[...db.products.map(p=>({name:p.name,code:p.sku,type:'Produto'})),...db.suppliers.map(p=>({name:p.name,code:p.code,type:'Fornecedor'}))].filter(x=>(x.name+' '+x.code).toLocaleLowerCase('pt-BR').includes(q)).slice(0,100);
$('#blingList').innerHTML=entries.length?entries.map(x=>'<div class="bling-record"><span><b>'+esc(x.name)+'</b><small>'+esc(x.type)+'</small></span><code>'+esc(x.code||'—')+'</code></div>').join(''):'<p class="bling-hint">Nenhum registro para exibir.</p>';
}
function parseCsv(text){
const delimiter=(()=>{const first=text.replace(/^\uFEFF/,'').split(/\r?\n/)[0]||'';return [';',',','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];})();
let rows=[],row=[],cell='',quoted=false;
for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===delimiter){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
if(quoted)throw Error('CSV com aspas incompletas');row.push(cell.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);return rows;
}
function toRecords(rows,type){
const headers=rows[0]?.map(normalize)||[];
const find=(...names)=>headers.findIndex(h=>names.some(n=>h===n||h.startsWith(n)));
const sku=find('codigo','sku','codigoproduto','codigointerno','referencia');
const name=type==='products'?find('descricao','nomeproduto','produto','nome'):find('nome','razaosocial','fornecedor','contato');
const phone=find('telefone','celular','fone');
const id=find('idbling','idproduto','idcontato','id');
if(name<0||(type==='products'&&sku<0))throw Error(type==='products'?'Planilha precisa de colunas Código/SKU e Descrição.':'Planilha precisa da coluna Nome.');
const result=[],seen=new Set();let invalid=0,duplicates=0;
for(const cells of rows.slice(1)){if(!cells.some(x=>String(x||'').trim()))continue;
const title=String(cells[name]||'').trim().slice(0,250),code=String(cells[sku]||'').trim().slice(0,120),externalId=id>=0?String(cells[id]||'').trim().slice(0,100):'';
const key=type==='products'?code.toUpperCase():(externalId?'id:'+externalId:'name:'+normalize(title));
if(!title||(type==='products'&&!code)){invalid++;continue;}if(seen.has(key)){duplicates++;continue;}seen.add(key);
result.push(type==='products'?{sku:code,name:title,blingId:externalId}:{code:externalId,name:title,phone:phone>=0?String(cells[phone]||'').trim().slice(0,40):''});
if(result.length>150000)throw Error('Arquivo muito grande: máximo 150 mil registros.');
}
return {result,invalid,duplicates};
}
$('#blingFile').onchange=async e=>{
staged=null;$('#blingPreview').replaceChildren();const file=e.target.files?.[0];if(!file)return;
if(file.size>MAX_FILE_MB*1024*1024){notify('Arquivo acima de '+MAX_FILE_MB+' MB','warning');return;}
try{
let rows;if(/\.csv$/i.test(file.name))rows=parseCsv(await file.text());
else if(/\.xlsx?$/i.test(file.name)){if(!window.XLSX)throw Error('Biblioteca Excel indisponível. Exporte como CSV.');const book=XLSX.read(await file.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false});}
else throw Error('Use CSV ou Excel XLSX/XLS.');
const type=$('#blingType').value;const data=toRecords(rows,type);if(!data.result.length)throw Error('Nenhum registro válido encontrado.');
const current=new Set(db[type].map(x=>type==='products'?x.sku.toUpperCase():(x.code?'id:'+x.code:'name:'+normalize(x.name))));
const update=data.result.filter(x=>current.has(type==='products'?x.sku.toUpperCase():(x.code?'id:'+x.code:'name:'+normalize(x.name)))).length;
staged={type,records:data.result};
$('#blingPreview').innerHTML='<div class="bling-preview"><h3>Prévia da importação</h3><p><b>'+data.result.length+'</b> válidos · <b>'+update+'</b> correspondentes a registros existentes · <b>'+data.invalid+'</b> incompletos ignorados · <b>'+data.duplicates+'</b> duplicados no arquivo ignorados</p><div class="bling-preview-rows">'+data.result.slice(0,8).map(x=>'<div><b>'+esc(x.sku||x.code||'—')+'</b> '+esc(x.name)+'</div>').join('')+'</div><button class="primary-btn" id="blingConfirm" type="button">Confirmar importação</button><button class="subtle-btn" id="blingCancel" type="button">Cancelar</button></div>';
$('#blingCancel').onclick=()=>{staged=null;$('#blingPreview').replaceChildren();$('#blingFile').value='';};
$('#blingConfirm').onclick=async()=>{
if(!staged||!await confirmAction('Importar '+staged.records.length+' registros? Pedidos existentes não serão alterados.'))return;
const old=db;const key=x=>staged.type==='products'?x.sku.toUpperCase():(x.code?'id:'+x.code:'name:'+normalize(x.name));
const merged=new Map(db[staged.type].map(x=>[key(x),x]));staged.records.forEach(x=>merged.set(key(x),{...merged.get(key(x)),...x}));
db={...db,[staged.type]:[...merged.values()],updatedAt:new Date().toISOString()};if(!persist()){db=old;window.MMImportedBling=db;return;}
staged=null;$('#blingPreview').replaceChildren();$('#blingFile').value='';render();notify('Importação concluída');
};
}catch(err){console.error('Erro na importação Bling',err);$('#blingPreview').textContent=err.message;notify('Não foi possível ler a planilha','error');}
};
$('#blingType').onchange=()=>{staged=null;$('#blingPreview').replaceChildren();$('#blingFile').value='';};
$('#blingSearch').oninput=render;
$('#blingExport').onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='master-motos-bling-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
render();
})();