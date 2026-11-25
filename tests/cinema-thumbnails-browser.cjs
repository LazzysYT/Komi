'use strict';
// Run: node tests/cinema-thumbnails-browser.cjs
// Browser fixture only: no live accounts, database writes, or playback downloads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '..', 'cinema-layout-v3.js'), 'utf8');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const fixture = `<!doctype html><html lang="ru"><meta charset="utf-8"><body>
  <div id="watchModal" class="active"><div id="watchModalContent">
    <img class="crunchy-hero-poster" alt="" src="https://images.test/title-poster.png">
    <div class="komi-watch-main">
      <div class="player-wrapper"></div>
      <div class="komi-player-heading"><h1>Стальной алхимик: Братство</h1></div>
      <div class="komi-watch-controls"></div>
    </div>
    <aside class="komi-watch-sidebar"><h3>Серии</h3>
      <div class="komi-episode-number-grid" role="group" aria-label="Выбрать серию">
        ${Array.from({length:68}, (_, index) => `<button type="button" class="komi-episode-number${index===0?' active':''}" data-episode-number="${index+1}" aria-current="${index===0}">${index+1}</button>`).join('')}
      </div>
    </aside>
  </div></div>
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
      return route.fulfill({status:200,contentType:'image/png',body:png});
    });
    await page.goto('https://komi.test/fixture');
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
    await page.evaluate(() => {
      const episodeMeta = Array.from({length:68}, (_,index) => ({
        ...(index >= 64 ? {supplementalLabel:'Дополнительный выпуск · STEPonee'} : {})
      }));
      episodeMeta[0].preview = 'https://images.test/frame-1.png';
      episodeMeta[1].preview = 'https://images.test/missing-frame.png';
      episodeMeta[2].preview = episodeMeta[3].preview = 'https://images.test/repeated.png';
      episodeMeta[4].preview = 'https://images.test/title-poster.png';
      episodeMeta[5].preview = 'javascript:invalid';
      window.__context = KomiPlayerUX.mount({
        animeId:'5114',season:1,index:0,hasNext:true,displayNumber:1,
        watchPoster:'https://images.test/title-poster.png',
        watchStill:'https://images.test/unassigned-title-still.png',
        watchBanner:'https://images.test/title-banner.png',
        episodeSummary:'64 серии + 4 дополнительных выпуска',
        episodeMeta
      });
    });
    const episodes = page.locator('.komi-episode-number');
    await page.waitForFunction(() => document.querySelectorAll('.komi-episode-thumb')[1].dataset.previewKind === 'poster');
    assert.equal(await episodes.count(),68,'All provider positions must remain available');
    assert.equal(await page.locator('#komiEpisodeSummary').innerText(),'64 серии + 4 дополнительных выпуска');
    assert.equal(await page.locator('.komi-episode-number-grid').getAttribute('aria-describedby'),'komiEpisodeSummary');
    assert.deepEqual(await page.locator('.komi-episode-thumb').evaluateAll(nodes => nodes.slice(0,6).map(n=>n.dataset.previewKind)),
      ['frame','poster','poster','poster','poster','poster']);
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-kind').innerText(),'Кадр серии');
    assert.match(await episodes.nth(0).getAttribute('aria-label'),/Сейчас смотришь.*Кадр серии/);
    assert.equal(await episodes.nth(1).locator('.komi-episode-thumb-kind').innerText(),'Постер тайтла');
    assert.equal(await episodes.nth(1).locator('img').getAttribute('src'),'https://images.test/title-poster.png');
    assert.match(await episodes.nth(1).getAttribute('aria-label'),/Постер тайтла/);
    assert.equal(await page.evaluate(() => __context.failedPreviews.has('https://images.test/missing-frame.png')),true);
    assert.equal(requests.some(url => url.includes('unassigned-title-still') || url.includes('repeated.png')),false,
      'A generic screenshot or repeated preview must not be requested as an episode frame');
    assert.equal(await episodes.nth(63).locator('.komi-episode-supplemental').count(),0);
    assert.match(await episodes.nth(64).locator('.komi-list-label').innerText(),/Доп\. выпуск 65/);
    assert.match(await episodes.nth(67).getAttribute('aria-label'),/Дополнительный выпуск 68.*STEPonee/);
    assert.equal(await page.evaluate(() => __buttons.every((button,index) => button === document.querySelectorAll('.komi-episode-number')[index])),true,
      'Enhancing a row must preserve the original button and click handler');
    await episodes.nth(64).click();
    assert.deepEqual(await page.evaluate(() => __selected),[64],'Additional position must keep its original zero-based index');

    // Real-frame failures fall through to truthful poster state, then to a
    // numbered no-image state; neither a failed frame nor a poster is hidden as a frame.
    await episodes.nth(0).locator('img').evaluate(image => image.dispatchEvent(new Event('error')));
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb').getAttribute('data-preview-kind'),'poster');
    assert.equal(await episodes.nth(0).locator('img').getAttribute('src'),'https://images.test/title-poster.png');
    await episodes.nth(0).locator('img').evaluate(image => image.dispatchEvent(new Event('error')));
    assert.equal(await episodes.nth(0).locator('img').getAttribute('src'),'https://images.test/title-banner.png');
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-kind').innerText(),'Постер тайтла');
    await episodes.nth(0).locator('img').evaluate(image => image.dispatchEvent(new Event('error')));
    assert.equal(await episodes.nth(0).locator('img').count(),0);
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-kind').innerText(),'Нет изображения');
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-badge').innerText(),'1');
    assert.match(await episodes.nth(0).getAttribute('aria-label'),/Нет изображения/);

    // The native-video capture path provides an in-memory JPEG as a genuine
    // frame. A retired image must not corrupt its replacement through late errors.
    await page.evaluate(() => {
      const frame = document.querySelectorAll('.komi-episode-thumb')[6];
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
    assert.equal(await episodes.nth(6).locator('.komi-episode-thumb-kind').innerText(),'Кадр серии');
    assert.match(await episodes.nth(6).locator('img').getAttribute('src'),/^data:image\/jpeg/);

    await page.getByRole('button',{name:'Показать серии сеткой',exact:true}).click();
    assert.equal(await episodes.nth(64).innerText(),'65');
    assert.match(await episodes.nth(64).getAttribute('aria-label'),/Дополнительный выпуск 65/);
    await page.getByRole('button',{name:'Показать серии списком',exact:true}).click();
    assert.equal(await episodes.nth(0).locator('.komi-episode-thumb-kind').innerText(),'Постер тайтла',
      'A failed real preview must stay failed when switching view mode');
    assert.equal(await episodes.count(),68);
    assert.equal(await episodes.nth(67).getAttribute('data-episode-number'),'68');
    assert.deepEqual(errors,[]);
    console.log('PASS episode thumbnails: real frame, poster, duplicate/unsafe URLs, image-error recovery, captured-frame label, supplementary positions, retained click indices and accessible labels');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
