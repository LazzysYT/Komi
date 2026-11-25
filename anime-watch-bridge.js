/* Lightweight bridge from a crawlable /anime/:id SEO page into the Komi player.
 * The visible URL stays canonical; the main app consumes the tab-scoped intent.
 */
(function () {
  'use strict';
  const id = document.querySelector('meta[name="komi-anime-id"]')?.content || '';
  if (!/^[1-9][0-9]{0,11}$/.test(id)) return;

  const poster = document.getElementById('komiSeoPoster');
  if (poster) {
    const direct = poster.getAttribute('data-poster-direct') || '';
    let triedDirect = false;
    const fallback = () => {
      if (poster.getAttribute('src') === '/anime-artwork.svg') return;
      if (!triedDirect && /^https:\/\//i.test(direct)) {
        triedDirect = true;
        poster.src = direct;
        return;
      }
      poster.src = '/anime-artwork.svg';
    };
    poster.addEventListener('error', fallback);
    if (poster.complete && poster.naturalWidth === 0) fallback();
  }

  function openRequestedPlayer() {
    const wantsPlayer = location.hash.toLowerCase() === '#player' ||
      new URLSearchParams(location.search).get('autoplay') === '1';
    if (!wantsPlayer) return;

    const params = new URLSearchParams(location.search);
    const destination = new URLSearchParams({anime:id});
    const season = params.get('season'), episode = params.get('episode');
    if (/^[1-9][0-9]{0,5}$/.test(episode || '')) {
      if (/^[1-9][0-9]{0,5}$/.test(season || '')) destination.set('season',season);
      destination.set('episode',episode);
    }
    // Temporary same-tab handoff; the main application restores the canonical path.
    window.location.replace('/?' + destination.toString());
  }
  window.addEventListener('hashchange', openRequestedPlayer);
  openRequestedPlayer();
})();
