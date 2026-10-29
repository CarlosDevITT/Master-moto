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
  const rows=XLSX.utils.sheet_to_json(book.Sheets[sheetName],{header:1,defval:'',raw:false,blankrows:false});
  if(!rows.length)continue;
  let header=-1,cols=[];
  // Cabeçalhos podem começar depois de linhas de título e instruções.
  for(let i=0;i<Math.min(rows.length,25);i++){
   const values=rows[i].map(norm);
   const hits=values.map((h,j)=>/categoria|subcategoria|segmento|grupo|familia|classificacao|tipodemoto|tipopeca|sistema|departamento|secao/.test(h)?j:-1).filter(j=>j>=0);
   if(hits.length){header=i;cols=hits;break;}
  }
  if(header<0){
   // Planilhas de uma coluna com categorias sem cabeçalho.
   const populated=rows.slice(0,15).filter(row=>row.some(v=>clean(v)));
   const single=populated.length>0&&populated.every(row=>row.filter(v=>clean(v)).length===1);
   if(single){header=-1;cols=[rows[0].findIndex(v=>clean(v))];}
  }
  if(!cols.length||cols[0]<0){sheetInfo.push({name:sheetName,rows:rows.length,recognized:false,headers:rows.slice(0,3).map(r=>r.map(clean))});continue;}
  for(const row of rows.slice(header+1)){
   for(const index of cols){
    const value=clean(row[index]);
    if(value&&!/^\\d+$/.test(value)&&!/^categoria(s)?$/i.test(value))cats.push(value);
   }
   count++;
  }
  sheetInfo.push({name:sheetName,rows:rows.length,recognized:true,columns:cols});
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
  if(!window.XLSX){await new Promise((resolve,reject)=>{const t=setInterval(()=>{if(window.XLSX){clearInterval(t);clearTimeout(deadline);resolve();}},100);const deadline=setTimeout(()=>{clearInterval(t);reject(Error('Biblioteca Excel indisponível'));},8000);});}
  const response=await fetch(FILE+'?v=taxonomia-20261029',{cache:'no-cache'});
  if(!response.ok)throw Error('Planilha não disponível (HTTP '+response.status+')');
  const buffer=await response.arrayBuffer();
  const parsed=parse(XLSX.read(buffer,{type:'array'}));
  if(!parsed.categories.length)throw Error('Não foi possível identificar categorias. Abas: '+parsed.sheets.map(x=>x.name+(x.recognized?' (sem valores)':' (colunas não reconhecidas)')).join(', '));
  Object.assign(state,parsed,{status:'ready'});
  updateCatalog();
  window.dispatchEvent(new CustomEvent('mm:categories-updated',{detail:{categories:state.categories.slice(),rows:state.rows}}));
 }catch(error){state.status='error';state.error=error.message;console.warn('Categorias:',error);}
 return state;
}
window.MMMotoCategories.ready=load();
})();