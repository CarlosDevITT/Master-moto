// Keep dialog focus within the active modal and return it to its trigger.
(() => {
  let previousFocus = null;
  let activeDialog = null;
  let lastExternalFocus = document.activeElement;
  document.addEventListener('focusin', event => {
    if (!event.target.closest('.modal-backdrop')) lastExternalFocus = event.target;
  });
  const sync = () => {
    const next = [...document.querySelectorAll('.modal-backdrop')].find(element => !element.classList.contains('hidden'));
    document.body.classList.toggle('modal-open', Boolean(next));
    document.querySelector('.app-shell').inert = Boolean(next);
    if (next && !activeDialog) previousFocus = lastExternalFocus;
    if (!next && activeDialog && previousFocus?.isConnected) previousFocus.focus();
    activeDialog = next;
  };
  document.querySelectorAll('.modal-backdrop').forEach(element => new MutationObserver(sync).observe(element, { attributes: true, attributeFilter: ['class'] }));
  document.addEventListener('keydown', event => {
    if (!activeDialog) return;
    if (event.key === 'Escape') {
      activeDialog.querySelector('.close-btn')?.click();
      return;
    }
    if (event.key !== 'Tab') return;
    const fields = [...activeDialog.querySelectorAll('button, input, select, textarea, a[href]')].filter(element => !element.disabled && element.type !== 'hidden' && element.getClientRects().length);
    if (!fields.length) return;
    const first = fields[0], last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.querySelectorAll('[data-sort]').forEach(header => {
    header.tabIndex = 0;
    header.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); header.click(); }
    });
  });
  // One icon family and explicit current-page state across wide and compact menus.
  const icons = {
    catalogo:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    dashboard:'<path d="M4 20V10m8 10V4m8 16v-7"/><path d="M2 21h20"/>',
    notas:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    guia:'<path d="M12 5v16M3 4h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',
    precificacao:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1m6 0h1M8 15h1m6 0h1M8 19h1m6 0h1"/>',
    mercado:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>'
  };
  document.querySelectorAll('.nav-item').forEach(button => {
    button.title=button.textContent.trim();
    button.setAttribute('aria-label',button.textContent.replace(/[▦◒▤◴★]/g,'').trim());
    const icon=button.querySelector('.nav-icon');
    if(icon&&icons[button.dataset.view])icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[button.dataset.view]}</svg>`;
  });
  const updateCurrent=()=>document.querySelectorAll('.nav-item').forEach(button=>{
    if(button.classList.contains('active'))button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
  updateCurrent();
  document.querySelector('.nav').addEventListener('click',updateCurrent);
  document.getElementById('themeBtn').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.5 13.2A8.6 8.6 0 0 1 10.8 3.5 8.6 8.6 0 1 0 20.5 13.2Z" stroke-linejoin="round"/></svg>';
})();
