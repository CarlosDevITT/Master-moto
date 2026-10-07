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
  document.querySelectorAll('.nav-item').forEach(button => button.title = button.textContent.trim());
})();
