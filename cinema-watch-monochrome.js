/* KomiAnime: monochrome watch-page enhancement; preserve live playback and handlers. */
(function (root) {
  'use strict';
  if (typeof root.KomiPlayerUX?.mount !== 'function') return;
  const originalMount = root.KomiPlayerUX.mount;
  const make = (tag, className, label) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (label) element.textContent = label;
    return element;
  };
  function makeDetails(className, label) {
    const details = make('details', className);
    details.append(make('summary', '', label));
    return details;
  }
  root.KomiPlayerUX.mount = function mountMonochromeWatch(settings = {}) {
    const context = originalMount(settings);
    const content = context?.content;
    const layout = content?.querySelector('.watch-cinema-layout');
    const stage = layout?.querySelector('.komi-watch-stage');
    const controls = stage?.querySelector('.komi-watch-controls');
    const heading = content?.querySelector('.komi-player-heading');
    const sidebar = stage?.querySelector('.komi-watch-sidebar');
    if (!stage || !controls || !heading || !sidebar) return context;
    const find = selector => content.querySelector(selector);
    const signal = context.abort?.signal;
    const addListener = (element, type, callback, options = {}) => {
      if (element) element.addEventListener(type, callback, signal ? {...options, signal} : options);
    };

    layout.prepend(heading);
    const left = make('div', 'komi-deck-source');
    const right = make('div', 'komi-deck-actions');
    const source = find('.komi-watch-source');
    const approved = find('.komi-adfree-option');
    if (source) left.append(source);
    if (approved) left.append(approved); // Keep the site's strict ad-free option.
    const navigation = find('.komi-episode-navigation');
    if (navigation) {
      const buttons = navigation.querySelectorAll('.komi-watch-navbtn');
      if (buttons[0]) buttons[0].textContent = '‹ Пред';
      if (buttons[1]) buttons[1].textContent = 'След ›';
      right.append(navigation);
    }
    const party = find('.komi-cinema-party');
    if (party) { party.textContent = 'Watch Party'; right.append(party); }
    const toolbar = find('.komi-cinema-toolbar');
    const lights = toolbar?.querySelector('.komi-cinema-lights');
    if (lights) { lights.textContent = 'Свет'; right.append(lights); }
    const drawer = find('.komi-episodes-toggle');
    if (drawer) right.append(drawer);
    const share = find('.komi-cinema-share');
    if (share) { share.textContent = 'Поделиться'; right.append(share); }

    const more = makeDetails('komi-deck-more', '⋯');
    more.firstElementChild.setAttribute('aria-label', 'Дополнительные действия плеера');
    const menu = make('div', 'komi-deck-menu');
    for (const selector of ['.komi-watch-expand', '.komi-cinema-skip', '.komi-cinema-shortcuts', '.komi-cinema-external-note']) {
      const element = find(selector);
      if (element) menu.append(element);
    }
    if (toolbar) {
      for (const child of [...toolbar.children]) menu.append(child);
      if (toolbar.isConnected) toolbar.remove();
    }
    const recovery = find('#komiPlayerRecovery');
    const recoveryActions = recovery?.querySelector('div');
    if (recoveryActions) {
      for (const child of [...recoveryActions.children]) menu.append(child);
      recoveryActions.remove();
    }
    if (menu.children.length) { more.append(menu); right.append(more); }
    const note = find('.komi-cinema-action-status');
    controls.replaceChildren(left, right);
    if (note) controls.append(note);
    stage.append(controls);
    if (recovery) stage.append(recovery);

    const sideHeading = sidebar.querySelector('.komi-watch-side-heading');
    const episodeSearch = sideHeading?.querySelector('.komi-episode-search');
    const views = find('.komi-episode-view-toggle');
    if (sideHeading && views) sideHeading.append(views);
    if (sideHeading && episodeSearch) sideHeading.after(episodeSearch);

    const titleActions = make('div', 'komi-title-actions');
    const statusRow = find('[data-watch-status]')?.parentElement;
    if (statusRow) {
      const status = makeDetails('komi-status-picker', 'В список');
      status.append(statusRow);
      titleActions.append(status);
      const paintStatus = () => {
        status.firstElementChild.textContent = statusRow.querySelector('[aria-pressed="true"]')?.textContent.trim() || 'В список';
      };
      paintStatus();
      const observer = new MutationObserver(paintStatus);
      observer.observe(statusRow, {subtree:true, attributes:true, attributeFilter:['aria-pressed']});
      if (signal) signal.addEventListener('abort', () => observer.disconnect(), {once:true});
    }
    const meta = layout.querySelector('.komi-watch-meta');
    const rating = meta?.querySelector('span');
    if (rating) { rating.classList.add('komi-title-rating'); titleActions.append(rating); }
    const favorite = meta?.querySelector('button:not(#komiWatchDetailsParty)');
    if (favorite) titleActions.append(favorite);
    if (titleActions.children.length) heading.append(titleActions);

    const extras = layout.querySelector('.komi-clean-extras');
    if (extras) stage.after(extras);
    // Preserve the original Party button for its post-mount event registration.
    const updateProgress = () => {
      const video = context.video;
      const fraction = video && Number.isFinite(video.duration) && video.duration > 0
        ? Math.max(0, Math.min(1, video.currentTime / video.duration)) : 0;
      sidebar.querySelector('.komi-episode-number.active')?.style.setProperty('--episode-progress', (fraction * 100) + '%');
    };
    addListener(context.video, 'timeupdate', updateProgress);
    addListener(context.video, 'loadedmetadata', updateProgress);
    updateProgress();
    addListener(document, 'pointerdown', event => {
      for (const details of content.querySelectorAll('.komi-deck-more[open], .komi-status-picker[open]')) {
        if (!details.contains(event.target)) details.open = false;
      }
    });
    addListener(content, 'keydown', event => {
      if (event.key !== 'Escape') return;
      const expanded = content.querySelector('.komi-deck-more[open], .komi-status-picker[open]');
      if (expanded) {
        event.preventDefault();
        event.stopPropagation();
        expanded.open = false;
        expanded.firstElementChild?.focus();
      }
    }, {capture:true});
    return context;
  };
})(globalThis);
