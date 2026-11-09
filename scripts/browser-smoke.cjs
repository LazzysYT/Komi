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
        mainText: document.querySelector('main')?.innerText?.slice(0, 300) || '',
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        googleButton: !!document.querySelector('.komi-google-btn'),
        loginForm: !!document.querySelector('#loginFormContainer'),
        registrationForm: !!document.querySelector('#registerFormContainer'),
      }));
      const result = { width, status: response?.status(), ...state, errors };
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
