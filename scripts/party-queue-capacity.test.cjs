const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261119204500_party_queue_premium_capacity.sql'),'utf8');
const party=fs.readFileSync(path.join(__dirname,'../watch-party.js'),'utf8');
test('free rooms keep existing capacity and Premium rooms limited by server membership',()=>{
  assert.match(sql,/max_participants smallint not null default 0/);
  assert.match(sql,/new\.max_participants:=case when exists/);
  assert.match(sql,/b\.active_until>now\(\)/);
  assert.match(sql,/then 10 else 0 end/);
  assert.match(sql,/trg_komi_party_limit_on_presence/);
  assert.match(sql,/before insert or update of last_seen on public\.komi_party_presence/);
});
test('queue only host can edit and private room invitations are enforced',()=>{
  assert.match(sql,/create table if not exists komi_private\.party_queue_entries/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on komi_private\.party_queue_entries from public,anon,authenticated/);
  assert.match(sql,/room\.private and actor<>room\.host/);
  assert.match(sql,/party_invite_is_valid/);
  assert.match(sql,/p_action<>'read' and actor<>room\.host/);
  assert.match(sql,/count\(\*\).*room_id=p_room_id\)>=30/);
  assert.match(sql,/grant execute on function public\.komi_party_queue/);
  assert.doesNotMatch(sql,/payment|premium_rewards|premium_contracts|komi_anicoin/i);
});
test('Watch Party viewer joins checked presence and host controls server queue',()=>{
  assert.match(party,/await partyPresenceCall\(room\.id\)/);
  assert.match(party,/partyQueueCall\(room\.id,'add'/);
  assert.match(party,/partyQueueCall\(room\.id,'next'/);
  assert.match(party,/partyQueueCall\(room\.id,'remove'/);
  assert.match(party,/partyQueueCall\(room\.id,'read'/);
  assert.match(party,/partyPresenceCall\(room\.id,'leave'\)/);
  assert.match(party,/🔥 Класс/);
});
