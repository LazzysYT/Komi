const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'home-discovery.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'home-discovery.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'app-main.js'), 'utf8');

test('only active discovery hero slide can be displayed', () => {
  assert.match(css, /\.komi-home-hero \.hero-slide\s*\{[^}]*display:none\s*;/);
  assert.match(css, /\.komi-home-hero \.hero-slide\.active\s*\{[^}]*display:flex\s*;/);
  assert.match(css, /\.komi-home-hero \.hero-dot:focus-visible/);
  assert.match(css, /\.komi-home-hero \.hero-slide\.active\{animation:none!important\}/);
});

test('discovery renders one visible slide and one selected indicator', () => {
  const scope = {};
  vm.runInNewContext(js, scope, {filename:'home-discovery.js'});
  const animeList = [1, 2, 3].map(id => ({
    id:String(id), title:'Аниме ' + id, poster:'https://example.com/' + id + '.jpg',
    shikiRating:8, year:2026, genres:['Фэнтези'], desc:'Описание'
  }));
  const result = scope.KomiHomeDiscovery.render({
    animeList, currentSlideIndex:1, currentUser:null, progress:{},
    year:a=>String(a.year), artwork:a=>a.poster, describe:desc=>desc,
    type:()=> 'Сериал', renderCard:()=>'<div></div>',
    recommendations:()=>[], calendar:()=>'', years:()=>'', intro:()=>''
  });
  assert.equal((result.match(/class="hero-slide(?: active)?"/g)||[]).length, 3);
  assert.equal((result.match(/class="hero-slide active"/g)||[]).length, 1);
  assert.equal((result.match(/aria-hidden="false"/g)||[]).length, 1);
  assert.equal((result.match(/aria-hidden="true"/g)||[]).length, 2);
  assert.equal((result.match(/class="hero-dot active"/g)||[]).length, 1);
  assert.equal((result.match(/aria-pressed="true"/g)||[]).length, 1);
  assert.match(result, /data-komi-onclick="changeSlide\(-1\)"/);
  assert.match(result, /data-komi-onclick="changeSlide\(1\)"/);
  assert.match(result, /data-komi-onclick="setSlide\(1\)"/);
  assert.match(result, /<svg viewBox="0 0 24 24"/);
});

test('manual and automatic slide updates remain scoped to heroSlider', () => {
  const body = main.slice(main.indexOf('function startHeroAutoSlide()'),
    main.indexOf('function updateProfileCollectionSearch('));
  assert.match(body, /document\.getElementById\('heroSlider'\)/);
  assert.match(body, /slider\.querySelectorAll\('\.hero-slide'\)/);
  assert.match(body, /slide\.setAttribute\('aria-hidden', String\(!active\)\)/);
  assert.match(body, /dot\.setAttribute\('aria-pressed', String\(active\)\)/);
  assert.match(body, /!Number\.isInteger\(index\)/);
  assert.doesNotMatch(body, /document\.querySelectorAll\('\.hero-slide'\)/);
});
