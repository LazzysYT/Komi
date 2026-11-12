/* Static HTML actions: one strict allowlist, never eval/Function.
 * Event delegation works for the inert admin template when it is activated.
 * Can be kept unchanged when CSP script-src-attr is eventually 'none'.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  function sound() { if (typeof playSound === 'function') playSound(); }
  function withSound(callback) { sound(); return callback(); }
  function act(kind, action, event, element) {
    switch (kind + ':' + action) {
      case 'click:nav-home': return withSound(() => navigate('home'));
      case 'click:nav-catalog': return withSound(() => navigate('catalog'));
      case 'click:notifications': return withSound(() => toggleNotifications());
      case 'click:notifications-read': return markNotificationsRead();
      case 'click:random': return withSound(() => randomAnimeWithAnimation());
      case 'click:watch-party': return withSound(() => openWatchPartyHub());
      case 'click:admin-panel': return withSound(() => openAdminPanel());
      case 'click:anime-add': return withSound(() => openAddModal());
      case 'click:shop': return openAniCoinShop();
      case 'click:friends': return withSound(() => toggleFriendsDrawer());
      case 'click:partners': return withSound(() => navigate('partners'));
      case 'click:profile': return withSound(() => {
        if (typeof currentUser !== 'undefined' && currentUser)
          return openProfile(currentUser.username);
        return openAuthModal('login');
      });
      case 'click:friends-close': return closeFriendsDrawer();
      case 'click:friends-all': return setFriendsDrawerTab('all');
      case 'click:friends-following': return setFriendsDrawerTab('friends');
      case 'click:anime-close': return withSound(() => closeAddModal());
      case 'click:anime-search': return searchAnimeFromAPI();
      case 'click:anime-import': return importTopSeasonalAnime();
      case 'click:episode-add': return withSound(() => addEpisodeField());
      case 'click:sound': return sound();
      case 'click:auth-close': return withSound(() => closeAuthModal());
      case 'click:auth-login': return withSound(() => switchAuthTab('login'));
      case 'click:auth-register': return withSound(() => switchAuthTab('register'));
      case 'click:auth-google': return showGoogleAuthInfo();
      case 'click:random-try': return randomAnimeWithAnimation();
      case 'click:random-close': return closeKomiRoulette();
      case 'input:search-input': return handleInstantSearch(element.value);
      case 'input:friends-search': return renderFriendsDrawer();
      case 'focus:search-focus': return showSearchDropdown();
      case 'error:poster-error': return komiCardPosterFallback(element);
      case 'submit:anime-submit': return saveAnimeForm(event);
      case 'submit:login-submit': return handleLoginSubmit(event);
      case 'submit:register-submit': return handleRegisterSubmit(event);
      default: return undefined;
    }
  }
  function delegate(kind, event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const el = target.closest('[data-komi-' + kind + ']');
    if (!el) return;
    const action = el.getAttribute('data-komi-' + kind);
    if (!action) return;
    const result = act(kind, action, event, el);
    if (result && typeof result.then === 'function')
      result.catch(error => console.error('Komi UI action failed:',kind,action,error));
  }
  for (const type of ['click','input','submit','focus','error'])
    document.addEventListener(type, event=>delegate(type,event), type==='focus'||type==='error');
  // An image may have failed before this script attached the capturing error listener.
  for (const image of document.querySelectorAll('img[data-komi-error="poster-error"]')) {
    if (image.complete && image.naturalWidth===0 && typeof komiCardPosterFallback === 'function')
      komiCardPosterFallback(image);
  }
})();
