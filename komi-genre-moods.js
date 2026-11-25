/* KomiAnime · monochrome mood genres, pure presentation helpers.
 * Uses the catalog already loaded by app-main.js. No additional Supabase queries.
 */
(function (root) {
  'use strict';

  // The Komi public projection currently has no imported Isekai labels.
  // Seed a conservative set of exact Shikimori IDs verified in the catalogue.
  // Series/parts only unless a movie carries the same transported protagonist;
  // no recaps, unrelated specials, title substrings or all-fantasy fallback.
  // Classification source for the core series: Crunchyroll's Isekai guide
  // and Anime Awards category; the IDs below are Komi's own catalogue IDs.
  const isekaiIds = new Set([
    31240, 39587, 42203, 54857, 61316, // Re:Zero
    30831, 32937, 49458, 38040, // KonoSuba
    37430, 39551, 41487, 53580, 59970, 49877, // That Time I Got Reincarnated as a Slime
    39535, 45576, 51179, 55888, 59193, // Mushoku Tensei
    29803, 35073, 37675, 48895, 48896, // Overlord
    35790, 40356, 40357, 57907, // The Rising of the Shield Hero
    32615, 49233, 37055, // Saga of Tanya the Evil
    39468, 40815, 42429, 57466, // Ascendance of a Bookworm
    37984, // So I'm a Spider, So What?
    19815, // No Game No Life
    153 // The Twelve Kingdoms
  ]);

  const MOODS = [
    ['Экшен', 'Бои и приключения', ['Экшен', 'Боевые искусства', 'Action']],
    ['Романтика', 'Любовь и отношения', ['Романтика', 'Romance']],
    ['Фэнтези', 'Магия и приключения', ['Фэнтези', 'Fantasy']],
    ['Комедия', 'Юмор и пародии', ['Комедия', 'Comedy']],
    ['Ужасы', 'Мистика и хоррор', ['Ужасы', 'Хоррор', 'Horror']],
    ['Спорт', 'Спорт и соревнования', ['Спорт', 'Sports']],
    ['Исэкай', 'Другие миры', ['Исэкай', 'Исекай', 'Isekai']],
    ['Психологическое', 'Психология и интриги', ['Психологическое', 'Психология', 'Психологический', 'Psychological']]
  ];
  const artKeys = new Map(Object.entries({
    'Экшен': 'action', 'Романтика': 'romance', 'Фэнтези': 'fantasy', 'Комедия': 'comedy',
    'Ужасы': 'horror', 'Спорт': 'sports', 'Исэкай': 'isekai', 'Психологическое': 'mind'
  }));
  // The storefront already uses this Re:Zero banner. Provide a real isekai
  // cover even when the lightweight home catalogue has no tagged isekai.
  const seedArtwork = new Map([
    ['Исэкай', 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/189046-MDk2CaVuRWpb.jpg']
  ]);
  const localArtwork = name => '/komi-mood-art.svg#' + artKeys.get(name);

  function restoreArtwork(event) {
    const image = event.target;
    const fallback = image?.getAttribute?.('data-komi-mood-fallback');
    if (!fallback || image.getAttribute('src') === fallback) return;
    const direct = image.getAttribute('data-komi-mood-direct');
    image.removeAttribute('data-komi-mood-direct');
    if (direct && image.getAttribute('src') !== direct) {
      image.src = direct;
      return;
    }
    image.removeAttribute('data-komi-lazy-src');
    image.src = fallback;
  }
  root.document?.addEventListener('error', restoreArtwork, true);

  // The same genre labels recur across thousands of catalog rows. Keep locale
  // normalization out of those repeated comparisons without retaining every
  // possible label supplied by a catalog refresh or filter.
  const normalizedLabels = new Map();
  const norm = value => {
    const text = String(value || '').trim();
    const cached = normalizedLabels.get(text);
    if (cached !== undefined) return cached;
    const normalized = text.toLocaleLowerCase('ru-RU');
    if (normalizedLabels.size >= 256) normalizedLabels.clear();
    normalizedLabels.set(text, normalized);
    return normalized;
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function genresOf(anime) {
    const labels = [anime.genres, anime.genre];
    return labels.flatMap(value => Array.isArray(value) ? value : [value])
      .flatMap(value => typeof value === 'string' ? [value]
        : value && typeof value === 'object'
          ? [value.russian, value.name, value.title].filter(label => typeof label === 'string')
          : []);
  }
  const moodAliases = new Map(MOODS.map(([name, , aliases]) => [norm(name),new Set(aliases.map(norm))]));
  const isekaiLabels = moodAliases.get('исэкай');
  const normalizedGenres = new WeakMap();

  function matches(anime, genre) {
    if (!genre || genre === 'Все') return true;
    if (!anime || typeof anime!=='object') return false;
    const key = norm(genre);
    const isIsekai = isekaiLabels.has(key);
    if (isIsekai) {
      // Public card IDs are normalized to Shikimori IDs in the catalogue loader.
      const id = anime.shikimoriId ?? anime.shikimori_id ?? anime.id;
      if ((typeof id === 'string' || typeof id === 'number') &&
          /^[1-9]\d{0,11}$/.test(String(id)) && isekaiIds.has(Number(id))) return true;
    }
    const choices = isIsekai ? isekaiLabels : moodAliases.get(key);
    const source = anime.genres, fallback = anime.genre;
    let cached = normalizedGenres.get(anime);
    // Catalog rows are replaced on refresh; also detect replaced genre arrays.
    if (!cached || cached.source !== source || cached.fallback !== fallback ||
        cached.length !== (source?.length || 0) || cached.fallbackLength !== (fallback?.length || 0)) {
      cached = {source, fallback, length: source?.length || 0, fallbackLength: fallback?.length || 0,
        values: genresOf(anime).map(norm)};
      normalizedGenres.set(anime,cached);
    }
    return choices ? cached.values.some(item => choices.has(item)) : cached.values.includes(key);
  }

  // Small, stable genre thumbnails should never request 1280px hero art.
  // The poster CDN helper only allows trusted public image origins.
  const moodArtworkCache = new Map();
  function compactArtwork(anime) {
    if (typeof root.komiValidatePosterSource !== 'function' ||
        typeof root.komiCachedPosterUrl !== 'function') return null;
    for (const raw of [anime?.banner, anime?.poster, anime?.screenshots?.[0]]) {
      const direct = root.komiValidatePosterSource(raw);
      if (direct) return {src: root.komiCachedPosterUrl(direct, 360), direct};
    }
    return null;
  }

  function render({ animeList = [], genre = 'Все', availableGenres = [], artwork, deferImages = false, navigation = false }) {
    const items = Array.isArray(animeList) ? animeList : [];
    const genres = [...new Set([...availableGenres, ...MOODS.map(item => item[0])])];
    const cards = MOODS.map(([name, description], index) => {
      // Once a genre thumbnail is chosen, never rescan 8,000+ anime on
      // every view switch, notification update or text filter redraw.
      let art = moodArtworkCache.get(name);
      if (!art && typeof artwork === 'function') {
        let sourceAnime = null;
        let selectedCompact = null;
        let bestQuality = -Infinity;
        for (const anime of items) {
          if (!matches(anime, name) ||
              !(anime.banner || anime.poster || typeof anime.screenshots?.[0] === 'string')) continue;
          const compact = compactArtwork(anime);
          const quality = (compact ? 12 : 0) +
            (typeof anime.screenshots?.[0] === 'string' ? 1 : 0) +
            (Number(anime.shikiRating) || 0) / 2;
          if (quality <= bestQuality) continue;
          sourceAnime = anime;
          selectedCompact = compact;
          bestQuality = quality;
        }
        if (sourceAnime) {
          art = selectedCompact;
          if (!art) {
            const screenshot = typeof sourceAnime.screenshots?.[0] === 'string'
              ? sourceAnime.screenshots[0] : '';
            art = {src: artwork({...sourceAnime, banner: screenshot || sourceAnime.banner || sourceAnime.poster}), direct: ''};
          }
          if (art?.src) moodArtworkCache.set(name, art);
        }
      }
      const selected = norm(genre) === norm(name) ||
        (name === 'Исэкай' && isekaiLabels.has(norm(genre))) ||
        (name === 'Ужасы' && norm(genre) === 'хоррор');
      if (!art?.src || art.src === '/anime-artwork.svg') {
        const seed = seedArtwork.get(name);
        art = seed ? compactArtwork({banner: seed}) || {src: seed, direct: seed} : null;
      }
      const fallback = localArtwork(name);
      const src = art && !deferImages ? art.src : fallback;
      const upgrade = art
        ? ' data-komi-mood-fallback="' + escape(fallback) + '"' +
          (art.direct ? ' data-komi-mood-direct="' + escape(art.direct) + '"' : '') +
          (deferImages ? ' data-komi-lazy-src="' + escape(art.src) + '"' : '')
        : '';
      const tag = navigation ? 'a' : 'button';
      return '<' + tag + (navigation ? ' href="/catalog?genre=' + encodeURIComponent(name) + '"' : ' type="button"') +
        ' class="komi-mood-card' + (selected ? ' is-selected' : '') + '"' +
        ' data-komi-mood-genre="' + escape(name) + '"' + (navigation ? '' : ' aria-pressed="' + selected + '"') +
        ' aria-label="Жанр ' + escape(name) + ': ' + escape(description) + '">' +
        '<img class="komi-mood-art" src="' + escape(src) +
        '" alt="" width="360" height="160" loading="lazy" decoding="async" fetchpriority="' +
        (index < 4 ? 'auto' : 'low') + '" referrerpolicy="no-referrer"' + upgrade + '>' +
        '<span class="komi-mood-gradient" aria-hidden="true"></span>' +
        '<span class="komi-mood-copy"><strong>' + escape(name) + '</strong><small>' + escape(description) + '</small></span></' + tag + '>';
    }).join('');
    const choices = genres.map(name => '<button type="button" data-komi-mood-genre="' + escape(name) + '"' +
      ' aria-pressed="' + (norm(genre) === norm(name)) + '">' + escape(name) + '</button>').join('');
    return '<section class="komi-moods" aria-labelledby="komiMoodTitle">' +
      '<div class="komi-moods-heading"><div><h2 id="komiMoodTitle">Жанры</h2>' +
      '<p>Аниме по жанрам</p></div>' +
      (navigation ? '<a class="komi-home-all" href="/catalog">Все жанры</a>' :
      '<details class="komi-moods-all"><summary>Все жанры</summary>' +
      '<div class="komi-moods-dropdown" role="group" aria-label="Все жанры">' +
      '<button type="button" data-komi-mood-genre="Все">Сбросить жанр</button>' + choices + '</div></details>') + '</div>' +
      '<div class="komi-moods-grid">' + cards + '</div></section>';
  }

  function toolbar({ years = [], year = 'Все', sort = 'popular', scope = 'catalog' } = {}) {
    const sorts = [['popular','Актуальные'],['updated','Новые серии'],['rating','По рейтингу'],['year','Сначала новые'],['alphabet','По алфавиту']];
    const currentSort = sorts.find(([value]) => value === sort)?.[1] || 'Актуальные';
    const yearOptions = ['Все', ...years.filter(value => value !== 'Все')];
    const option = (key, value, label, selected) =>
      '<button type="button" data-komi-quick-' + key + '="' + escape(value) + '" aria-pressed="' + selected + '">' + escape(label) + '</button>';
    return '<div class="komi-catalog-tools" role="group" aria-label="Быстрые настройки каталога">' +
      '<details class="komi-tool-menu"><summary>Сортировка: ' + escape(currentSort) + '</summary><div class="komi-tool-dropdown">' +
      sorts.map(([value,label]) => option('sort', value, label, value === sort)).join('') + '</div></details>' +
      '<details class="komi-tool-menu"><summary>' + (year === 'Все' ? 'Все годы' : 'Год: ' + escape(year)) + '</summary><div class="komi-tool-dropdown">' +
      yearOptions.map(value => option('year', value, value === 'Все' ? 'Все годы' : value, value === year)).join('') + '</div></details>' +
      '<button type="button" class="komi-tool-filters" data-komi-more-filters="' + escape(scope) + '">Все фильтры</button>' +
      '</div>';
  }

  root.KomiGenreMoods = Object.freeze({render, toolbar, matches});
})(window);
