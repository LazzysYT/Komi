/* Lightweight bridge from a crawlable /anime/:id SEO page into the Komi player.
 * The visible URL stays canonical; the main app consumes the tab-scoped intent.
 */
(function () {
  'use strict';
  const id = document.querySelector('meta[name="komi-anime-id"]')?.content || '';
  if (!/^[1-9][0-9]{0,11}$/.test(id)) return;

  const poster = document.getElementById('komiSeoPoster');
  if (poster) {
    const fallback = () => {
      if (poster.getAttribute('src') === '/anime-artwork.svg') return;
      poster.src = '/anime-artwork.svg';
    };
    poster.addEventListener('error', fallback);
    if (poster.complete && poster.naturalWidth === 0) fallback();
  }

  function openRequestedPlayer() {
    const wantsPlayer = location.hash.toLowerCase() === '#player' ||
      new URLSearchParams(location.search).get('autoplay') === '1';
    if (!wantsPlayer) return;

    try {
      sessionStorage.setItem('komi_watch_deeplink_v1', id);
    } catch {
      const message = document.getElementById('komiSeoWatchNotice');
      if (message) message.textContent = 'Не удалось автоматически открыть просмотр. Разрешите хранение данных сайта и повторите попытку.';
      return;
    }
    // A same-tab handoff opens the existing native player without a public /?anime= URL.
    window.location.replace('/');
  }
  window.addEventListener('hashchange', openRequestedPlayer);
  openRequestedPlayer();
})();
