/* Komi Anime: progressive hero artwork with native-resolution fallbacks.
 * Requests public metadata only; does not send account information.
 * Wide images must be genuinely wide and high resolution. Low-resolution
 * portraits stay sharp and contained; wide images upgrade after first paint.
 */
(function (root) {
  'use strict';

  const API = 'https://graphql.anilist.co';
  const SELECTOR = '.komi-home-hero .hero-slide[data-komi-anime-id]';
  const CACHE_PREFIX = 'komi_hd_hero_v3_';
  const FOUND_TTL = 24 * 60 * 60 * 1000;
  const MISSING_TTL = 60 * 60 * 1000;
  const cache = new Map();
  const pending = new Set();
  const metadata = new Map();
  const metadataPending = new Map();
  const runningVideos = new Set();
  const retryAfter = new Map();
  let fetching = false;
  let scanTimer = null;
  let firstVisibleId = '';
  let userSelectedSlide = false;

  function trustedAniListImage(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 1024) return '';
      const u = new URL(raw);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash ||
          !['s4.anilist.co', 's3.anilist.co'].includes(u.hostname) ||
          !/^\/file\/anilistcdn\/media\/anime\/(?:banner|cover)\//.test(u.pathname)) return '';
      return u.href;
    } catch { return ''; }
  }

  function safeStill(raw) {
    try {
      if (typeof raw !== 'string' || raw.length > 1024) return '';
      const u = new URL(raw);
      return u.protocol === 'https:' && !u.username && !u.password && !u.port ? u.href : '';
    } catch { return ''; }
  }

  function getCached(id) {
    const now = Date.now();
    const key = CACHE_PREFIX + id;
    let item = cache.get(id);
    if (!item) {
      try { item = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { item = null; }
    }
    if (!item || !Number.isFinite(item.time) ||
        now - item.time > (item.banner || item.cover ? FOUND_TTL : MISSING_TTL)) {
      cache.delete(id);
      return null;
    }
    cache.set(id, item);
    return item;
  }

  function saveCached(id, media) {
    const entry = {
      banner: trustedAniListImage(media?.bannerImage),
      cover: trustedAniListImage(media?.coverImage?.extraLarge),
      time: Date.now()
    };
    cache.set(id, entry);
    try { sessionStorage.setItem(CACHE_PREFIX + id, JSON.stringify(entry)); } catch {}
    return entry;
  }

  function updateLayout(slide, img) {
    if (!img || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const wide = img.naturalWidth >= 1200 && ratio >= 1.6;
    const softWide = !wide && img.naturalWidth >= 900 && ratio >= 1.55;
    slide.classList.toggle('komi-hd-wide', wide);
    slide.classList.toggle('komi-hd-softwide', softWide);
    slide.classList.toggle('komi-hd-poster', !wide && !softWide);
    slide.classList.toggle('komi-art-ready', true);
  }

  function bindImage(slide) {
    const img = slide.querySelector('img.komi-hub-hero-art');
    if (!img) return null;
    if (!img.dataset.komiHeroBound) {
      img.dataset.komiHeroBound = '1';
      img.addEventListener('load', () => updateLayout(slide, img));
      if (img.complete && img.naturalWidth) updateLayout(slide, img);
    }
    return img;
  }

  function preflight(url) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const picture = new Image();
      picture.decoding = 'async';
      picture.referrerPolicy = 'no-referrer';
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        picture.onload = picture.onerror = null;
        resolve(result);
      };
      const timer = setTimeout(() => {
        finish(null);
        picture.removeAttribute('src');
      }, 3500);
      picture.onload = () => finish({
        url, width: picture.naturalWidth, height: picture.naturalHeight
      });
      picture.onerror = () => finish(null);
      picture.src = url;
    });
  }

  async function applyArtwork(slide, entry) {
    const img = bindImage(slide);
    if (!img || !slide.classList.contains('active')) return;
    // Upgrade the initial portrait only when a verified landscape is available.
    // Keep an already-wide first paint intact.
    const firstUnselected = !userSelectedSlide && String(slide.dataset.komiAnimeId||'')===firstVisibleId;
    if (firstUnselected && slide.classList.contains('komi-hd-wide')) return;
    const banner = safeStill(slide.dataset.komiHeroBanner);
    const still = safeStill(slide.dataset.komiHeroStill);
    const originalPoster = safeStill(img.dataset.posterDirect);
    const signature = [banner, entry.banner, still, entry.cover, originalPoster].join('|');
    if (img.dataset.komiHeroChecked === signature) return;
    img.dataset.komiHeroChecked = signature;
    const stillActive = () => {
      if (!img.isConnected || img.dataset.komiHeroChecked !== signature) return false;
      if (slide.classList.contains('active') && !document.hidden) return true;
      delete img.dataset.komiHeroChecked;
      return false;
    };

    // Prefer the largest real widescreen image (banner or anime screenshot).
    // At 900-1199px, slight softening prevents visible upscaling artifacts.
    let bestLandscape = null;
    for (const url of new Set([banner, entry.banner, still].filter(Boolean))) {
      const result = await preflight(url);
      if (!stillActive()) return;
      if (result && result.width >= 900 && result.height > 0 &&
          result.width / result.height >= 1.55 &&
          (!bestLandscape || result.width > bestLandscape.width)) {
        bestLandscape = result;
      }
    }
    if (bestLandscape) {
      if (stillActive() && img.src !== bestLandscape.url) img.src = bestLandscape.url;
      return;
    }

    // No HD landscape: keep the first paint stable; later slides may improve their portrait.
    if (firstUnselected) return;
    // Use the original cover if it has better native dimensions than the proxy.
    let bestPortrait = null;
    for (const url of new Set([entry.cover, originalPoster].filter(Boolean))) {
      const result = await preflight(url);
      if (!stillActive()) return;
      if (result && result.width >= 480 && result.height > result.width * 1.05 &&
          (!bestPortrait || result.width > bestPortrait.width)) {
        bestPortrait = result;
      }
    }
    if (stillActive() && bestPortrait && bestPortrait.width > (img.naturalWidth || 0) + 90 &&
        img.src !== bestPortrait.url) {
      img.src = bestPortrait.url;
    }
  }

  function apply(id, entry) {
    document.querySelectorAll(SELECTOR).forEach(slide => {
      if (slide.dataset.komiAnimeId === id &&
          (!root.matchMedia?.('(max-width: 767px)').matches ||
            slide.classList.contains('active'))) void applyArtwork(slide, entry);
    });
  }

  async function fetchPending() {
    if (fetching || !pending.size) return;
    fetching = true;
    try {
      while (pending.size) {
        const batch = Array.from(pending).slice(0, 5);
        batch.forEach(id => pending.delete(id));

        // A Page filter skips missing titles instead of failing a query when
        // any single MAL entry has no matching AniList media record.
        const query = 'query KomiHeroArtwork($ids:[Int]) {' +
          ' Page(page:1,perPage:5) {' +
          ' media(type:ANIME,idMal_in:$ids) {' +
          ' idMal isAdult bannerImage coverImage { extraLarge } } } }';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
          const response = await fetch(API, {
            method: 'POST',
            headers: {'Content-Type':'application/json', Accept:'application/json'},
            body: JSON.stringify({query, variables:{ids:batch.map(Number)}}),
            credentials: 'omit',
            signal: controller.signal
          });
          if (!response.ok) throw new Error('Hero artwork unavailable');
          const payload = await response.json();
          const results = payload?.data?.Page?.media;
          if (!Array.isArray(results)) throw new Error('Invalid artwork metadata');
          const byId = new Map(results.filter(item => item && !item.isAdult)
            .map(item => [String(item.idMal), item]));
          for (const id of batch) {
            retryAfter.delete(id);
            apply(id, saveCached(id, byId.get(id)));
          }
        } catch {
          // Keep existing artwork and avoid repeat requests during provider outages.
          for (const id of batch) retryAfter.set(id, Date.now() + 60000);
        } finally {
          clearTimeout(timer);
        }
      }
    } finally {
      fetching = false;
    }
  }

  function bindVisible() {
    document.querySelectorAll(SELECTOR+'.active').forEach(slide=>{
      const id=String(slide.dataset.komiAnimeId||'');
      if (!firstVisibleId) firstVisibleId=id;
      bindImage(slide);
    });
  }
  function applyMetadata(slide, item) {
    if (!slide.classList.contains('active') || !slide.isConnected) return;
    const still = safeStill(item?.still);
    const banner = safeStill(item?.banner);
    const video = safeStill(item?.video);
    if (still) slide.dataset.komiHeroStill = still;
    if (banner) slide.dataset.komiHeroBanner = banner;
    if (video && /\.(mp4|webm)$/i.test(new URL(video).pathname)) slide.dataset.komiHeroVideo = video;
    const content = slide.querySelector('.komi-home-hero-content');
    if (content && item?.description) {
      let description = content.querySelector('p');
      if (!description) {
        description = document.createElement('p');
        description.className = 'komi-hub-description';
        const actions = content.querySelector('.hero-buttons');
        content.insertBefore(description,actions || null);
      }
      if (description.textContent !== item.description) description.textContent = item.description;
    }
    const entry = getCached(slide.dataset.komiAnimeId) || {};
    if (banner || still) void applyArtwork(slide,entry);
    syncVideos();
  }
  function loadMetadata(slide,id) {
    if (typeof root.komiFetchHeroMetadata !== 'function') return;
    if (metadata.has(id)) { applyMetadata(slide,metadata.get(id)); return; }
    if (metadataPending.has(id)) return;
    const task = root.komiFetchHeroMetadata(id).then(item => {
      if (!item) return;
      metadata.set(id,item);
      if (metadata.size > 20) metadata.delete(metadata.keys().next().value);
      document.querySelectorAll(SELECTOR+'.active').forEach(current => {
        if (current.dataset.komiAnimeId === id) applyMetadata(current,item);
      });
    }).catch(()=>{}).finally(()=>metadataPending.delete(id));
    metadataPending.set(id,task);
  }

  function syncVideos() {
    for (const video of runningVideos) if (!video.isConnected) { video.pause(); runningVideos.delete(video); }
    const connection = root.navigator?.connection;
    const allowed = !document.hidden && !connection?.saveData && !/(^|-)2g$/.test(connection?.effectiveType || '') && !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll(SELECTOR).forEach(slide => {
      const existing = slide.querySelector('video.komi-hero-video');
      const active = allowed && slide.classList.contains('active');
      const url = safeStill(slide.dataset.komiHeroVideo);
      if (!active || !url) { if (existing) { existing.pause(); existing.classList.remove('is-playing'); } return; }
      if (slide.dataset.komiHeroVideoFailed === url) return;
      let video = existing;
      if (!video) {
        video = document.createElement('video');
        video.className = 'komi-hero-video';
        video.muted = true; video.defaultMuted = true; video.loop = true;
        video.playsInline = true; video.preload = 'none';
        video.setAttribute('aria-hidden','true');
        video.addEventListener('playing', () => { if (slide.classList.contains('active') && !document.hidden) video.classList.add('is-playing'); });
        video.addEventListener('error', () => { slide.dataset.komiHeroVideoFailed = url; video.classList.remove('is-playing'); });
        slide.querySelector('img.komi-hub-hero-art')?.after(video);
        video.src = url;
        runningVideos.add(video);
      }
      if (video.paused) video.play().catch(() => { video.classList.remove('is-playing'); });
    });
  }
  function scan() {
    bindVisible();
    syncVideos();
    const connection = root.navigator?.connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '') || document.hidden) return;
    document.querySelectorAll(SELECTOR).forEach(slide => {
      // On cellular, do not request high-resolution alternatives for slides
      // the visitor has not selected yet.
      if (!slide.classList.contains('active')) return;
      bindImage(slide);
      const id = String(slide.dataset.komiAnimeId || '');
      if (!/^[1-9]\d{0,9}$/.test(id)) return;
      loadMetadata(slide,id);
      const cached = getCached(id);
      if (cached) void applyArtwork(slide, cached);
      else if ((retryAfter.get(id) || 0) <= Date.now()) pending.add(id);
    });
    if (pending.size) void fetchPending();
  }

  function scheduleScan() {
    // The existing low-resolution picture must be visible immediately;
    // HD metadata and network upgrades are deliberately deferred.
    bindVisible();
    if (scanTimer !== null) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      const connection = root.navigator?.connection;
      if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
      if (document.hidden) return;
      if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(scan,{timeout:5000});
      else scan();
    }, 1800);
  }

  function selectedSlide() {
    userSelectedSlide=true;
    scan();
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleScan();
    syncVideos();
  });
  // One delegated pointer handler, only on fine pointers with motion enabled.
  if (root.matchMedia?.('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches) {
    document.addEventListener('pointermove', event => {
      const slider = event.target.closest?.('#heroSlider');
      if (!slider || !slider.closest('.komi-home-hero')) return;
      const rect = slider.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      slider.style.setProperty('--komi-hero-x', ((event.clientX-rect.left)/rect.width-.5)*-10+'px');
      slider.style.setProperty('--komi-hero-y', ((event.clientY-rect.top)/rect.height-.5)*-6+'px');
    }, {passive:true});
    document.addEventListener('pointerout', event => {
      const slider = event.target.closest?.('#heroSlider');
      if (slider && !slider.contains(event.relatedTarget)) {
        slider.style.removeProperty('--komi-hero-x');
        slider.style.removeProperty('--komi-hero-y');
      }
    }, {passive:true});
  }
  root.KomiHeroArt = {scan,selectedSlide,syncVideos};
  const container = document.getElementById('mainContainer');
  if (container) {
    new MutationObserver(scheduleScan).observe(container, {childList:true, subtree:true});
    scheduleScan();
  }
})(window);
