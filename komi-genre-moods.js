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

  function render({ animeList = [], genre = 'Все', availableGenres = [], artwork }) {
    const items = Array.isArray(animeList) ? animeList : [];
    const genres = [...new Set([...availableGenres, ...MOODS.map(item => item[0])])];
    const cards = MOODS.map(([name, description]) => {
      const candidates = items.filter(anime => matches(anime, name) &&
        (anime.banner || anime.poster || (typeof anime.screenshots?.[0] === 'string')));
      const quality = anime =>
        (typeof anime.screenshots?.[0] === 'string' ? 6 : anime.banner ? 4 : 0) +
        (Number(anime.shikiRating) || 0) / 2;
      const sourceAnime = candidates.reduce((best, anime) =>
        !best || quality(anime) > quality(best) ? anime : best, null);
      const screenshot = typeof sourceAnime?.screenshots?.[0] === 'string' ? sourceAnime.screenshots[0] : '';
      const art = sourceAnime && typeof artwork === 'function'
        ? artwork({ ...sourceAnime, banner: screenshot || sourceAnime.banner || sourceAnime.poster })
        : '';
      const selected = norm(genre) === norm(name) ||
        (name === 'Исэкай' && norm(genre) === 'исекай') ||
        (name === 'Ужасы' && norm(genre) === 'хоррор');
      return '<button type="button" class="komi-mood-card' + (selected ? ' is-selected' : '') + '"' +
        ' data-komi-mood-genre="' + escape(name) + '" aria-pressed="' + selected + '"' +
        ' aria-label="Жанр ' + escape(name) + ': ' + escape(description) + '">' +
        (art ? '<img class="komi-mood-art" src="' + escape(art) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-komi-onerror="this.style.display=\'none\'">' : '') +
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