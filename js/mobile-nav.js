/* Mobile navigation: dock + accessible bottom sheet; existing module handlers remain the source of truth. */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const dock=$('.mm-mobile-dock'),sheet=$('#mmMobileSheet'),backdrop=$('#mmMobileBackdrop'),links=$('#mmMobileLinks');
if(!dock||!sheet||!backdrop||!links)return;
const home=$('#mmMobileHome'),modules=$('#mmMobileModules'),settings=$('#mmMobileSettings'),close=$('#mmMobileClose');
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let open=false,lastFocus=null;
const special=new Set(['bling','account','settings','system']);
const retired=new Set(['guia','mercado']);
const labelOf=b=>b.textContent.replace(/\s+/g,' ').trim().replace(/\d+$/,'').trim();
function menuItems(kind){
const nav=[...document.querySelectorAll('#sidebarNav [data-view]')].filter(b=>!retired.has(b.dataset.view));
const items=nav.filter(b=>kind==='settings'?special.has(b.dataset.view):!special.has(b.dataset.view));
if(kind==='settings'){
  const bling=nav.find(b=>b.dataset.view==='bling');
  if(bling&&!items.includes(bling))items.unshift(bling);
}
return items;
}
function render(kind){
const items=menuItems(kind);
$('#mmMobileSheetTitle').textContent=kind==='settings'?'Configurações':'Todos os módulos';
links.innerHTML=items.map(b=>'<button type="button" class="mm-mobile-link" data-target="'+esc(b.dataset.view)+'"><span class="mm-mobile-link-icon">'+(b.querySelector('.nav-icon')?.textContent||'◈')+'</span><span>'+esc(labelOf(b))+'</span><span class="mm-mobile-arrow">›</span></button>').join('');
if(kind==='settings'){
 links.insertAdjacentHTML('beforeend','<button type="button" class="mm-mobile-link" data-action="theme"><span class="mm-mobile-link-icon">◐</span><span>Alternar tema</span><span class="mm-mobile-arrow">›</span></button>');
 const account=document.querySelector('#accountView, [data-view="account"], #accountBtn, #accountMenu');
 if(account)links.insertAdjacentHTML('beforeend','<button type="button" class="mm-mobile-link" data-action="account"><span class="mm-mobile-link-icon">♙</span><span>Conta</span><span class="mm-mobile-arrow">›</span></button>');
 links.insertAdjacentHTML('beforeend','<div class="mm-mobile-info">Sistema: Master Motos · Armazenamento local · Integrações em modo manual</div>');
}
if(!items.length&&kind==='modules')links.innerHTML='<p class="mm-mobile-info">Os módulos aparecerão após o carregamento.</p>';
}
function toggle(kind){
if(open&&sheet.dataset.kind===kind){hide();return;}
lastFocus=document.activeElement;render(kind);sheet.dataset.kind=kind;open=true;
sheet.inert=false;sheet.setAttribute('aria-hidden','false');backdrop.hidden=false;
requestAnimationFrame(()=>{sheet.classList.add('is-open');backdrop.classList.add('is-open');});
modules.setAttribute('aria-expanded',String(kind==='modules'));settings.setAttribute('aria-expanded',String(kind==='settings'));
document.body.classList.add('mm-sheet-open');close.focus({preventScroll:true});
}
function hide(){
if(!open)return;open=false;sheet.classList.remove('is-open');backdrop.classList.remove('is-open');sheet.setAttribute('aria-hidden','true');sheet.inert=true;modules.setAttribute('aria-expanded','false');settings.setAttribute('aria-expanded','false');document.body.classList.remove('mm-sheet-open');
setTimeout(()=>{if(!open)backdrop.hidden=true;},260);
lastFocus?.focus?.({preventScroll:true});
}
function navigate(view){
const original=[...document.querySelectorAll('#sidebarNav [data-view]')].find(b=>b.dataset.view===view);
if(!original)return;
hide();original.click();activate(view);window.scrollTo({top:0,behavior:'smooth'});
}
// Navegação centralizada e resiliente mesmo com scripts antigos em cache.
const viewIds={catalogo:'catalogView',dashboard:'dashboardView',notas:'notesView',guia:'guideView',mercado:'marketView',precificacao:'pricingView',marcas:'brandsView',orders:'ordersView',pedidos:'ordersView',bling:'blingView',compat:'compatView'};
function activate(view){
  const id=viewIds[view]||view+'View',target=document.getElementById(id);
  if(!target||retired.has(view))return;
  document.querySelectorAll('#mainContent > .content').forEach(el=>el.classList.toggle('hidden',el!==target));
  target.classList.remove('hidden');
  document.querySelectorAll('#sidebarNav [data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
  const label=document.querySelector('#sidebarNav [data-view="'+view+'"]')?.textContent?.replace(/\\s+/g,' ').trim();
  const title=document.getElementById('pageTitle');if(title&&label)title.textContent=label;
  home.classList.toggle('is-active',view==='dashboard');
}
document.getElementById('sidebarNav')?.addEventListener('click',e=>{
  const btn=e.target.closest('[data-view]');
  if(!btn)return;
  if(retired.has(btn.dataset.view)){e.preventDefault();e.stopImmediatePropagation();return;}
  // Capture runs before older app.js handlers, and repairs view after their dispatch.
  const view=btn.dataset.view;
  queueMicrotask(()=>activate(view));
},true);
function ensureVisible(){
  const visible=[...document.querySelectorAll('#mainContent > .content')].some(el=>!el.classList.contains('hidden'));
  if(!visible)activate('catalogo');
}
document.addEventListener('DOMContentLoaded',()=>{ensureVisible();});
window.addEventListener('load',()=>{ensureVisible();});
home.onclick=()=>navigate('dashboard');
modules.onclick=()=>toggle('modules');
settings.onclick=()=>toggle('settings');
close.onclick=hide;backdrop.onclick=hide;
links.onclick=e=>{
const b=e.target.closest('button');if(!b)return;
if(b.dataset.target)return navigate(b.dataset.target);
if(b.dataset.action==='theme'){hide();$('#themeBtn')?.click();}
if(b.dataset.action==='account'){hide();const account=$('[data-view="account"]');if(account)account.click();else $('#accountBtn, #accountMenu')?.click();}
};
document.addEventListener('keydown',e=>{if(!open)return;if(e.key==='Escape'){e.preventDefault();hide();}if(e.key==='Tab'){const focusable=[...sheet.querySelectorAll('button:not([disabled])')];const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
document.addEventListener('click',e=>{if(e.target.closest('#sidebarNav [data-view]')){const active=$('#sidebarNav [data-view].active');home.classList.toggle('is-active',active?.dataset.view==='dashboard');}});
home.classList.add('is-active');
})();