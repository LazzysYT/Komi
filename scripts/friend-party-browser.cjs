const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.KOMI_TEST_URL||'http://127.0.0.1:8765/';

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.KOMI_CHROME?{executablePath:process.env.KOMI_CHROME}:{})});
  try {
    const page=await browser.newPage({viewport:{width:390,height:820}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/__komi_friend_party_fixture__',route=>route.fulfill({
      status:200,contentType:'text/html; charset=utf-8',
      body:`<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body>
        <aside id="komiFriendsDrawer" class="open">
          <section id="komiFriendRoomsSection" hidden>
            <button type="button" id="komiFriendRoomsRefresh">Обновить</button>
            <div id="komiFriendRoomsList"></div>
          </section>
        </aside>
        <script>
          window.currentUser={authUserId:'a1111111-1111-4111-8111-111111111111'};
          window.protectedFriendList={owner:currentUser.authUserId,
            idsByName:new Map([['Друг', 'b2222222-2222-4222-8222-222222222222']])};
          window.animeList=[{id:'42',title:'<img src=x onerror=alert(1)>'}];
          window.partyCall=async()=>[
            {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
             host:'b2222222-2222-4222-8222-222222222222',anime_id:'42',episode:4},
            {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
             host:'e3333333-3333-4333-8333-333333333333',anime_id:'42',episode:1}
          ];
          window.closeFriendsDrawer=()=>document.getElementById('komiFriendsDrawer').classList.remove('open');
          window.joinWatchPartyRoom=id=>{window.__joinedRoom=id};
        </script>
        <script src="/friend-party.js"></script>
      </body></html>`
    }));
    await page.goto(new URL('/__komi_friend_party_fixture__',base).href,{waitUntil:'load'});
    await page.evaluate(()=>KomiFriendRooms.refresh());
    const section=page.locator('#komiFriendRoomsSection');
    assert.equal(await section.isVisible(),true);
    assert.equal(await page.locator('.komi-friend-room-row').count(),1);
    assert.equal(await page.locator('.komi-friend-room-description strong').innerText(),'Друг');
    assert.equal(await page.locator('.komi-friend-room-description small').innerText(),'<img src=x onerror=alert(1)> · Серия 5');
    assert.equal(await section.locator('img').count(),0,'Untrusted anime title must not become HTML');
    await page.getByRole('button',{name:'Присоединиться к комнате Друг'}).click();
    assert.equal(await page.evaluate(()=>window.__joinedRoom),'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    assert.equal(await page.locator('#komiFriendsDrawer').evaluate(el=>el.classList.contains('open')),false);
    await page.evaluate(()=>{
      window.currentUser=null;
      document.getElementById('komiFriendsDrawer').classList.add('open');
      KomiFriendRooms.refresh();
    });
    await page.waitForFunction(()=>document.getElementById('komiFriendRoomsSection').hidden);
    assert.deepEqual(errors,[]);
    console.log('PASS joinable friend rooms: verified host only, escaped metadata, one-click join and sign-out cleanup');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
