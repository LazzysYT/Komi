const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../watch-party.js'),'utf8');
const start=source.indexOf('function partyOptions(anime) {');
const end=source.indexOf('\nfunction partySignedIn()',start);
assert.ok(start>=0&&end>start,'Watch Party options function must be present');
const context=vm.createContext({KomiPlayerCore:require('../player-core')});
vm.runInContext(source.slice(start,end),context);
function options(episodes) {
    context.anime={episodes};
    return vm.runInContext('partyOptions(anime)',context);
}
test('Watch Party prefers manageable media over iframe without hiding source variants',()=>{
    const result=options([{season:1,number:1,sources:{
        Embed:'<iframe src="https://example.test/embedded/player"></iframe>',
        Video:'https://example.test/episode.mp4',
        HLS:'https://example.test/episode.m3u8'
    }}]);
    assert.deepEqual(Array.from(result,x=>x.source),['Video','HLS','Embed']);
    assert.deepEqual(Array.from(result,x=>x.synchronized),[true,true,false]);
    assert.equal(result[2].kind,'iframe');
    assert.match(result[2].label,/Без общей паузы/);
    assert.match(result[0].label,/Полная синхронизация/);
});
test('Watch Party keeps all episodes and falls back to legacy episode.url',()=>{
    const result=options([
        {number:1,sources:{},url:'https://example.test/first.mp4'},
        {number:2,sources:{External:'<iframe src="https://example.test/second"></iframe>'}},
        {number:3,sources:{Stream:'https://example.test/third.m3u8'}}
    ]);
    assert.deepEqual(Array.from(result,x=>x.episode),[0,1,2]);
    assert.equal(result[0].source,'Основной источник');
    assert.equal(result[0].kind,'video');
    assert.equal(result[1].synchronized,false);
    assert.equal(result[2].synchronized,true);
});
test('Watch Party rejects unsafe links without claiming they can synchronize',()=>{
    const result=options([{sources:{Unsafe:'javascript:alert(1)',Safe:'https://example.test/fourth.mp4'}}]);
    assert.equal(result.length,1);
    assert.equal(result[0].source,'Safe');
});

test('Watch Party excludes catalog demo movie stand-ins, not real iframe sources',()=>{
    const sample='https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const result=options([{
        season:1,number:1,
        sources:{
            'Kodik (Ожидает ссылки)':sample,
            'Old test stream':sample,
            'External':'https://example.test/player/real-series',
            'Native':'https://example.test/real-episode.mp4'
        }
    }]);
    assert.deepEqual(Array.from(result,x=>x.source),['Native','External']);
    assert.equal(result[0].synchronized,true);
    assert.equal(result[1].synchronized,false);
});
