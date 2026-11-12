const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
const headers=config.headers.find(entry=>entry.source==='/(.*)')?.headers||[];
const header=name=>headers.find(item=>item.key.toLowerCase()===name.toLowerCase())?.value||'';
const directives=Object.fromEntries(header('Content-Security-Policy').split(';').map(item=>{
  const parts=item.trim().split(/\s+/);
  return [parts.shift(),parts];
}));
test('production CSP enforces external script boundaries instead of report-only',()=>{
  assert.deepEqual(directives['base-uri'],["'self'"]);
  assert.deepEqual(directives['object-src'],["'none'"]);
  assert.deepEqual(directives['frame-ancestors'],["'none'"]);
  assert.deepEqual(directives['form-action'],["'self'"]);
  assert.ok(directives['script-src'].includes("'self'"));
  assert.ok(directives['script-src'].includes('https://cdn.jsdelivr.net'));
  assert.ok(!directives['script-src'].includes('https:')&&!directives['script-src'].includes('*'));
  assert.ok(!directives['script-src'].includes("'unsafe-eval'"));
  assert.ok(!directives['script-src'].includes("'unsafe-inline'"));
  assert.ok(!directives['script-src-elem'].includes("'unsafe-inline'"));
  assert.ok(directives['script-src-elem'].includes("'self'"));
  // Static and dynamic HTML handlers are delegated through reviewed allowlists.
  // No browser-executed HTML event-handler attribute may run.
  assert.deepEqual(directives['script-src-attr'],["'none'"]);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'../app-main.js'),'utf8');
  assert.ok(app.length>100000);
  assert.match(html,/<script src="\.\/app-main\.js"><\/script>/);
  assert.doesNotMatch(html,/<script\s*>[\s\S]*?<\/script>/);
  assert.ok(directives['style-src'].includes('https://fonts.googleapis.com'));
  assert.ok(directives['font-src'].includes('https://fonts.gstatic.com'));
  assert.ok(directives['worker-src'].includes('blob:'),'hls.js media workers must remain allowed');
  assert.match(header('Content-Security-Policy-Report-Only'),/connect-src/);
});
test('required security headers remain configured on all routes',()=>{
  assert.match(header('Strict-Transport-Security'),/max-age=\d+/);
  assert.equal(header('X-Content-Type-Options'),'nosniff');
  assert.equal(header('X-Frame-Options'),'DENY');
  assert.equal(header('Referrer-Policy'),'strict-origin-when-cross-origin');
});
