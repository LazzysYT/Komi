/* Graceful logo fallback: preserve a readable title if a catalog logo fails. */
(function () {
  'use strict';
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches('.komi-hub-title-logo')) return;
    const titleWrap = image.closest('.komi-hub-title-wrap');
    if (titleWrap) titleWrap.classList.add('logo-failed');
  }, true);
})();
