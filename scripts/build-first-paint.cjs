/* Build-only: retain all root/global rules and omit only positively scoped
 * descendants of features that are absent or hidden on the public home.
 * Full CSS remains intact and is applied in its original cascade position. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const scope=/^(?:(?:html|body)(?:[.#][\w-]+)*\s+)*(?:#watchModal|#authModal|#shop|#profile|\.komi-profile-v2|\.komi-shop-v3|\.watch-cinema-layout)(?:[.#][\w-]+)*(?:\s+|>)/;
function isFeatureRule(rule){
  if(rule.parent?.type==='atrule'&&/keyframes/i.test(rule.parent.name))return false;
  return rule.selectors.length>0&&rule.selectors.every(selector=>{
    const s=selector.trim();
    // Reject sibling combinators, escaped tokens, and uncertain selectors.
    return scope.test(s)&&!/[+~\\]/.test(s);
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
module.exports={makeCritical,buildFirstPaint};
