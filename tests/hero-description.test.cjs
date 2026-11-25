'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const description = require('../anime-description.js');
const read = file => fs.readFileSync(path.join(root,file),'utf8');

test('paired and self-contained Shikimori references keep their supplied labels and punctuation', () => {
  assert.equal(description.clean('[character=186854]Химмелем[/character] , Хайтером и Айзеном.'),
    'Химмелем, Хайтером и Айзеном.');
  assert.equal(description.clean('Император [character=68537 яхве] встречает [character=5]Ичиго[/character].'),
    'Император яхве встречает Ичиго.');
  assert.equal(description.clean('В эпицентре оказывается [character=5 ичиго-куросаки]. Ему предстоит бой.'),
    'В эпицентре оказывается ичиго-куросаки. Ему предстоит бой.');
  assert.equal(description.clean('Имя [character=5]'), 'Имя', 'a numeric ID never invents a name');
});

test('plain text removes incomplete tags and URLs, decodes entities, and never returns executable markup', () => {
  assert.equal(description.clean('[b]Tom &amp; Jerry[/b] <em>возвращаются</em> [character=1]Рем[/c'),
    'Tom & Jerry возвращаются Рем');
  assert.equal(description.clean('&laquo;Текст&#33;&raquo;&nbsp; &#x1F31F;'), '«Текст!» 🌟');
  assert.equal(description.clean('<script>alert(1)</script><style>body{display:none}</style><b>Рем</b> https://example.org'), 'Рем');
  assert.equal(description.clean('Текст <img src=x onerror=alert(1)> &lt;script&gt;alert(2)&lt;/script&gt;'), 'Текст');
});

test('excerpts end on a whole word with one ellipsis and preserve complete short descriptions', () => {
  assert.equal(description.excerpt('Одно длинноеслово затем ещё.', 12), 'Одно…');
  assert.equal(description.excerpt('Одно слово затем', 11), 'Одно слово…');
  assert.equal(description.excerpt('Короткое описание.'), 'Короткое описание.');
  assert.equal(description.excerpt('Аниме'), '');
  assert.equal(description.excerpt('anime'), '');
  assert.equal(description.excerpt('Н'.repeat(400)), '…');
});

function storefront() {
  const scope = {URL,Date}; scope.window = scope; vm.createContext(scope);
  for (const file of ['anime-description.js','komi-home-snapshot.js','komi-home-seed.js','home-discovery.js'])
    vm.runInContext(read(file),scope,{filename:file});
  const context = {animeList:scope.KomiHomeSeed,currentUser:null,currentSlideIndex:0,
    year:a=>String(a.year), type:a=>a.type, artwork:a=>a.banner || a.poster,
    renderCard:()=>'',genres:()=>''};
  return {scope,html:scope.KomiHomeDiscovery.render(context)};
}

test('the actual first-paint seed renders five clean excerpts and real score/year separators', () => {
  const {scope,html} = storefront();
  const hero = html.match(/<section class="komi-home-hero"[\s\S]*?<\/section>/)[0];
  const slides = hero.match(/<article\b[\s\S]*?<\/article>/g).filter(slide=>slide.includes('data-komi-anime-id='));
  const featured = scope.KomiHomeSnapshot.featured(scope.KomiHomeSeed,a=>a.year);
  assert.equal(slides.length,5);
  slides.forEach((slide,i) => {
    const text = slide.match(/<p class="komi-hub-description"[^>]*>(.*?)<\/p>/)[1];
    const expected = description.excerpt(featured[i].desc);
    assert.equal(text,expected);
    assert.ok(text.length <= description.HERO_LIMIT);
    assert.ok(text.endsWith('…'));
    assert.doesNotMatch(text,/\[(?:\/?character|\/?c)| \./);
    assert.match(slide,/<div class="hero-meta"><span>★ [\d.]+<\/span> · <span>2026<\/span><\/div>/);
  });
  assert.match(hero,/data-komi-promo="brand-loop"/);
  assert.match(hero,/data-komi-slide-current>01<\/strong><span>\/ 06/);
});

test('hero content is escaped once after cleaning, and missing years add no orphan separator', () => {
  const {scope} = storefront();
  // Isolate the renderer's optional metadata from featured-selection rules.
  scope.KomiHomeSnapshot = {featured:items=>items};
  const html = scope.KomiHomeDiscovery.render({animeList:[{id:'1',title:'Title',year:'',shikiRating:9,
    poster:'https://example.org/1.jpg',desc:'[b]Tom &amp; Jerry[/b] «История».',episodeCount:1}],
    currentUser:null,currentSlideIndex:0,year:()=>'',type:()=>'',artwork:a=>a.poster,renderCard:()=>'',genres:()=>''});
  assert.match(html,/<p class="komi-hub-description">Tom &amp; Jerry «История»\.<\/p>/);
  assert.match(html,/<div class="hero-meta"><span>★ 9\.0<\/span><\/div>/);
  assert.doesNotMatch(html,/Tom &amp;amp;/);
});

test('live public metadata uses the same bounded excerpt as the storefront', async () => {
  const value = '[character=5 ичиго-куросаки] возвращается. ' + 'Полное описание продолжается. '.repeat(25);
  const query = {select:()=>query,eq:()=>query,abortSignal:()=>query,
    maybeSingle:async()=>({data:{description:value},error:null})};
  const scope = vm.createContext({window:{KomiDescription:description},_supabase:{from:()=>query},
    AbortController,setTimeout:()=>1,clearTimeout:()=>{}});
  const app = read('app-main.js');
  vm.runInContext(app.slice(app.indexOf('window.komiFetchHeroMetadata ='),app.indexOf('function startHeroAutoSlide()')),scope);
  const item = await scope.window.komiFetchHeroMetadata('60636');
  assert.equal(item.description,description.excerpt(value));
  assert.ok(item.description.length <= description.HERO_LIMIT);
});
