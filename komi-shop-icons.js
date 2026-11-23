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
/* Filled monochrome icons for the V5 shop — no external icon dependency. */
const solidPaths=Object.freeze({
 gift:'<path d="M3 10h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10Zm-1-5h4.2C4.4 2.9 6 1 8 1c2.1 0 3.4 1.5 4 3.2C12.6 2.5 13.9 1 16 1c2 0 3.6 1.9 1.8 4H22v4H2V5Zm8.2 0C9.8 3.7 9 3 8 3 6.5 3 6.2 4 7.9 5h2.3Zm3.6 0h2.3C17.8 4 17.5 3 16 3c-1 0-1.8.7-2.2 2Z"/><path d="M11 9h2v13h-2z" fill="#242429"/>',
 coins:'<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 4v1.4c2.1.3 3.3 1.5 3.5 3.1h-2.6c-.2-.7-.9-1-1.9-1-1.1 0-1.7.4-1.7 1 0 .6.6.9 2.3 1.3 2.9.7 4.1 1.8 4.1 3.8 0 1.9-1.3 3.1-3.7 3.4V20h-2v-1.4c-2.3-.3-3.6-1.5-3.9-3.5h2.6c.2.8 1.1 1.2 2.3 1.2 1.3 0 2-.4 2-1.1 0-.6-.6-1-2.3-1.4-2.8-.6-4-1.7-4-3.6 0-1.9 1.3-3.1 3.6-3.3V6h2Z"/>',
 plus:'<path d="M10 3a2 2 0 0 1 4 0v7h7a2 2 0 1 1 0 4h-7v7a2 2 0 1 1-4 0v-7H3a2 2 0 1 1 0-4h7V3Z"/>',
 eye:'<path d="M12 4C6.5 4 2.1 7.4.4 12c1.7 4.6 6.1 8 11.6 8s9.9-3.4 11.6-8C21.9 7.4 17.5 4 12 4Zm0 13a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>',
 tag:'<path d="M3 3h8.4a3 3 0 0 1 2.1.9l7.6 7.6a3 3 0 0 1 0 4.2l-5.4 5.4a3 3 0 0 1-4.2 0L3.9 13.5A3 3 0 0 1 3 11.4V3Zm4.8 4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"/>',
 clock:'<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 4a1 1 0 0 1 2 0v5.5l3.2 1.9a1 1 0 0 1-1 1.7l-3.7-2.2a1 1 0 0 1-.5-.9V6Z"/>',
 bag:'<path d="M5 8V7a7 7 0 0 1 14 0v1h1a2 2 0 0 1 2 2l-1 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2L2 10a2 2 0 0 1 2-2h1Zm3 0h8V7a4 4 0 0 0-8 0v1Z"/>',
 palette:'<path d="M12 2a10 10 0 0 0 0 20h2a3 3 0 0 0 2.6-4.5c-.8-1.3 0-2.5 1.4-2.5h1a3 3 0 0 0 3-3A10 10 0 0 0 12 2ZM7 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>',
 reset:'<path d="M12 2a10 10 0 1 1-9.8 12 1.5 1.5 0 0 1 3-.6A7 7 0 1 0 6 8h2V5H2v6h6V8h1.9A10 10 0 0 1 12 2Z"/>',
 chevron:'<path d="M5.3 8.3a1.5 1.5 0 0 1 2.1 0L12 12.9l4.6-4.6a1.5 1.5 0 0 1 2.1 2.1l-5.6 5.6a1.5 1.5 0 0 1-2.2 0l-5.6-5.6a1.5 1.5 0 0 1 0-2.1Z"/>'
});
function solid(name,size=20){
 if(!Object.hasOwn(solidPaths,name))return svg(name,size);
 const s=Math.max(14,Math.min(32,Number(size)||20));
 return '<svg aria-hidden="true" class="komi-sticker-icon" viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="currentColor" stroke="none" focusable="false">'+solidPaths[name]+'</svg>';
}
root.KomiShopIcons=Object.freeze({svg,solid,badge});
})(window);
