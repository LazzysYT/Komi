/* Verified, wide episode stills for the editorial front page. The promo is not a daily lead. */
(function (root) {
  'use strict';
  const stills = Object.freeze({
    61316:'f7StpjhGI5xdIecti2jQkQY38ov',
    61469:'nVjUqzoZXDGXajjged1ZhUpj1jr',
    61967:'pn7ZN5POA455AqIVejsL4YiKxiS',
    60636:'pShnxXXD1CrHyLbbTu8nAaLczHP',
    59978:'a47oBhPll8SzPJaef1VzG0Yft91'
  });
  const order = ['61316','61469','61967','60636','59978'];
  function dayNumber(now) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'numeric',day:'numeric'})
        .formatToParts(now);
      const fields = Object.fromEntries(parts.map(p=>[p.type,Number(p.value)]));
      return Math.floor(Date.UTC(fields.year,fields.month-1,fields.day)/86400000);
    } catch {return Math.floor(Number(now)/86400000);}
  }
  function lead(now = Date.now()) {
    const offset = dayNumber(now) - Math.floor(Date.UTC(2026,10,25)/86400000);
    return order[((offset % order.length) + order.length) % order.length];
  }
  const first = lead(); // Fixed for the lifetime of the page, including refreshes of its data.
  function artwork(id) {
    const key = stills[id];
    return Object.prototype.hasOwnProperty.call(stills,id) ? 'https://image.tmdb.org/t/p/w1280/' + key + '.jpg' : '';
  }
  function lineup(catalog, seed = []) {
    const live = new Map(catalog.filter(item=>order.includes(String(item?.id))).map(item=>[String(item.id),item]));
    const index = order.indexOf(first);
    return order.slice(index).concat(order.slice(0,index)).map(id=>{
      const baseline = seed.find(item=>String(item.id)===id);
      const item = live.get(id);
      return item ? {...baseline,...item,desc:item.desc || baseline?.desc || ''} : baseline;
    }).filter(Boolean);
  }
  const loads = new WeakMap(), decoded = new WeakSet();
  function imageIsReal(image) {
    const src = image?.currentSrc || image?.getAttribute?.('src') || '';
    return Boolean(image?.complete && image.naturalWidth >= 2 && src && !/\/anime-artwork\.svg(?:[?#]|$)/i.test(src));
  }
  function prepare(slide) {
    const image = slide?.querySelector('.komi-hub-hero-art');
    if (!image) return Promise.resolve(false);
    if (decoded.has(image) && imageIsReal(image)) return Promise.resolve(true);
    if (loads.has(image)) return loads.get(image);
    const source = image.dataset.komiHeroDeferredSrc || image.getAttribute('src');
    if (!source || /\/anime-artwork\.svg(?:[?#]|$)/i.test(source)) return Promise.resolve(false);
    const request = new Promise(resolve=>{
      let finished = false;
      const finish = value=>{
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        image.removeEventListener('load', onLoad);
        image.removeEventListener('error', onError);
        resolve(value);
      };
      const onError = ()=>finish(false);
      const onLoad = ()=>{
        if (!imageIsReal(image)) return;
        Promise.resolve(typeof image.decode === 'function' ? image.decode() : null)
          .then(()=>{const ok=imageIsReal(image);if(ok)decoded.add(image);finish(ok);},onError);
      };
      const timer = setTimeout(onError,4200);
      image.addEventListener('load',onLoad);
      image.addEventListener('error',onError);
      image.loading = 'eager';
      image.fetchPriority = 'low';
      if (image.getAttribute('src') !== source || (image.complete && !image.naturalWidth)) image.src = source;
      onLoad();
    }).finally(()=>loads.delete(image));
    loads.set(image,request);
    return request;
  }
  root.KomiHeroDaily = {first,lead,artwork,lineup,prepare,imageIsReal};
  if (typeof module === 'object' && module.exports) module.exports = root.KomiHeroDaily;
})(globalThis);

/* Keep the crawlable SEO fallback in the document, but never flash it to JS visitors.
   CSP-safe external script in <head>; hydrated markup is switched on before paint. */
(() => {
  'use strict';
  if (typeof document === 'undefined') return;
  // Start font CSS without making the first screen depend on a remote stylesheet.
  document.addEventListener('load', event => {
    if (event.target?.id === 'komi-font-css' || event.target?.matches?.('link[data-komi-deferred-style]')) {
      event.target.media = 'all';
      if (event.target.dataset?.komiDeferredStyle === 'base') {
        // Full stylesheet includes the same rules in their original order.
        // Once ready, discard the temporary first-paint stylesheet.
        document.querySelector('link[data-komi-first-paint]')?.remove();
      }
    }
  }, true);
  // Shop-only rules stay nonblocking on the homepage; retain their original
  // cascade position and activate immediately when entering the shop.
  const ensureShopStyle=()=>{
    if (/^\/(?:catalog|shop|partners|profile)$/.test(location.pathname) || /^#(?:catalog|shop|partners|profile)$/.test(location.hash.toLowerCase())) {
      const base=document.querySelector('link[data-komi-deferred-style="base"]');
      if (base) base.media='all';
    }
    if (location.pathname==='/shop'||location.hash.toLowerCase()==='#shop') {
      const link=document.querySelector('link[data-komi-deferred-style="shop"]');
      if (link) link.media='all';
    }
    if (location.pathname==='/profile'||location.hash.toLowerCase()==='#profile') {
      const link=document.querySelector('link[data-komi-deferred-style="profile"]');
      if (link) link.media='all';
    }
  };
  const styleObserver=new MutationObserver(()=>{
    ensureShopStyle();
    if(document.querySelector('link[data-komi-deferred-style="shop"]')&&
       document.querySelector('link[data-komi-deferred-style="profile"]'))styleObserver.disconnect();
  });
  styleObserver.observe(document.head,{childList:true});
  window.addEventListener('popstate',ensureShopStyle);
  window.addEventListener('hashchange',ensureShopStyle);
  document.addEventListener('DOMContentLoaded',()=>{ensureShopStyle();styleObserver.disconnect();},{once:true});
  const incomingAnime = new URLSearchParams(location.search).get('anime');
  if (/^\/(?:index\.html)?$/.test(location.pathname) && /^[1-9][0-9]{0,11}$/.test(incomingAnime || '')) {
    const html = document.documentElement;
    html.classList.add('komi-watch-entry');
    // If scripts or the title lookup fail, offer a real exit instead of exposing a flash of home.
    setTimeout(() => {
      const pending = document.getElementById('komiWatchEntryStatus');
      if (html.classList.contains('komi-watch-entry') && pending)
        pending.textContent = 'Не удалось открыть просмотр. Обновите страницу или вернитесь в каталог.';
    }, 12000);
    return;
  }
  const sectionRoute = /^\/(catalog|shop|partners|profile)$/.test(location.pathname) || /^#(catalog|shop|partners|profile)$/.test(location.hash.toLowerCase());
  if (!sectionRoute && (!/^\/(?:index\.html)?$/.test(location.pathname) ||
      (location.hash && location.hash !== '#home') ||
      new URLSearchParams(location.search).has('anime'))) return;

  const html = document.documentElement;
  const daily = window.KomiHeroDaily;
  let firstImage = null;
  html.classList.add('komi-home-booting');
  if (!sectionRoute) {
    // A fixed real preview would show yesterday's title briefly. Keep the
    // neutral shell until the selected daily image has actually decoded.
    const src = daily?.artwork?.(daily.first) || document.querySelector('meta[name="komi-first-hero"]')?.content;
    const nativeBanner = /^https:\/\/s[34]\.anilist\.co\/file\/anilistcdn\/media\/anime\/banner\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|avif)$/i;
    if (src && (src.startsWith('https://wsrv.nl/?url=') || nativeBanner.test(src) ||
        /^https:\/\/image\.tmdb\.org\/t\/p\/w1280\/[A-Za-z0-9_-]+\.jpg$/.test(src))) {
      const preload = document.createElement('link');
      preload.rel = 'preload'; preload.as = 'image'; preload.href = src;
      preload.fetchPriority = 'high'; preload.referrerPolicy = 'no-referrer';
      document.head.append(preload);
    }
    if (daily && src && typeof Image === 'function') {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.fetchPriority = 'high';
      image.referrerPolicy = 'no-referrer';
      firstImage = {id:daily.first,src,image,ready:false,promise:null};
      firstImage.promise = new Promise(resolve => {
        let settled = false;
        const finish = ready => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          image.onload = image.onerror = null;
          firstImage.ready = ready;
          resolve(ready);
        };
        const deadline = setTimeout(() => finish(false), 4200);
        image.onload = () => {
          if (!daily.imageIsReal(image)) { finish(false); return; }
          Promise.resolve(typeof image.decode === 'function' ? image.decode() : null)
            .then(() => finish(daily.imageIsReal(image)), () => finish(false));
        };
        image.onerror = () => finish(false);
        image.src = src;
      });
      daily.firstImage = firstImage;
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
    document.removeEventListener?.('readystatechange',paintDailyPreview);
  }

  function paintDailyPreview() {
    // Interactive is reached once HTML is parsed, before deferred application
    // scripts finish. Never change a main element the parser is still filling.
    if (done || !firstImage?.ready || document.readyState === 'loading') return;
    const main = document.getElementById('mainContainer');
    if (!main || main.querySelector('.komi-home-discovery')) return;
    const template = main.querySelector('template.komi-boot-real-hero');
    const hero = template?.content?.firstElementChild?.cloneNode(true);
    const wrapper = hero?.querySelector('.hero-slides-wrapper');
    if (!wrapper) return;
    const slides = [...wrapper.querySelectorAll('.hero-slide[data-komi-anime-id]')];
    const lineup = daily.lineup(slides.map(slide => ({id:slide.dataset.komiAnimeId,slide})));
    const promo = wrapper.querySelector('.hero-slide[data-komi-promo]');
    if (lineup.length !== 5 || !promo || lineup[0].id !== firstImage.id) return;
    let activeSlide = null;
    for (const [index,item] of lineup.entries()) {
      const slide = item.slide, active = index === 0;
      const image = slide.querySelector('.komi-hub-hero-art');
      const link = slide.querySelector('.komi-hub-play');
      if (!image || link?.getAttribute('href') !== '/anime/'+item.id+'#player') return;
      const src = daily.artwork(item.id);
      slide.classList.toggle('active',active);
      slide.classList.remove('komi-hd-poster','komi-hd-softwide');
      slide.classList.add('komi-hd-wide');
      slide.setAttribute('aria-hidden',String(!active));
      slide.toggleAttribute('inert',!active);
      slide.dataset.komiHeroBanner = src;
      slide.dataset.komiDailyArt = 'true';
      if (active) {
        // Insert the very image decoded in <head>. Hydration adopts this node,
        // keeping the actual LCP frame attached rather than painting it twice.
        for (const attribute of image.attributes) {
          if (!['src','loading','fetchpriority','data-komi-hero-deferred-src'].includes(attribute.name))
            firstImage.image.setAttribute(attribute.name,attribute.value);
        }
        firstImage.image.width = 1280;
        firstImage.image.height = 720;
        image.remove();
        activeSlide = slide;
        slide.classList.add('komi-art-ready');
      } else {
        image.src = '/anime-artwork.svg';
        image.loading = 'lazy';
        image.removeAttribute('fetchpriority');
        image.dataset.komiHeroDeferredSrc = src;
      }
    }
    promo.classList.remove('active');
    promo.setAttribute('aria-hidden','true');
    promo.setAttribute('inert','');
    wrapper.replaceChildren(...lineup.map(item => item.slide),promo);
    for (const button of hero.querySelectorAll('button')) button.disabled = true;
    // The native watch link works before the JS-only list/carousel controls.
    const home = document.createElement('div');
    home.className = 'komi-home-discovery komi-home-storefront';
    home.dataset.komiBootPreview = '';
    home.dataset.komiHomeOwner = '';
    home.append(hero);
    // Adopt the prepared template into the live document before inserting its
    // decoded image, so that image never moves into an inert template document.
    activeSlide.prepend(firstImage.image);
    const footer = document.createElement('footer');
    footer.className = 'komi-home-browse-footer';
    const catalog = document.createElement('a');
    catalog.className = 'komi-home-catalog-link';
    catalog.setAttribute('href','/catalog');
    catalog.textContent = 'Весь каталог';
    footer.append(catalog);
    home.append(footer);
    daily.preview = hero;
    main.replaceChildren(home);
    finish();
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
  if (firstImage) {
    document.addEventListener('readystatechange',paintDailyPreview);
    firstImage.promise.then(paintDailyPreview);
    paintDailyPreview();
  }
  // If a script or network request fails, restore the navigable SEO fallback.
  // A slow or unavailable JS/CDN must not hide the real, navigable HTML for 20 seconds.
  timer = setTimeout(finish, 5000);
  window.addEventListener('hashchange', () => {
    if (location.hash && location.hash !== '#home') finish();
  });
})();
