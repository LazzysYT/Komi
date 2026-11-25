'use strict';
// Run: node tests/cinema-thumbnails-browser.cjs
// Browser fixture only: no live accounts, database writes, or playback downloads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.KOMI_PLAYWRIGHT || 'playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'cinema-layout-v3.js'), 'utf8');
const imageFixture = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><path fill="#325d72" d="M0 0h160v90H0z"/><circle fill="#c69563" cx="130" cy="22" r="10"/><path fill="#253643" d="M0 90 52 25 112 90z"/></svg>';
const fixture = `<!doctype html><html lang="ru"><meta charset="utf-8"><body>
  <div id="watchModal" class="active"><div id="watchModalContent">
    <img class="crunchy-hero-poster" alt="" src="https://images.test/title-poster.png">
    <div class="komi-watch-main komi-watch-stage">
      <div class="player-wrapper"></div>
      <div class="komi-player-heading"><h1>Стальной алхимик: Братство</h1></div>
      <div class="komi-watch-controls"></div>
    <aside class="komi-watch-sidebar">
      <div class="komi-watch-side-heading"><h3>Серии <span>68</span></h3><div class="komi-episode-search"><input id="komiEpisodeSearch" type="search" aria-label="Найти серию по номеру" placeholder="Найти серию"></div></div>
      <div class="komi-episode-number-grid" role="group" aria-label="Выбрать серию">
        ${Array.from({length:68}, (_, index) => `<button type="button" class="komi-episode-number${index===0?' active':''}" data-episode-number="${index+1}" aria-current="${index===0}">${index+1}</button>`).join('')}
      </div>
    </aside>
  </div></div></div>
</body></html>`;

