'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
test('Premium markers only reflect trusted membership reads',()=>{
 const ui=read('komi-premium.js'),app=read('app-main.js');
 assert.match(ui,/komi_premium_badges/);assert.match(ui,/select\('user_id'\)/);
 assert.doesNotMatch(ui,/\.insert\(|\.upsert\(|\.update\(|service_role|localStorage/);
 assert.match(app,/data-komi-premium-panel/);assert.match(app,/data-komi-premium-username/);
 assert.match(read('komi-comments.js'),/name\.dataset\.komiPremiumId/);
 assert.match(read('index.html'),/komi-premium\.js/);
});
test('Premium badge CSS is bundled and monochrome layout intact',()=>{
 assert.match(read('profile-premium-mono.css'),/\.komi-premium-badge/);
 assert.match(read('komi.bundle.css'),/\.komi-premium-showcase/);
});
