const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.KOMI_TEST_URL || 'https://komi-six.vercel.app/';
const output = path.resolve('browser-test-results');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const width of [375, 768, 1366, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let response;
    try {
      response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
      try {
        await page.waitForFunction(
          () => typeof catalogInitialLoadComplete !== 'undefined' && catalogInitialLoadComplete,
          null, { timeout: 15000 }
        );
      } catch (waitError) {
        const diagnostic = await page.evaluate(() => ({
          url: location.href,
          title: document.title,
          snippet: document.body?.innerText?.slice(0, 180),
          catalogLoaded: typeof catalogInitialLoadComplete === 'undefined' ? 'undefined' : catalogInitialLoadComplete,
          hasSupabase: typeof _supabase !== 'undefined' && !!_supabase,
          catalogSize: typeof animeList === 'undefined' ? -1 : animeList.length
        })).catch(e => ({ diagnosticError: e.message }));
        throw new Error('Catalog load timeout: ' + JSON.stringify({
          status: response?.status(), ...diagnostic, pageErrors: errors.slice(0, 4)
        }));
      }
      const catalogChecks = await page.evaluate(async () => {
        const playable = animeList.find(anime => Number(anime.episodeCount) > 0);
        const allCardOnly = animeList.every(anime => Array.isArray(anime.episodes) && anime.episodes.length === 0);
        const result = {
          total: animeList.length,
          initialCardsAreLightweight: allCardOnly,
          playableId: playable?.id || null,
          filteredCount: 0,
          detailsLoaded: false,
          modalHasSeries: false
        };
        if (!playable) return result;
        const previousSearch = catalogSearchQuery;
        catalogSearchQuery = String(playable.title).slice(0, 5);
        result.filteredCount = komiCatalogFiltered().length;
        catalogSearchQuery = previousSearch;
        await openWatchModal(playable.id);
        result.detailsLoaded = Boolean(playable.komiDetailsLoaded);
        result.modalHasSeries = Boolean(document.querySelector('#watchModal .komi-watch-stage'));
        closeWatchModal();
        return result;
      });
      const state = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        mainText: document.querySelector('main')?.innerText?.slice(0, 300) || '',
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        googleButton: !!document.querySelector('.komi-google-btn'),
        loginForm: !!document.querySelector('#loginFormContainer'),
        registrationForm: !!document.querySelector('#registerFormContainer'),
      }));
      const result = { width, status: response?.status(), ...state, catalogChecks, errors };
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
      if (Object.values(authChecks).some(value => value !== true)) {
        console.error('FAIL auth UI', authChecks);
        process.exitCode = 1;
      }
      await page.screenshot({ path: path.join(output, 'komi-' + width + '.png'), fullPage: true });
      if (!response?.ok() || !state.mainText.trim() || state.horizontalOverflow || errors.length || catalogChecks.total < 5000 || !catalogChecks.initialCardsAreLightweight || !catalogChecks.filteredCount || !catalogChecks.detailsLoaded || !catalogChecks.modalHasSeries) {
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
