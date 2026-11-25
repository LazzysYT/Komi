'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app-main.js'), 'utf8');
const start = source.indexOf('        async function resumeKomiAnime(');
const end = source.indexOf('        function saveKomiEpisode(', start);
assert.ok(start >= 0 && end > start, 'Resume entry point must exist');
const resume = source.slice(start, end);
const UID = '00000000-0000-4000-8000-000000000001';
const OTHER_UID = '00000000-0000-4000-8000-000000000002';

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}

function fixture() {
    const opened = [], notices = [];
    const context = vm.createContext({
        currentUser: {authUserId: UID, username: 'owner'},
        komiResumeReadyUid: UID,
        komiSessionRestoreQueue: Promise.resolve(),
        komiCatalogLoadPending: null,
        animeList: [{id: '42'}],
        komiEpisodeProgress: {owner_42: {season: 2, index: 1, time: 42, duration: 100}},
        komiResumePreview: Object.freeze([{anime: {id: '42'}, p: {season: 1, index: 0, time: 12}}]),
        async loadAuthenticatedAnimeData() { throw Error('Unexpected account load'); },
        openWatchModal(id) {
            opened.push({id, progress: context.komiEpisodeProgress['owner_' + id]});
        },
        komiStatusFeedback(message) { notices.push(message); }
    });
    vm.runInContext(resume, context);
    return {context, opened, notices};
}

test('ready owner resumes immediately with the unchanged season, slot and position', async () => {
    const {context, opened, notices} = fixture();
    const original = context.komiEpisodeProgress.owner_42;
    await context.resumeKomiAnime(42);
    assert.equal(opened.length, 1);
    assert.equal(opened[0].id, '42');
    assert.equal(opened[0].progress, original);
    assert.deepEqual(original, {season: 2, index: 1, time: 42, duration: 100});
    assert.deepEqual(notices, []);
});

test('an early cached-card click waits for existing account restore and uses its newer progress', async () => {
    const {context, opened, notices} = fixture();
    const gate = deferred();
    context.komiResumeReadyUid = null;
    context.komiEpisodeProgress = {};
    const originalPreview = context.komiResumePreview;
    context.komiSessionRestoreQueue = gate.promise.then(() => {
        context.komiEpisodeProgress.owner_42 = {season: 2, index: 3, time: 84, duration: 200};
        context.komiResumeReadyUid = UID;
    });
    const pending = context.resumeKomiAnime('42');
    await Promise.resolve();
    assert.equal(opened.length, 0, 'Do not open at the beginning before server progress arrives');
    assert.deepEqual(context.komiEpisodeProgress, {}, 'Never copy the older preview into progress');
    gate.resolve();
    await pending;
    assert.deepEqual(opened, [{id: '42', progress: {season: 2, index: 3, time: 84, duration: 200}}]);
    assert.equal(context.komiResumePreview, originalPreview);
    assert.deepEqual(notices, []);
});

test('simultaneous early clicks serialize the missing account read instead of starting competing loads', async () => {
    const {context, opened, notices} = fixture();
    const gate = deferred(), started = deferred();
    let loads = 0;
    context.komiResumeReadyUid = null;
    context.loadAuthenticatedAnimeData = async () => {
        loads++;
        started.resolve();
        await gate.promise;
        context.komiResumeReadyUid = UID;
    };
    const first = context.resumeKomiAnime('42');
    const second = context.resumeKomiAnime('42');
    await started.promise;
    assert.equal(loads, 1);
    assert.equal(opened.length, 0);
    gate.resolve();
    await Promise.all([first, second]);
    assert.equal(loads, 1);
    assert.equal(opened.length, 2);
    assert.deepEqual(notices, []);
});

for (const [name, user] of [
    ['different account', {authUserId: OTHER_UID, username: 'other'}],
    ['renamed account', {authUserId: UID, username: 'renamed'}],
    ['signed-out visitor', null]
]) {
    test('a pending resume never opens for a ' + name, async () => {
        const {context, opened, notices} = fixture();
        const gate = deferred();
        context.komiResumeReadyUid = null;
        context.komiSessionRestoreQueue = gate.promise;
        const pending = context.resumeKomiAnime('42');
        context.currentUser = user;
        gate.resolve();
        await pending;
        assert.deepEqual(opened, []);
        assert.deepEqual(notices, [], 'Old-owner failures must not notify the next account');
    });
}

test('a failed server progress read never starts playback or imports the cached snapshot', async () => {
    const {context, opened, notices} = fixture();
    context.komiResumeReadyUid = null;
    context.komiEpisodeProgress = {};
    let loads = 0;
    context.loadAuthenticatedAnimeData = async () => { loads++; };
    await context.resumeKomiAnime('42');
    assert.equal(loads, 1);
    assert.deepEqual(opened, []);
    assert.deepEqual(context.komiEpisodeProgress, {});
    assert.equal(notices.length, 1);
    assert.match(notices[0], /Проверьте соединение/);
});

test('a thrown account read remains retryable through the same restore queue', async () => {
    const {context, opened, notices} = fixture();
    context.komiResumeReadyUid = null;
    let loads = 0;
    context.loadAuthenticatedAnimeData = async () => {
        loads++;
        if (loads === 1) throw Error('offline');
        context.komiResumeReadyUid = UID;
    };
    await context.resumeKomiAnime('42');
    assert.equal(opened.length, 0);
    await context.resumeKomiAnime('42');
    assert.equal(loads, 2);
    assert.equal(opened.length, 1);
    assert.equal(notices.length, 1);
});

test('a cached title outside the first public page waits for the existing catalog load', async () => {
    const {context, opened, notices} = fixture();
    const gate = deferred();
    context.animeList = [{id: '1'}];
    context.komiCatalogLoadPending = gate.promise.then(() => { context.animeList.push({id: '42'}); });
    const pending = context.resumeKomiAnime('42');
    await Promise.resolve();
    assert.equal(opened.length, 0);
    gate.resolve();
    await pending;
    assert.equal(opened.length, 1);
    assert.equal(opened[0].progress.time, 42);
    assert.deepEqual(notices, []);
});

test('account identity is checked again after awaiting the public catalog', async () => {
    const {context, opened, notices} = fixture();
    const gate = deferred();
    context.animeList = [];
    context.komiCatalogLoadPending = gate.promise.then(() => { context.animeList.push({id: '42'}); });
    const pending = context.resumeKomiAnime('42');
    context.currentUser = {authUserId: OTHER_UID, username: 'other'};
    gate.resolve();
    await pending;
    assert.deepEqual(opened, []);
    assert.deepEqual(notices, []);
});

test('an unavailable cached title gives existing status feedback without starting another catalog request', async () => {
    const {context, opened, notices} = fixture();
    context.animeList = [];
    await context.resumeKomiAnime('42');
    assert.deepEqual(opened, []);
    assert.equal(notices.length, 1);
    assert.match(notices[0], /Не удалось загрузить аниме/);
});

test('a new restoration of the same account cannot clear progress while a cached title is loading', async () => {
    const {context, opened, notices} = fixture();
    const gate = deferred();
    context.animeList = [];
    context.komiCatalogLoadPending = gate.promise.then(() => { context.animeList.push({id: '42'}); });
    const pending = context.resumeKomiAnime('42');
    context.komiResumeReadyUid = null;
    context.komiEpisodeProgress = {};
    gate.resolve();
    await pending;
    assert.deepEqual(opened, []);
    assert.deepEqual(context.komiEpisodeProgress, {});
    assert.equal(notices.length, 1);
});
