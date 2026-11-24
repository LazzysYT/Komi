/* Build-time-only conservative minification. Keep all classic-script globals
 * and CSS cascade order. No bundling, identifier renaming or syntax minification.
 * The tracked source files remain unchanged: run only in deployment/CI workspace. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const names=['komi.production.css','app-main.js','komi-watch-compact-v6.css','komi-hero-senku.css','komi-icon-rail.css','komi-pill-system.css','home-discovery.js','komi-home-seed.js'];
const pending=[];
try {
  for(const name of names){
    const input=path.join(root,name),output=input+'.komi-min.tmp';
    const original=fs.readFileSync(input);
    const result=cp.spawnSync('esbuild',[input,'--minify-whitespace','--target=esnext','--charset=utf8','--legal-comments=inline','--outfile='+output],{encoding:'utf8'});
    if(result.error||result.status!==0){fs.rmSync(output,{force:true});throw result.error||new Error(name+': '+result.stderr);}
    pending.push({input,output});
    const minified=fs.readFileSync(output);
    if(name.endsWith('.js'))new vm.Script(minified.toString('utf8'),{filename:name});
    if(!minified.length || minified.length>=original.length)throw Error('Minification produced no savings: '+name);
    console.log(name+': '+original.length+' -> '+minified.length+' bytes');
  }
  for(const {input,output} of pending)fs.renameSync(output,input);
} finally {
  for(const {output} of pending)fs.rmSync(output,{force:true});
}
