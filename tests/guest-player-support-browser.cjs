'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.KOMI_PLAYWRIGHT || 'playwright');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const app = read('app-main.js');
const part = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)+start.length));
const css = ['komi.production.css', 'komi-pill-system.css', 'button-animations.css','komi-watch-compact-v6.css'].map(read).join('\n');
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}</style>
<div id="watchModal" class="modal-overlay active"><div id="watchModalContent" class="modal-content"></div></div>`;
const broken = 'https://kodikplayer.com/serial/7884/d5bb968fd3ac83b29b02a5c955166563/720p?season=1&only_episode=true&episode=2';
const sourceLink = n => 'https://embed.example/episode/' + n;

(async() => {
  const browser = await chromium.launch({ headless: true, ...(process.env.KOMI_CHROME ? {executablePath:process.env.KOMI_CHROME} : {}) });
  try {
    for (const width of [1280,850,390,320]) {
      const page = await browser.newPage({viewport:{width,height:780}});
      await page.route('**/*', route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>External embed fixture</title>'}));
      await page.setContent(html);
      await page.evaluate(({broken, alternatives}) => {
        window.komiCoreAbort = new AbortController();
        Object.assign(window,{
          animeList:[{id:5114,title:'Стальной алхимик: Братство',poster:'https://image.example/poster.jpg',genres:[],
            komiDetailsLoaded:true,komiDetailsLoadedAt:'ready',komiCardUpdatedAt:'ready',episodes:[
              {season:1,number:1,sources:{AniDUB:alternatives[0]}},
              {season:1,title:'Эпизод 2',sources:{AniDUB:broken,'Озвучка A':alternatives[1],'Озвучка Б':alternatives[2]}}
            ]}],
          siteStats:{views:0}, saveData(){}, komiDetailOpenToken:0, komiWatchSourceIntent:null,
          currentUser:null,_supabase:null,userWatchHistory:{},userFavorites:{},userAnimeStatuses:{},userCustomFolders:{},
          activePlayerSource:'',KOMI_ANIVIBE_LABEL:'AniVibe · партнёрский',komiAdFreeOnly:()=>false,
          komiAniVibeEpisodeSource:async()=>'',getKomiProgress:()=>null,saveKomiEpisode(){},animeArtwork:()=>'/anime-artwork.svg',
          cleanAnimeDescription:()=>'',animeDetailsMarkup:()=>'',renderAnimeExtras(){},bindKomiPlayer(){},
          playSound(){},createWatchPartyFromAnime(){},komiFindEpisode(){},saveProgress(){},disposeKomiMedia(){},
          komiMountFollowButton(){},
          escapeFriendHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
          KomiPlayerUX:{ mount() {
            const content=document.getElementById('watchModalContent');
            return {content,modal:document.getElementById('watchModal'),abort:window.komiCoreAbort,note:document.createElement('p')};
          }},
          KomiComments:{mount(){
            const node=document.createElement('section');node.id='komiAnimeComments';node.textContent='Комментарии';
            document.getElementById('watchModalContent').append(node);
          }}
        });
      },{broken,alternatives:[sourceLink(1),sourceLink('2A'),sourceLink('2B')]});
      for(const name of ['player-core.js','player-source-preferences.js','mobile-bottom-sheets.js','cinema-watch-monochrome.js','komi-watch-compact-v6.js'])
        await page.addScriptTag({content:read(name)});
      await page.addScriptTag({content:part('function closeWatchModal(', 'const KOMI_ADFREE_ONLY_KEY')+
        part('function komiPlayerKind(', 'function restoreKomiVideo(')+
        part('function komiWatchEpisodePresentation(', '// Follows are stored per verified account')+
        part('function changePlayerSource(', '// Cache only active title details')});
      // Simulate the site's delegated handler while the real source/select logic,
      // mobile sheets, episode entry point and per-episode filtering run unmodified.
      await page.evaluate(async () => {
        document.addEventListener('change', event=>{
          if (event.target.id !== 'komiWatchSourceSelect') return;
          const args = /^changePlayerSource\('([0-9]+)',([0-9]+),([0-9]+),this\.value\)$/
            .exec(event.target.getAttribute('data-komi-onchange') || '');
          if (args) void window.changePlayerSource(args[1],Number(args[2]),Number(args[3]),event.target.value);
        });
        await window.openWatchModal(5114, 1, 0, 'AniDUB', 2);
      });
      const player=page.locator('.player-wrapper');
      assert.equal(await player.locator('iframe').getAttribute('src'),sourceLink('2A'));
      const bar=page.getByRole('group',{name:'Управление плеером'});
      const help=bar.getByRole('button',{name:'Видео не работает?'});
      const select=bar.getByRole('combobox',{name:'Озвучка'});
      const mobilePicker=bar.getByRole('button',{name:'Озвучка'});
      assert.ok(await help.isVisible(), 'visible help on ' + width + ': ' + await page.evaluate(() => {let el=document.querySelector('#komiPlayerHelp'), out=[];while(el){const c=getComputedStyle(el);out.push([el.tagName,el.className,c.display,c.visibility]);el=el.parentElement;}return JSON.stringify(out);}));
      assert.equal(await select.isVisible(), width>=768, 'desktop picker only');
      assert.equal(await mobilePicker.isVisible(), width<768, 'mobile picker only');
      const [videoBox,barBox,helpBox] = await Promise.all([player.boundingBox(),bar.boundingBox(),help.boundingBox()]);
      assert.ok(barBox.y>=videoBox.y+videoBox.height-1&&barBox.x>=0&&barBox.x+barBox.width<=width+1&&helpBox.height>=44, JSON.stringify({width,videoBox,barBox,helpBox}));
      const recovery=page.locator('#komiPlayerRecovery');
      assert.ok(!(await recovery.isVisible()));
      await help.click();
      assert.ok(await recovery.isVisible());
      assert.equal(await help.getAttribute('aria-expanded'),'true');
      assert.ok(await recovery.getByRole('button',{name:'Повторить загрузку'}).evaluate(button=>document.activeElement===button));
      assert.ok(await recovery.getByRole('button',{name:'Сменить источник'}).isVisible());
      await help.click();
      assert.ok(!(await recovery.isVisible()));
      if(width<768) {
        await mobilePicker.click();
        const dialog=page.getByRole('dialog',{name:'Озвучка и источник'});
        assert.ok(await dialog.getByRole('button',{name:'Озвучка Б'}).isVisible());
        assert.equal(await dialog.getByRole('button',{name:'AniDUB'}).count(),0);
        await dialog.getByRole('button',{name:'Озвучка Б'}).click();
      } else {
        assert.equal(await select.getByRole('option',{name:'AniDUB'}).count(),0);
        await select.selectOption('Озвучка Б');
      }
      await page.waitForFunction(url=>document.querySelector('.player-wrapper iframe')?.src===url,sourceLink('2B'));
      await page.close();
    }
    console.log('PASS guest watch escape, source alternatives and help dock at 1280, 850, 390 and 320 px (embed fixtures)');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
