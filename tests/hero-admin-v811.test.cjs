'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '..', 'app-main.js'), 'utf8');
const source = app.slice(app.indexOf('async function saveAnimeForm('), app.indexOf('async function showGoogleAuthInfo('));

function fixture({banner='https://example.test/banner.jpg', video='https://example.test/loop.webm', fail=false}={}) {
  let reads=0, writes=0, saved, invalidated;
  const errors=[], notices=[];
  const values={editAnimeId:'61316',animeShikimoriId:'61316',animeTitle:'Re:Zero',animePoster:'https://example.test/poster.jpg',
    animeHeroBanner:banner,animeHeroVideo:video,animeScreenshots:'',animeShikiRating:'9.1',animeYear:'2026',animeType:'Сериал',animeDesc:'Описание',animeTrailer:''};
  const fields=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}]));
  const submit={disabled:false};
  const form={dataset:{},setAttribute(){},removeAttribute(){},querySelector:selector=>selector==='[type="submit"]'?submit:null};
  const previous={id:'61316',episodes:[{season:1,title:'Серия 1',url:'https://example.test/episode.mp4'}],customField:'keep',banner_url:'https://example.test/old.jpg'};
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>{reads++;if(fail)throw Error('network');return{data:{data:previous}};},
    update:value=>{writes++;saved=value;return query;},single:async()=>({data:{shikimori_id:61316}})};
  const context=vm.createContext({
    URL,document:{getElementById:id=>id==='animeForm'?form:fields[id],querySelectorAll:()=>[]},
    requireServerAdmin:async()=>true,currentUser:{authUserId:'admin'},_supabase:{from:()=>query},
    komiResetAnimeFormErrors:()=>{},komiAnimeFormError:message=>errors.push(message),komiStatusFeedback:message=>notices.push(message),
    closeAddModal:()=>{},render:()=>{},animeList:[{id:'61316'}],komiCatalogRevision:0,window:{KomiHeroArt:{invalidateMetadata:id=>invalidated=id}}
  });
  vm.runInContext(source,context);
  return {form,submit,fields,errors,notices,context,run:()=>context.saveAnimeForm({preventDefault(){}}),
    get reads(){return reads;},get writes(){return writes;},get saved(){return saved;},get invalidated(){return invalidated;}};
}

test('admin stores optional media without losing other metadata or episodes',async()=>{
  const f=fixture();await f.run();
  assert.equal(f.writes,1);
  assert.equal(f.saved.data.banner_url,'https://example.test/banner.jpg');
  assert.equal(f.saved.data.banner_video_url,'https://example.test/loop.webm');
  assert.equal(f.saved.data.customField,'keep');
  assert.equal(f.saved.data.episodes.length,1);
  assert.equal(f.invalidated,'61316');
  assert.equal(f.context.komiCatalogRevision,1);
  assert.equal(f.submit.disabled,false);
  assert.equal(f.form.dataset.komiSaving,undefined);
  assert.equal(f.errors.length,0);
  assert.equal(f.notices.length,1);
});

test('empty optional media deliberately clears saved media',async()=>{
  const f=fixture({banner:'',video:''});await f.run();
  assert.equal(f.saved.data.banner_url,'');
  assert.equal(f.saved.data.banner_video_url,'');
});

test('unsafe media is rejected before any database request',async()=>{
  for(const values of [{banner:'javascript:alert(1)'},{banner:'https://user:pass@example.test/a.jpg'},
    {video:'https://example.test/watch'},{video:'http://example.test/a.mp4'},{banner:'https://example.test/'+ 'a'.repeat(2001)}]){
    const f=fixture(values);await f.run();
    assert.equal(f.reads,0);
    assert.equal(f.writes,0);
    assert.equal(f.errors.length,1);
  }
});

test('network failure keeps entered data and restores the save button',async()=>{
  const f=fixture({fail:true});await f.run();
  assert.equal(f.writes,0);
  assert.equal(f.fields.animeHeroBanner.value,'https://example.test/banner.jpg');
  assert.equal(f.submit.disabled,false);
  assert.equal(f.form.dataset.komiSaving,undefined);
  assert.equal(f.errors.length,1);
  assert.equal(f.notices.length,0);
});
