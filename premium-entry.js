/* Komi Premium has one canonical destination: the existing Studio page. */
(function () {
  'use strict';
  const STUDIO = '/premium.html';
  function redirectLegacy() {
    if (window.location.pathname === '/' && window.location.hash.toLowerCase() === '#premium') {
      // Keep referral or tracking query parameters when following an old link.
      window.location.replace(STUDIO + window.location.search);
      return true;
    }
    return false;
  }
  // Run synchronously in the <head> so #premium doesn't flash the old SPA page.
  if (redirectLegacy()) return;
  window.addEventListener('hashchange', redirectLegacy);
  document.addEventListener('click', function (event) {
    const trigger = event.target?.closest?.('[data-komi-click="premium"]');
    if (!trigger || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(STUDIO);
  }, true);
})();
