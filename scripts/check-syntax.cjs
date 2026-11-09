const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
let count=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
 if(/\bsrc\s*=/.test(match[1]))continue;
 if(/application\/ld\+json/.test(match[1])) {JSON.parse(match[2]);continue;}
 new vm.Script(match[2],{filename:'index.html inline '+(++count)});
}
for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});
console.log('PASS syntax: inline scripts, structured data and all root JavaScript modules');
