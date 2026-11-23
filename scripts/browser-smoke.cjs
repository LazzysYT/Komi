const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.KOMI_TEST_URL || 'https://komi-six.vercel.app/';
const output = path.resolve('browser-test-results');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.KOMI_CHROME ? {executablePath:process.env.KOMI_CHROME} : {}) });
  const results = [];
  for (const width of [1440, 768, 390, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let response;
    try {
      response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Loading text is not evidence that the catalogue loaded successfully.
      await page.waitForFunction(() => typeof catalogInitialLoadComplete !== 'undefined' && catalogInitialLoadComplete, null, {timeout:45000});
      const state = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        mainText: (() => { const main=document.querySelector('main') || document.getElementById('mainContainer'); return (main?.innerText?.trim() || main?.textContent?.trim() || '').slice(0,300); })(),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        googleButton: !!document.querySelector('.komi-google-btn'),
        loginForm: !!document.querySelector('#loginFormContainer'),
        registrationForm: !!document.querySelector('#registerFormContainer'),
      }));
      // Visual layout contract: genres span the entire section and catalog tools
      // stack below them. Catch legacy three-column grid regressions on reload.
      const genreLayout = await page.evaluate(() => {
        const section = document.getElementById('komiHomeQuickFilters');
        const moods = section?.querySelector('.komi-moods');
        const cards = [...(moods?.querySelectorAll('.komi-mood-card') || [])];
        const heading = section?.querySelector(':scope > .komi-catalog-head-row');
        const pills = section?.querySelector(':scope > .komi-home-quick-categories');
        if (!section || !moods || cards.length !== 8 || !heading || !pills) {
          return { ok:false, issue:'Expected eight genre cards and separate catalog rows', cards:cards.length };
        }
        const sectionBox = section.getBoundingClientRect();
        const moodsBox = moods.getBoundingClientRect();
        const headingBox = heading.getBoundingClientRect();
        const pillsBox = pills.getBoundingClientRect();
        const boxes = cards.map(card => card.getBoundingClientRect());
        const columns = innerWidth >= 1024 ? 4 : 2;
        const fullWidth = moodsBox.width >= sectionBox.width * 0.95;
        const wideCards = boxes.every(box => box.width >= sectionBox.width / columns * 0.7);
        const sameRow = boxes.slice(0, columns).every(box => Math.abs(box.top - boxes[0].top) <= 3);
        const secondRow = boxes[columns].top >= boxes[0].bottom - 3;
        const belowGenres = headingBox.top >= Math.max(...boxes.map(box => box.bottom)) - 3;
        const pillsBelow = pillsBox.top >= headingBox.bottom - 3;
        return {ok:fullWidth && wideCards && sameRow && secondRow && belowGenres && pillsBelow,
          cards:cards.length,columns,fullWidth,wideCards,sameRow,secondRow,belowGenres,pillsBelow,
          firstCardWidth:Math.round(boxes[0].width),sectionWidth:Math.round(sectionBox.width)};
      });
      const result = { width, status: response?.status(), ...state, genreLayout, errors };
      results.push(result);
      // Exercise the real auth UI without creating test users or sending credentials.
      const authChecks = await page.evaluate(() => {
        const result = {};
        result.authModal = !!document.getElementById('authModal');
        result.login = !!document.getElementById('loginUsername') && !!document.getElementById('loginPassword');
        result.register = !!document.getElementById('regUsername') && !!document.getElementById('regEmail') && !!document.getElementById('regPassword');
        result.authFunctions = typeof openAuthModal === 'function' && typeof switchAuthTab === 'function';
        if (result.authFunctions && result.authModal) {
          openAuthModal('register');
          result.registerVisible = document.getElementById('authModal').classList.contains('active')
            && document.getElementById('registerFormContainer').style.display !== 'none';
          switchAuthTab('login');
          result.loginVisible = document.getElementById('loginFormContainer').style.display !== 'none';
          closeAuthModal();
          result.modalCloses = !document.getElementById('authModal').classList.contains('active');
        }
        return result;
      });
      result.authChecks = authChecks;
      if (!genreLayout.ok) { console.error('FAIL genre layout', genreLayout); process.exitCode = 1; }
      if (Object.values(authChecks).some(value => value !== true)) {
        console.error('FAIL auth UI', authChecks);
        process.exitCode = 1;
      }
      await page.screenshot({ path: path.join(output, 'komi-' + width + '.png'), fullPage: true });
      if (!response?.ok() || !state.mainText.trim() || state.horizontalOverflow || errors.length) {
        console.error('FAIL', result);
        process.exitCode = 1;
      } else console.log('PASS', result);
    } catch (e) {
      results.push({ width, error: e.message, errors });
      console.error('FAIL', width, e.message);
      process.exitCode = 1;
    } finally { await page.close(); }
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