(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.KOMI_CHROME ? {executablePath:process.env.KOMI_CHROME} : {})});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:850}});
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = route.request().url();
      requests.push(url);
      if (url === 'https://komi.test/fixture') return route.fulfill({status:200,contentType:'text/html',body:fixture});
      if (url.includes('missing-frame')) return route.fulfill({status:404,body:'Missing episode image'});
      if (url.includes('/episode-stills/5114.json')) return route.fulfill({json:[
        {number:2,still:'https://image.tmdb.org/t/p/w500/two.jpg'},
        {number:3,still:'https://image.tmdb.org/t/p/w500/three.jpg'},
        {number:65,still:'https://image.tmdb.org/t/p/w500/wrong-special.jpg'}
      ],headers:{'Access-Control-Allow-Origin':'*'}});
      return route.fulfill({status:200,contentType:'image/svg+xml',body:imageFixture});
    });
    await page.goto('https://komi.test/fixture');
    for(const file of ['cinema-layout-v3.css','cinema-watch-monochrome.css','komi-watch-compact-v6.css']) {
      await page.addStyleTag({path:path.join(__dirname,'..',file)});
    }
    await page.evaluate(() => {
      window.__buttons = [...document.querySelectorAll('.komi-episode-number')];
      window.__selected = [];
      window.__buttons.forEach((button,index) => button.addEventListener('click', () => __selected.push(index)));
      window.closeWatchModal = () => {};
      window.KomiPlayerUX = {mount: settings => ({
        ...settings,
        modal:document.getElementById('watchModal'),
        content:document.getElementById('watchModalContent'),
        video:null
      })};
    });
    // Only the test exposes the existing renderer so cached-frame transitions can
    // be exercised without downloading an episode or adding a production API.
    await page.addScriptTag({content:source.replace('})(globalThis);', 'root.__cinemaTest = {paintEpisodeImage};\n})(globalThis);')});
    await page.addScriptTag({path:path.join(__dirname,'..','komi-watch-compact-v6.js')});
    await page.evaluate(() => {
      const episodeMeta = Array.from({length:68}, (_,index) => ({
        number:index+1,
        ...(index >= 64 ? {supplementalLabel:'Дополнительный выпуск · STEPonee'} : {})
      }));
      episodeMeta[0].preview = 'https://images.test/frame-1.png';
      episodeMeta[1].preview = 'https://images.test/missing-frame.png';
      episodeMeta[2].preview = episodeMeta[3].preview = 'https://images.test/repeated.png';
      episodeMeta[4].preview = 'https://images.test/title-poster.png';
      episodeMeta[5].preview = 'javascript:invalid';
      window.__context = KomiPlayerUX.mount({
        animeId:'5114',episodeArtworkId:5114,season:1,index:0,hasNext:true,displayNumber:1,
        watchPoster:'https://images.test/title-poster.png',
        watchStill:'https://images.test/unassigned-title-still.png',
        watchBanner:'https://images.test/title-banner.png',
        episodeSummary:'64 серии + 4 дополнительных выпуска',
        episodeMeta
      });
    });
    const episodes = page.locator('.komi-episode-number');
    await page.waitForFunction(() => { const frames = [...document.querySelectorAll('.komi-episode-thumb')].slice(0,3); return frames.length === 3 && frames.every(frame => frame.dataset.previewKind === 'frame'); });
    assert.equal(await episodes.count(),68,'All provider positions must remain available');
    assert.equal(await page.locator('#komiEpisodeSummary').innerText(),'64 серии + 4 дополнительных выпуска');
    assert.equal(await page.locator('.komi-episode-number-grid').getAttribute('aria-describedby'),'komiEpisodeSummary');
    assert.deepEqual(await page.locator('.komi-episode-thumb').evaluateAll(nodes => nodes.slice(0,6).map(n=>n.dataset.previewKind)),
      ['frame','frame','frame','unavailable','unavailable','unavailable']);
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-kind').textContent(),'Кадр серии');
    assert.match(await episodes.nth(0).getAttribute('aria-label'),/Сейчас смотришь.*Кадр серии/);
    assert.equal(await episodes.nth(1).locator('img').getAttribute('src'),'https://image.tmdb.org/t/p/w300/two.jpg');
    assert.equal(await episodes.nth(2).locator('img').getAttribute('src'),'https://image.tmdb.org/t/p/w300/three.jpg');
    assert.equal(await page.evaluate(() => __context.failedPreviews.has('https://images.test/missing-frame.png')),true);
    assert.equal(await episodes.nth(64).locator('img').count(),0);
    assert.equal(requests.some(url => url.includes('unassigned-title-still') || url.includes('repeated.png')),false,
      'A generic screenshot or repeated preview must not be requested as an episode frame');
    assert.equal(await episodes.nth(63).locator('.komi-episode-supplemental').count(),0);
    assert.match(await episodes.nth(64).locator('.komi-list-label').innerText(),/Доп\. выпуск 65/);
    assert.match(await episodes.nth(67).getAttribute('aria-label'),/Дополнительный выпуск 68.*STEPonee/);
    assert.equal(await page.evaluate(() => __buttons.every((button,index) => button === document.querySelectorAll('.komi-episode-number')[index])),true,
      'Enhancing a row must preserve the original button and click handler');
    await episodes.nth(64).click();
    assert.deepEqual(await page.evaluate(() => __selected),[64],'Additional position must keep its original zero-based index');

    await episodes.nth(0).locator('img').evaluate(image => image.dispatchEvent(new Event('error')));
    assert.equal(await episodes.nth(0).locator('img').count(),0);
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-kind').textContent(),'Нет изображения');
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-badge').innerText(),'1');
    assert.match(await episodes.nth(0).getAttribute('aria-label'),/Нет изображения/);

    await episodes.nth(2).scrollIntoViewIfNeeded();
    // The native-video capture path provides an in-memory JPEG as a genuine
    // frame. A retired image must not corrupt its replacement through late errors.
    await page.evaluate(() => {
      const frame = document.querySelectorAll('.komi-episode-thumb')[2];
      window.__retiredImage = frame.querySelector('img');
      const canvas = document.createElement('canvas');
      canvas.width=2; canvas.height=2;
      canvas.getContext('2d').fillRect(0,0,2,2);
      __cinemaTest.paintEpisodeImage(frame,[
        {url:canvas.toDataURL('image/jpeg'),kind:'frame'},
        {url:'https://images.test/title-poster.png',kind:'poster'}
      ]);
      __retiredImage.dispatchEvent(new Event('error'));
    });
    await page.waitForFunction(() => document.querySelectorAll('.komi-episode-thumb')[2].dataset.previewKind === 'frame');
    assert.equal(await episodes.nth(2).locator('.komi-episode-thumb-kind').textContent(),'Кадр серии');
    assert.match(await episodes.nth(2).locator('img').getAttribute('src'),/^data:image\/jpeg/);

    await page.getByRole('button',{name:'Показать серии сеткой',exact:true}).click();
    assert.equal(await episodes.nth(64).innerText(),'65');
    assert.match(await episodes.nth(64).getAttribute('aria-label'),/Дополнительный выпуск 65/);
    await page.getByRole('button',{name:'Показать серии списком',exact:true}).click();
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-kind').textContent(),'Нет изображения',
      'A failed real preview must stay failed when switching view mode');
    assert.equal(await episodes.count(),68);
    assert.equal(await episodes.nth(67).getAttribute('data-episode-number'),'68');
    assert.equal(await page.locator('.komi-episode-filters input').count(),1);
    await page.evaluate(() => { __buttons[0].hidden = true; });
    assert.equal(await episodes.nth(0).evaluate(row=>getComputedStyle(row).display),'none');
    for (const width of [1280,390,320]) {
      await page.setViewportSize({width,height:850});
      // Mobile uses the same sidebar node inside the existing sheet.
      if (width === 390) await page.evaluate(() => {
        const layer = document.createElement('div'); layer.id = 'komiMobileSheet';
        document.querySelector('#watchModal').append(layer);
        layer.append(document.querySelector('.komi-watch-sidebar'));
      });
      const geometry = await page.locator('.komi-episode-filters').evaluate(el=>({
        width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.getBoundingClientRect().height
      }));
      assert.ok(geometry.width > 0 && geometry.height >= 40 && geometry.scrollWidth <= geometry.width+1,JSON.stringify({width,...geometry}));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS desktop and mobile episode filmstrip: distinct frames, no repeat posters, image-error fallback, retained click indices and accessible controls');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
