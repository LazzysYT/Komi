const {test} = require('node:test');
const assert = require('node:assert/strict');
const {source, finite, seasonEpisodes, createWriter} = require('../player-core');
test('legacy iframe entities and protocol-relative sources are decoded once', () => {
    assert.equal(source('<iframe src="//example.test/player?id=1&amp;episode=2"></iframe>').url, 'https://example.test/player?id=1&episode=2');
    assert.equal(source('https://example.test/a.m3u8?token=x').kind, 'hls');
    assert.equal(source('<iframe src="https://example.test/a.mp4"></iframe>').kind, 'video');
    for (const url of ['javascript:alert(1)', 'http://example.test', 'https://user:pass@example.test', null]) assert.equal(source(url).kind, 'missing');
});
test('unknown and live durations never persist NaN or Infinity', () => {
    for (const value of [NaN, Infinity, -4, undefined]) assert.equal(finite(value), 0);
});
test('padded episode numbers share a row and preserve sources and old progress slots', () => {
    const episodes = [
        {season:1, number:2, url:'https://example.test/2.mp4'},
        {season:1, number:'01', sources:{Dub:'https://example.test/1.m3u8'}},
        {season:1, number:'1', preview:'frame.jpg', sources:{Dub:'https://example.test/1b.mp4', Sub:'https://example.test/1'}},
        {season:2, number:1, url:'https://example.test/s2.mp4'}
    ];
    const [first, second] = seasonEpisodes(episodes, 1);
    assert.equal(first.preview, 'frame.jpg');
    assert.deepEqual(first.slots, [0, 1]);
    assert.deepEqual(second.slots, [2]);
    assert.deepEqual({...first.sources}, {
        Dub:'https://example.test/1.m3u8', 'Dub (2)':'https://example.test/1b.mp4', Sub:'https://example.test/1'
    });
    assert.deepEqual(first.origins['Dub (2)'], {index:2, name:'Dub'});
    assert.deepEqual(second.origins.Default, {index:0, name:'Основной источник'});
});
test('slow persistence is ordered and intermediate updates are coalesced', async () => {
    const calls = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const writer = createWriter(async value => { calls.push(value); if(value === 1) await gate; });
    writer.enqueue('user:anime', 1);
    await Promise.resolve();
    writer.enqueue('user:anime', 2);
    writer.enqueue('user:anime', 3);
    release();
    await writer.flush();
    assert.deepEqual(calls, [1,3]);
});
test('failed write does not block a later snapshot', async () => {
    const errors = [];
    const calls = [];
    const writer = createWriter(async value => {calls.push(value); if(value===1) throw Error('offline');}, e=>errors.push(e.message));
    await writer.enqueue('a',1);
    await writer.enqueue('a',2);
    assert.deepEqual(calls,[1,2]);
    assert.deepEqual(errors,['offline']);
});
