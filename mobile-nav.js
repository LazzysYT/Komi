/* Komi mobile navigation.
 * Reuse the existing five primary rail actions at small breakpoints.
 * Extra actions remain available in a separate header popup.
 * No permissions or account state are written by this module.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const toggle = document.getElementById('komiMobileMoreToggle');
  const panel = document.getElementById('komiMobileMoreMenu');
  if (!toggle || !panel) return;
  function openMore(open) {
    const enabled = !!open && window.matchMedia('(max-width: 767px)').matches;
    panel.hidden = !enabled;
    toggle.setAttribute('aria-expanded', String(enabled));
  }
  function syncSelectedTabs() {
    const view = typeof currentView === 'string' ? currentView : 'home';
    const entries = [
      [document.getElementById('sideHomeBtn'), view === 'home'],
      [document.getElementById('sideCatalogBtn'), view === 'catalog'],
      [document.querySelector('.komi-side-nav .komi-side-account'), view === 'profile']
    ];
    for (const [button, selected] of entries) {
      if (!button) continue;
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }
  toggle.addEventListener('click', () => openMore(panel.hidden));
  panel.addEventListener('click', event => {
    const button = event.target.closest?.('[data-komi-mobile-extra]');
    if (!button) return;
    const action = button.dataset.komiMobileExtra;
    openMore(false);
    if (action === 'shop' && typeof openAniCoinShop === 'function') openAniCoinShop();
    else if (action === 'party' && typeof openWatchPartyHub === 'function') openWatchPartyHub();
    else if (action === 'partners' && typeof navigate === 'function') navigate('partners');
    else if (action === 'notifications' && typeof toggleNotifications === 'function') toggleNotifications();
    syncSelectedTabs();
  });
  document.addEventListener('click', event => {
    if (panel.hidden || toggle.contains(event.target) || panel.contains(event.target)) return;
    openMore(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    openMore(false);
    toggle.focus();
  });
  const breakpoint = window.matchMedia('(max-width: 767px)');
  breakpoint.addEventListener?.('change', () => openMore(false));
  const main = document.getElementById('mainContainer');
  if (main) new MutationObserver(syncSelectedTabs).observe(main, {childList:true});
  syncSelectedTabs();
})();
