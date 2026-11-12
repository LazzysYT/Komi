/* Komi strict-CSP bridge for legacy dynamically generated UI markup.
 * Declarative data-komi-on{event} values are accepted ONLY if they match a
 * finite set of safe, anchored patterns. This is NOT an expression evaluator.
 * Arbitrary user-supplied JavaScript is never executed.
 */
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  const allowedStatuses=new Set(['Просмотрено','В планах','Смотрю','Отложено','Брошено','Любимые']);
  const allowedSections=new Set(['overview','anime','friends','comments']);
  const allowedCollections=new Set(['all','recent','short','movies','best']);
  const safeAnimeId=/^[1-9][0-9]{0,14}$/;
  const isId=id=>safeAnimeId.test(String(id||''))&&Number.isSafeInteger(Number(id));

  function fallback(img,source){
    if(!img || !/^(\/anime-artwork\.svg|\.\/anime-artwork\.svg|https:\/\/api\.dicebear\.com\/7\.x\/bottts\/svg\?seed=(Komi|fallback))$/.test(source))return;
    if(img.dataset.komiFallbackApplied===source){img.removeAttribute('data-komi-onerror');return}
    img.dataset.komiFallbackApplied=source;
    img.src=source;
  }
  const fixed={
    "closeFriendsDrawer();openAuthModal('login')":()=>{closeFriendsDrawer();openAuthModal('login')},
    "openAuthModal('login')":()=>openAuthModal('login'),
    "openAniCoinShop()":()=>openAniCoinShop(),
    "openWatchPartyHub()":()=>openWatchPartyHub(),
    "leaveWatchPartyRoom()":()=>leaveWatchPartyRoom(),
    "toggleKomiPartyFullscreen()":()=>toggleKomiPartyFullscreen(),
    "toggleKomiWatchFullscreen()":()=>toggleKomiWatchFullscreen(),
    "closeWatchModal()":()=>closeWatchModal(),
    "closeFriendsDrawer()":()=>closeFriendsDrawer(),
    "loadDataFromCloud()":()=>loadDataFromCloud(),
    "loadDataFromCloud(); render()":()=>{loadDataFromCloud();render()},
    "loadDataFromCloud();render()":()=>{loadDataFromCloud();render()},
    "komiResetCatalogFilters()":()=>komiResetCatalogFilters(),
    "showMoreCatalog()":()=>showMoreCatalog(),
    "randomAnimeWithAnimation()":()=>randomAnimeWithAnimation(),
    "loadKomiEpisodeSchedule(true)":()=>loadKomiEpisodeSchedule(true),
    "document.getElementById('komiCalendarSection')?.scrollIntoView({behavior:'smooth',block:'start'})":
      ()=>document.getElementById('komiCalendarSection')?.scrollIntoView({behavior:'smooth',block:'start'}),
    "openAniCoinShop()":()=>openAniCoinShop(),
    "importLocalCustomFolders()":()=>importLocalCustomFolders(),
    "createCustomFolder()":()=>createCustomFolder(),
    "document.querySelector('.profile-settings-box')?.classList.toggle('is-open')":
      ()=>document.querySelector('.profile-settings-box')?.classList.toggle('is-open'),
    "updateUserProfile(this)":(_,el)=>updateUserProfile(el),
    "logoutUser('global')":()=>logoutUser('global'),
    "openProfile(window.komiViewedProfileName)":()=>openProfile(root.komiViewedProfileName),
    "removeFriend(window.komiViewedProfileName)":()=>removeFriend(root.komiViewedProfileName),
    "sendFriendRequest(window.komiViewedProfileName)":()=>sendFriendRequest(root.komiViewedProfileName),
    "postToProfileWall(window.komiWallProfileName)":()=>postToProfileWall(root.komiWallProfileName)
  };

  function makeClick(text) {
    if(Object.hasOwn(fixed,text))return fixed[text];
    let match;
    if((match=/^navigate\('(home|catalog|shop|partners)'\)$/.exec(text)))
      return ()=>navigate(match[1]);
    if((match=/^openKomiCollection\('([a-z]+)'\)$/.exec(text)) && allowedCollections.has(match[1]))
      return ()=>openKomiCollection(match[1]);
    if((match=/^setKomiCatalogYear\('(Все|[12][0-9]{3})'\)$/.exec(text)))
      return ()=>setKomiCatalogYear(match[1]);
    if((match=/^showKomiYear\('([12][0-9]{3})'\)$/.exec(text)))
      return ()=>showKomiYear(match[1]);
    if((match=/^respondProtectedFriendRequest\(([0-9]{1,12}), (true|false)\)$/.exec(text)))
      return ()=>respondProtectedFriendRequest(Number(match[1]),match[2]==='true');
    if((match=/^changeSlide\((-?1)\)$/.exec(text)))
      return ()=>changeSlide(Number(match[1]));
    if((match=/^setSlide\(([0-9]{1,2})\)$/.exec(text)))
      return ()=>setSlide(Number(match[1]));
    if((match=/^openWatchModal\('([0-9]{1,15})'(?:,\s*([0-9]{1,4}),\s*(-?[0-9]{1,5}))?\)$/.exec(text)) && isId(match[1]))
      return ()=>match[2]===undefined
        ?openWatchModal(match[1])
        :openWatchModal(match[1],Number(match[2]),Number(match[3]));
    if((match=/^resumeKomiAnime\('([0-9]{1,15})'\)$/.exec(text)) && isId(match[1]))
      return ()=>resumeKomiAnime(match[1]);
    if((match=/^createWatchPartyFromAnime\('([0-9]{1,15})'\)$/.exec(text)) && isId(match[1]))
      return ()=>createWatchPartyFromAnime(match[1]);
    if((match=/^createWatchPartyFromAnime\('([0-9]{1,15})', '', false, ([0-9]{1,5}), document\.getElementById\('komiWatchSourceSelect'\)\.value\)$/.exec(text)) && isId(match[1]))
      return ()=>createWatchPartyFromAnime(match[1],'',false,Number(match[2]),
        document.getElementById('komiWatchSourceSelect')?.value || '');
    if((match=/^toggleFavorite\('([0-9]{1,15})', 'Любимые'\)$/.exec(text)) && isId(match[1]))
      return ()=>toggleFavorite(match[1],'Любимые');
    if((match=/^setAnimeStatus\('([0-9]{1,15})', '([^']+)'\)$/.exec(text)) &&
      isId(match[1]) && allowedStatuses.has(match[2]))
      return ()=>setAnimeStatus(match[1],match[2]);
    if((match=/^profilePageSection='(overview|anime|friends|comments)';\s*render\(\)$/.exec(text)) &&
      allowedSections.has(match[1]))
      return ()=>{profilePageSection=match[1];render()};
    if((match=/^profilePageSection='anime';\s*profileActiveTab='([^']+)';\s*render\(\)$/.exec(text)) &&
      allowedStatuses.has(match[1]))
      return ()=>{profilePageSection='anime';profileActiveTab=match[1];render()};
    if((match=/^profileActiveTab='([^']+)';\s*(profilePageSection='anime';\s*)?render\(\)$/.exec(text)) &&
      allowedStatuses.has(match[1]))
      return ()=>{profileActiveTab=match[1];if(match[2])profilePageSection='anime';render()};
    if((match=/^profileActiveTab=window\.komiProfileFolderNames\[([0-9]{1,4})\];\s*render\(\)$/.exec(text)))
      return ()=>{profileActiveTab=root.komiProfileFolderNames?.[Number(match[1])]||profileActiveTab;render()};
    if((match=/^deleteCustomFolder\(window\.komiProfileFolderNames\[([0-9]{1,4})\]\)$/.exec(text)))
      return ()=>deleteCustomFolder(root.komiProfileFolderNames?.[Number(match[1])]);
    if((match=/^openCommunityProfile\(window\.komiFriendNames\[([0-9]{1,4})\]\)$/.exec(text)))
      return ()=>openCommunityProfile(root.komiFriendNames?.[Number(match[1])]);
    if((match=/^requestCommunityFriend\(window\.komiFriendNames\[([0-9]{1,4})\]\)$/.exec(text)))
      return ()=>requestCommunityFriend(root.komiFriendNames?.[Number(match[1])]);
    if((match=/^openProfile\(window\.komiSidebarSearchNames\[([0-9]{1,4})\]\)$/.exec(text)))
      return ()=>openProfile(root.komiSidebarSearchNames?.[Number(match[1])]);
    if((match=/^sendFriendRequest\(window\.komiSidebarSearchNames\[([0-9]{1,4})\]\)$/.exec(text)))
      return ()=>sendFriendRequest(root.komiSidebarSearchNames?.[Number(match[1])]);
    if((match=/^openProfile\(window\.komiSidebarFriendNames\[([0-9]{1,4})\]\)$/.exec(text)))
      return ()=>openProfile(root.komiSidebarFriendNames?.[Number(match[1])]);
    if((match=/^openProfile\(window\.komiProfileFriendNames\[([0-9]{1,4})\]\)$/.exec(text)))
      return ()=>openProfile(root.komiProfileFriendNames?.[Number(match[1])]);
    if((match=/^openProfile\(window\.komiWallAuthorByIndex\[([0-9]{1,4})\]\)$/.exec(text)))
      return ()=>openProfile(root.komiWallAuthorByIndex?.[Number(match[1])]);
    if((match=/^deleteWallMessage\(window\.komiWallProfileName, ([0-9]{1,5})\)$/.exec(text)))
      return ()=>deleteWallMessage(root.komiWallProfileName,Number(match[1]));
    return null;
  }

  function resolve(type,expression){
    let text=String(expression||'').trim();
    const soundPrefix=type==='click' && /^playSound\(\);\s*/.test(text);
    if(soundPrefix)text=text.replace(/^playSound\(\);\s*/,'');
    let fn=null,match;
    if(type==='click')fn=makeClick(text);
    if(type==='click' && soundPrefix && !text)fn=()=>{};
    if(type==='input') {
      if(text==='handleFriendSearchInput(this.value)')fn=(_,el)=>handleFriendSearchInput(el.value);
      if(text==='komiUpdateCatalogQuery(this.value)')fn=(_,el)=>komiUpdateCatalogQuery(el.value);
      if(text==='komiFindEpisode(this.value)')fn=(_,el)=>komiFindEpisode(el.value);
      if(text==='updateProfileCollectionSearch(this)')fn=(_,el)=>updateProfileCollectionSearch(el);
    }
    if(type==='change') {
      if((match=/^(catalogFilterGenre|catalogFilterYear|catalogFilterType|catalogSort)=this\.value;\s*render\(\)$/.exec(text)))
        fn=(_,el)=>{switch(match[1]){
          case 'catalogFilterGenre':catalogFilterGenre=el.value;break;
          case 'catalogFilterYear':catalogFilterYear=el.value;break;
          case 'catalogFilterType':catalogFilterType=el.value;break;
          case 'catalogSort':catalogSort=el.value;break;
        }render()};
      if(text==='handleAvatarFileUpload(event)')fn=e=>handleAvatarFileUpload(e);
      if((match=/^changePlayerSource\('([0-9]{1,15})',([0-9]{1,4}),([0-9]{1,5}),this\.value\)$/.exec(text)) && isId(match[1]))
        fn=(_,el)=>changePlayerSource(match[1],Number(match[2]),Number(match[3]),el.value);
    }
    if(type==='keydown') {
      if((match=/^if\(event\.key==='Enter'\|\|event\.key===' '\)\{event\.preventDefault\(\);openWatchModal\('([0-9]{1,15})'\)\}$/.exec(text)) && isId(match[1]))
        fn=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openWatchModal(match[1])}};
      if(text==="if(event.key==='Enter') postToProfileWall(window.komiWallProfileName)")
        fn=e=>{if(e.key==='Enter')postToProfileWall(root.komiWallProfileName)};
    }
    if(type==='error') {
      if(text==='komiCardPosterFallback(this)')fn=(_,el)=>{
        if(el.getAttribute('src')==='/anime-artwork.svg'){el.removeAttribute('data-komi-onerror');return}
        komiCardPosterFallback(el);
      };
      if(text==="this.style.display='none'")fn=(_,el)=>{el.style.display='none';el.removeAttribute('data-komi-onerror')};
      if((match=/^(?:this\.onerror=null;)?this\.src='([^']+)'$/.exec(text)))
        fn=(_,el)=>fallback(el,match[1]);
    }
    if(!fn)return null;
    if(!soundPrefix)return fn;
    return (event,element)=>{
      if(typeof playSound==='function')playSound();
      return fn(event,element);
    };
  }

  function delegate(type,event){
    const target=event.target;
    if(!target || typeof target.closest!=='function')return;
    const element=target.closest('[data-komi-on'+type+']');
    if(!element)return;
    const source=element.getAttribute('data-komi-on'+type);
    const handler=resolve(type,source);
    if(!handler){
      console.warn('Unsupported Komi legacy UI action:',type);
      return;
    }
    const result=handler(event,element);
    if(result&&typeof result.then==='function')
      result.catch(error=>console.error('Komi dynamic UI action:',type,error));
  }
  for(const type of ['click','input','change','keydown','error'])
    document.addEventListener(type,event=>delegate(type,event),type==='error');
  root.KomiDynamicEvents={supports:(type,code)=>!!resolve(type,code)};
})(globalThis);
