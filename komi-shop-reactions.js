/* Fixed local artwork for paid reaction previews. Emoji IDs and transport stay
   in the catalog; this display-only renderer never injects its input as HTML. */
(function(root){
'use strict';
const art=Object.freeze({
 '🔥':'<path fill="#f58a27" stroke="#43271c" stroke-width="1.8" d="M22 3c2 8-4 9-1 14 2-3 4-4 4-8 6 6 9 12 8 18-1 7-6 10-13 10S7 33 7 26c0-6 4-9 5-14 2 2 3 4 3 6 5-5 6-8 7-15Z"/><path fill="#ffe392" d="M20 21c1 4 5 5 5 9a5 5 0 0 1-10 0c0-3 3-5 5-9Z"/>',
 '😮':'<circle cx="20" cy="20" r="16" fill="#f4ce58" stroke="#5d4222" stroke-width="1.8"/><ellipse cx="14" cy="16" rx="1.8" ry="2.7" fill="#382a22"/><ellipse cx="26" cy="16" rx="1.8" ry="2.7" fill="#382a22"/><ellipse cx="20" cy="27" rx="3.5" ry="4.8" fill="#443126"/><path d="m10 10 5-1m10 0 5 1" fill="none" stroke="#77572b" stroke-width="1.7" stroke-linecap="round"/>',
 '👏':'<g fill="#f4ce7c" stroke="#694829" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 10 10 12c5 6 2 13-4 14-3 0-6-2-8-5L9 18c-2-2 1-5 3-3l7 7-9-12c-2-2 1-4 3-2l9 10-7-11c-1-3 2-4 4-2l8 12-4-8c-1-2 2-3 3-1l5 9"/><path d="m11 17 8 10c2 2 3 4 5 3 2-1 1-3 0-5l-4-6c-1-2 2-4 4-2l5 7"/></g><path d="m31 5 1-3m3 7 3-1M7 6 4 4m2 8H2" fill="none" stroke="#d8b055" stroke-width="2" stroke-linecap="round"/>',
 '🥲':'<circle cx="20" cy="20" r="16" fill="#f4ce58" stroke="#5d4222" stroke-width="1.8"/><path d="M11 16q3-3 6 0m6 0q3-3 6 0m-16 9q7 7 14 0" fill="none" stroke="#513a24" stroke-width="2" stroke-linecap="round"/><path d="M29 19c0 4-4 6-4 9a4 4 0 0 0 8 0c0-3-3-5-4-9Z" fill="#a5dced" stroke="#477f9a" stroke-width="1.2"/><path d="M29 27c-1 1-1 2 0 3" fill="none" stroke="#e7f8ff" stroke-width="1.5" stroke-linecap="round"/>',
 '🤍':'<path d="M20 35 6 21C-2 11 10-1 20 10 30-1 42 11 34 21Z" fill="#f4f0f4" stroke="#817587" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 14c0-3 3-5 6-4" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>',
 '😂':'<circle cx="20" cy="20" r="16" fill="#f4ce58" stroke="#5d4222" stroke-width="1.8"/><path d="m10 17 5-3 3 3m4 0 3-3 5 3" fill="none" stroke="#513a24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 23c2 12 16 12 18 0Z" fill="#5d3526"/><path d="M12 23h16l-2 4H14Z" fill="#fff8e7"/><path d="M16 32c2-3 6-3 8 0" fill="#d58b79"/><path d="M8 19c-3 3-6 4-6 7a4 4 0 0 0 8 0c0-2-1-4-2-7Zm24 0c3 3 6 4 6 7a4 4 0 0 1-8 0c0-2 1-4 2-7Z" fill="#a5dced" stroke="#477f9a" stroke-width="1.2"/>',
 '⭐':'<path d="m20 3 5.3 10.8L37 15.5l-8.5 8.3 2 11.7L20 30l-10.5 5.5 2-11.7L3 15.5l11.7-1.7Z" fill="#eed381" stroke="#9d7b39" stroke-width="1.8" stroke-linejoin="round"/><path d="m20 9-3.5 7.2-7.9 1.2" fill="none" stroke="#fff5c7" stroke-width="2.2" stroke-linecap="round"/>',
 '👀':'<ellipse cx="12" cy="21" rx="8" ry="13" fill="#f6f5f4" stroke="#898391" stroke-width="1.6"/><ellipse cx="29" cy="21" rx="8" ry="13" fill="#f6f5f4" stroke="#898391" stroke-width="1.6"/><ellipse cx="15" cy="23" rx="3.8" ry="6" fill="#302c37"/><ellipse cx="32" cy="23" rx="3.8" ry="6" fill="#302c37"/><circle cx="16" cy="21" r="1.2" fill="#fff"/><circle cx="33" cy="21" r="1.2" fill="#fff"/>',
 '🍿':'<path d="M9 18c-5-3-4-9 1-10 0-5 7-7 10-2 4-6 11-3 10 2 6 0 8 7 3 10Z" fill="#f4e2a9" stroke="#b4a172" stroke-width="1.5"/><path d="m7 16 4 21h18l4-21Z" fill="#f6f1e7" stroke="#977773" stroke-width="1.6" stroke-linejoin="round"/><path d="m12 17 3 19h4l-1-19Zm11 0-1 19h4l3-19Z" fill="#c87b7d"/><path d="M8 17h24M11 9q4-3 6 1m6-2q3-1 4 3" fill="none" stroke="#b6a172" stroke-width="1.5" stroke-linecap="round"/>'
});
const fallback='<path d="m20 5 4.2 10.8L35 20l-10.8 4.2L20 35l-4.2-10.8L5 20l10.8-4.2Z" fill="#e5e3ec" stroke="#918b9f" stroke-width="1.8" stroke-linejoin="round"/>';
function render(emoji){
 const key=typeof emoji==='string'?emoji.replace(/\ufe0f/g,''):'';
 const drawing=Object.hasOwn(art,key)?art[key]:fallback;
 return '<svg class="komi-reaction-art" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32">'+drawing+'</svg>';
}
root.KomiShopReactions=Object.freeze({render});
})(window);
