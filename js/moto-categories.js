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
  get entries(){return (state.entries||[]).map(x=>({...x,synonyms:x.synonyms.slice()}));},
  subcategories(main){return unique((state.entries||[]).filter(x=>norm(x.main)===norm(main)).map(x=>x.sub));},
  classify(name){const source=' '+norm(name)+' ';let best=null,score=0;for(const e of state.entries||[]){for(const term of [e.identification,...e.synonyms]){const token=norm(term);if(token.length<5)continue;if(source.includes(' '+token+' ')&&token.length>score){best=e;score=token.length;}}}return best?{main:best.main,sub:best.sub,path:best.path}:null;},
  get rows(){return state.rows;},
  get source(){return FILE;},
  get error(){return state.error;},
  ready:null
};
const unique=values=>[...new Map(values.filter(Boolean).map(x=>[norm(x),x])).values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
function parse(book){
 const sheet=book.Sheets['Categorias IA'];
 if(!sheet)throw Error('Aba Categorias IA não encontrada');
 const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
 const entries=rows.map(row=>({
  main:clean(row['Categoria principal']),
  sub:clean(row['Subcategoria padronizada']),
  identification:clean(row['Nome para identificação IA']),
  synonyms:String(row['Palavras-chave / sinônimos']||'').split(';').map(clean).filter(Boolean),
  path:clean(row['Caminho completo'])
 })).filter(x=>x.main&&x.sub);
 if(!entries.length)throw Error('Aba Categorias IA não contém categorias válidas');
 return {categories:unique(entries.map(x=>x.main)),entries,rows:entries.length,sheets:[{name:'Categorias IA',rows:entries.length,recognized:true}]};
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
  const response=await fetch(FILE+'?v=taxonomia-real-20261029',{cache:'no-cache'});
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