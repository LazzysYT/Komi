'use strict';
// Low-noise security gate. No secrets or matched values are printed.
const fs=require('node:fs');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const patterns=[
  ['private PEM key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,255}\b/],
  ['AWS access key ID', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/]
];
function findSecret(s) {
  for (const [name,re] of patterns) if(re.test(s)) return name;
  for(const m of s.matchAll(/\beyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{15,}\b/g)) {
    try {
      const data=JSON.parse(Buffer.from(m[1],'base64url').toString('utf8'));
      if(data.role==='service_role') return 'Supabase service-role JWT';
    } catch {}
  }
  return null;
}
function forbiddenPath(p){
  const base=p.split('/').at(-1);
  return (/^\.env(?:\.|$)/.test(base)&&!['.env.example','.env.template'].includes(base))
    || /(?:^|\/)(?:\.vercel|\.supabase|browser-test-results)(?:\/|$)/.test(p)
    || /(?:^|\/)supabase\/\.temp(?:\/|$)/.test(p)
    || /(?:\.pem|\.key|\.p12|\.pfx|\.sql\.dump|\.dump|\.bak)$/i.test(base)
    || base==='premium-audit.json';
}
assert.equal(findSecret('sb_publishable_'+'A'.repeat(32)),null);
assert.equal(findSecret('sb_secret_'+'A'.repeat(32)),'Supabase secret key');
assert.equal(findSecret('-----BEGIN '+'PRIVATE KEY-----'),'private PEM key');
assert.equal(forbiddenPath('a/.env.local'),true);
assert.equal(forbiddenPath('.env.example'),false);
const files=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean);
const problems=[];
let skippedBinary=0;
for(const file of files){
  if(forbiddenPath(file)){problems.push([file,'tracked local credential or private artifact']);continue;}
  if(file==='scripts/security-check.cjs') continue; // scanner contains test patterns, not production credentials
  const stat=fs.lstatSync(file);
  if(!stat.isFile()){if(stat.isSymbolicLink()) problems.push([file,'unexpected tracked symlink']);continue;}
  const buf=fs.readFileSync(file);
  if(buf.includes(0)){skippedBinary++;continue;}
  const finding=findSecret(buf.toString('utf8'));
  if(finding)problems.push([file,finding]);
}
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const headers=new Map((config.headers.find(x=>x.source==='/(.*)')?.headers||[]).map(x=>[x.key.toLowerCase(),x.value]));
for(const name of ['strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','permissions-policy','content-security-policy']){
  if(!headers.has(name))problems.push(['vercel.json','missing '+name]);
}
if(headers.get('x-content-type-options')!=='nosniff')problems.push(['vercel.json','invalid nosniff policy']);
if(!/\bframe-ancestors\s+'none'/.test(headers.get('content-security-policy')||''))problems.push(['vercel.json','missing frame-ancestors policy']);
if(problems.length){
  for(const [file,reason] of problems)console.error(JSON.stringify(file)+': '+reason);
  process.exitCode=1;
}else console.log('Security guard passed: '+files.length+' tracked paths checked; '+skippedBinary+' binary files not text-scanned.');
