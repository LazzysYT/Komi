'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prefs=require('../player-source-preferences');
const {selectPlaybackSource}=require('../player-core');
const source=(filename)=>fs.readFileSync(path.join(__dirname,'..',filename),'utf8');

function storageFixture(fn) {
    const previous=global.localStorage;
    const values=new Map();
    global.localStorage={
        getItem:k=>values.has(k)?values.get(k):null,
        setItem:(k,v)=>values.set(k,String(v)),
        removeItem:k=>values.delete(k)
    };
    try { fn(values); } finally { global.localStorage=previous; }
}
test('remembered dub is reused for later episodes of the same anime',()=>{
    storageFixture(values=>{
        assert.equal(prefs.recordChoice(52991,'AniLibria'),true);
        assert.equal(values.get('komi_source_52991'),'AniLibria');
        assert.deepEqual(prefs.preferredFor(52991,['AniLibria','Kodik']),{
            name:'AniLibria',kind:'title'
        });
        const next=selectPlaybackSource({
            Kodik:'https://example.com/embed/2',
            AniLibria:'https://example.com/dub2.mp4'
        },{requestedSource:prefs.preferredFor(52991,['AniLibria','Kodik']).name});
        assert.equal(next.name,'AniLibria');
    });
});
test('new titles use the most frequently explicitly chosen available source',()=>{
    storageFixture(()=>{
        prefs.recordChoice(100,'AniLibria');
        prefs.recordChoice(101,'Студийная Банда');
        prefs.recordChoice(102,'Студийная Банда');
        assert.deepEqual(prefs.preferredFor(999,['AniLibria','Студийная Банда']),{
            name:'Студийная Банда',kind:'global'
        });
        assert.equal(prefs.preferredFor(999,['Other']).name,'');
        assert.equal(prefs.preferredFor(101,['AniLibria','Студийная Банда']).kind,'title');
    });
});
test('legacy title preference migrates without losing prior choices',()=>{
    storageFixture(values=>{
        values.set('komi_source_52991','Kodik');
        assert.equal(prefs.preferredFor(52991,['Kodik','AniLibria']).name,'Kodik');
        values.set('komi_source_picks_v1','not-json');
        assert.equal(prefs.preferredFor(52991,['Kodik']).name,'Kodik');
    });
});
test('source-memory rejects unsupported and invalid data, leaves strict mode enforced',()=>{
    storageFixture(()=>{
        assert.equal(prefs.recordChoice('no-id','Kodik'),false);
        assert.equal(prefs.recordChoice(1,'<script>'),false);
        prefs.recordChoice(123,'Kodik');
        const strict=selectPlaybackSource({
            Kodik:'https://example.org/embed',
            'Без рекламы · Партнёр':'https://cdn.example.org/a.m3u8'
        },{adFreeOnly:true,requestedSource:prefs.preferredFor(123,['Kodik']).name});
        assert.equal(strict.name,'Без рекламы · Партнёр');
    });
});
test('native end handler does not skip the five-second cancel countdown',()=>{
    const runtime=source('player-runtime.js');
    const ux=source('player-ux.js');
    assert.match(runtime,/video\.addEventListener\('ended', \(\) => saveProgress\(animeId, video, true\)\)/);
    assert.doesNotMatch(runtime,/video\.addEventListener\('ended',[^\n]*playNextEp/);
    assert.match(ux,/title\.textContent = 'Следующая серия через ' \+ remaining/);
    assert.match(ux,/remaining -= 1/);
    assert.match(ux,/clearNextCountdown\(context\)/);
    assert.match(ux,/cancel\.addEventListener\('click'/);
    assert.match(ux,/root\.openWatchModal\(context\.animeId, context\.season, context\.index \+ 1\)/);
});
test('native-only seek and PiP paths keep provider iframe untouched',()=>{
    const ux=source('player-ux.js');
    const controls=source('player-controls.js');
    const app=source('app-main.js');
    const html=source('index.html');
    assert.match(ux,/video\.addEventListener\('pointerup'/);
    assert.match(ux,/event\.pointerType !== 'touch'/);
    assert.match(ux,/Math\.hypot/);
    assert.match(ux,/komi-tap-seek-feedback/);
    assert.match(controls,/document\.pictureInPictureEnabled/);
    assert.match(controls,/webkitSupportsPresentationMode/);
    assert.match(controls,/pip\.hidden = !standardPiP && !safariPiP/);
    assert.match(app,/KomiPlayerUX\?\.cancelPendingNext\?\.\(\)/);
    assert.match(html,/player-source-preferences\.js/);
    assert.match(html,/komi\.production\.css/);
    assert.match(ux,/else if \(wrapper\.querySelector\('iframe'\)\)/);
});