/* Keep the crawlable SEO fallback in the document, but never flash it to JS visitors.
   CSP-safe external script in <head>; hydrated markup is switched on before paint. */
(() => {
  'use strict';
  const sectionRoute = /^\/(catalog|shop|partners|profile)$/.test(location.pathname) || /^#(catalog|shop|partners|profile)$/.test(location.hash.toLowerCase());
  if (!sectionRoute && (!/^\/(?:index\.html)?$/.test(location.pathname) ||
      (location.hash && location.hash !== '#home') ||
      new URLSearchParams(location.search).has('anime'))) return;

  const html = document.documentElement;
  html.classList.add('komi-home-booting');
  let observer = null;
  let timer = null;
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    html.classList.remove('komi-home-booting');
    if (observer) observer.disconnect();
    if (timer !== null) clearTimeout(timer);
  }

  function checkReady() {
    const main = document.getElementById('mainContainer');
    if (!main) return false;
    if (main.querySelector('.komi-home-discovery') ||
        (main.children.length > 0 &&
         !main.querySelector('.komi-seo-fallback') &&
         !main.querySelector('.komi-seo-card'))) {
      finish();
      return true;
    }
    return false;
  }

  function observe() {
    if (checkReady()) return;
    const main = document.getElementById('mainContainer');
    if (!main) { finish(); return; }
    observer = new MutationObserver(checkReady);
    observer.observe(main, {childList: true});
    checkReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe, {once:true});
  } else {
    observe();
  }
  // If a script or network request fails, restore the navigable SEO fallback.
  timer = setTimeout(finish, 20000);
  window.addEventListener('hashchange', () => {
    if (location.hash && location.hash !== '#home') finish();
  });
})();