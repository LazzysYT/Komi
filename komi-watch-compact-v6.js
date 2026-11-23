/* Compact watch layout: presentation adapter around the existing player, Supabase and Watch Party handlers. */
(function (root) {
  'use strict';
  if (typeof root.KomiPlayerUX?.mount !== 'function') return;

  const previousMount = root.KomiPlayerUX.mount;
  const create = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  };

  function refineWatch(context, settings = {}) {
    const content = context?.content;
    const stage = content?.querySelector('.komi-watch-stage');
    const wrapper = stage?.querySelector('.player-wrapper');
    const heading = content?.querySelector('.komi-player-heading');
    const controls = stage?.querySelector('.komi-watch-controls');
    const sidebar = stage?.querySelector('.komi-watch-sidebar');
    if (!wrapper || !heading || !controls || !sidebar) return;

    const logo = content.querySelector('.komi-watch-rail-logo');
    if (logo) {
      logo.textContent = 'K';
      logo.title = 'KomiAnime — на главную';
    }

    const titleActions = heading.querySelector('.komi-title-actions');
    const rating = titleActions?.querySelector('.komi-title-rating');
    const summaryLine = heading.querySelector('p');
    if (rating && summaryLine) {
      rating.textContent = ' · Рейтинг ' + rating.textContent.trim();
      summaryLine.append(rating);
    }

    const navigation = controls.querySelector('.komi-episode-navigation');
    if (navigation) {
      navigation.querySelectorAll('.komi-watch-navbtn').forEach((btn, index) => {
        btn.textContent = index ? '›' : '‹';
        btn.title = index ? 'Следующая серия' : 'Предыдущая серия';
      });
      heading.append(navigation);
    }

    const actions = create('div', 'komi-watch-quick-actions');
    const status = titleActions?.querySelector('.komi-status-picker');
    const favorite = titleActions?.querySelector(':scope > button');
    if (status) {
      status.classList.add('komi-compact-list');
      actions.append(status);
      // A direct child is the favorite control; nested status buttons must stay
      // in the status picker. Move the *original* button, retaining its handler.
      if (favorite) {
        favorite.classList.add('komi-compact-favorite');
        favorite.setAttribute('aria-pressed', String(/В избранном/.test(favorite.textContent)));
        actions.append(favorite);
      }
    } else if (favorite) {
      favorite.classList.add('komi-compact-favorite');
      actions.append(favorite);
    }

    const party = controls.querySelector('.komi-cinema-party');
    if (party) {
      party.textContent = '♧ Смотреть вместе';
      actions.append(party);
    }

    let more = controls.querySelector('.komi-deck-more');
    if (!more) {
      more = create('details', 'komi-deck-more');
      const trigger = create('summary', '', '•••');
      trigger.setAttribute('aria-label', 'Дополнительные действия');
      more.append(trigger, create('div', 'komi-deck-menu'));
    }
    const menu = more.querySelector('.komi-deck-menu');
    const source = controls.querySelector('.komi-watch-source');
    if (source) {
      source.classList.add('komi-player-source-floating');
      wrapper.append(source);
    }
    const adfree = controls.querySelector('.komi-adfree-option');
    if (adfree && menu) menu.append(adfree);
    const recovery = content.querySelector('#komiPlayerRecovery');
    if (recovery && menu) {
      recovery.classList.add('komi-recovery-in-menu');
      menu.append(recovery);
    }
    const views = sidebar.querySelector('.komi-episode-view-toggle');
    if (views && menu) menu.append(views);

    // Move only remaining original actions; keep their own registered listeners.
    if (menu) {
      const leftovers = controls.querySelectorAll('button, a, details, select');
      leftovers.forEach(el => {
        if (el === more || more.contains(el) || source?.contains(el) || adfree?.contains(el)) return;
        menu.append(el);
      });
    }
    more.querySelector('summary')?.setAttribute('title', 'Дополнительно');
    actions.append(more);
    const feedback = controls.querySelector('.komi-cinema-action-status');
    if (feedback) actions.append(feedback);

    stage.append(heading, actions);
    controls.classList.add('komi-deck-parked');
    if (titleActions && !titleActions.children.length) titleActions.remove();

    const sideHead = sidebar.querySelector('.komi-watch-side-heading');
    const search = sidebar.querySelector('.komi-episode-search');
    if (sideHead && search) sideHead.append(search);

    // Keep real episode stills provided by cinema-layout-v3. A fallback must be
    // a landscape screenshot/banner, NEVER the cropped vertical cover poster.
    const safeStill = raw => {
      try {
        const url = new URL(String(raw || ''));
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
      } catch { return ''; }
    };
    const wideStill = safeStill(settings.watchStill) || safeStill(settings.watchBanner);
    sidebar.querySelectorAll('.komi-episode-list .komi-episode-number').forEach(button => {
      const placeholder = button.querySelector('.komi-episode-placeholder');
      if (!placeholder) return; // An actual per-episode preview is already present.
      const frame = create('span', 'komi-episode-fallback-frame');
      const number = create('span', 'komi-episode-fallback-number',
        button.dataset.episodeNumber || placeholder.textContent.trim());
      frame.append(number);
      if (wideStill) {
        const image = create('img', 'komi-episode-fallback-image');
        image.src = wideStill;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => image.remove(), {once:true});
        frame.prepend(image);
      }
      placeholder.replaceWith(frame);
    });

    // The follow control is mounted asynchronously by app-main.js; moving the
    // existing button preserves its Supabase subscriptions and click handler.
    function attachBell() {
      if (!sideHead?.isConnected) return;
      const host = content.querySelector('.komi-episode-follow-control');
      if (!host) return;
      if (host.parentElement !== sideHead) sideHead.append(host);
      host.removeAttribute('style');
      host.querySelector('button')?.setAttribute('aria-label', host.querySelector('button')?.textContent || 'Уведомления о новых сериях');
    }
    attachBell();
    const bellObserver = new MutationObserver(attachBell);
    bellObserver.observe(content, {childList:true,subtree:true,characterData:true});
    context.abort?.signal.addEventListener('abort', () => bellObserver.disconnect(), {once:true});

    const closeMenus = event => {
      for (const details of content.querySelectorAll('.komi-deck-more[open], .komi-status-picker[open]')) {
        if (event.type === 'keydown' || !details.contains(event.target)) details.open = false;
      }
    };
    document.addEventListener('pointerdown', closeMenus, context.abort?.signal ? {signal:context.abort.signal} : undefined);
    content.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenus(event);
    }, context.abort?.signal ? {signal:context.abort.signal} : undefined);
  }

  root.KomiPlayerUX.mount = function mountCompactWatch(settings = {}) {
    const context = previousMount(settings);
    if (context) refineWatch(context, settings);
    return context;
  };

  if (root.KomiComments && typeof root.KomiComments.mount === 'function') {
    const previousCommentsMount = root.KomiComments.mount;
    root.KomiComments.mount = function mountInlineComments(animeId) {
      const result = previousCommentsMount(animeId);
      const content = document.getElementById('watchModalContent');
      const stage = content?.querySelector('.komi-watch-stage');
      const section = content?.querySelector('#komiAnimeComments');
      if (!stage || !section) return result;
      stage.append(section);
      const title = section.querySelector('.komi-comments-heading');
      if (title) title.append(create('span', 'komi-comments-episode-label', ' · ' + (Number(root.komiActiveEpisode) + 1 || 1) + ' серия'));
      const field = section.querySelector('.komi-comments-input');
      if (field) {
        field.rows = 1;
        field.placeholder = 'Что думаешь об этой серии? Спойлеры: ||текст||';
      }
      const form = section.querySelector('.komi-comments-form');
      if (form) {
        const avatar = create('span', 'komi-comment-compose-avatar', 'K');
        avatar.setAttribute('aria-hidden','true');
        const existing = document.querySelector('#sidebarAvatarIcon img');
        if (existing?.src) {
          const img = existing.cloneNode(false);
          img.alt = '';
          avatar.replaceChildren(img);
        }
        form.prepend(avatar);
        // The author is determined by Supabase; the explanatory debug text
        // is redundant for a signed-in user, but login help stays visible.
        const hint = form.querySelector('.komi-comments-actions small');
        if (hint?.textContent?.includes('Имя берётся из твоего профиля')) hint.remove();
      }
      return result;
    };
  }

  // A detail action opens the existing anime details accordion; the card itself
  // still opens the episode normally, including on touch screens.
  document.addEventListener('click', event => {
    const detail = event.target.closest?.('[data-komi-card-detail]');
    if (!detail) return;
    event.preventDefault();
    event.stopPropagation();
    const id = detail.closest('.anime-card')?.dataset.komiAnimeId;
    if (!/^[1-9][0-9]{0,14}$/.test(String(id || '')) || typeof root.openWatchModal !== 'function') return;
    Promise.resolve(root.openWatchModal(id)).then(() => {
      const pane = document.querySelector('#watchModal .komi-clean-extras');
      if (!pane) return;
      pane.open = true;
      pane.scrollIntoView({block:'start',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    }).catch(error => console.warn('Komi details:',error));
  }, true);
})(globalThis);
