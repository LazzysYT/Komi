'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
const rail=fs.readFileSync(path.join(__dirname,'../komi-icon-rail.css'),'utf8');
const start=app.indexOf('        function komiNormalizeCatalogSearch(');
const end=app.indexOf('        // Returning to an unchanged, unfiltered catalog',start);
const variantsStart=app.indexOf('        function komiSearchVariants(');
const variantsEnd=app.indexOf('        // Cache normalized metadata',variantsStart);
assert.ok(start>=0&&end>start&&variantsEnd>variantsStart);
const {score,terms,normalize}=new Function(app.slice(variantsStart,variantsEnd)+app.slice(start,end)+'return {score:komiCatalogSearchScore,terms:komiCatalogSearchTerms,normalize:komiNormalizeCatalogSearch};')();
test('exact titles precede prefixes, partial names and genres',()=>{
 const exact={names:['наруто'],genres:[]};
 assert.ok(score(exact,terms('Наруто'))>score({names:['наруто ураганные хроники'],genres:[]},terms('Наруто')));
 assert.ok(score({names:['наруто ураганные хроники'],genres:[]},terms('Наруто'))>score({names:['приключения наруто'],genres:[]},terms('Наруто')));
 assert.equal(score({names:['другое'],genres:['экшен']},terms('Экшен')),20);
});
test('normalizes punctuation, yo, whitespace, and keyboard layout',()=>{
 assert.equal(normalize('  Чёрный—клевер! '),'черный клевер');
 assert.ok(terms('yfhenj').includes('наруто'));
 assert.ok(terms('abkmv').includes('фильм'));
 assert.ok(terms('yфру').every(Boolean));
 assert.equal(score({names:['черный клевер'],genres:[]},terms('Чёрный: клевер')),100);
 assert.equal(score({names:['one piece'],genres:[]},terms('piece one')),50);
});
test('desktop rail stays compact; catalog has an accessible clear button and search feedback',()=>{
 assert.match(rail,/--hub-rail: 72px/);
 assert.doesNotMatch(rail,/--hub-rail: 184px/);
 assert.match(rail,/:is\(:hover,:focus-visible\)/);
 assert.match(app,/id="komiCatalogClearSearch"[^>]+aria-label="Очистить поиск"/);
 assert.match(app,/id="komiCatalogSearchStatus" role="status"/);
});

test('search index caches metadata and invalidates for new data and revisions',()=>{
 const fixture=[{title:'Чёрный клевер',originalTitle:'Black Clover',english:'Black Clover',synonyms:['BC'],genres:[{russian:'Экшен'}]},null];
 const f=new Function('animeList','komiCatalogRevision',app.slice(start,end)+'return {index:komiGetCatalogSearchIndex, change:()=>{komiCatalogRevision++;}, replace:items=>{animeList=items;}};')(fixture,1);
 const index=f.index();
 assert.equal(index,f.index());
 assert.equal(index.size,1);
 assert.equal(score(index.get(fixture[0]),terms('BC')),100);
 assert.equal(score(index.get(fixture[0]),terms('Black—Clover')),100);
 assert.equal(score(index.get(fixture[0]),terms('Экшен')),20);
 f.change();
 assert.notEqual(index,f.index());
 const fresh=[{title:'Наруто'}];
 f.replace(fresh);
 assert.equal(f.index().get(fresh[0]).names[0],'наруто');
});

test('localized aliases, romanization, bounded typos and preserved season numbers',()=>{
 const fixture=[
   {id:'16498',title:'Атака титанов',originalTitle:'Shingeki no Kyojin',shikiRating:9},
   {id:'20',title:'Наруто',shikiRating:8},
   {id:'21',title:'Наруто: Ураганные хроники',shikiRating:8.5},
   {id:'40028',title:'Магическая битва',shikiRating:8.8},
   {id:'5',title:'Ковбой Бибоп',japanese:'カウボーイビバップ',synonyms:['Cowboy Bebop']},
   {id:'6',title:'Тест сезона 2'},{id:'7',title:'Тест сезона 3'}
 ];
 const f=new Function('animeList','komiCatalogRevision',app.slice(variantsStart,variantsEnd)+app.slice(start,end)+'return {scores:komiCatalogSearchScores,terms:komiCatalogSearchTerms,distance:komiCatalogEditDistance};')(fixture,1);
 const ranked=q=>[...f.scores(f.terms(q))].sort((a,b)=>b[1]-a[1]).map(([a])=>a.id);
 for(const q of ['атака титанов','Атака титанів','Attack on Titan','Shingeki no Kyojin','aot','ataka titanov','атка титанов','атака титанво','Atack on Titan'])assert.equal(ranked(q)[0],'16498',q);
 for(const q of ['наруто','naruto','нартуо','нарут','Nrauto','yfhenj'])assert.equal(ranked(q)[0],'20',q);
 for(const q of ['магічна битва','Jujutsu Kaisen','jjk'])assert.equal(ranked(q)[0],'40028',q);
 assert.equal(ranked('カウボーイビバップ')[0],'5');
 assert.equal(ranked('Cowboy Bebop')[0],'5');
 assert.equal(ranked('тест сезна 2')[0],'6');
 assert.ok(!ranked('тест сезна 2').includes('7'));
 assert.equal(f.distance('nrauto','naruto',1),1);
 assert.equal(f.distance('narutooo','naruto',2),2);
 assert.ok(!ranked('zx').length);
 assert.equal(f.scores(f.terms('атака титанов')),f.scores(f.terms('атака титанов')));
});
