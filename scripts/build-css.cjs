#!/usr/bin/env node
'use strict';
/* Deterministic, dependency-free CSS builder for Komi's plain HTML deployment.
 * Preserve the original cascade order:
 *   node scripts/build-css.cjs
 * CI verifies the committed artifact:
 *   node scripts/build-css.cjs --check
 */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sources=[
  'komi-comments.css','styles/inline-head.css','cinema-ui.css','mono-ui.css',
  'cinema-layout-v3.css','cinema-hud-v4.css','cinema-clean-v5.css',
  'home-discovery.css','styles/inline-tail.css','komi-monochrome.css'
];
function buildCSS(){
  return sources.map(relative => {
    const source=fs.readFileSync(path.join(root,relative),'utf8').replace(/\r\n/g,'\n');
    return '/* --- '+relative+' --- */\n'+source+'\n';
  }).join('\n');
}
function main(args=process.argv.slice(2)){
  const content=buildCSS(),out=path.join(root,'komi.bundle.css');
  if(args.includes('--check')){
    if(!fs.existsSync(out)||fs.readFileSync(out,'utf8')!==content){
      console.error('Komi CSS bundle is stale: run node scripts/build-css.cjs');
      process.exitCode=1;return;
    }
    console.log('PASS Komi CSS bundle: source order and content match');
  } else {
    fs.writeFileSync(out,content);
    console.log('Built Komi CSS bundle:',Buffer.byteLength(content),'bytes');
  }
}
if(require.main===module)main();
module.exports={sources,buildCSS};
