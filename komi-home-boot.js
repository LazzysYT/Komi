/* Keep the crawlable SEO fallback in the document, but never flash it to JS visitors.
   CSP-safe external script in <head>; hydrated markup is switched on before paint. */
(() => {
  'use strict';
  // Start font CSS without making the first screen depend on a remote stylesheet.
  document.addEventListener('load', event => {
    if (event.target?.id === 'komi-font-css' || event.target?.matches?.('link[data-komi-deferred-style]')) event.target.media = 'all';
  }, true);
  // Shop-only rules stay nonblocking on the homepage; retain their original
  // cascade position and activate immediately when entering the shop.
  const ensureShopStyle=()=>{
    if (location.pathname==='/shop'||location.hash.toLowerCase()==='#shop') {
      const link=document.querySelector('link[data-komi-deferred-style="shop"]');
      if (link) link.media='all';
    }
  };
  const styleObserver=new MutationObserver(()=>{ensureShopStyle();if(document.querySelector('link[data-komi-deferred-style="shop"]'))styleObserver.disconnect();});
  styleObserver.observe(document.head,{childList:true});
  window.addEventListener('popstate',ensureShopStyle);
  window.addEventListener('hashchange',ensureShopStyle);
  document.addEventListener('DOMContentLoaded',ensureShopStyle,{once:true});
  const sectionRoute = /^\/(catalog|shop|partners|profile)$/.test(location.pathname) || /^#(catalog|shop|partners|profile)$/.test(location.hash.toLowerCase());
  if (!sectionRoute && (!/^\/(?:index\.html)?$/.test(location.pathname) ||
      (location.hash && location.hash !== '#home') ||
      new URLSearchParams(location.search).has('anime'))) return;

  const html = document.documentElement;
  html.classList.add('komi-home-booting');
  if (!sectionRoute) {
    html.classList.add('komi-home-boot-preview');
    const src = document.querySelector('meta[name="komi-first-hero"]')?.content;
    if (src && src.startsWith('https://wsrv.nl/?url=')) {
      const preload = document.createElement('link');
      preload.rel = 'preload'; preload.as = 'image'; preload.href = src;
      preload.fetchPriority = 'high'; preload.referrerPolicy = 'no-referrer';
      document.head.append(preload);
    }
  }
  let observer = null;
  let timer = null;
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    html.classList.remove('komi-home-booting','komi-home-boot-preview');
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
  // A slow or unavailable JS/CDN must not hide the real, navigable HTML for 20 seconds.
  timer = setTimeout(finish, 5000);
  window.addEventListener('hashchange', () => {
    if (location.hash && location.hash !== '#home') finish();
  });
})();