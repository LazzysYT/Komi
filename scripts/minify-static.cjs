/* Build-time-only conservative minification. Keep all classic-script globals
 * and CSS cascade order. Only the three ordered head helpers are concatenated;
 * no module bundling, identifier renaming or syntax minification.
 * The tracked source files remain unchanged: run only in deployment/CI workspace. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const names=['komi.production.css','app-main.js','komi-home-boot.js','komi-ads-loader.js','komi-watch-compact-v6.css','komi-hero-senku.css','komi-icon-rail.css','komi-pill-system.css','home-discovery.js','home-release-shelves.js','komi-home-seed.js'];
const pending=[];
try {
  const startup=require('./build-startup.cjs').prepareStartup(root);
  for(const name of [...names,startup.name]){
    const input=path.join(root,name),output=input+'.komi-min.tmp';
    const generated=name===startup.name;
    const original=generated?Buffer.from(startup.source):fs.readFileSync(input);
    const sourceArgs=generated?['--loader=js','--sourcefile='+name]:[input];
    const outputArgs=generated?[]:['--outfile='+output];
    const result=cp.spawnSync('esbuild',[...sourceArgs,'--minify-whitespace','--target=esnext','--charset=utf8','--legal-comments=inline',...outputArgs],{encoding:'utf8',...(generated?{input:original}:{})});
    if(result.error||result.status!==0){fs.rmSync(output,{force:true});throw result.error||new Error(name+': '+result.stderr);}
    if(generated)fs.writeFileSync(output,result.stdout);
    pending.push({input,output});
    const minified=fs.readFileSync(output);
    if(name.endsWith('.js'))new vm.Script(minified.toString('utf8'),{filename:name});
    if(!minified.length || minified.length>=original.length)throw Error('Minification produced no savings: '+name);
    console.log(name+': '+original.length+' -> '+minified.length+' bytes');
  }
  const index=path.join(root,'index.html'),builtIndex=index+'.komi-min.tmp';
  fs.writeFileSync(builtIndex,startup.html);
  pending.push({input:index,output:builtIndex});
  for(const {input,output} of pending)fs.renameSync(output,input);
  require('./build-first-paint.cjs').buildFirstPaint(root);
} finally {
  for(const {output} of pending)fs.rmSync(output,{force:true});
}
