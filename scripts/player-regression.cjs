// Deterministic local browser checks. No real API or account access.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(__dirname, '../index.html')));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      if (route.request().url().startsWith('http://127.0.0.1:')) return route.continue();
      if (route.request().url().includes('graphql.anilist.co')) return route.fulfill({ json: { data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } } } });
      return route.fulfill({ body: '', contentType: 'text/plain' });
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const checks = await page.evaluate(async () => {
      const results = {};
      const source = '<iframe src="https://player.example/embed?a=1&amp;b=2"></iframe>';
      const parsed = new DOMParser().parseFromString(komiPlayerHtml(source, '123', 1, 0), 'text/html');
      results.iframeQuery = parsed.querySelector('iframe').getAttribute('src') === 'https://player.example/embed?a=1&b=2';
      results.unsafeIframe = komiPlayerKind('<iframe src="javascript:alert(1)"></iframe>') === 'missing';
      results.relativeIframe = komiPlayerKind('<iframe src="/player"></iframe>') === 'missing';
      results.mediaTypes = komiPlayerKind('https://example.com/a.mp4') === 'video' && komiPlayerKind('https://example.com/a.m3u8') === 'hls';
      currentUser = { username: 'test_user' };
      const attack = '<img src=x onerror="window.injected=true">';
      const chatBox = document.createElement('div');
      chatBox.id = 'partyChatBox';
      const input = document.createElement('input');
      input.id = 'partyMessageInput';
      input.value = attack;
      document.body.append(chatBox, input);
      activeWatchPartyRoom = { chat: [] };
      await sendPartyMessage();
      results.chatEscaped = chatBox.textContent.includes(attack) && !chatBox.querySelector('img');
      chatBox.remove(); input.remove();
      userNotifications.test_user = [{ text: attack, read: false, time: '12:00' }];
      updateNotificationsUI();
      results.notificationsEscaped = !document.querySelector('#notifListContainer img') && document.getElementById('notifListContainer').textContent.includes(attack);
      animeList = [{ id: '123', title: 'Test', desc: attack, genres: [], episodes: [
        { number: 1, season: 1, sources: { Test: source } },
        { number: 2, season: 1, sources: { Test: source } }
      ] }];
      saveKomiEpisode('123', 1, 0, 90, 1440);
      await openWatchModal('123');
      results.descriptionEscaped = document.querySelector('.crunchy-hero-info').textContent.includes(attack) && !document.querySelector('.crunchy-hero-info img');
      results.resumePosition = getKomiProgress('123').time === 90;
      results.resumeDuration = getKomiProgress('123').duration === 1440;
      closeWatchModal();
      results.playerRemoved = !document.querySelector('#watchModal iframe, #watchModal video');
      results.modalClosed = !document.getElementById('watchModal').classList.contains('active');
      await openWatchModal('123', 1, 1);
      results.newEpisodeReset = getKomiProgress('123').time === 0 && getKomiProgress('123').duration === 0;
      closeWatchModal();
      saveKomiEpisode('123', 1, 1, Infinity, NaN);
      results.finiteProgress = Number.isFinite(getKomiProgress('123').time) && Number.isFinite(getKomiProgress('123').duration) && Number.isFinite(userWatchHistory.test_user_123);
      // Exercise actual sign-out and verify private records never enter legacy storage.
      currentUser = { username: 'test_user', authUserId: 'user-a' };
      userAnimeStatuses.test_user = { 123: 'Смотрю' };
      userFavorites.test_user = { 123: 'Любимое' };
      let cloudWrites = 0;
      _supabase = {
        auth: { signOut: async () => ({}) },
        from: () => ({ delete: () => ({ eq: async () => ({}) }), upsert: async () => { cloudWrites++; return {}; } })
      };
      await logoutUser();
      results.privateDataCleared = !userAnimeStatuses.test_user && !userFavorites.test_user && !komiEpisodeProgress.test_user_123 && !userWatchHistory.test_user_123;
      results.privateDataNotCached = ['komi_anime_statuses', 'komi_favorites', 'komi_history', 'komi_episode_progress'].every(key => !localStorage.getItem(key).includes('test_user'));
      await saveStatusesToCloud();
      results.noGuestWrites = cloudWrites === 0;
      return results;
    });
    for (const [name, passed] of Object.entries(checks)) {
      console.log((passed ? 'PASS ' : 'FAIL ') + name);
    }
    assert.deepEqual(Object.entries(checks).filter(([, passed]) => !passed), [], 'all regression checks');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    console.log('PASS no uncaught browser errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
