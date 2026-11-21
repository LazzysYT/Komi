/* Capture attribution on every KomiAnime entry page without requiring auth. */
(function(){
 'use strict';
 try {
   const value=new URLSearchParams(location.search).get('ref');
   if(!value)return;
   const code=value.trim().toUpperCase();
   if(/^[A-Z0-9_-]{3,40}$/.test(code))localStorage.setItem('komi_ref_code',code);
 }catch{ /* Storage may be disabled by the browser. */ }
})();
