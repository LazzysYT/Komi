const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {friendRoomCards}=require('../friend-party.js');
const idA='11111111-1111-4111-8111-111111111111';
const idB='22222222-2222-4222-8222-222222222222';
const roomA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const roomB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('only rooms hosted by verified friends may be displayed',()=>{
  const trusted=new Map([['Alice',idA]]);
  const cards=friendRoomCards([
    {id:roomA,host:idA,anime_id:'42',episode:4,private:true},
    {id:roomB,host:idB,anime_id:'43',episode:7},
    {id:'bad-room-id',host:idA,anime_id:'42'},
    {id:roomA,host:idA,anime_id:'42'}
  ],trusted,[{id:'42',title:'Известное аниме'}]);
  assert.equal(cards.length,1);
  assert.equal(cards[0].id,roomA);
  assert.equal(cards[0].friendName,'Alice');
  assert.equal(cards[0].animeTitle,'Известное аниме');
  assert.equal(cards[0].episodeLabel,' · Серия 5');
  assert.deepEqual(friendRoomCards([],trusted,[]),[]);
  assert.deepEqual(friendRoomCards([{}],new Map(),[]),[]);
});

test('friend room UI reads server-filtered rooms and uses textContent rather than raw HTML',()=>{
  const js=fs.readFileSync(path.join(__dirname,'../friend-party.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
  assert.match(js,/await partyCall\('list'\)/);
  assert.match(js,/friend\.textContent=room\.friendName/);
  assert.match(js,/anime\.textContent=room\.animeTitle\+room\.episodeLabel/);
  assert.match(js,/joinWatchPartyRoom\(room\.id\)/);
  assert.match(js,/protectedFriendList\.idsByName/);
  assert.match(app,/window\.KomiFriendRooms\?\.refresh\(\)/);
  assert.match(html,/<section id="komiFriendRoomsSection"[^>]*hidden>/);
  assert.match(html,/<script src="\.\/friend-party\.js"><\/script>/);
});
