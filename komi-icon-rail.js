/* Visual-only active marker: does not replace static-ui-events.js or navigate(). */
(() => {
  'use strict';
  const rail = document.querySelector('.komi-side-nav.komi-icon-rail');
  if (!rail) return;

  const indicator = rail.querySelector('.komi-rail-indicator');
  const buttons = [...rail.querySelectorAll('.komi-side-button[data-komi-click]')];
  const main = document.getElementById('mainContainer');
  const mobile = window.matchMedia('(max-width: 767px)');
  let frame = 0;

  function getActiveButton() {
    // currentView/profilePageSection belong to the existing KomiAnime SPA.
    if (document.getElementById('notifDropdown')?.classList.contains('active'))
      return rail.querySelector('#notifBellBtn');
    if (document.getElementById('watchPartyModal')?.classList.contains('active'))
      return rail.querySelector('#sidePartyBtn');
    const view = typeof currentView === 'string' ? currentView : '';
    const hash = location.hash;
    const isProfile = view === 'profile' || hash === '#profile';
    const isLists = isProfile &&
      typeof profilePageSection === 'string' && profilePageSection === 'anime';

    if (view === 'premium' || hash === '#premium') return rail.querySelector('#sidePremiumBtn');
    if (view === 'shop' || hash === '#shop') return rail.querySelector('#sideShopBtn');
    if (view === 'catalog' || hash === '#catalog') return rail.querySelector('#sideCatalogBtn');
    if (isLists) return rail.querySelector('#sideListsBtn');
    if (isProfile) return rail.querySelector('.komi-side-account');
    if (view === 'home' || (!view && !hash)) return rail.querySelector('#sideHomeBtn');
    return null; // Other pages/modal states do not invent a selected destination.
  }

  function sync() {
    frame = 0;
    const bell = rail.querySelector('#notifBellBtn');
    bell?.setAttribute('aria-expanded', String(!!document.getElementById('notifDropdown')?.classList.contains('active')));
    const active = getActiveButton();
    for (const button of buttons) {
      const selected = button === active;
      button.classList.toggle('is-active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    if (!indicator || !active || mobile.matches || active.getClientRects().length === 0) {
      indicator?.classList.remove('is-visible');
      return;
    }
    const railTop = rail.getBoundingClientRect().top;
    const rect = active.getBoundingClientRect();
    const offset = rect.top - railTop + (rect.height - 22) / 2;
    indicator.style.transform = `translate3d(0,${Math.round(offset)}px,0)`;
    indicator.classList.add('is-visible');
  }

  function scheduleSync() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  // Event delegation in static-ui-events.js executes on document during bubbling.
  // The next frame sees the real route chosen by that handler.
  document.addEventListener('click', event => {
    if (event.target.closest?.('.komi-icon-rail,[data-komi-mobile-extra]')) scheduleSync();
  });
  window.addEventListener('hashchange', scheduleSync);
  window.addEventListener('popstate', scheduleSync);
  window.addEventListener('resize', scheduleSync, {passive: true});
  mobile.addEventListener?.('change', scheduleSync);

  // The existing SPA replaces #mainContainer on navigation; no polling needed.
  if (main) new MutationObserver(scheduleSync).observe(main, {childList: true});
  for (const id of ['notifDropdown', 'watchPartyModal']) {
    const el = document.getElementById(id);
    if (el) new MutationObserver(scheduleSync).observe(el, {attributes: true, attributeFilter: ['class']});
  }
  if ('ResizeObserver' in window) new ResizeObserver(scheduleSync).observe(rail);
  scheduleSync();
})();