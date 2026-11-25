/* Keep the dormant hero template on the shared renderer and bundled seed.
 * Boot reorders these titles and installs the decoded daily artwork before
 * revealing it; the fixed template must never paint without that preparation. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {cachedPosterUrl} = require('../poster-cache-client.js');
const root = path.join(__dirname, '..');
function buildHomeShell() {
  const scope = {URL, Date}; scope.window = scope;
  vm.createContext(scope);
  for (const file of ['anime-description.js','komi-home-snapshot.js','komi-home-seed.js','home-discovery.js'])
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),scope,{filename:file});
  const markup = scope.KomiHomeDiscovery.render({
    animeList:scope.KomiHomeSeed, currentUser:null, currentSlideIndex:0,
    year:a=>String(a.year || '').match(/(?:19|20)\d{2}/)?.[0] || '',
    type:a=>a.type,
    // Match animeArtwork's home-sized poster path. Dedicated landscape banners
    // are selected by the shared hero renderer and remain native/high priority.
    artwork:a=>cachedPosterUrl(String(a.banner || a.poster || '/anime-artwork.svg')
      .replace(/(https:\/\/shikimori\.(?:io|one)\/system\/animes\/)preview(\/[1-9]\d*\.jpe?g(?:\?\d+)?)/i,'$1original$2'),768),
    renderCard:()=>'', genres:()=>''
  });
  const hero = markup.match(/<section class="komi-home-hero"[\s\S]*?<\/section>/)?.[0];
  if (!hero) throw new Error('Rendered first-paint hero missing');
  const dailyIds = require('../komi-home-boot.js').lineup(scope.KomiHomeSeed).map(item=>String(item.id));
  const templateIds = [...hero.matchAll(/data-komi-anime-id="([0-9]+)"/g)].map(match=>match[1]);
  if (dailyIds.length !== 5 || templateIds.length !== 5 ||
      dailyIds.some(id=>!templateIds.includes(id)))
    throw new Error('First-paint template must contain all five daily titles');
  const file = path.join(root,'index.html'), html = fs.readFileSync(file,'utf8');
  const marker = /(<template class="komi-boot-real-hero">)[\s\S]*?(<\/template>)/;
  if (!marker.test(html)) throw new Error('Dormant hero template marker missing');
  const next = html.replace(marker, (_match,start,end)=>start+hero+end);
  if (process.argv.includes('--check')) {
    if (next !== html) throw new Error('First-paint hero is stale: run node scripts/build-home-shell.cjs');
  } else fs.writeFileSync(file,next);
  console.log('PASS dormant hero template matches public storefront renderer');
}
if (require.main === module) buildHomeShell();
module.exports = {buildHomeShell};
