/* Read-only guest E2E against the actual production domain.
 * No sign-up, credentials, data modifications, room creation or RPC writes.
 * We check the DOM and navigation a real visitor can reach.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base='https://komianime.online/';
const output=path.join(__dirname,'../browser-test-results');
fs.mkdirSync(output,{recursive:true});

(async()=>{
  const browser=await chromium.launch({headless:true});
  const results=[];
  try {
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog',dialog=>dialog.dismiss().catch(()=>{}));
      try {
        const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
        assert.ok(response?.ok(),'Production HTTPS returned '+response?.status());
        if(width===1440) {
          const enforced=(response.headers()['content-security-policy']||'');
          assert.ok(enforced.includes("script-src-elem 'self' https://cdn.jsdelivr.net"),
            'Production must enforce allowed script elements, not only Report-Only');
          assert.doesNotMatch(enforced,/script-src-elem[^;]*'unsafe-inline'/i,
            'Inline <script> must remain blocked on the real domain');
          const legacyAttrs=enforced.includes("script-src-attr 'unsafe-inline'");
          const strictAttrs=enforced.includes("script-src-attr 'none'");
          assert.ok(strictAttrs || legacyAttrs,
            'Production must explicitly declare the HTML event attribute restriction');
          if(process.env.KOMI_EXPECT_STRICT_CSP==='1') {
            assert.ok(strictAttrs,'The deployed release must reject all inline HTML event handlers');
          } else if(legacyAttrs) {
            console.warn('Production has previous CSP attr exception; strict deployment not live yet');
          }
          const appResponse=await page.request.get(base+'app-main.js',{timeout:20000});
          assert.equal(appResponse.status(),200,'Public app-main.js must load after inline script extraction');
          assert.match(appResponse.headers()['content-type']||'',/javascript/i);
          assert.ok((await appResponse.body()).length>100000,'Main app script appears truncated');
          if (process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main') {
            // A live source check catches stale HTML / wrong alias even if
            // hydrated JavaScript happens to show the right storefront.
            const homepageHtml=await response.text();
            const checkedInHtml=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
            const revision=checkedInHtml.match(/<meta name="komi-ui-revision" content="([^"]+)"/)?.[1];
            assert.match(revision,/^\d{8}-[\w-]+$/,'Checked-in release must declare its UI revision');
            assert.equal(homepageHtml.match(/<meta name="komi-ui-revision" content="([^"]+)"/)?.[1],revision,
              'Main domain must serve the exact checked-in storefront revision');
            assert.equal(homepageHtml.match(/komi\.production\.css\?v=([^"]+)/)?.[1],revision,
              'The deployed HTML and stylesheet must belong to the same release');
            const staticCards=[...homepageHtml.matchAll(/<a\b[^>]*class="komi-discovery-card komi-seo-card"[^>]*>/g)];
            assert.equal(staticCards.length,12,'First paint must expose twelve native recommendations');
            for(const [card]of staticCards)assert.match(card,/href="\/anime\/[1-9][0-9]{0,11}"/);
            const staticGenres=[...homepageHtml.matchAll(/<a\b[^>]*class="komi-mood-card"[^>]*href="([^\"]+)"[^>]*data-komi-mood-genre="([^\"]+)"[^>]*>/g)];
            assert.equal(staticGenres.length,8,'First paint must expose all eight native genre links');
            for(const [,href,genre]of staticGenres){
              const destination=new URL(href.replace(/&amp;/g,'&'),base);
              assert.equal(destination.pathname,'/catalog');
              assert.equal(destination.searchParams.get('genre'),genre);
            }
            assert.doesNotMatch(homepageHtml,/id="komiHomeQuickFilters"|data-komi-more-filters="home"|data-komi-home-category=/,
              'Expanded filters and catalog categories belong in the catalog');
            console.log('PASS production first-paint recommendations, genre filters and catalog navigation');
            const cssHref=homepageHtml.match(/href="(\/komi\.production\.css\?v=[^"]+)"/)?.[1]
              || '/komi.production.css';
            const css=await page.request.get(new URL(cssHref,base).href,{timeout:20000});
            assert.equal(css.status(),200,'Current production CSS must be available');
            assert.match(css.headers()['content-type']||'',/text\/css/,'Stylesheet must be served as CSS');
            assert.ok((await css.body()).length>200000,'Production CSS is missing core styles');
            const denied=await page.request.get(
              base+'api/poster?src='+encodeURIComponent('https://127.0.0.1/private'),
              {timeout:20000});
            assert.equal(denied.status(),400,'Poster endpoint must reject arbitrary hosts before fetch');
            const poster=await page.request.get(
              base+'api/poster?src='+encodeURIComponent(
                'https://shikimori.io/uploads/poster/animes/52991/dc841cc9fce2aa1e9907a4b61c5d1d92.jpeg'),
              {timeout:30000});
            assert.ok([200,502].includes(poster.status()),'Poster cache route must exist and handle upstream outages');
            if (poster.status()===200) {
              assert.match(poster.headers()['content-type']||'',/^image\//);
              // Vercel strips s-maxage before forwarding the response to browsers.
              assert.match(poster.headers()['cache-control']||'',/max-age=60/);
              const cacheResult=poster.headers()['x-vercel-cache']||'unknown';
              console.log('Poster CDN cache result:',cacheResult);
            } else console.warn('Poster upstream unavailable; browser fallback to direct/local remains active');
            console.log('PASS production combined stylesheet and poster cache validation');
          }
          // This changes only the in-memory test page. No user account or
          // server data is touched.
          await page.evaluate(()=>{
            window.__liveCspInlineProbe=false;
            const inline=document.createElement('script');
            inline.textContent='window.__liveCspInlineProbe=true';
            document.body.appendChild(inline);
          });
          assert.equal(await page.evaluate(()=>window.__liveCspInlineProbe),false,
            'Live production CSP must block injected inline JavaScript');
          console.log('PASS production security headers, external main JS and enforced inline-script block');
        }
        await page.waitForFunction(()=>typeof catalogInitialLoadComplete!=='undefined' && catalogInitialLoadComplete,null,{timeout:75000});
        await page.waitForSelector('#mainContainer .komi-home-popular .komi-discovery-card',{timeout:30000});
        const initial=await page.evaluate(()=>{
          const canonical=document.querySelector('link[rel=canonical]')?.href||'';
          const domain=location.hostname;
          const cardCount=document.querySelectorAll('.komi-home-discovery .komi-home-popular .komi-discovery-card').length;
          return {domain,canonical,cardCount,title:document.title,
             profileDrawer:!!document.getElementById('komiFriendsDrawer'),
             videoModal:!!document.getElementById('watchModal'),
             logo:!!document.querySelector('.komi-side-logo'),
             overflow:document.documentElement.scrollWidth>innerWidth+2,
             loading:!catalogInitialLoadComplete};
        });
        assert.equal(initial.domain,'komianime.online');
        assert.ok(initial.canonical.startsWith(base),'Canonical URL should match the public domain');
        assert.ok(initial.cardCount>0&&initial.cardCount<=12,'The recommendation rail must contain real bounded cards');
        const genres=page.locator('.komi-home-discovery .komi-home-genres-section a[data-komi-mood-genre]');
        assert.equal(await genres.count(),8,'Hydrated home must preserve the eight native genre links');
        assert.equal(initial.overflow,false,'Page should not overflow horizontally');
        // Verify the actual production asset response, not an assumed Vite/public path.
        const posterResponse=await page.request.get(new URL('anime-artwork.svg',base).href,{timeout:15000});
        assert.equal(posterResponse.status(),200,'Random anime fallback must be publicly served');
        assert.ok((posterResponse.headers()['content-type']||'').includes('image/svg+xml'),
          'Random anime artwork must be served as SVG, not an HTML fallback');
        if(width===1440){
          // These must be served as HTML/XML by Vercel, not just appear in GitHub.
          const detail=await page.request.get(base+'anime/52991',{timeout:30000});
          assert.equal(detail.status(),200,'SEO anime detail URL must return HTTP 200');
          assert.match(detail.headers()['content-type']||'',/text\/html/,
            'Anime detail must be real HTML');
          const seoHtml=await detail.text();
          assert.match(seoHtml,/<title>[^<]+Komi Anime<\/title>/);
          assert.match(seoHtml,/href="https:\/\/komianime\.online\/anime\/52991"/);
          assert.match(seoHtml,/application\/ld\+json/);
          const sitemap=await page.request.get(base+'sitemap.xml',{timeout:60000});
          assert.equal(sitemap.status(),200,'Live XML sitemap must be available');
          assert.match(sitemap.headers()['content-type']||'',/xml/);
          const sitemapXml=await sitemap.text();
          assert.match(sitemapXml,/<urlset/);
          const indexed=(sitemapXml.match(/<url>/g)||[]).length;
          assert.ok(indexed>=7000,'Expected 7000+ URLs, got '+indexed);
          assert.match(sitemapXml,/https:\/\/komianime\.online\/anime\/52991/);
          const robots=await page.request.get(base+'robots.txt',{timeout:12000});
          assert.equal(robots.status(),200,'robots.txt must be available');
          const robotsText=await robots.text();
          assert.match(robotsText,/Sitemap: https:\/\/komianime\.online\/sitemap\.xml/);
          assert.match(robotsText,/Allow:\s*\//);
          assert.doesNotMatch(robotsText,/Disallow:\s*\/anime\//,'Anime pages must be crawlable');
          // This is a production domain, not a preview deployment: it must be
          // public even when Vercel Authentication protects preview branches.
          // Run on PRs too, so changing Vercel's project-level SSO settings
          // cannot silently break shared anime links.
          const mirror=await page.request.get('https://komi-six.vercel.app/anime/52991',{timeout:30000});
          assert.equal(mirror.status(),200,'Public production mirror must not require Vercel sign-in');
          assert.match(mirror.headers()['content-type']||'',/text\/html/i,'Mirror route must serve SSR HTML');
          const mirrorHtml=await mirror.text();
          assert.match(mirrorHtml,/rel="canonical" href="https:\/\/komianime\.online\/anime\/52991"/,
            'Mirror SSR title must point to canonical primary-domain URL');
          assert.match(mirrorHtml,/Фрирен/,'Mirror SSR route must render the real anime title');
          assert.doesNotMatch(mirrorHtml,/Vercel Authentication|PERMISSION_DENIED/i);
          assert.match(mirror.headers()['x-robots-tag']||'',/noindex/i,'Mirror title must not be indexed');
          assert.doesNotMatch(detail.headers()['x-robots-tag']||'',/noindex/i,'Primary canonical title must be indexable');
          // Unlike a raw HTTP GET, these checks exercise an actual fresh browser
          // context (incognito-equivalent), direct address-bar navigation and F5.
          // Never use the SPA home page as a fallback for title detail SSR.
          for(const host of ['komianime.online','komi-six.vercel.app']){
            const isolated=await browser.newContext({viewport:{width:1280,height:800}});
            try{
              const titleTab=await isolated.newPage();
              const directUrl='https://'+host+'/anime/52991';
              const direct=await titleTab.goto(directUrl,{waitUntil:'domcontentloaded',timeout:45000});
              assert.equal(direct?.status(),200,'Fresh direct title route failed on '+host);
              assert.equal(new URL(titleTab.url()).pathname,'/anime/52991');
              assert.match(await titleTab.locator('h1').innerText(),/Фрирен/);
              assert.equal(await titleTab.locator('link[rel="canonical"]').getAttribute('href'),
                'https://komianime.online/anime/52991');
              assert.match(await titleTab.locator('meta[property="og:image"]').getAttribute('content'),
                /^https:\/\/komianime\.online\/api\/poster\?src=/);
              const refreshed=await titleTab.reload({waitUntil:'domcontentloaded',timeout:45000});
              assert.equal(refreshed?.status(),200,'F5 direct title reload failed on '+host);
              assert.equal(new URL(titleTab.url()).pathname,'/anime/52991');
              assert.match(await titleTab.locator('h1').innerText(),/Фрирен/);
              console.log('PASS isolated browser direct URL + F5 on',host);
            }finally{await isolated.close()}
          }
          if(process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main'){
            assert.match(seoHtml,/<meta name="twitter:image" content="https:\/\/komianime\.online\/api\/poster\?src=/);
            assert.match(seoHtml,/<meta property="og:image:alt" content="Постер аниме/);
            assert.match(seoHtml,/<meta property="og:site_name" content="Komi Anime">/);
            console.log('PASS production per-anime OpenGraph and Twitter metadata');
          }
          console.log('PASS public mirror /anime/52991, canonical SEO, noindex and production routing');
          console.log('PASS SEO production: anime detail, JSON-LD, sitemap',indexed,'URLs, robots');
        }
        const posterText=await posterResponse.text();
        assert.ok(posterText.includes('<svg')&&posterText.includes('</svg>'),'Poster fallback must be valid SVG markup');
        await page.waitForFunction(()=>{
          const image=document.getElementById('rouletteImage');
          return image?.complete && image.naturalWidth>0;
        },null,{timeout:12000});
        assert.ok((await page.locator('#rouletteImage').getAttribute('src')).endsWith('anime-artwork.svg'));
        const socials=await page.evaluate(()=>Array.from(document.querySelectorAll('nav[aria-label="Социальные сети Komi Anime"] a')).map(link=>{
          const svg=link.querySelector('svg');
          const icon=svg?.querySelector('path');
          const box=link.getBoundingClientRect();
          const svgBox=svg?.getBoundingClientRect();
          const style=getComputedStyle(link);
          const svgStyle=svg?getComputedStyle(svg):null;
          return {href:link.href,ariaLabel:link.getAttribute('aria-label'),hasSvg:Boolean(icon),
            width:box.width,height:box.height,visibility:style.visibility,display:style.display,
            svgWidth:svgBox?.width||0,svgHeight:svgBox?.height||0,svgVisibility:svgStyle?.visibility||'hidden',
            pathArea:icon?Math.abs(icon.getBBox().width*icon.getBBox().height):0};
        }));
        assert.equal(socials.length,2,'TikTok and Telegram links must exist');
        for (const link of socials) {
          assert.ok(link.hasSvg,'Social link must have a rendered SVG icon');
          assert.ok(link.width>=30&&link.height>=30,'Social links must have a usable click target');
          assert.ok(link.visibility!=='hidden'&&link.display!=='none','Social icons must be visible');
          assert.ok(link.svgWidth>=16&&link.svgHeight>=16,'Social SVG must have visible rendered size');
          assert.equal(link.svgVisibility,'visible','Social SVG itself must not be CSS-hidden');
          assert.ok(link.pathArea>10,'Social SVG should contain drawable path geometry');
        }
        const adminDisabled=await page.evaluate(async()=>{
          const originalAlert=window.alert;
          window.alert=()=>{};
          try {return (await requireServerAdmin(true))===false
            && !document.getElementById('adminModal')
            && !document.getElementById('addModal')
            && !document.getElementById('adminPanelBtn')
            && !document.getElementById('addAnimeBtn');}
          finally {window.alert=originalAlert;}
        });
        assert.equal(adminDisabled,true,'Client admin actions must remain disabled for guests');
        await page.locator('#sideFriendsBtn').click({timeout:10000});
        await page.waitForFunction(()=>document.getElementById('komiFriendsDrawer').classList.contains('open'));
        await page.waitForFunction(()=>!document.getElementById('komiFriendsDrawer').hasAttribute('inert'));
        // The drawer transitions visibility over ~280ms; wait for the actual visible frame.
        await page.waitForFunction(()=>getComputedStyle(document.getElementById('komiFriendsDrawer')).visibility==='visible',null,{timeout:8000});
        const drawer=await page.evaluate(()=>({
          visible:getComputedStyle(document.getElementById('komiFriendsDrawer')).visibility,
          hasSearch:!!document.getElementById('komiFriendsSearch'),
          readable:document.getElementById('komiFriendsDrawerList').textContent.trim().length>0
        }));
        assert.equal(drawer.visible,'visible');
        assert.equal(drawer.hasSearch,true);
        assert.equal(await page.locator('#komiFriendsDrawer').getAttribute('aria-hidden'),'false',
          'Visible friends drawer must not be hidden from assistive technologies');
        await page.locator('#komiFriendsSearch').fill('CI-AUTOTEST');
        await page.locator('#komiFriendsDrawer .komi-friends-close').count().then(async count=>{
          if(count)await page.locator('#komiFriendsDrawer .komi-friends-close').click();
          else await page.evaluate(()=>closeFriendsDrawer());
        });
        await page.waitForFunction(()=>document.getElementById('komiFriendsDrawer').hasAttribute('inert'));
        assert.equal(await page.locator('#komiFriendsDrawer').getAttribute('aria-hidden'),'true',
          'Closed friends drawer must be hidden from assistive technologies');
        await page.evaluate(()=>openWatchPartyHub());
        await page.waitForFunction(()=>document.getElementById('authModal').classList.contains('active'));
        const google=page.locator('#authModal .komi-google-btn');
        assert.equal(await google.isVisible(),true,'Google sign-in must have a visible button');
        assert.ok((await google.innerText()).includes('Google'),'Google sign-in must have readable text');
        assert.equal(await page.locator('#tabLoginBtn').isVisible(),false,
          'Login footer link stays hidden while the login form itself is active');
        assert.equal(await page.locator('#tabRegisterBtn').isVisible(),true,
          'Login view must offer the register link');
        assert.equal(await page.locator('#loginFormContainer button[type="submit"]').isVisible(),true,
          'Komi sign-in submit button must be visible');
        await page.locator('#tabRegisterBtn').click();
        assert.equal(await page.locator('#registerFormContainer button[type="submit"]').isVisible(),true,
          'Registration submit button must appear when switching tabs');
        assert.equal(await page.locator('#tabLoginBtn').isVisible(),true,
          'Registration view must offer a visible return-to-login link');
        assert.equal(await page.locator('#tabRegisterBtn').isVisible(),false);
        await page.locator('#tabLoginBtn').click();
        assert.equal(await page.locator('#loginFormContainer button[type="submit"]').isVisible(),true);
        assert.equal(await page.locator('#tabRegisterBtn').isVisible(),true,
          'Switching back must restore the registration link');
        assert.equal(await page.locator('#tabLoginBtn').isVisible(),false);
        await page.evaluate(()=>closeAuthModal());
        await page.evaluate(()=>{location.hash='#shop'});
        await page.waitForSelector('#anicoin-title',{timeout:15000});
        await page.evaluate(()=>{location.hash='#catalog'});
        await page.waitForFunction(()=>currentView==='catalog');
        await page.waitForSelector('#komiCatalogGrid .anime-card',{timeout:30000});
        const finish=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,route:location.hash}));
        assert.equal(finish.overflow,false,'Catalog must not overflow horizontally');
        assert.equal(finish.route,'#catalog');
        assert.deepEqual(errors,[],'Page threw JavaScript exceptions');
        const result={width,initial,drawer,finish,errors};
        results.push(result);
        await page.screenshot({path:path.join(output,'live-komianime-'+width+'.png'),fullPage:true});
        console.log('PASS live production visitor',JSON.stringify(result));
      }catch(e){
        results.push({width,failed:e.message,errors});
        console.error('FAIL live production visitor',width,e.stack||e.message,'pageerrors',errors);
        process.exitCode=1;
      }finally{await page.close()}
    }
  }finally{
    fs.writeFileSync(path.join(output,'live-domain-results.json'),JSON.stringify(results,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
