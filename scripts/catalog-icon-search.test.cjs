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
