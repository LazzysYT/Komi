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
    const sections = ['overview','anime','history','friends','achievements','activity','comments'];
    for (const width of widths) {
      await page.setViewportSize({width,height:844});
      for (const section of sections) {
        const info = await page.evaluate(section => {
          profilePageSection = section;
          // The async catalogue/account renderer may replace mainContainer between
          // viewport changes. Reattach the synthetic fixture, not production DOM.
          let fixture=document.getElementById('komi-mobile-profile-test-root');
          if(!fixture){fixture=document.createElement('div');fixture.id='komi-mobile-profile-test-root';fixture.style.cssText='width:100%;min-width:0;max-width:100%;';document.getElementById('mainContainer').appendChild(fixture);}
          renderProfileView(fixture);
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
            profileWidth:profile.getBoundingClientRect().width,
            navRight:profile.querySelector('.profile-navigation-shell').getBoundingClientRect().left,
            panelRight:profile.querySelector('#komiProfilePanel').getBoundingClientRect().right,
            navDirection:getComputedStyle(profile.querySelector('.profile-premium-tabs')).flexDirection,
            more:profile.querySelectorAll('.profile-more').length,
            tabs:tabs.length
          };
        },section);
        assert.ok(info.farRight <= width + 3,
          'Profile widget clips horizontally at ' + width + ' ('+section+'): '+JSON.stringify(info));
        assert.ok(info.docWidth <= width + 3,
          'Document clips horizontally at ' + width + ' ('+section+'): '+JSON.stringify(info));
        assert.equal(info.activeTabs,1,'Exactly one active profile tab at '+width);
        assert.equal(info.tabs,7,'All owner sections must be reachable');
        assert.equal(info.more,0,'No hidden navigation');
        if(width>=1100){assert.equal(info.navDirection,'column');assert.ok(info.navRight>=info.panelRight-1,'Right column must not overlap content');}
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
    await page.setViewportSize({width:390,height:844});
    const preview=await page.evaluate(()=>{
      const uid=currentUser.authUserId;
      userFavorites[currentUser.username]={'52991':'Любимые'};
      window.komiProfilePreviewOwner=uid;
      komiPrivacyState.owner=uid;komiPrivacyState.data={hide_profile:false,invisible:false};
      profilePageSection='overview';
      let root=document.getElementById('komi-mobile-profile-test-root');
      if(!root){root=document.createElement('div');root.id='komi-mobile-profile-test-root';root.style.cssText='width:100%;min-width:0;max-width:100%;';document.getElementById('mainContainer').appendChild(root);}
      renderProfileView(root);
      const p=root.querySelector('#profile');
      const exposed=p.querySelector('[data-profile-edit],[data-profile-balance],[data-profile-week-owner],[data-profile-tab="history"],[data-profile-tab="activity"],.profile-favorites-widget');
      const result={isPreview:p.dataset.profilePreview,exposed:!!exposed,exit:!!p.querySelector('[data-profile-preview-toggle]'),privateFavorite:p.textContent.includes('Проверочное аниме')};
      komiPrivacyState.data.hide_profile=true;renderProfileView(root);result.hidden=root.textContent.includes('Профиль скрыт');
      window.komiProfilePreviewOwner=null;komiPrivacyState.data.hide_profile=false;renderProfileView(root);result.restored=!!root.querySelector('[data-profile-edit]');
      return result;
    });
    assert.deepEqual(preview,{isPreview:'true',exposed:false,exit:true,privateFavorite:false,hidden:true,restored:true});
    console.log('PASS profile preview hides owner controls and private data, respects hidden profile and restores edit mode');
    await page.close();
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
