'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'komi-genre-moods.css'),'utf8');
const home=fs.readFileSync(path.join(root,'home-discovery.js'),'utf8');
const moods=fs.readFileSync(path.join(root,'komi-genre-moods.js'),'utf8');
test('mobile four-column dock wins final cascade and preserves destinations',()=>{
  assert.match(html,/komi-genre-moods\.css\?v=20261126-comfort/);
  assert.doesNotMatch(html,/komi-mobile-stable\.css/);
  assert.ok(css.includes('Final post-bundle layer'), 'The last stylesheet must contain stable mobile rules');
  assert.match(css,/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  for(const id of ['sideHomeBtn','sideCatalogBtn','sideListsBtn','notifBellBtn','sideFriendsBtn'])assert.ok(css.includes(id));
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/\.komi-side-account/);
});
test('off-screen mobile shelves defer paint but preserve all collection actions',()=>{
  assert.match(css,/content-visibility: auto/);
  assert.match(home,/list\.slice\(0, 7\)/);
  assert.match(home,/collectionAction\(kind\)/);
  assert.match(moods,/loading="lazy"/);
});

function moodFixture({uncached=false}={}) {
  const stringMaps=[];
  class ObservedMap extends Map {
    set(key,value) {
      super.set(key,value);
      if(typeof value==='string') {
        if(!this.stringPeak) stringMaps.push(this);
        this.stringPeak=Math.max(this.stringPeak||0,this.size);
      }
      return this;
    }
  }
  const scope={Map:ObservedMap,localeCalls:0};
  scope.window=scope;
  vm.createContext(scope);
  vm.runInContext(`
    const localeLower=String.prototype.toLocaleLowerCase;
    String.prototype.toLocaleLowerCase=function(...args) {
      globalThis.localeCalls++;
      return localeLower.apply(this,args);
    };
  `,scope);
  let source=moods;
  if(uncached) {
    // Differential oracle: run the same presentation with its original,
    // uncached locale conversion, so the complete generated HTML must agree.
    const start=source.indexOf('  const norm =');
    const end=source.indexOf('  const escape =',start);
    assert.ok(start>=0&&end>start);
    source=source.slice(0,start)+
      "  const norm = value => String(value || '').trim().toLocaleLowerCase('ru-RU');\n"+
      source.slice(end);
  }
  vm.runInContext(source,scope);
  scope.localeCalls=0;
  return {api:scope.KomiGenreMoods,scope,stringMaps};
}

test('genre label caching preserves Unicode matching and complete mood markup',()=>{
  const cached=moodFixture(), reference=moodFixture({uncached:true});
  const cases=[
    [{genres:['Боевые искусства']},'  ЭКШЕН  '],
    [{genre:'Romance'},'Романтика'],
    [{genres:['\u00a0ЁЖИК ЙОД\u00a0']},'ёжик йод'],
    [{genres:['İ']},'i\u0307'],
    [{genres:['I']},'ı'],
    [{genres:['ΟΣ']},'ος'],
    [{genres:['ẞ']},'ß'],
    [{genres:['Е\u0308']},'Ё'],
    [null,'Все'],[null,'Экшен']
  ];
  for(const [anime,genre] of cases)
    assert.equal(cached.api.matches(anime,genre),reference.api.matches(anime,genre),genre);
  const animeList=[
    {id:'1',title:'Один',genres:['Action','Романтика','Fantasy','Comedy'],shikiRating:8,poster:'https://example.test/one.jpg'},
    {id:'2',title:'Два',genres:['Horror','Sports','Isekai','Psychological'],shikiRating:9,poster:'https://example.test/two.jpg'}
  ];
  const context={animeList,genre:'  РОМАНТИКА\u00a0',
    availableGenres:['ЁЖИК & <звезда>','İ','ΟΣ','ẞ'],
    artwork:anime=>anime.poster,deferImages:true};
  const expected=reference.api.render(context);
  assert.equal(cached.api.render(context),expected);
  assert.equal(cached.api.render(context),expected,'cache hits must preserve the entire markup');
});

test('repeated catalog labels reuse locale normalization across distinct anime',()=>{
  const {api,scope}=moodFixture();
  for(let index=0;index<500;index++)
    assert.equal(api.matches({genres:['\u00a0Исекай\u00a0','İ','ЁЖИК']},'  ИСЭКАЙ  '),true);
  assert.ok(scope.localeCalls<=3,
    '500 rows sharing genre labels should convert only the three previously unseen labels');
});

test('genre normalization cache stays bounded and recomputes evicted labels correctly',()=>{
  const {api,stringMaps}=moodFixture();
  for(let index=0;index<800;index++)
    assert.equal(api.matches({genres:['ЖАНР '+index]},'жанр '+index),true);
  assert.ok(stringMaps.length>0,'the bounded label cache must be exercised');
  for(const cache of stringMaps) assert.ok(cache.stringPeak<=256);
  assert.equal(api.matches({genres:['ЖАНР 0']},'жанр 0'),true);
  assert.equal(api.matches({genres:['Isekai']},'ИСЭКАЙ'),true);
  assert.equal(api.matches({genres:['ЁЖИК']},'ёжик'),true);
});
