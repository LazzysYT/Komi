const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../mono-ui.css'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../mobile-nav.js'),'utf8');
test('five core tabs and overflow access preserve original desktop controls',()=>{
  for(const label of ['sideHomeBtn','sideCatalogBtn','sideFriendsBtn','komiMobileMoreToggle','komiMobileMoreMenu'])
    assert.match(html,new RegExp('id="'+label+'"'));
  assert.match(html,/class="komi-side-button komi-side-account"/);
  assert.match(html,/<script src="\.\/mobile-nav\.js"><\/script>/);
  for(const action of ['shop','party','notifications','partners'])
    assert.match(html,new RegExp('data-komi-mobile-extra="'+action+'"'));
  for(const selector of ['.komi-side-links > :nth-child(3)', '.komi-side-links > :nth-child(6)',
                          '.komi-side-links > :nth-child(7)', '.komi-side-bottom > :first-child'])
    assert.ok(css.includes(selector), 'Missing secondary item hiding selector: '+selector);
  assert.match(css,/@media \(max-width:767px\)/);
  assert.match(css,/env\(safe-area-inset-bottom/);
});
test('More popup uses explicit action handlers and restores keyboard focus',()=>{
  assert.match(script,/toggle\.addEventListener\('click'/);
  assert.match(script,/panel\.addEventListener\('click'/);
  assert.match(script,/event\.key !== 'Escape'/);
  assert.match(script,/toggle\.focus\(\)/);
  assert.match(script,/openWatchPartyHub\(\)/);
  assert.match(script,/toggleNotifications\(\)/);
  assert.match(script,/openAniCoinShop\(\)/);
  assert.match(script,/navigate\('partners'\)/);
  assert.doesNotMatch(script,/innerHTML\s*=/);
});
