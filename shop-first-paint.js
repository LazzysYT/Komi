/* Keep #shop readable before auth, SPA hydration or catalog requests. */
(function(){'use strict';function sync(){document.documentElement.dataset.komiShopRoute=(location.pathname==='/shop'||location.hash.toLowerCase()==='#shop')?'true':'false';}sync();window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);})();
