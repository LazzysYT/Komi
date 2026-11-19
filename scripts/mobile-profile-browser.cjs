// Responsive profile and friends drawer regression using synthetic public UI data only.
// This test does not authenticate or modify Supabase records.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.KOMI_TEST_URL || 'http://127.0.0.1:8765/';
const widths = [320, 375, 390, 620, 768, 900, 1280, 1366];

(async () => {
  const browser = await chromium.launch({headless:true,
    ...(process.env.KOMI_CHROME ? {executablePath: process.env.KOMI_CHROME} : {})});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.route('https://**/*', route =>
      route.fulfill({status:200,contentType:'application/json',body:'{}'}));
    await page.goto(BASE, {waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(() => typeof renderProfileView === 'function' &&
      typeof openFriendsDrawer === 'function');

    const setup = await page.evaluate(() => {
      const name = 'L'.repeat(40);
      window.komiProfileMobileTestName = name;
      const root = document.createElement('div');
      root.id = 'komi-mobile-profile-test-root';
      root.style.cssText = 'width:100%;min-width:0;max-width:100%;';
      document.getElementById('mainContainer').appendChild(root);
      currentUser = {username:name,authUserId:'test-ui-profile-user'};
      userProfiles[name] = {
        displayName:'N'.repeat(40),
        status:'Z'.repeat(100),
        avatar:'/anime-artwork.svg',
        regDate:'Проверка мобильного профиля'
      };
      userAnimeStatuses[name] = {'52991':'Просмотрено'};
      userCustomFolders[name] = {'Тестовая папка с очень длинным названием':[]};
      userFavorites[name] = {};
      animeList = [{
        id:'52991', shikimoriId:52991,
        title:'Проверочное аниме',genres:['Драма'],
        poster:'/anime-artwork.svg',year:2026,shikiRating:8,episodeCount:1
      }];
      profileTargetUser=null;
      profileActiveTab='Просмотрено';
      profileCollectionSearchQuery='';
      return name;
    });
    assert.equal(setup.length,40);
    const sections = ['overview','anime','friends','comments'];
    for (const width of widths) {
      await page.setViewportSize({width,height:844});
      for (const section of sections) {
        const info = await page.evaluate(section => {
          profilePageSection = section;
          renderProfileView(document.getElementById('komi-mobile-profile-test-root'));
          const profile = document.querySelector('#komi-mobile-profile-test-root .komi-profile-v2');
          const tabs = [...profile.querySelectorAll('.komi-profile-tab')];
          const counters = [...profile.querySelectorAll('.profile-stat-card')];
          const right = element => element.getBoundingClientRect().right;
          const candidates = [profile,...profile.querySelectorAll(
            '.profile-header-card,.profile-info-grid,.profile-name-row,' +
            '.profile-name-row h2,.profile-badge-item,.profile-stats-grid,' +
            '.komi-profile-tabs,.profile-layout-grid,.profile-settings-box'
          )];
          return {
            docWidth:document.documentElement.scrollWidth,
            viewport:innerWidth,
            farRight:Math.max(...candidates.map(right)),
            activeTabs:tabs.filter(el=>el.getAttribute('aria-pressed')==='true').length,
            activeLabels:counters.filter(el=>el.getAttribute('aria-pressed')==='true').length,
            activeTab:tabs.find(el=>el.getAttribute('aria-pressed')==='true')?.textContent.trim(),
            hasStatus:profile.textContent.includes('Z'.repeat(100)),
            nameWrap:getComputedStyle(profile.querySelector('.profile-name-row h2')).overflowWrap,
            profileWidth:profile.getBoundingClientRect().width
          };
        },section);
        assert.ok(info.farRight <= width + 3,
          'Profile widget clips horizontally at ' + width + ' ('+section+'): '+JSON.stringify(info));
        assert.ok(info.docWidth <= width + 3,
          'Document clips horizontally at ' + width + ' ('+section+'): '+JSON.stringify(info));
        assert.equal(info.activeTabs,1,'Exactly one active profile tab at '+width);
        assert.equal(info.activeLabels,1,'Exactly one active collection tab at '+width);
        assert.equal(info.hasStatus,true,'Long profile status must stay visible at '+width);
        assert.equal(info.nameWrap,'anywhere','Unbroken nickname should wrap');
      }
      if (width === 1280 || width === 1366) {
        const layout = await page.evaluate(() => {
          const main = document.getElementById('mainContainer');
          const before = main.getBoundingClientRect().width;
          openFriendsDrawer();
          const drawer = document.getElementById('komiFriendsDrawer');
          const computed = getComputedStyle(drawer);
          const box = drawer.getBoundingClientRect();
          const after = main.getBoundingClientRect().width;
          const open = drawer.classList.contains('open') && !drawer.hasAttribute('inert');
          closeFriendsDrawer();
          const closed = drawer.hasAttribute('inert') && !drawer.classList.contains('open');
          return {before,after,position:computed.position,right:box.right,
            width:box.width,open,closed};
        });
        assert.equal(layout.position,'fixed','Friends drawer must overlay the main page');
        assert.ok(layout.open && layout.closed,'Drawer open/close and inert must work');
        assert.ok(Math.abs(layout.before-layout.after)<1,'Drawer must not shrink catalog');
        assert.ok(layout.width < width / 2, 'Drawer too wide on laptop '+width);
      }
      console.log('PASS responsive profile and drawer '+width);
    }
    await page.close();
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
