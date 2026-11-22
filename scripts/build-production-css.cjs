'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');
// Keep the same ordering as the historic index.html stylesheet links.
const sources=Object.freeze(["komi.bundle.css","mobile-home-polish.css","mobile-catalog-dock.css","catalog-comfort.css","player-comfort.css","mobile-bottom-sheets.css","auth-dialog.css","catalog-discovery-v4.css","community-search.css","komi-checkout.css","komi-shop-cosmetics.css","komi-shop-visual.css","komi-shop-v3.css"]);
function buildCSS(){return "/* Komi production CSS — generated from ordered files; do not edit directly. */\n"+sources.map(name=>`/* --- ${name} --- */\n${fs.readFileSync(path.join(root,name),'utf8').trimEnd()}\n`).join('\n');}
if(require.main===module){fs.writeFileSync(path.join(root,'komi.production.css'),buildCSS(),'utf8');console.log('Generated komi.production.css');}
module.exports={sources,buildCSS};
