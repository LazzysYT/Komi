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
      party.textContent = 'Смотреть вместе';
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
    // Detach the nested menu before moving remaining control groups.
    // A group containing the menu cannot be appended inside that menu.
    actions.append(more);
    const source = controls.querySelector('.komi-watch-source');
    if (source) {
      if (wrapper.querySelector('video, iframe')) {
        source.classList.add('komi-player-source-floating');
        wrapper.append(source);
      } else if (menu) menu.append(source);
      // The HUD already owns the source chooser. Keep the original select in
      // the DOM for existing source handlers, but do not render it twice.
      if (wrapper.querySelector('.komi-v4-source-trigger')) {
        source.classList.add('komi-source-duplicate');
        source.inert = true;
        source.setAttribute('aria-hidden','true');
      }
    }
    // Keep mobile source and episode controls outside the hidden legacy deck.
    let mobileDock = controls.querySelector('.komi-mobile-watch-actions');
    if (!mobileDock && root.KomiMobileSheets) {
      mobileDock = create('div','komi-mobile-watch-actions');
      const dub = create('button','komi-mobile-watch-source','♫ Озвучка');
      const episodes = create('button','komi-mobile-watch-episodes','☷ Серии');
      for (const btn of [dub,episodes]) { btn.type='button'; btn.setAttribute('aria-haspopup','dialog'); btn.setAttribute('aria-controls','komiMobileSheet'); }
      dub.addEventListener('click',()=>void root.KomiMobileSheets.openSource(dub));
      episodes.addEventListener('click',()=>void root.KomiMobileSheets.openEpisodes(episodes));
      mobileDock.append(dub,episodes);
    }
    if (mobileDock) actions.prepend(mobileDock);
    const adfree = controls.querySelector('.komi-adfree-option');
    if (adfree && menu) menu.append(adfree);
    const recovery = content.querySelector('#komiPlayerRecovery');
    if (recovery) {
      // Keep source recovery accessible when the overflow menu is closed.
      recovery.classList.remove('komi-recovery-in-menu');
      if (recovery.parentElement !== stage) stage.append(recovery);
    }
    const views = sidebar.querySelector('.komi-episode-view-toggle');
    if (views) sidebar.querySelector('.komi-episode-number-grid')?.before(views);
    const drawer = controls.querySelector('.komi-episodes-toggle');
    if (drawer) actions.append(drawer);
    const share = controls.querySelector('.komi-cinema-share');
    if (share) { share.textContent = '↗'; share.title = 'Поделиться серией'; actions.append(share); }

    // Move only remaining original actions; keep their own registered listeners.
    if (menu) {
      const leftovers = [...controls.children];
      leftovers.forEach(el => {
        if (el === more || el === source || el === adfree || el.contains(menu) || el.classList.contains('komi-cinema-action-status')) return;
        // Move each complete control group: labels, hidden state and nested menus stay intact.
        if (el.matches('button,a,details,select,label') || el.querySelector('button,a,details,select')) menu.append(el);
      });
    }
    more.querySelector('summary')?.setAttribute('title', 'Дополнительно');
    if (more.parentElement !== actions) actions.append(more);
    const feedback = controls.querySelector('.komi-cinema-action-status');
    if (feedback) actions.append(feedback);

    stage.append(heading, actions);
    controls.classList.add('komi-deck-parked');
    if (titleActions && !titleActions.children.length) titleActions.remove();

    const sideHead = sidebar.querySelector('.komi-watch-side-heading');
    const search = sidebar.querySelector('.komi-episode-search');
    if (sideHead && search) sideHead.append(search);

    // Mirror the verified, account-scoped sidebar avatar as it loads or changes.
    const account = content.querySelector('.komi-watch-rail-avatar');
    const sourceAvatar = document.getElementById('sidebarAvatarIcon');
    function syncAvatar() {
      if (!account?.isConnected || !sourceAvatar) return;
      const sourceImage = sourceAvatar.querySelector('img');
      const destination = account.querySelector('img');
      if (!sourceImage?.src) {
        destination?.remove();
        account.classList.remove('komi-has-avatar');
        return;
      }
      if (destination?.src === sourceImage.src) return;
      const image = sourceImage.cloneNode(false);
      image.removeAttribute('id');
      image.alt = '';
      image.loading = 'eager';
      image.addEventListener('error', () => {
        image.remove();
        account.classList.remove('komi-has-avatar');
      }, {once:true});
      account.replaceChildren(image);
      account.classList.add('komi-has-avatar');
    }
    syncAvatar();
    if (sourceAvatar && account) {
      const avatarObserver = new MutationObserver(syncAvatar);
      avatarObserver.observe(sourceAvatar, {childList:true,subtree:true,attributes:true,attributeFilter:['src']});
      const closeObserver = new MutationObserver(() => {
        if (!context.modal.classList.contains('active')) {
          avatarObserver.disconnect();
          closeObserver.disconnect();
        }
      });
      closeObserver.observe(context.modal,{attributes:true,attributeFilter:['class']});
      context.abort?.signal.addEventListener('abort', () => {
        avatarObserver.disconnect();closeObserver.disconnect();
      }, {once:true});
    }

    const extrasSummary = content.querySelector('.komi-clean-extras > summary');
    if (extrasSummary) extrasSummary.textContent = 'Подробнее об аниме';

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
      if (title && !title.querySelector('.komi-comments-episode-label')) {
        const number = content.querySelector('.komi-episode-number.active')?.dataset.episodeNumber;
        if (number) title.append(create('span', 'komi-comments-episode-label', ' · ' + number + ' серия'));
      }
      const field = section.querySelector('.komi-comments-input');
      if (field) {
        field.rows = 1;
        field.placeholder = 'Поделись впечатлениями о серии…';
      }
      const form = section.querySelector('.komi-comments-form');
      if (form && !form.querySelector('.komi-comment-compose-avatar')) {
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
