'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fixture(){
 const scope={URL,Date,Map,Set,escapeFriendHtml:escape,
  komiAnimeYear:a=>String(a.year),komiCatalogType:a=>a.type,
  komiCardPosterSource:raw=>({preferred:raw}),currentView:'home'};
 scope.window=scope;vm.createContext(scope);
 for(const name of ['player-core.js','komi-genre-moods.js','home-release-shelves.js','home-discovery.js'])
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),scope,{filename:name});
 vm.runInContext(app.slice(app.indexOf('function renderCard('),app.indexOf('let komiRouletteRun')),scope);
 const animeList=Array.from({length:10},(_,i)=>({id:String(i+1),title:'Название '+(i+1),year:2026,type:'Сериал',
  poster:'https://example.org/'+i+'.jpg',desc:i?'': 'Аниме',shikiRating:8.6-i/10,episodeCount:12,genres:['Экшен'],episodes:[]}));
 const context={animeList,catalogRevision:1,currentUser:null,resumeReady:true,progress:{},
  renderCard:scope.renderCard,year:scope.komiAnimeYear,type:scope.komiCatalogType,artwork:a=>a.banner||a.poster,
  describe:value=>value||'',genres:()=>scope.KomiGenreMoods.render({animeList,navigation:true}),schedule:new Map(),now:Date.now()};
 return {scope,context,animeList,render:()=>scope.KomiHomeDiscovery.render(context)};
}
test('guest home contains one discovery sequence and no catalog grid, filters, account prompts or leaderboard',()=>{
 const f=fixture(),html=f.render();
 const order=['komi-home-hero','komi-home-popular','komi-home-genres-section','komi-home-upcoming'];
 const offsets=order.map(value=>html.indexOf(value));
 assert.ok(offsets.every((value,index)=>value>=0 && (!index || value>offsets[index-1])));
 assert.doesNotMatch(html,/komi-home-continue|komi-hub-resume|komi-resume-loading|komiLeaderboard|komi-hub-catalog-preview|class="anime-grid"|Все фильтры|Войдите/);
 assert.match(html,/<h2>Рекомендуем<\/h2>/);
 assert.match(html,/По оценкам Shikimori и свежести обновлений/);
 assert.doesNotMatch(html,/Популярное прямо сейчас|Топ зрителей|На один вечер/);
});
test('unfinished history uses original owner, slot and time; zero/completed/foreign entries remain hidden',()=>{
 const f=fixture(); f.context.currentUser={username:'owner',authUserId:'uid-a'};
 const p={season:2,index:3,time:143,duration:1440,updated:200};
 f.context.progress={owner_1:p,owner_2:{...p,time:0,updated:500},owner_3:{...p,time:1438,updated:600},other_4:p};
 const items=f.scope.KomiHomeDiscovery.recentProgress(f.context,f.animeList);
 assert.equal(items.length,1);assert.equal(items[0].p,p);
 const html=f.render();
 assert.ok(html.indexOf('komi-home-continue')>html.indexOf('komi-home-hero'));
 assert.ok(html.indexOf('komi-home-continue')<html.indexOf('komi-home-popular'));
 assert.match(html,/resumeKomiAnime\(&#39;1&#39;\)|resumeKomiAnime\('1'\)/);
 assert.match(html,/Сезон 2 · Серия 4 · 2:23/);
 assert.equal((html.match(/class="komi-home-progress-card"/g)||[]).length,1);
 assert.doesNotMatch(html,/Убрать|Удалить прогресс/);
});
test('cached owner snapshot applies same unfinished boundary before limiting',()=>{
 const f=fixture(),p={season:1,index:0,time:22,duration:120,updated:100};
 f.context.currentUser={username:'owner',authUserId:'uid-a'};f.context.resumeReady=false;
 f.context.resumePreview=[{anime:f.animeList[0],p:{...p,time:0}},{anime:f.animeList[1],p:{...p,time:115}},{anime:f.animeList[2],p:{...p,duration:0}}];
 assert.deepEqual(Array.from(f.scope.KomiHomeDiscovery.recentProgress(f.context,[]),x=>x.anime.id),['3']);
 f.context.currentUser=null;assert.equal(f.scope.KomiHomeDiscovery.recentProgress(f.context,[]).length,0);
});
test('discovery cards are native detail links with rating-only overlay and metadata; text is escaped',()=>{
 const f=fixture(),anime={...f.animeList[0],title:'<img onerror=alert(1)> & название'};
 const card=f.scope.renderCard(anime,{variant:'discovery'});
 assert.match(card,/^<a class="komi-discovery-card" href="\/anime\/1"/);
 assert.match(card,/width="240" height="360"/);
 assert.match(card,/2026 · Сериал · 12 сер\./);
 assert.match(card,/&lt;img onerror=alert\(1\)&gt; &amp; название/);
 assert.doesNotMatch(card,/<button|komi-card-status|data-komi-quick|Watch Party|role="button"|onerror="alert/);
 assert.equal(f.scope.renderCard({...anime,id:'bad"id'},{variant:'discovery'}),'');
});
test('hero has exactly watch/list actions, omits filler description and prioritizes only active artwork',()=>{
 const f=fixture(),html=f.render();
 const hero=html.slice(html.indexOf('<section class="komi-home-hero"'),html.indexOf('</section>')+10);
 assert.doesNotMatch(hero,/komi-hub-info|komi-hub-genres|>Аниме<|12 эп\./);
 const actions=hero.match(/<div class="hero-buttons">[\s\S]*?<\/div>/g);
 assert.ok(actions.length>1);
 for(const row of actions) assert.equal((row.match(/<(?:a|button)\b/g)||[]).length,2);
 assert.equal((hero.match(/fetchpriority="high"/g)||[]).length,1);
 assert.equal((hero.match(/data-komi-hero-deferred-src/g)||[]).length,actions.length-1);
});
test('home genre native links carry the filter and use no expanded catalogue controls',()=>{
 const f=fixture(),html=f.context.genres();
 assert.match(html,/<a href="\/catalog\?genre=%D0%AD%D0%BA%D1%88%D0%B5%D0%BD"/);
 assert.doesNotMatch(html,/<details|<select|Сортировка|Все фильтры/);
});
test('genre navigation resets stale pagination and old category without dropping the selected genre',()=>{
 const scope={availableGenresList:['Экшен'],currentView:'home',catalogVisibleCount:500,komiCatalogRestorePending:true,
  catalogCollection:'movies',catalogCategory:'movies',catalogFilterType:'Фильм',catalogFilterYear:'2020',catalogSearchQuery:'old',
  komiCatalogPageSize:()=>24,navigate:view=>scope.destination=view,komiSmoothToCatalog:()=>{}};
 vm.createContext(scope);
 vm.runInContext(app.slice(app.indexOf('function komiApplyMoodGenre('),app.indexOf("document.addEventListener('click'",app.indexOf('function komiApplyMoodGenre(')))+';komiApplyMoodGenre("Экшен");',scope);
 assert.equal(scope.destination,'catalog');assert.equal(scope.catalogFilterGenre,'Экшен');
 assert.equal(scope.catalogVisibleCount,24);assert.equal(scope.komiCatalogRestorePending,false);
 assert.equal(scope.catalogFilterYear,'Все');assert.equal(scope.catalogCategory,'all');assert.equal(scope.catalogSearchQuery,'');
});
