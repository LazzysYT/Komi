/* Unified lightweight Komi monochrome stickers and action icons. */
(function(root){
'use strict';
const paths=Object.freeze({
 quality:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 8v8m0-4 4-4v8m4-8v8m0-8 4 8"/>',
 movie:'<rect x="3" y="4" width="18" height="16" rx="4"/><path d="m10 8 6 4-6 4z"/>',
 medal:'<circle cx="12" cy="9" r="5"/><path d="m8.5 13-1 8L12 18l4.5 3-1-8"/><path d="m12 6 1.1 2.1 2.4.3-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.3z"/>',
 coins:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 8v8m-2-6h4m-4 4h4"/>',
 gift:'<rect x="3" y="10" width="18" height="11" rx="2"/><path d="M2 8h20v4H2zM12 8v13M12 8c-5-3.2-7-6-5-7.5 3-2 5 4 5 7.5Zm0 0c5-3.2 7-6 5-7.5-3-2-5 4-5 7.5Z"/>',
 layers:'<rect x="4" y="4" width="13" height="15" rx="2"/><path d="M8 20h11a2 2 0 0 0 2-2V8M9 9h5m-5 4h4"/>',
 eye:'<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 reset:'<path d="M3 11a9 9 0 1 1 2 6M3 4v7h7"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>',
 users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 check:'<path d="m5 12 5 5L20 7"/>',
 sparkles:'<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
 bag:'<path d="M4 8h16l1 13H3L4 8Zm4 0V6a4 4 0 0 1 8 0v2"/>',
 shield:'<path d="M12 2 21 6v6c0 6-4 9-9 10-5-1-9-4-9-10V6z"/><path d="m9 12 2 2 4-4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 crown:'<path d="m2 8 5 4 5-7 5 7 5-4-2 11H4z"/><path d="M5 22h14"/>',
 star:'<path d="m12 2 3 7 7 .6-5.5 5 1.5 7.4-6-4-6 4 1.5-7.4L2 9.6 9 9z"/>',
 tag:'<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/>',
 palette:'<path d="M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-4 2 2 0 0 1-1-4h3a4 4 0 0 0 4-4A9 9 0 0 0 12 3z"/><circle cx="7" cy="10" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="9" r="1"/>',
 wand:'<path d="m4 20 12-12 4 4L8 24M14 4V2m6 4 2-1M6 8 4 7"/>'
});
function svg(name,size=20){
 const n=Object.hasOwn(paths,name)?name:'sparkles';
 const s=Math.max(14,Math.min(32,Number(size)||20));
 return '<svg aria-hidden="true" class="komi-sticker-icon" viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">'+paths[n]+'</svg>';
}
function badge(name){
 return '<span class="sv4-sticker" aria-hidden="true">'+svg(name,22)+'</span>';
}
root.KomiShopIcons=Object.freeze({svg,badge});
})(window);
