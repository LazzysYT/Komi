/* Build-only: omit positively identified feature rules from the public home's
 * first stylesheet. This is an explicit ownership list, not a DOM/usage purge.
 * Full CSS remains intact and is applied in its original cascade position.
 * Direct catalog/shop/partners/profile entries promote that full stylesheet in
 * komi-home-boot.js; watch has its own early overlay guard and compact sheet.
 * Keep those entry paths when adding a new feature family here. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ancestors='(?:(?:(?:html|body)(?:[.#][\\w-]+)*|\\.komi-media-hub|#mainContainer)\\s+)*';
const descendantScope=new RegExp('^'+ancestors+
  '(?:#watchModal|#authModal|#shop|#profile|#watchPartyModal|#randomRouletteModal|'+
  '\\.komi-profile-v2|\\.komi-shop-v3|\\.watch-cinema-layout)(?:[.#][\\w-]+)*(?:\\s+|>)');
// Checked against the home renderer, header/community renderers and each owner:
// app-main profile/admin/partners; player and episode UI; mobile-bottom-sheets;
// AniCoin storefront/preview; Premium checkout. Shared komi-store-* cosmetics,
// badges, generic cards/buttons, navigation and search deliberately stay out.
const featurePrefixes=Object.freeze([
  'profile-','komi-profile-',
  'watch-','komi-watch-','player-','players-','komi-player-',
  'crunchy-','ep-crunchy-','episode-','komi-episode-','anime-screenshots-',
  'komi-mobile-sheet-',
  'sv3-','komi-shop-','komi-coin-','anicoin-','komi-checkout-',
  'admin-','komi-partner-','komi-partners-'
]);
const featureScope=new RegExp('^'+ancestors+'\\.(?:'+featurePrefixes.join('|')+')'+
  '[\\w-]+(?=[.#:\\[\\s>]|$)');
// Preserve the feature containers themselves, including their hidden/open
// states and backdrop rules. Only their positively scoped contents may defer.
const featureRoots=Object.freeze([
  'profile-container','komi-profile-v2','watch-cinema-layout',
  'komi-mobile-sheet-layer','komi-checkout-overlay','komi-shop-dialog',
  'komi-shop-gift-dialog','sv3-promo-dialog','anicoin-shop',
  'komi-shop-v3','komi-shop-v4'
]);
const featureRoot=new RegExp('^'+ancestors+'\\.(?:'+featureRoots.join('|')+')'+
  '(?:(?:[.#][\\w-]+)|(?:\\[[^\\]]*\\])|(?:::[\\w-]+)|(?::[\\w-]+(?:\\([^()]*\\))?))*$');
function keepsHiddenState(rule){
  let hidden=rule.selectors.some(selector=>/\[\s*hidden(?:\s|=|\])/i.test(selector));
  rule.walkDecls(declaration=>{
    const property=declaration.prop.toLowerCase(),value=declaration.value.trim().toLowerCase();
    if((property==='display'&&value==='none')||
       (property==='visibility'&&/^(?:hidden|collapse)$/.test(value))||
       (property==='content-visibility'&&value==='hidden')||
       (property==='opacity'&&/^0(?:\.0+)?%?$/.test(value)))hidden=true;
  });
  return hidden;
}
function isFeatureRule(rule){
  for(let parent=rule.parent;parent;parent=parent.parent)
    if(parent.type==='atrule'&&/keyframes/i.test(parent.name))return false;
  if(!rule.selectors.length||keepsHiddenState(rule))return false;
  return rule.selectors.every(selector=>{
    const s=selector.trim();
    // Every comma-list branch must have a positive feature owner. Reject
    // sibling combinators, escaped tokens, root-only and uncertain selectors.
    return !/[+~\\]/.test(s)&&!featureRoot.test(s)&&
      (descendantScope.test(s)||featureScope.test(s));
  });
}
function makeCritical(css,postcss){
  const root=postcss.parse(css);
  root.walkRules(rule=>{if(isFeatureRule(rule))rule.remove();});
  // Do not remove at-rules: layer ordering and declarations must survive.
  return root.toString();
}
function postcssPackage(){
  for(const bin of process.env.PATH.split(path.delimiter)){
    const packagePath=path.join(bin,'..','postcss','package.json');
    if(fs.existsSync(packagePath))return require(path.dirname(packagePath));
  }
  return require('postcss');
}
function buildFirstPaint(root){
  const postcss=postcssPackage();
  // Self-check conservative filtering on comma lists, hidden roots and siblings.
  const sample='#watchModal{display:none}#watchModal .only-watch{color:red}#watchModal .both,.home{color:white}#watchModal + .sibling{color:blue}@media(max-width:500px){body.komi-media-hub #shop .only-shop{color:red}}';
  const check=makeCritical(sample,postcss);
  if(check.includes('only-watch')||check.includes('only-shop')||!check.includes('display:none')||!check.includes('.home')||!check.includes('.sibling'))throw Error('Critical CSS filter self-check failed');
  const full=fs.readFileSync(path.join(root,'komi.production.css'),'utf8');
  const first=makeCritical(full,postcss);
  const original=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const match=original.match(/<link rel="stylesheet" href="\/komi\.production\.css\?v=[^"]+">/);
  if(!match)throw Error('Expected source stylesheet link missing');
  if(first.length>=full.length||first.length<50000)throw Error('Unexpected first-paint CSS size');
  const href=match[0].match(/href="([^"]+)"/)[1];
  const firstHref=href.replace('/komi.production.css','/komi.first-paint.css');
  const tag='<link rel="stylesheet" href="'+firstHref+'" data-komi-first-paint>\n    '+match[0].replace('>',' media="print" data-komi-deferred-style="base">')+'\n    <noscript><link rel="stylesheet" href="'+href+'"></noscript>';
  fs.writeFileSync(path.join(root,'komi.first-paint.css'),first);
  fs.writeFileSync(path.join(root,'index.html'),original.replace(match[0],tag));
  console.log('First-paint stylesheet: '+Buffer.byteLength(first)+' / '+Buffer.byteLength(full)+' bytes; original full cascade retained');
}
module.exports={makeCritical,buildFirstPaint,isFeatureRule};
