'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isFeatureRule}=require('./build-first-paint.cjs');

// Exercise the classifier without adding a runtime dependency to the source
// unit suite. The deployment builder supplies actual PostCSS Rule objects.
function rule(selectors,declarations=[],parent={type:'root'}){
  return {selectors:Array.isArray(selectors)?selectors:[selectors],parent,
    walkDecls(callback){for(const [prop,value] of declarations)callback({prop,value});}};
}

test('first-paint filter defers only explicitly owned feature selectors',()=>{
  for(const selector of [
    '.profile-header-card','.komi-profile-tabs',
    'body.komi-media-hub .komi-profile-v2 .profile-name-row h2',
    '.komi-media-hub .komi-profile-v2 .profile-settings-box',
    '#mainContainer .komi-partner-card',
    '.watch-cinema-layout .player-box','.player-switch-btn.active',
    '.players-switcher-bar','.komi-player-notice','.komi-watch-sidebar',
    '.crunchy-hero-section','.ep-crunchy-card','.episode-label',
    '.komi-episode-number-grid','.anime-screenshots-section',
    '.komi-mobile-sheet-panel','.sv3-item','.komi-shop-rarity',
    '.komi-coin-card','.anicoin-wallet','.komi-checkout-fields',
    '.admin-table','.komi-partners-hero',
    '#watchPartyModal .komi-party-room-header',
    '#randomRouletteModal .roulette-result'
  ])assert.equal(isFeatureRule(rule(selector)),true,selector);
  assert.equal(isFeatureRule(rule(['.profile-header-card','.komi-profile-actions'])),true);
});

test('shared home, header, community, cosmetic and mixed rules survive',()=>{
  for(const selector of [
    ':root','html','body','header','.header-inner',
    '.komi-home-hero','.komi-home-progress-card','.hero-slider-arrow',
    '.komi-side-account','.komi-hub-tools-panel','.komi-mobile-more-menu',
    '.komi-friends-drawer','.komi-friends-identity','.notification-dropdown',
    '.search-dropdown','.anime-card','.btn-primary','.modal-overlay',
    '.komi-store-frame-moon','.frame-moon','.komi-premium-badge',
    '.home:not(.profile-header-card)',':is(.player-box,.home)',
    '.komi-media-hub:has(.profile-header-card)',
    '.profile-header-card + .home','.profile-header-card~.home',
    '.profile-escaped\\:name','.unrelated-profile-card'
  ])assert.equal(isFeatureRule(rule(selector)),false,selector);
  assert.equal(isFeatureRule(rule(['.profile-header-card','.notification-dropdown'])),false);
  assert.equal(isFeatureRule(rule(['#watchModal .player-box','.komi-home-hero'])),false);
});

test('modal and feature roots retain their geometry, states and backdrops',()=>{
  for(const selector of [
    '#watchModal','#authModal','#watchPartyModal','#randomRouletteModal',
    '#shop','#profile','.profile-container','.komi-profile-v2',
    '.watch-cinema-layout','.komi-mobile-sheet-layer',
    '.komi-mobile-sheet-layer.is-open','.komi-checkout-overlay',
    '.komi-shop-dialog','.komi-shop-dialog::backdrop',
    '.komi-shop-gift-dialog','.sv3-promo-dialog','.anicoin-shop',
    '.komi-shop-v3','.komi-shop-v4',
    'body.komi-media-hub #mainContainer .profile-container'
  ])assert.equal(isFeatureRule(rule(selector,[['display','flex']])),false,selector);
});

test('hiding declarations and hidden attributes survive even inside known features',()=>{
  for(const declaration of [
    ['display','none'],['visibility','hidden'],['visibility','collapse'],
    ['content-visibility','hidden'],['opacity','0'],['opacity','0.0'],['opacity','0%']
  ])assert.equal(isFeatureRule(rule('#watchModal .player-box',[declaration])),false,declaration.join(':'));
  for(const selector of ['.komi-shop-favorite-showcase[hidden]',
    '.profile-settings-box[hidden="hidden"]','.komi-checkout-caption[ hidden ]'])
    assert.equal(isFeatureRule(rule(selector)),false,selector);
  assert.equal(isFeatureRule(rule('.profile-settings-box',[['display','block']])),true);
});

test('keyframe rules are never filtered, including inside nested at-rules',()=>{
  const keyframes={type:'atrule',name:'-webkit-keyframes',parent:{type:'root'}};
  assert.equal(isFeatureRule(rule('.profile-animation',[],keyframes)),false);
  assert.equal(isFeatureRule(rule('.profile-animation',[],{
    type:'atrule',name:'supports',parent:keyframes
  })),false);
  assert.equal(isFeatureRule(rule('.profile-header-card',[],{
    type:'atrule',name:'media',parent:{type:'root'}
  })),true);
});
