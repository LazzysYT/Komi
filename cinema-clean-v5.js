/* Komi Clean Cinema V5: compact viewing screen, existing player remains authoritative.
 * No cross-origin iframe access. All account features and catalog markup stay mounted.
 */
(function (root) {
  'use strict';
  if (!root.KomiPlayerUX || typeof root.KomiPlayerUX.mount !== 'function') return;

  const previousMount = root.KomiPlayerUX.mount;
  let previousCleanup = null;

  function button(text, className, label) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = text;
    el.className = className;
    el.setAttribute('aria-label', label);
    return el;
  }

  function enhance(context, settings) {
    const { modal, content } = context;
    const layout = content?.querySelector('.watch-cinema-layout');
    const stage = layout?.querySelector('.komi-watch-stage');
    const main = stage?.querySelector('.komi-watch-main');
    const wrapper = main?.querySelector('.player-wrapper');
    const sidebar = stage?.querySelector('.komi-watch-sidebar');
    const grid = sidebar?.querySelector('.komi-episode-number-grid');
    const heading = main?.querySelector('.komi-player-heading h2');
    if (!modal || !layout || !stage || !main || !wrapper || !sidebar || !grid || !heading) return;

    const abort = new AbortController();
    const {signal} = abort;
    modal.classList.add('komi-clean-v5');
    modal.classList.toggle('komi-clean-native', !!wrapper.querySelector('video'));
    modal.classList.toggle('komi-clean-external', !!wrapper.querySelector('iframe'));
    const isActive = () => content.isConnected && modal.classList.contains('active') &&
      wrapper.isConnected;
    previousCleanup = () => { abort.abort(); modal.classList.remove('komi-clean-v5','komi-clean-native','komi-clean-external'); };

    // The authentic title metadata already exists in the DOM; never synthesize anime data.
    const footer = document.createElement('div');
    footer.className = 'komi-clean-titleline';
    const text = document.createElement('div');
    text.className = 'komi-clean-title-text';
    const title = document.createElement('h2');
    title.textContent = heading.textContent || 'KomiAnime';
    const subtitle = document.createElement('p');
    const n = Number(settings.displayNumber) || context.index + 1;
    const count = grid.querySelectorAll('.komi-episode-number').length;
    const duration = settings.episodeMeta?.[context.index]?.duration;
    let time = '';
    if (typeof duration === 'string' && /^\d{1,3}:\d{2}$/.test(duration))
      time = ' · ' + duration;
    else if (Number.isFinite(Number(duration)) && Number(duration) > 0)
      time = ' · ' + Math.floor(Number(duration) / 60) + ' мин';
    subtitle.textContent = 'Сезон ' + context.season + ' · Серия ' + n +
      (count ? ' из ' + count : '') + time;
    text.append(title,subtitle);

    const footerActions = document.createElement('div');
    footerActions.className = 'komi-clean-title-actions';
    const more = button('Описание и настройки','komi-clean-more','Открыть информацию и дополнительные настройки');
    more.setAttribute('aria-expanded','false');
    footerActions.append(more);
    footer.append(text,footerActions);
    wrapper.after(footer);

    // Keep the previous/next actions already wired by HUD V4. Show them beside
    // the title in ordinary mode, and restore them inside the HUD in fullscreen.
    const arrows = wrapper.querySelector('.komi-v4-episode-actions');
    const topActions = wrapper.querySelector('.komi-v4-top-actions');
    function placeArrows() {
      if (!arrows || !topActions) return;
      if (document.fullscreenElement === wrapper) topActions.prepend(arrows);
      else footerActions.prepend(arrows);
    }
    placeArrows();
    document.addEventListener('fullscreenchange', placeArrows, {signal});

    // Keep comments, relations, lists, source selectors and fallback actions;
    // they are simply collapsed below the viewing viewport.
    const details = document.createElement('details');
    details.className = 'komi-clean-extras';
    const summary = document.createElement('summary');
    summary.textContent = 'Описание, списки и дополнительные настройки';
    const body = document.createElement('div');
    body.className = 'komi-clean-extras-body';
    details.append(summary,body);
    const hero = layout.querySelector('.crunchy-hero-section');
    if (hero) body.append(hero);

    // Move only existing DOM nodes; never recreate handlers, authentication
    // controls or per-title data.
    for (const child of [...layout.children]) {
      if (child !== stage && child !== details) body.append(child);
    }
    for (const child of [...main.children]) {
      if (child.classList?.contains('komi-watch-controls') ||
          child.id === 'komiPlayerRecovery') body.append(child);
    }
    layout.append(details);

    more.addEventListener('click', () => {
      if (!isActive()) return;
      details.open = !details.open;
      more.setAttribute('aria-expanded',String(details.open));
      if (details.open) details.scrollIntoView({behavior:'smooth',block:'start'});
    }, {signal});
    details.addEventListener('toggle', () => {
      more.setAttribute('aria-expanded',String(details.open));
    }, {signal});

    // Search belongs beside the episode count, as in the requested reference.
    const sidebarHeading = sidebar.querySelector('.komi-watch-side-heading');
    const search = sidebar.querySelector('#komiEpisodeSearch');
    if (sidebarHeading && search) {
      const slot = document.createElement('div');
      slot.className = 'komi-clean-series-search';
      search.placeholder = 'Номер';
      slot.append(search);
      sidebarHeading.append(slot);
    }

    // Prefer compact visual episode rows for every title. Use real preview
    // images only when the catalog supplies them; otherwise display an
    // honest neutral placeholder, not invented anime frames.
    const listControl = context.viewButtons?.find(el => el.dataset?.view === 'list');
    if (listControl) listControl.click();
    for (const item of grid.querySelectorAll('.komi-episode-number')) {
      if (!item.querySelector('.komi-episode-preview')) {
        const placeholder = document.createElement('span');
        placeholder.className = 'komi-clean-episode-thumb';
        placeholder.setAttribute('aria-hidden','true');
        placeholder.textContent = item.dataset.komiEpisodeLabel || '—';
        item.prepend(placeholder);
      }
      const image = item.querySelector('.komi-episode-preview');
      if (image) image.addEventListener('error', () => {
        if (!image.isConnected) return;
        const placeholder = document.createElement('span');
        placeholder.className = 'komi-clean-episode-thumb';
        placeholder.setAttribute('aria-hidden','true');
        placeholder.textContent = item.dataset.komiEpisodeLabel || '—';
        image.replaceWith(placeholder);
      }, {once:true,signal});
    }
    grid.classList.add('komi-clean-series-list');
    const activeEpisode = grid.querySelector('.komi-episode-number.active');
    if (activeEpisode && !root.matchMedia('(prefers-reduced-motion:reduce)').matches)
      requestAnimationFrame(() => {
        if (isActive() && sidebar.classList.contains('komi-watch-sidebar'))
          activeEpisode.scrollIntoView({block:'nearest',behavior:'instant'});
      });

    // When the modal is dismissed (without opening another episode), release
    // all listeners added by this layer.
    const observer = new MutationObserver(() => {
      if (!modal.classList.contains('active')) {
        observer.disconnect();
        previousCleanup?.();
        previousCleanup = null;
      }
    });
    observer.observe(modal,{attributes:true,attributeFilter:['class']});
    signal.addEventListener('abort',()=>observer.disconnect(),{once:true});
  }

  root.KomiPlayerUX.mount = function mountCleanCinema(settings = {}) {
    previousCleanup?.();
    previousCleanup = null;
    const context = previousMount(settings);
    if (context) enhance(context, settings);
    return context;
  };
})(globalThis);
