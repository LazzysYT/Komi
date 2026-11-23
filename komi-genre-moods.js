/* KomiAnime · monochrome mood genres, pure presentation helpers.
 * Uses the catalog already loaded by app-main.js. No additional Supabase queries.
 */
(function (root) {
  'use strict';

  const MOODS = [
    ['Экшен', 'Драки и погони', ['Экшен', 'Боевые искусства', 'Action']],
    ['Романтика', 'Про любовь', ['Романтика', 'Romance']],
    ['Фэнтези', 'Магия и миры', ['Фэнтези', 'Fantasy']],
    ['Комедия', 'Посмеяться', ['Комедия', 'Comedy']],
    ['Ужасы', 'Для смелых', ['Ужасы', 'Хоррор', 'Horror']],
    ['Спорт', 'Командный дух', ['Спорт', 'Sports']],
    ['Исэкай', 'Попал в другой мир', ['Исэкай', 'Исекай', 'Isekai']],
    ['Психологическое', 'Игры разума', ['Психологическое', 'Психология', 'Психологический', 'Psychological']]
  ];
  const norm = value => String(value || '').trim().toLocaleLowerCase('ru-RU');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const genresOf = anime => Array.isArray(anime?.genres) ? anime.genres : [anime?.genre].filter(Boolean);
  const aliasesOf = genre => MOODS.find(([name, , aliases]) => norm(name) === norm(genre))?.[2] || [genre];

  function matches(anime, genre) {
    if (!genre || genre === 'Все') return true;
    const choices = new Set(aliasesOf(genre).map(norm));
    return genresOf(anime).some(item => choices.has(norm(item)));
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

  function render({ animeList = [], genre = 'Все', availableGenres = [], artwork }) {
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
        (name === 'Исэкай' && norm(genre) === 'исекай') ||
        (name === 'Ужасы' && norm(genre) === 'хоррор');
      const fallback = art?.direct
        ? ' data-poster-direct="' + escape(art.direct) + '" data-komi-onerror="komiCardPosterFallback(this)"'
        : ' data-komi-onerror="this.style.display=\'none\'"';
      return '<button type="button" class="komi-mood-card' + (selected ? ' is-selected' : '') + '"' +
        ' data-komi-mood-genre="' + escape(name) + '" aria-pressed="' + selected + '"' +
        ' aria-label="Жанр ' + escape(name) + ': ' + escape(description) + '">' +
        (art?.src ? '<img class="komi-mood-art" src="' + escape(art.src) +
          '" alt="" width="360" height="160" loading="eager" decoding="async" fetchpriority="' +
          (index < 4 ? 'auto' : 'low') + '" referrerpolicy="no-referrer"' + fallback + '>' : '') +
        '<span class="komi-mood-gradient" aria-hidden="true"></span>' +
        '<span class="komi-mood-copy"><strong>' + escape(name) + '</strong><small>' + escape(description) + '</small></span></button>';
    }).join('');
    const choices = genres.map(name => '<button type="button" data-komi-mood-genre="' + escape(name) + '"' +
      ' aria-pressed="' + (norm(genre) === norm(name)) + '">' + escape(name) + '</button>').join('');
    return '<section class="komi-moods" aria-labelledby="komiMoodTitle">' +
      '<div class="komi-moods-heading"><div><h2 id="komiMoodTitle">Жанры</h2>' +
      '<p>Выбери настроение на вечер</p></div>' +
      '<details class="komi-moods-all"><summary>Все жанры</summary>' +
      '<div class="komi-moods-dropdown" role="group" aria-label="Все жанры">' +
      '<button type="button" data-komi-mood-genre="Все">Сбросить жанр</button>' + choices + '</div></details></div>' +
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