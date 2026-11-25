'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app-main.js'), 'utf8');

// A small inert DOM fixture exercises the real renderer and section patcher.
// Track removals, because final node equality alone misses remove/reinsert bugs.
const decode = text => text.replace(/&(amp|quot|lt|gt|#39);/g,
  (_, name) => ({amp:'&', quot:'"', lt:'<', gt:'>', '#39':"'"})[name]);
class Node {
  constructor(tag, attributes = {}) {
    this.tag = tag; this.attributes = attributes; this.childNodes = [];
    this.dataset = Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
    this.removals = 0;
    this.style = {setProperty:(key, value) => {this.style[key] = value;}};
    this.classList = {
      contains:name => (this.attributes.class || '').split(/\s+/).includes(name),
      toggle:(name, on) => {
        const names = new Set((this.attributes.class || '').split(/\s+/).filter(Boolean));
        if (on) names.add(name); else names.delete(name);
        this.attributes.class = [...names].join(' ');
      }
    };
  }
  get children() {return this.childNodes.filter(node => node.tag !== '#text');}
  get firstElementChild() {return this.children[0] || null;}
  get isConnected() {return this.connected || Boolean(this.parentNode?.isConnected);}
  get textContent() {return this.tag === '#text' ? this.text : this.childNodes.map(node => node.textContent).join('');}
  set textContent(value) {
    const text = new Node('#text'); text.text = value;
    this.replaceChildren(text);
  }
  get outerHTML() {
    if (this.tag === '#text') return this.text;
    return '<' + this.tag + JSON.stringify(this.attributes) + '>' +
      this.childNodes.map(node => node.outerHTML).join('') + '</' + this.tag + '>';
  }
  getAttribute(name) {return this.attributes[name] ?? null;}
  setAttribute(name, value) {this.attributes[name] = String(value);}
  querySelectorAll(selector) {
    const direct = selector.startsWith(':scope > ');
    const className = selector.replace(':scope > ', '').slice(1);
    const found = [];
    for (const child of this.children) {
      if (child.classList.contains(className)) found.push(child);
      if (!direct) found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
  querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  remove() {
    if (!this.parentNode) return;
    if (this.isConnected) this.recordRemoval();
    const list = this.parentNode.childNodes;
    list.splice(list.indexOf(this), 1); this.parentNode = null;
  }
  recordRemoval() {this.removals++; for (const child of this.childNodes) child.recordRemoval();}
  insertBefore(node, before) {
    node.remove();
    const index = before ? this.childNodes.indexOf(before) : this.childNodes.length;
    this.childNodes.splice(index, 0, node); node.parentNode = this;
  }
  replaceChildren(...nodes) {
    for (const child of [...this.childNodes]) child.remove();
    for (const node of nodes) this.insertBefore(node, null);
  }
  set innerHTML(markup) {this.replaceChildren(...parse(markup).childNodes);}
}
function parse(markup) {
  const fragment = new Node('#fragment'), stack = [fragment];
  for (const token of markup.match(/<[^>]+>|[^<]+/g) || []) {
    if (token.startsWith('</')) {stack.pop(); continue;}
    if (token.startsWith('<')) {
      const tag = token.match(/^<([\w-]+)/)?.[1];
      if (!tag) continue;
      const attributes = Object.fromEntries([...token.matchAll(/([\w:-]+)="([^"]*)"/g)]
        .map(([, key, value]) => [key, decode(value)]));
      const node = new Node(tag, attributes);
      stack.at(-1).insertBefore(node, null);
      if (!/^(img|br|hr|input|meta|link|source)$/.test(tag) && !token.endsWith('/>')) stack.push(node);
    } else {
      const node = new Node('#text'); node.text = decode(token);
      stack.at(-1).insertBefore(node, null);
    }
  }
  return fragment;
}
function fixture(initialIndex = 0, cachedPreview = false) {
  const container = new Node('main'); container.connected = true;
  let timerStarts = 0;
  const scope = {
    container, document:{createElement:() => ({content:new Node('#fragment'),
      set innerHTML(markup) {this.content = parse(markup);}})},
    currentUser:null, currentSlideIndex:initialIndex, komiHomeCatalogReady:false,
    komiCatalogRevision:1, komiEpisodeProgress:{}, userAnimeStatuses:{},
    komiExternalCalendar:new Map(), komiCalendarLoading:false, komiCalendarError:'',
    availableGenresList:[], KomiGenreMoods:{render:() => ''},
    komiResumeReadyUid:null, komiResumePreview:[], komiLastHomeMarkup:'',
    komiStartupHomeCommitted:false, komiHomeHeroMayPaint:() => true,
    startHeroAutoSlide:() => timerStarts++,
    renderCard:anime => '<a class="anime-card">' + anime.title + '</a>',
    komiAnimeYear:anime => String(anime.year), komiCatalogType:anime => anime.type,
    animeArtwork:anime => anime.banner || anime.poster,
    cleanAnimeDescriptionText:value => value || '',
    cleanAnimeDescription:() => {throw new Error('Descriptions must be escaped only by the renderer');},
    komiRecommendations:() => [], komiReleaseCalendar:() => '',
    komiYearSections:() => '', komiIntroMarkup:() => '', komiHomeQuickFiltersMarkup:() => ''
  };
  scope.window = scope;
  vm.createContext(scope);
  for (const file of ['komi-home-snapshot.js', 'komi-home-seed.js', 'home-discovery.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), scope, {filename:file});
  scope.KomiHomeDiscovery.afterRender = () => {};
  scope.komiHomePreviewCatalog = scope.KomiHomeSnapshot.featured(scope.KomiHomeSeed, scope.komiAnimeYear);
  if (cachedPreview) scope.komiHomePreviewCatalog = scope.komiHomePreviewCatalog
    .map(anime => ({...anime, banner_url:undefined, bannerUrl:undefined}));
  const start = app.indexOf('if (window.KomiHomeDiscovery) {', app.indexOf('function render()'));
  const end = app.indexOf('const sliderItems =', start);
  vm.runInContext('function renderHome() {' + app.slice(start, end) + '}', scope);
  scope.renderHome();
  return {scope, container, get timerStarts() {return timerStarts;},
    hydrate(change = () => {}) {
      // The live public projection normalizes IDs and omits hero metadata.
      scope.animeList = scope.komiHomePreviewCatalog.map(anime => ({...anime,
        id:String(anime.shikimoriId), year:Number(anime.year),
        shikiRating:String(anime.shikiRating), desc:undefined,
        banner_url:undefined, bannerUrl:undefined}));
      scope.animeList.push({id:'999999', title:'New catalog card', year:2020,
        poster:'https://example.test/extra.jpg', episodeCount:1, shikiRating:7});
      change(scope.animeList);
      scope.komiHomeCatalogReady = true; scope.komiCatalogRevision++;
      scope.renderHome();
    }
  };
}

test('catalog hydration keeps the upgraded hero continuously attached and preserves its timer', () => {
  const f = fixture(), hero = f.container.querySelector('.komi-home-hero');
  const image = hero.querySelector('.komi-hub-hero-art');
  const description = hero.querySelector('.komi-hub-description');
  image.setAttribute('src', 'https://example.test/full-width-banner.jpg');
  hero.querySelector('.hero-slide').dataset.komiHeroBanner = image.getAttribute('src');
  description.textContent = 'Full description loaded asynchronously';
  const slides = hero.querySelectorAll('.hero-slide');
  f.scope.currentSlideIndex = 2;
  slides.forEach((slide, index) => slide.classList.toggle('active', index === 2));
  hero.querySelector('.hero-slider-container').style.setProperty('--komi-hero-progress', '42%');
  f.hydrate();
  assert.equal(f.container.querySelector('.komi-home-hero'), hero);
  assert.equal(hero.isConnected, true);
  assert.equal(hero.removals, 0, 'the hero must never be detached and reinserted');
  assert.equal(image.removals, 0, 'the LCP image must remain attached');
  assert.equal(hero.querySelector('.komi-hub-hero-art'), image);
  assert.equal(image.getAttribute('src'), 'https://example.test/full-width-banner.jpg');
  assert.equal(description.textContent, 'Full description loaded asynchronously');
  assert.equal(slides[2].classList.contains('active'), true);
  assert.equal(hero.querySelector('.hero-slider-container').style['--komi-hero-progress'], '42%');
  assert.equal(f.timerStarts, 1);
  assert.match(f.container.textContent, /New catalog card/, 'nonhero sections still refresh');
  f.scope.renderHome();
  assert.equal(f.timerStarts, 1, 'unchanged refreshes do not restart progress');
});

test('catalog hydration retains a selected brand slide and its mounted video', () => {
  const f = fixture(), hero = f.container.querySelector('.komi-home-hero');
  const slides = hero.querySelectorAll('.hero-slide'), promo = slides.at(-1);
  assert.equal(slides.length, 6);
  assert.equal(promo.dataset.komiPromo, 'brand-loop');
  f.scope.currentSlideIndex = 5;
  slides.forEach((slide, index) => slide.classList.toggle('active', index === 5));
  const poster = promo.querySelector('.komi-hub-hero-art');
  poster.setAttribute('src', poster.dataset.komiHeroDeferredSrc);
  delete poster.dataset.komiHeroDeferredSrc;
  const video = new Node('video', {class:'komi-hero-video'});
  video.currentTime = 2.5;
  promo.insertBefore(video, promo.querySelector('.komi-home-hero-content'));
  f.hydrate();
  assert.equal(f.container.querySelector('.komi-home-hero'), hero);
  assert.equal(promo.classList.contains('active'), true);
  assert.equal(promo.querySelector('.komi-hero-video'), video);
  assert.equal(video.isConnected, true);
  assert.equal(video.removals, 0, 'hydration must not detach and restart the video');
  assert.equal(video.currentTime, 2.5);
  assert.equal(poster.removals, 0);
  assert.equal(f.timerStarts, 1);
});

test('changed title, route or media replaces the old hero and starts its timer', () => {
  for (const change of [
    anime => {anime.title += ' — corrected';},
    anime => {anime.id = '999998';},
    anime => {anime.poster = anime.banner = 'https://example.test/new-poster.jpg';},
    anime => {anime.banner_url = 'https://example.test/new-banner.jpg';},
    anime => {anime.banner_video_url = 'https://example.test/preview.webm';},
    anime => {anime.screenshots = ['https://example.test/still.jpg'];}
  ]) {
    const f = fixture(), old = f.container.querySelector('.komi-home-hero');
    f.hydrate(items => change(items[0]));
    assert.notEqual(f.container.querySelector('.komi-home-hero'), old);
    assert.equal(old.isConnected, false);
    assert.equal(f.timerStarts, 2);
  }
});

test('account changes do not retain another owner’s hero or bookmark state', () => {
  const f = fixture(), old = f.container.querySelector('.komi-home-hero');
  f.scope.currentUser = {authUserId:'owner-2', username:'viewer'};
  f.scope.userAnimeStatuses = {viewer:{[f.scope.komiHomePreviewCatalog[0].id]:'watching'}};
  f.hydrate();
  const next = f.container.querySelector('.komi-home-hero');
  assert.notEqual(next, old);
  assert.equal(next.dataset.komiOwner, 'owner-2');
  assert.equal(next.querySelector('.hero-slide').dataset.komiHeroSaved, 'true');
  assert.equal(f.timerStarts, 2);
});

test('verified landscape is the eager first source across seed, cached preview and live hydration', () => {
  const banner = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/189046-MDk2CaVuRWpb.jpg';
  for (const cached of [false, true]) {
    const f = fixture(0, cached), hero = f.container.querySelector('.komi-home-hero');
    const slide = hero.querySelector('.hero-slide'), image = slide.querySelector('.komi-hub-hero-art');
    const seed = f.scope.KomiHomeSeed.find(anime => anime.id === '61316');
    assert.equal(slide.dataset.komiAnimeId, '61316');
    assert.equal(slide.dataset.komiHeroBanner, banner);
    assert.equal(slide.classList.contains('komi-hd-wide'), true, 'verified landscape fills the hero before media scanning');
    assert.equal(slide.classList.contains('komi-hd-poster'), false);
    assert.equal(image.getAttribute('src'), banner);
    assert.equal(image.getAttribute('fetchpriority'), 'high');
    assert.equal(image.getAttribute('loading'), 'eager');
    assert.equal(image.dataset.posterDirect, seed.poster, 'original cover remains the failure fallback');
    assert.equal(seed.banner, seed.poster, 'seed catalog artwork stays a cover');
    f.hydrate();
    assert.equal(f.container.querySelector('.komi-home-hero'), hero);
    assert.equal(image.removals, 0);
    assert.equal(image.getAttribute('src'), banner);
  }
});

test('seed banner is scoped to its ID and cover, while explicit custom banners win', () => {
  for (const change of [
    anime => {anime.id = '237'; anime.shikimoriId = 237; anime.title = 'Eureka';
      anime.poster = anime.banner = 'https://example.test/eureka-cover.jpg';},
    anime => {anime.poster = anime.banner = 'https://example.test/revised-cover.jpg';},
    anime => {anime.poster = 'https://example.test/revised-poster.jpg';},
    anime => {anime.banner = 'https://example.test/legacy-custom-banner.jpg';},
    anime => {anime.banner_url = 'https://example.test/custom-banner.jpg';},
    anime => {anime.bannerUrl = 'https://example.test/camel-case-banner.jpg';}
  ]) {
    const f = fixture();
    f.hydrate(items => change(items[0]));
    const anime = f.scope.animeList[0], image = f.container.querySelector('.komi-hub-hero-art');
    assert.equal(image.getAttribute('src'), anime.banner_url || anime.bannerUrl || anime.banner || anime.poster);
    assert.equal(image.dataset.posterDirect, anime.banner || anime.poster);
    assert.equal(f.container.querySelector('.hero-slide').classList.contains('komi-hd-wide'), false,
      'unverified custom sources still wait for dimension validation');
  }
  const inactive = fixture(1).container.querySelector('.komi-hub-hero-art');
  assert.equal(inactive.getAttribute('src'), '/anime-artwork.svg');
  assert.match(inactive.dataset.komiHeroDeferredSrc, /\/banner\/189046-/);
  assert.equal(inactive.getAttribute('fetchpriority'), null, 'inactive slides do not request the landscape early');
});

test('failed initial landscape falls back to the original cover and then the local artwork', () => {
  const f = fixture(), rendered = f.container.querySelector('.komi-hub-hero-art');
  const image = {src:rendered.getAttribute('src'), dataset:{posterDirect:rendered.dataset.posterDirect}};
  const scope = {};
  vm.runInNewContext(app.slice(app.indexOf('function komiCardPosterFallback('),
    app.indexOf('function renderCard(')), scope);
  scope.komiCardPosterFallback(image);
  assert.equal(image.src, rendered.dataset.posterDirect);
  assert.equal(image.dataset.posterTriedDirect, '1');
  scope.komiCardPosterFallback(image);
  assert.equal(image.src, '/anime-artwork.svg');
});

test('home boot preloads only the configured trusted banner and skips anime routes', () => {
  const banner = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/189046-MDk2CaVuRWpb.jpg';
  const boot = fs.readFileSync(path.join(root, 'komi-home-boot.js'), 'utf8');
  function preload(src, pathname = '/') {
    const links = [];
    vm.runInNewContext(boot, {
      document:{readyState:'loading', documentElement:{classList:{add() {}, remove() {}}},
        head:{append:link => links.push(link)}, createElement:() => ({}), addEventListener() {},
        querySelector:selector => selector === 'meta[name="komi-first-hero"]' ? {content:src} : null},
      window:{addEventListener() {}}, location:{pathname, hash:'', search:''}, URLSearchParams,
      MutationObserver:class {observe() {} disconnect() {}}, setTimeout:() => 1, clearTimeout() {}
    });
    return links;
  }
  const [link] = preload(banner);
  assert.equal(link.href, banner);
  assert.equal(link.rel, 'preload');
  assert.equal(link.as, 'image');
  assert.equal(link.fetchPriority, 'high');
  assert.equal(link.referrerPolicy, 'no-referrer');
  assert.equal(preload(banner, '/anime/237').length, 0);
  assert.equal(preload(banner.replace('https:', 'http:')).length, 0);
  assert.equal(preload(banner.replace('s4.anilist.co', 'example.test')).length, 0);
});
