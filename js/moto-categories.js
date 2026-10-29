/* Taxonomia de categorias: fonte oficial em Data/categorias_motos_otimizadas_ia.xlsx.
   Somente leitura. Não modifica catálogo, pedidos ou importações do Bling. */
(()=>{
'use strict';
const FILE='Data/categorias_motos_otimizadas_ia.xlsx';
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clean=x=>String(x??'').trim().replace(/\s+/g,' ').slice(0,160);
const state={status:'loading',categories:[],rows:0,sheets:[],source:FILE,error:null};
window.MMMotoCategories={
  get status(){return state.status;},
  get categories(){return state.categories.slice();},
  get rows(){return state.rows;},
  get source(){return FILE;},
  get error(){return state.error;},
  ready:null
};
const unique=values=>[...new Map(values.filter(Boolean).map(x=>[norm(x),x])).values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
function parse(book){
 const cats=[],sheetInfo=[];let count=0;
 for(const sheetName of book.SheetNames){
  const rows=XLSX.utils.sheet_to_json(book.Sheets[sheetName],{header:1,defval:'',raw:false});
  if(!rows.length)continue;
  const first=rows.findIndex(r=>r.some(v=>clean(v)));
  if(first<0)continue;
  const headers=rows[first].map(norm);
  const cols=headers.map((h,i)=>/^(categoria|categorias|categoriaprincipal|subcategoria|subcategorias|segmento|tipodemoto|classificacao|grupo|familia)$/.test(h)?i:-1).filter(i=>i>=0);
  const selected=cols.length?cols:(headers.length===1?[0]:[]);
  if(!selected.length){sheetInfo.push({name:sheetName,rows:rows.length,recognized:false});continue;}
  for(const row of rows.slice(first+1)){
   for(const index of selected){
    const value=clean(row[index]);
    if(value&&!/^\d+$/.test(value))cats.push(value);
   }
   count++;
  }
  sheetInfo.push({name:sheetName,rows:rows.length,recognized:true});
 }
 return {categories:unique(cats),rows:count,sheets:sheetInfo};
}
function updateCatalog(){
 const select=document.getElementById('categoryFilter');
 if(!select||!state.categories.length)return;
 const previous=select.value;
 const existing=new Set([...select.options].map(o=>norm(o.value)));
 for(const category of state.categories){
  if(existing.has(norm(category)))continue;
  const option=document.createElement('option');option.value=category;option.textContent=category;select.append(option);
 }
 select.value=previous;
}
async function load(){
 try{
  if(!window.XLSX)throw Error('Leitor Excel não carregado');
  const response=await fetch(FILE+'?v=taxonomia-20261029',{cache:'no-cache'});
  if(!response.ok)throw Error('Planilha não disponível (HTTP '+response.status+')');
  const buffer=await response.arrayBuffer();
  const parsed=parse(XLSX.read(buffer,{type:'array'}));
  if(!parsed.categories.length)throw Error('Nenhuma coluna de categoria reconhecida na planilha');
  Object.assign(state,parsed,{status:'ready'});
  updateCatalog();
  window.dispatchEvent(new CustomEvent('mm:categories-updated',{detail:{categories:state.categories.slice(),rows:state.rows}}));
 }catch(error){state.status='error';state.error=error.message;console.warn('Categorias:',error);}
 return state;
}
window.MMMotoCategories.ready=load();
})();