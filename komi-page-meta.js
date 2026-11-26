/* Keep SPA navigation consistent with the public HTML served for each route. */
(function (root) {
  'use strict';
  const origin = 'https://komianime.online';
  const pages = {
    home: {
      path: '/',
      title: 'KomiAnime — смотреть аниме онлайн',
      description: 'KomiAnime (Коми Аниме) — аниме онлайн, каталог сериалов и фильмов, новые серии, поиск по жанрам и личные списки просмотра.'
    },
    catalog: {
      path: '/catalog',
      title: 'Каталог аниме — сериалы и фильмы | KomiAnime',
      description: 'Каталог KomiAnime: аниме-сериалы, фильмы, OVA и ONA. Ищите по названию, выбирайте жанр и год, смотрите информацию о сериях и сохраняйте тайтлы в свой список.'
    },
    shop: {path: '/shop', title: 'Магазин оформления — KomiAnime', description: 'Оформление профиля, аватары, рамки и другие предметы за AniCoin в KomiAnime.'},
    collection: {path: '/collection', title: 'Коллекция и кейсы — KomiAnime', description: 'Собирай персонажей любимых аниме: ежедневный бесплатный кейс и дополнительные за 50 AniCoin.'},
    partners: {path: '/partners', title: 'Партнёры — KomiAnime', description: 'Партнёры и авторы сообщества KomiAnime.'},
    profile: {path: '/profile', title: 'Профиль — KomiAnime', description: 'Профиль, личные списки просмотра и достижения в KomiAnime.'}
  };
  function metadata(view, pathname, search) {
    // Title detail and player URLs own their server-rendered anime metadata.
    if (/^\/anime\//.test(pathname || '')) return null;
    const page = pages[view];
    if (!page) return null;
    const indexable = view === 'home' || (view === 'catalog' && !search);
    return Object.assign({}, page, {
      canonical: origin + page.path,
      robots: indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow'
    });
  }
  function sync(view) {
    const doc = root.document;
    if (!doc || !root.location) return;
    const page = metadata(view, root.location.pathname, root.location.search);
    if (!page) return;
    doc.title = page.title;
    const set = (selector, attribute, value) => {
      const element = doc.querySelector(selector);
      if (element && element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
    };
    set('link[rel="canonical"]', 'href', page.canonical);
    set('meta[name="description"]', 'content', page.description);
    set('meta[name="robots"]', 'content', page.robots);
    set('meta[property="og:title"]', 'content', page.title);
    set('meta[property="og:description"]', 'content', page.description);
    set('meta[property="og:url"]', 'content', page.canonical);
    set('meta[name="twitter:title"]', 'content', page.title);
    set('meta[name="twitter:description"]', 'content', page.description);
    if (view !== 'catalog' || root.location.search) doc.getElementById('komi-catalog-schema')?.remove();
  }
  const api = {metadata, sync};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KomiPageMeta = api;
})(typeof window === 'object' ? window : {});
