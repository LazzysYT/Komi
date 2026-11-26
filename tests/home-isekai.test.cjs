'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'komi-genre-moods.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app-main.js'), 'utf8');
const makeContext = () => {
  const scope = {window: {}};
  vm.createContext(scope);
  vm.runInContext(source, scope);
  return scope;
};

test('identity-based isekai fallback finds known titles missing explicit tags', () => {
  const {window: {KomiGenreMoods: {matches}}} = makeContext();
  const records = [
    {id:'31240', genres:['Драма','Фэнтези','Психологическое']},
    {shikimoriId:61316, id:'new-season', genres:[]},
    {shikimori_id:30831, genres:['Комедия']},
    {id:'39535', genres:[]},
    {id:'48896', genres:['Фэнтези']}
  ];
  for (const record of records) for (const query of ['Исэкай','Исекай',' ISEKAI '])
    assert.equal(matches(record, query), true);
  assert.equal(matches({id:'52991', title:'Провожающая в последний путь Фрирен', genres:['Фэнтези']},'Исэкай'), false);
  assert.equal(matches({id:'63830', title:'Re:Zero. Перерыв с нуля 4', genres:[]},'Исэкай'), false);
  assert.equal(matches({id:'31240', shikimoriId:5114, title:'Подборка Re:Zero', genres:['Фэнтези']},'Исэкай'), false);
  assert.equal(matches({id:'600000', originalTitle:'Unverified Isekai', genre:'Фэнтези'},'Исэкай'), false);
});

test('explicit localized Isekai labels match either supported catalog spelling, including future titles', () => {
  const {window: {KomiGenreMoods: {matches}}} = makeContext();
  const scenarios = [
    {genres:[' ИсЭКай ']}, {genres:['Исекай']}, {genres:['ISEKAI']},
    {genres:[], genre:'Исекай'}, {genre:['Isekai']},
    {genres:[{id:130, name:'Isekai', russian:'Исэкай'}]},
    {genres:[{name:'Unknown', russian:'Исэкай'}]}
  ];
  for (const scenario of scenarios)
    for (const filter of ['Исэкай','Исекай'])
      assert.equal(matches({...scenario,id:'700001'},filter),true,JSON.stringify(scenario));
  assert.equal(matches({genres:[{id:62, name:'Fantasy'}]},'Исэкай'),false);
  assert.equal(matches({genres:['Isekai Documentary']},'Исэкай'),false);
  assert.equal(matches({genres:['Хоррор']},'Ужасы'),true);
  assert.equal(matches({genres:['Action']},'Экшен'),true);
});

test('guest catalog filter executes the real result pipeline on card-shaped data and preserves search', () => {
  const scope = makeContext();
  const first = app.indexOf('function komiNormalizeCatalogSearch(');
  const last = app.indexOf('function komiCatalogChipsMarkup(', first);
  assert.ok(first >= 0 && last > first);
  Object.assign(scope, {
    animeList: [
      {id:'31240', title:'Re:Zero', year:2016, genres:['Драма','Фэнтези']},
      {id:'52991', title:'Фрирен', year:2023, genres:['Фэнтези']},
      {id:'30831', title:'Этот замечательный мир!', year:2016, genres:['Комедия']},
      {id:'99997', title:'Новый тайтл', year:2027, genres:['Isekai']},
      {id:'99998', title:'Обзор Re:Zero', year:2030, genres:['Фэнтези']}
    ],
    komiAnimeYear: anime => String(anime.year),
    komiInCollection: () => true,
    catalogCollection:'all',
    catalogCategory:'all',
    catalogFilterGenre:'Исэкай',
    catalogFilterYear:'Все',
    catalogFilterType:'Все',
    catalogSort:'year',
    catalogSearchQuery:'',
    komiHideWatched:false,
    currentUser:null,
    komiCatalogRevision:0,
    komiSearchVariants(query) {return query ? [query.toLowerCase()] : [];}
  });
  vm.runInContext(app.slice(first,last),scope);
  const ids = () => Array.from(vm.runInContext('komiCatalogFiltered()',scope), item => item.id);
  assert.deepEqual(ids(), ['99997','31240','30831']);
  scope.catalogSearchQuery='re:zero';
  assert.deepEqual(ids(), ['31240']);
  scope.catalogSearchQuery='';
  scope.catalogFilterGenre='Исекай';
  scope.catalogFilterYear='2016';
  assert.deepEqual(ids(), ['31240','30831']);
});

test('home genre link keeps the deep link used by visitors', () => {
  const {window: {KomiGenreMoods}} = makeContext();
  const link = KomiGenreMoods.render({navigation:true});
  assert.ok(link.includes(`href="/catalog?genre=${encodeURIComponent('Исэкай')}"`));
});
