const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app-main.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const from=app.indexOf('function komiCardPosterSource(');
const to=app.indexOf('        function renderCard(',from);
assert.ok(from>=0&&to>from,'Poster sizing/fallback functions must exist');
const context=vm.createContext({komiSafeUrl:(value)=>{
 try {let u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return ''}
}});
vm.runInContext(app.slice(from,to),context);

test('Legacy Shikimori card images use preview without changing saved URLs',()=>{
 const input='https://shikimori.one/system/animes/original/39894.jpg?1718615729';
 const result=vm.runInContext('komiCardPosterSource('+JSON.stringify(input)+')',context);
 assert.equal(result.preferred,'https://shikimori.one/system/animes/preview/39894.jpg?1718615729');
 assert.equal(result.original,input);
 const staticCard=html.match(/<a class="anime-card komi-seo-card" href="\/anime\/39894"[\s\S]*?<\/a>/)?.[0];
 assert.ok(staticCard,'Static SEO card 39894 is missing');
 assert.match(staticCard,/\/system\/animes\/preview\/39894\.jpg/);
 assert.match(staticCard,/data-poster-original="https:\/\/shikimori\.one\/system\/animes\/original\/39894\.jpg/);
 assert.match(staticCard,/onerror="komiCardPosterFallback\(this\)"/);
 assert.match(app,/data-poster-original/);
});

test('Modern poster URLs and unsafe schemes are not converted into guessed variants',()=>{
 const modern='https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/cover.jpg';
 assert.equal(vm.runInContext('komiCardPosterSource('+JSON.stringify(modern)+').preferred',context),modern);
 assert.equal(vm.runInContext('komiCardPosterSource("javascript:alert(1)").preferred',context),'/anime-artwork.svg');
 assert.equal(vm.runInContext('komiCardPosterSource("javascript:alert(1)").original',context),'');
});

test('Preview failures fall back to original, then to local SVG',()=>{
 const original='https://shikimori.one/system/animes/original/39894.jpg?1718615729';
 const img={src:'https://shikimori.one/system/animes/preview/39894.jpg?1718615729',dataset:{posterOriginal:original},onerror:true};
 context.__image=img;
 vm.runInContext('komiCardPosterFallback(__image)',context);
 assert.equal(img.src,original);
 assert.equal(img.dataset.posterTriedOriginal,'1');
 vm.runInContext('komiCardPosterFallback(__image)',context);
 assert.equal(img.src,'/anime-artwork.svg');
 assert.equal(img.onerror,null);
});
