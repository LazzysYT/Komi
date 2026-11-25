/* Configure one real Komi promotion; no catalogue or account data is needed. */
(function () {
  'use strict';
  const slide = document.querySelector('.hero-slide[data-komi-promo="brand-loop"]');
  if (slide) slide.dataset.komiHeroVideo = new URL('./assets/hero/komi-promo-loop.mp4', location.href).href;
})();
