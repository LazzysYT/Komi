/* Load optional customization only when its UI is actually needed. */
(function(root){
'use strict';
let config=null,pending=null,loaded=null,catalogLoaded=false;
const loadScript=src=>new Promise((resolve,reject)=>{
 const s=document.createElement('script');s.src=src;s.async=true;
 s.onload=()=>resolve();s.onerror=()=>{s.remove();reject(new Error('Optional profile assets unavailable'));};
 document.head.append(s);
});
const proxy={
 configure(opts){config=opts;if(loaded)loaded.configure(opts);},
 mountProfile(node,opts){if(!node?.isConnected||!opts?.viewer)return;return invoke('mountProfile',[node,opts],()=>node.isConnected&&config?.getViewer()===opts.viewer);},
 mountShop(node,opts){const shop=node?.querySelector('#shop');if(!shop?.isConnected)return;return invoke('mountShop',[node,opts],()=>shop.isConnected&&node.querySelector('#shop')===shop&&String(config?.getViewer()||'')===String(opts?.owner||''));},
 decorateFriends(scope){if(!scope?.querySelector?.('[data-kpe-friend]')||!config?.getViewer())return;const uid=config.getViewer();return invoke('decorateFriends',[scope],()=>scope.isConnected!==false&&config?.getViewer()===uid);}
};
function ensure(){
 if(loaded)return Promise.resolve(loaded);
 if(!pending)pending=(async()=>{
  if(!catalogLoaded){await loadScript('/komi-profile-extras-catalog.js?v=20261127-extras-v1');catalogLoaded=!!root.KomiExtrasCatalog;if(!catalogLoaded)throw Error('Catalog missing');}
  await loadScript('/komi-profile-extras.js?v=20261127-extras-v1');
  const api=root.KomiProfileExtras;if(!api||api===proxy||typeof api.mountProfile!=='function')throw Error('Profile extras missing');
  loaded=api;if(config)api.configure(config);return api;
 })().catch(e=>{root.KomiProfileExtras=proxy;throw e;}).finally(()=>{pending=null;});
 return pending;
}
function invoke(method,args,valid){return ensure().then(api=>{if(valid())return api[method](...args);}).catch(()=>{});}
root.KomiProfileExtras=proxy;
})(window);
