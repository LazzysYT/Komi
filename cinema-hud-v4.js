/* Komi Cinema HUD V4.
 * Site-owned controls surround the media surface; no access to cross-origin iframe DOM.
 * Episodes and sources use the existing verified catalog and player lifecycle.
 */
(function (root) {
  'use strict';
  if (!root.KomiPlayerUX || typeof root.KomiPlayerUX.mount !== 'function') return;
  const previousMount = root.KomiPlayerUX.mount;
  let active = null;
  let activeAbort = null;
  let idleTimer = null;

  function button(text, className, label) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.textContent = text;
    if (label) el.setAttribute('aria-label', label);
    return el;
  }

  function stillCurrent(ctx) {
    return active === ctx && ctx.content.isConnected &&
      ctx.modal.classList.contains('active') &&
      ctx.wrapper.isConnected;
  }

  function cleanup() {
    activeAbort?.abort();
    activeAbort = null;
    clearTimeout(idleTimer);
    idleTimer = null;
    if (active?.wrapper) active.wrapper.classList.remove('komi-v4-idle');
    active = null;
  }

  function enhance(ctx, settings) {
    const wrapper = ctx.content.querySelector('.player-wrapper');
    const sourceSelect = ctx.content.querySelector('#komiWatchSourceSelect');
    const heading = ctx.content.querySelector('.komi-player-heading');
    if (!wrapper || !sourceSelect || !heading) return;
    ctx.wrapper = wrapper;
    active = ctx;
    activeAbort = new AbortController();
    const signal = activeAbort.signal;
    const external = !!wrapper.querySelector('iframe');
    const video = wrapper.querySelector('video');
    wrapper.classList.add('komi-v4-surface');
    wrapper.classList.toggle('komi-v4-external', external);

    const shade = document.createElement('div');
    shade.className = 'komi-v4-shade';
    shade.setAttribute('aria-hidden', 'true');
    const hud = document.createElement('div');
    hud.className = 'komi-v4-hud';
    hud.setAttribute('aria-label', 'Интерфейс KomiAnime');

    const top = document.createElement('div');
    top.className = 'komi-v4-top';
    const picker = document.createElement('div');
    picker.className = 'komi-v4-picker';
    const pickerButton = button(sourceSelect.selectedOptions[0]?.textContent || 'Источник',
      'komi-v4-pill komi-v4-source-trigger', 'Выбрать озвучку или источник видео');
    pickerButton.setAttribute('aria-expanded', 'false');
    pickerButton.setAttribute('aria-controls', 'komi-v4-source-options');
    const pickerMenu = document.createElement('div');
    pickerMenu.id = 'komi-v4-source-options';
    pickerMenu.className = 'komi-v4-source-menu';
    pickerMenu.setAttribute('role', 'group');
    pickerMenu.setAttribute('aria-label', 'Доступные источники');
    pickerMenu.hidden = true;

    function closePicker(restoreFocus) {
      pickerMenu.hidden = true;
      pickerButton.setAttribute('aria-expanded', 'false');
      if (restoreFocus) pickerButton.focus();
    }
    const choices = Array.from(sourceSelect.options).filter(option => option.value !== 'Недоступно');
    for (const option of choices) {
      const item = button(option.textContent, 'komi-v4-source-choice',
        'Выбрать источник ' + option.textContent);
      item.setAttribute('aria-pressed', String(option.value === sourceSelect.value));
      item.addEventListener('click', () => {
        closePicker(false);
        if (option.value === sourceSelect.value || !stillCurrent(ctx)) return;
        if (typeof root.changePlayerSource === 'function')
          root.changePlayerSource(ctx.animeId, ctx.season, ctx.index, option.value);
      }, { signal });
      pickerMenu.append(item);
    }
    pickerButton.disabled = choices.length < 2;
    pickerButton.title = pickerButton.disabled ? 'Доступен один источник' : 'Сменить источник';
    pickerButton.addEventListener('click', () => {
      const opening = pickerMenu.hidden;
      pickerMenu.hidden = !opening;
      pickerButton.setAttribute('aria-expanded', String(opening));
      if (opening) pickerMenu.querySelector('button')?.focus();
    }, { signal });
    picker.append(pickerButton, pickerMenu);

    const topActions = document.createElement('div');
    topActions.className = 'komi-v4-top-actions';
    const drawerButton = button('☷ Серии', 'komi-v4-pill komi-v4-drawer', 'Открыть список серий');
    drawerButton.addEventListener('click', async () => {
      if (!stillCurrent(ctx)) return;
      if (document.fullscreenElement === wrapper) {
        try { await document.exitFullscreen(); } catch {}
      }
      const toggle = ctx.content.querySelector('.komi-episodes-toggle');
      if (!toggle) return;
      if (ctx.modal.classList.contains('komi-episodes-collapsed')) toggle.click();
      else if (document.fullscreenElement === wrapper) toggle.click();
      ctx.sidebar?.querySelector('.komi-episode-number.active')?.scrollIntoView?.({
        block: 'nearest', behavior: 'smooth'
      });
    }, { signal });
    const fullscreen = button('⛶', 'komi-v4-pill komi-v4-fullscreen', 'Видео на весь экран');
    const canFullscreen = typeof wrapper.requestFullscreen === 'function' &&
      document.fullscreenEnabled !== false;
    fullscreen.disabled = !canFullscreen;
    fullscreen.addEventListener('click', async () => {
      if (!stillCurrent(ctx)) return;
      try {
        if (document.fullscreenElement === wrapper) await document.exitFullscreen();
        else await wrapper.requestFullscreen();
      } catch {
        ctx.note && (ctx.note.textContent = 'Полноэкранный режим недоступен в этом браузере.');
      }
    }, { signal });
    topActions.append(drawerButton, fullscreen);
    top.append(picker, topActions);

    const bottom = document.createElement('div');
    bottom.className = 'komi-v4-bottom';
    const info = document.createElement('div');
    info.className = 'komi-v4-info';
    const title = document.createElement('strong');
    title.textContent = heading.querySelector('h2')?.textContent || 'KomiAnime';
    const episode = document.createElement('span');
    const number = Number(settings.displayNumber) || ctx.index + 1;
    const total = ctx.content.querySelectorAll('.komi-episode-number-grid .komi-episode-number').length;
    episode.textContent = 'Сезон ' + ctx.season + ' · Серия ' + number + (total ? ' из ' + total : '');
    info.append(title, episode);
    const epActions = document.createElement('div');
    epActions.className = 'komi-v4-episode-actions';
    const previous = button('‹', 'komi-v4-circle', 'Предыдущая серия');
    previous.disabled = ctx.index <= 0;
    previous.addEventListener('click', () => {
      if (stillCurrent(ctx) && ctx.index > 0 && typeof root.openWatchModal === 'function')
        root.openWatchModal(ctx.animeId, ctx.season, ctx.index - 1);
    }, { signal });
    const next = button('›', 'komi-v4-circle komi-v4-next', 'Следующая серия');
    next.disabled = !ctx.hasNext;
    next.addEventListener('click', () => {
      if (stillCurrent(ctx) && ctx.hasNext && typeof root.openWatchModal === 'function')
        root.openWatchModal(ctx.animeId, ctx.season, ctx.index + 1);
    }, { signal });
    epActions.append(previous, next);
    bottom.append(info, epActions);
    hud.append(top, bottom);
    wrapper.append(shade, hud);

    document.addEventListener('pointerdown', event => {
      if (!picker.contains(event.target)) closePicker(false);
    }, { signal });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !pickerMenu.hidden) {
        event.stopPropagation();
        closePicker(true);
      }
    }, { signal });

    // A cross-origin iframe cannot forward mouse movement to the host.
    // Never auto-hide its controls, otherwise users could not recover them.
    function wakeHud() {
      wrapper.classList.remove('komi-v4-idle');
      clearTimeout(idleTimer);
      if (video && document.fullscreenElement === wrapper) {
        idleTimer = setTimeout(() => {
          if (stillCurrent(ctx) && document.fullscreenElement === wrapper &&
              !wrapper.matches(':focus-within') && pickerMenu.hidden)
            wrapper.classList.add('komi-v4-idle');
        }, 3200);
      }
    }
    wrapper.addEventListener('pointermove', wakeHud, { passive: true, signal });
    wrapper.addEventListener('focusin', wakeHud, { signal });
    document.addEventListener('fullscreenchange', () => {
      fullscreen.setAttribute('aria-label', document.fullscreenElement === wrapper ?
        'Выйти из полноэкранного режима' : 'Видео на весь экран');
      wakeHud();
    }, { signal });
    wakeHud();
  }

  root.KomiPlayerUX.mount = function mountCinemaHud(settings = {}) {
    cleanup();
    const context = previousMount(settings);
    if (context) enhance(context, settings);
    return context;
  };
})(globalThis);
