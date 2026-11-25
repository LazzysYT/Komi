const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.KOMI_TEST_URL || 'https://komi-six.vercel.app/';
const output = path.resolve('browser-test-results');
fs.mkdirSync(output, { recursive: true });
function measureGenreLayout({ selector, withTools }) {
  const section = document.querySelector(selector);
  const moods = section?.querySelector('.komi-moods');
  const cards = [...(moods?.querySelectorAll('.komi-mood-card') || [])];
  const heading = section?.querySelector(':scope > .komi-catalog-head-row');
  const pills = section?.querySelector(':scope > .komi-catalog-category-pills');
  if (!section || !moods || cards.length !== 8 || (withTools && (!heading || !pills))) {
    return { ok:false, issue:'Expected eight genre cards and route-specific catalog rows', cards:cards.length };
  }
  const sectionBox = section.getBoundingClientRect();
  const moodsBox = moods.getBoundingClientRect();
  const boxes = cards.map(card => card.getBoundingClientRect());
  const columns = innerWidth >= 1024 ? 4 : 2;
  // Width:100% fills the parent's content box, not its padded border box.
  const sectionStyle = getComputedStyle(section);
  const pixels = property => parseFloat(sectionStyle.getPropertyValue(property)) || 0;
  const contentLeft = sectionBox.left + pixels('border-left-width') + pixels('padding-left');
  const contentRight = sectionBox.right - pixels('border-right-width') - pixels('padding-right');
  const contentWidth = contentRight - contentLeft;
  const fullWidth = contentWidth > 0 && moodsBox.width >= contentWidth * 0.95;
  const alignedEdges = Math.abs(moodsBox.left - contentLeft) <= 2 && Math.abs(moodsBox.right - contentRight) <= 2;
  const wideCards = boxes.every(box => box.width >= sectionBox.width / columns * 0.7);
  const sameRow = boxes.slice(0, columns).every(box => Math.abs(box.top - boxes[0].top) <= 3);
  const secondRow = boxes[columns].top >= boxes[0].bottom - 3;
  const headingBox = heading?.getBoundingClientRect();
  const pillsBox = pills?.getBoundingClientRect();
  const belowGenres = !withTools || headingBox.top >= Math.max(...boxes.map(box => box.bottom)) - 3;
  const pillsBelow = !withTools || pillsBox.top >= headingBox.bottom - 3;
  const routeControls = withTools ? pills.querySelectorAll('[data-komi-category]').length === 5
    : cards.every(card => card.tagName === 'A' && new URL(card.href).pathname === '/catalog' &&
        new URL(card.href).searchParams.get('genre') === card.dataset.komiMoodGenre) &&
      !document.querySelector('.komi-home-storefront .komi-catalog-tools, #komiCatalogGrid');
  const horizontalOverflow = document.documentElement.scrollWidth > innerWidth + 2;
  return {ok:fullWidth && alignedEdges && wideCards && sameRow && secondRow && belowGenres && pillsBelow && routeControls && !horizontalOverflow,
    cards:cards.length,columns,fullWidth,alignedEdges,wideCards,sameRow,secondRow,belowGenres,pillsBelow,routeControls,horizontalOverflow,
    firstCardWidth:Math.round(boxes[0].width),sectionWidth:Math.round(sectionBox.width),
    contentWidth:Math.round(contentWidth),moodsWidth:Math.round(moodsBox.width)};
}
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
      await page.waitForSelector('.komi-home-discovery .komi-home-genres-section .komi-mood-card', {timeout:45000});
      const state = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        mainText: (() => { const main=document.querySelector('main') || document.getElementById('mainContainer'); return (main?.innerText?.trim() || main?.textContent?.trim() || '').slice(0,300); })(),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        firstShelfVisible: getComputedStyle(document.querySelector('.komi-home-popular')).contentVisibility === 'visible',
        googleButton: !!document.querySelector('.komi-google-btn'),
        loginForm: !!document.querySelector('#loginFormContainer'),
        registrationForm: !!document.querySelector('#registerFormContainer'),
      }));
      // Home genres span their own section; the catalog keeps its separate
      // heading, tools and category rows. Check both against legacy grid drift.
      await page.locator('.komi-home-discovery .komi-home-genres-section').scrollIntoViewIfNeeded();
      const genreLayout = await page.evaluate(measureGenreLayout, {
        selector:'.komi-home-discovery .komi-home-genres-section', withTools:false
      });
      await page.evaluate(() => navigate('catalog'));
      await page.waitForSelector('#catalog.komi-catalog-v5 .komi-catalog-category-pills');
      await page.locator('#catalog.komi-catalog-v5').scrollIntoViewIfNeeded();
      const catalogLayout = await page.evaluate(measureGenreLayout, {selector:'#catalog.komi-catalog-v5',withTools:true});
      await page.evaluate(() => navigate('home'));
      await page.waitForSelector('.komi-home-discovery .komi-home-genres-section .komi-mood-card');
      const result = { width, status: response?.status(), ...state, genreLayout, catalogLayout, errors };
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
      if (!catalogLayout.ok) { console.error('FAIL catalog layout', catalogLayout); process.exitCode = 1; }
      if (Object.values(authChecks).some(value => value !== true)) {
        console.error('FAIL auth UI', authChecks);
        process.exitCode = 1;
      }
      await page.screenshot({ path: path.join(output, 'komi-' + width + '.png'), fullPage: true });
      if (!response?.ok() || !state.mainText.trim() || !state.firstShelfVisible || state.horizontalOverflow || errors.length) {
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
