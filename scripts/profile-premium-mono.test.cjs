'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('monochrome profile stylesheet loads last and only restyles profile UI', () => {
  const html = read('index.html');
  const css = read('komi-black-white.css').split('/* KomiAnime profile 2026-11-19')[1];
  assert.ok(html.includes('komi.bundle.css?v=20261119a'));
  const bundle=read('komi.bundle.css');
  assert.ok(bundle.includes(read('komi-black-white.css').trim()),
    'Premium profile styles must remain in the final CSS bundle');
  assert.doesNotMatch(html, /profile-premium-mono\\.css/);
  assert.match(css, /\.komi-media-hub \.komi-profile-v2/);
  assert.doesNotMatch(css, /#(?:ff454f|e5344b|e53935|f00)\b/i);
  assert.doesNotMatch(css, /filter:\s*(?:grayscale|blur)/i);
});

test('showcase reads saved favorites instead of generating dummy content', () => {
  const code = read('app-main.js');
  assert.match(code, /const profileShowcase = Object\.keys\(userFavorites\[username\] \|\| \{\}\)/);
  assert.match(code, /profileShowcase\.map\(an => renderCard\(an\)\)/);
  assert.match(code, /profileShowcase\.length/);
  assert.match(code, /komiSafeUrl\(p\.avatar\)/);
});

test('public profile route and clipboard URL use the same canonical account handle', async () => {
  const code = read('app-main.js');
  const source = code.match(/        function openProfile\(username\) \{[\s\S]*?\n        \}\n\n        async function komiCopyProfileLink\(\) \{[\s\S]*?\n        \}/);
  assert.ok(source, 'profile navigation and sharing functions must be present');
  let route = '', copied = '', feedback = '';
  const ctx = {
    currentUser: {username:'owner'}, slideInterval:null, currentView:'home',
    profileTargetUser:null, location:{pathname:'/',search:'',hash:'',origin:'https://komianime.online'},
    history:{replaceState:(_a,_b,r)=>{route=r}}, render:()=>{},renderHeaderUser:()=>{},
    window:{komiViewedProfileName:'other_user'},
    navigator:{clipboard:{writeText:async t=>{copied=t}}},
    komiStatusFeedback:t=>{feedback=t},
    URL, encodeURIComponent, document:{}, openAuthModal:()=>{}, clearInterval:()=>{}
  };
  vm.runInNewContext(source[0], ctx);
  ctx.openProfile('other_user');
  assert.equal(route, '/?profile=other_user#profile');
  assert.equal(ctx.profileTargetUser, 'other_user');
  route = '';
  ctx.openProfile('owner');
  assert.equal(route, '/#profile');
  await ctx.komiCopyProfileLink();
  assert.equal(copied, 'https://komianime.online/?profile=other_user#profile');
  assert.match(feedback, /скопирована/);
  assert.match(code, /sharedName = new URLSearchParams\(location\.search\)\.get\('profile'\)/);
  assert.match(code, /!new URLSearchParams\(location\.search\)\.get\('profile'\)/);
});

test('CSP action dispatcher explicitly allows profile share, not arbitrary JS', () => {
  const source = read('dynamic-ui-events.js');
  const listeners = {};
  let clicks = 0;
  const sandbox = {
    document:{addEventListener:(type,listener)=>{listeners[type]=listener}},
    komiCopyProfileLink:()=>{clicks++}
  };
  sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox);
  assert.equal(sandbox.KomiDynamicEvents.supports('click','komiCopyProfileLink()'),true);
  assert.equal(sandbox.KomiDynamicEvents.supports('click','fetch("https://evil.example")'),false);
  listeners.click({target:{closest:()=>({getAttribute:()=> 'komiCopyProfileLink()'})}});
  assert.equal(clicks,1);
});
