const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:800}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__komi_cloud_watched_fixture__',route=>route.fulfill({
    status:200,contentType:'text/html; charset=utf-8',
    body:`<!doctype html><html><head><meta charset="utf-8"></head><body>
      <div id="watchModal" class="active"><div id="watchModalContent">
        <div class="player-wrapper"><video id="animeVideoPlayer" style="width:640px;height:360px"></video></div>
        <div class="komi-episode-number-grid"><button>1</button><button>2</button><button>3</button></div>
      </div></div>
      <script src="/player-ux.js"></script>
    </body></html>`
  }));
  await page.goto(new URL('/__komi_cloud_watched_fixture__',base).href,{waitUntil:'load'});
  await page.evaluate(()=>{
    const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
    window.testUsers={A,B};
    window.cloudRows={[A]:[{season:1,episode_index:1}],[B]:[]};
    window.cloudUpserts=[];
    window.__owner=A;
    window.mockClient=function(){
      return {
        from(table){
          if(table!=='komi_watched_episodes')throw Error('Unexpected table '+table);
          const opts={};
          return {
            select(){return this},
            eq(column,value){opts[column]=value;return this},
            order(){return this},
            async range(){
              const rows=window.cloudRows[opts.user_id] || [];
              return {data:rows.filter(row=>!opts.anime_id||Number(opts.anime_id)===52991),error:null};
            },
            async upsert(rows,options){
              window.cloudUpserts.push({rows,options});
              return {error:null};
            }
          };
        }
      };
    };
    localStorage.setItem(KomiPlayerUX.watchedStorageKey(A,'52991'),JSON.stringify(['1:0']));
    const video=document.getElementById('animeVideoPlayer');
    Object.defineProperty(video,'duration',{configurable:true,value:1000});
    Object.defineProperty(video,'currentTime',{configurable:true,writable:true,value:20});
    KomiPlayerUX.mount({animeId:'52991',userId:A,authId:A,client:mockClient(),
      ownerIsCurrent:()=>window.__owner===A,season:1,index:2,hasNext:false});
  });
  await page.waitForFunction(()=>{
    const {A}=window.testUsers;
    return KomiPlayerUX.readWatched(A,'52991').length===2 &&
      window.cloudUpserts.length>=1 &&
      document.querySelectorAll('.komi-episode-watched').length===2;
  });
  const initial=await page.evaluate(()=>({
    markers:KomiPlayerUX.readWatched(window.testUsers.A,'52991'),
    upserts:window.cloudUpserts.slice()
  }));
  assert.deepEqual(initial.markers,['1:0','1:1']);
  assert.equal(initial.upserts[0].rows[0].user_id,'11111111-1111-4111-8111-111111111111');
  assert.equal(initial.upserts[0].rows[0].episode_index,0);
  assert.equal(initial.upserts[0].options.ignoreDuplicates,true);
  await page.evaluate(()=>{
    const video=document.getElementById('animeVideoPlayer');
    video.currentTime=935;
    video.dispatchEvent(new Event('timeupdate'));
  });
  await page.waitForFunction(()=>KomiPlayerUX.readWatched(window.testUsers.A,'52991').length===3 &&
    window.cloudUpserts.some(x=>x.rows.some(y=>y.episode_index===2)));
  assert.equal(await page.locator('.komi-episode-watched').count(),3);
  await page.evaluate(()=>{
    const {B}=window.testUsers;
    window.__owner=B;
    document.getElementById('watchModalContent').innerHTML=
      '<div class="player-wrapper"><video id="animeVideoPlayer"></video></div>'+
      '<div class="komi-episode-number-grid"><button>1</button><button>2</button><button>3</button></div>';
    KomiPlayerUX.mount({animeId:'52991',userId:B,authId:B,client:mockClient(),
      ownerIsCurrent:()=>window.__owner===B,season:1,index:0,hasNext:false});
  });
  await page.waitForFunction(()=>document.querySelector('.komi-cinema-toolbar')!==null);
  assert.equal(await page.locator('.komi-episode-watched').count(),0,
    'Another user must not inherit the former owner\'s watched history');
  assert.deepEqual(await page.evaluate(()=>KomiPlayerUX.readWatched(window.testUsers.B,'52991')),[]);
  const cloudRequests=await page.evaluate(()=>window.cloudUpserts.length);
  assert.ok(cloudRequests>=2);
  assert.deepEqual(errors,[]);
  console.log('PASS cloud watched: reads remote, migrates old local marks, writes new completions and isolates new account');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
