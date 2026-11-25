/* Production-only request consolidation. Keep these classic scripts in their
 * source head order, with their own IIFE scopes and all global names intact.
 * Preparation does not write files; minify-static stages the entry and HTML. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ENTRY_FILE='komi-home-entry.js';
const STARTUP_FILES=Object.freeze(['komi-home-boot.js','premium-entry.js','shop-first-paint.js']);

function rewriteStartup(html){
  // Preserve offsets while ignoring comments containing example script tags.
  const visible=html.replace(/<!--[\s\S]*?-->/g,comment=>' '.repeat(comment.length));
  const head=/<head\b[^>]*>[\s\S]*?<\/head\s*>/i.exec(visible);
  if(!head)throw Error('Startup bundle: expected a complete head element');
  const found=new Map(STARTUP_FILES.map(name=>[name,[]]));
  for(const tag of visible.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    const src=/(?:^|\s)src\s*=\s*(["'])([^"']+)\1/i.exec(tag[1]);
    if(!src)continue;
    const name=src[2].replace(/[?#].*$/,'').replace(/^\//,'');
    if(!found.has(name))continue;
    found.get(name).push({tag,src:src[2]});
  }
  const targets=STARTUP_FILES.map(name=>{
    const matches=found.get(name);
    if(matches.length!==1)throw Error('Startup bundle: expected exactly one '+name+' script tag; found '+matches.length);
    const {tag,src}=matches[0];
    if(tag.index<head.index||tag.index+tag[0].length>head.index+head[0].length)
      throw Error('Startup bundle: '+name+' must stay in the head');
    if(!/^\s*src\s*=\s*(["'])[^"']+\1\s*$/.test(tag[1])||tag[2].trim())
      throw Error('Startup bundle: '+name+' must be an empty synchronous classic script tag with only src');
    const expected='/'+name+'?v=';
    const version=src.startsWith(expected)?src.slice(expected.length):'';
    if(!/^[A-Za-z0-9._-]+$/.test(version))
      throw Error('Startup bundle: '+name+' requires its versioned root-relative URL');
    return {start:tag.index,end:tag.index+tag[0].length,version};
  });
  for(let i=1;i<targets.length;i++){
    if(targets[i].start<targets[i-1].end)
      throw Error('Startup bundle: expected script order '+STARTUP_FILES.join(' -> '));
    if(visible.slice(targets[i-1].end,targets[i].start).trim())
      throw Error('Startup bundle: only comments and whitespace may separate the startup scripts');
  }
  const entryTag='<script src="/'+ENTRY_FILE+'?v='+targets[0].version+'"></script>';
  let built=html;
  for(let i=targets.length-1;i>=0;i--){
    const {start,end}=targets[i];
    built=built.slice(0,start)+(i===0?entryTag:'')+built.slice(end);
  }
  return built;
}

function prepareStartup(root){
  const html=rewriteStartup(fs.readFileSync(path.join(root,'index.html'),'utf8'));
  // A line break ends a trailing line comment; a semicolon separates adjacent
  // IIFEs even if a future helper omits its optional final semicolon.
  const source=STARTUP_FILES.map(name=>fs.readFileSync(path.join(root,name),'utf8')).join('\n;\n')+'\n';
  return {name:ENTRY_FILE,source,html};
}

module.exports={ENTRY_FILE,STARTUP_FILES,rewriteStartup,prepareStartup};
