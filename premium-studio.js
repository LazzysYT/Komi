/* Komi Premium Studio
 * Standalone /premium.html client. Uses the same public Supabase project,
 * prefs/badge tables, storage buckets and server RPC as the existing SPA.
 * Client is a preview only: entitlement, write access and purchases require RLS/RPC.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://xebglnnpoutmdcgukbxf.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_SzKz649coUbxHWXjQfdSXQ_GGzzbHrs';
  const themes = [
    ['Золотой','#f5d477','#3b2b0b'], ['Красный','#ff6262','#330d0d'],
    ['Фиолетовый','#c795ff','#241036'], ['Розовый','#ff8cc9','#381126'],
    ['Синий','#65b9ff','#0b2444'], ['Голубой','#73e8ff','#07323d'],
    ['Бирюзовый','#4be8d6','#06372f'], ['Зелёный','#74e786','#0d3519'],
    ['Лаймовый','#b5f76c','#273809'], ['Оранжевый','#ffae66','#402109'],
    ['Янтарный','#ffca58','#432c07'], ['Белый','#f7f7f7','#222222'],
    ['Графитовый','#b6b8c2','#202127'], ['Красный градиент','#ff8b9e','#46131e'],
    ['Фиолетово-синий','#a2a2ff','#191c50'], ['Аврора','#83f7ef','#302054'],
    ['Радужный','#ffb7e9','#283a65'], ['Ледяной','#a7e5ff','#143c56'],
    ['Дымный','#b8b4c8','#27252e'], ['Космический','#cf9dff','#211038']
  ];
  const badgeGradients = {
    13:'linear-gradient(120deg,#571224,#401d66)',
    14:'linear-gradient(120deg,#3e126b,#123b73)',
    15:'linear-gradient(120deg,#114b55,#4e1c65)',
    16:'linear-gradient(90deg,#9c2848,#8d7e24,#237c86,#4d2f8e)',
    17:'linear-gradient(120deg,#1c547e,#16304b)',
    18:'linear-gradient(120deg,#303038,#15151b)',
    19:'linear-gradient(120deg,#221037,#24154c,#0b3658)'
  };
  const nickStyles = [
    ['Обычный',''], ['Монохром','linear-gradient(110deg,#f0f0f0,#777)'],
    ['Розовый','linear-gradient(110deg,#ff8595,#c959ff)'],
    ['Небесный','linear-gradient(110deg,#79bfff,#bd8eff)'],
    ['Бирюзовый','linear-gradient(110deg,#81f3e7,#89bbff)'],
    ['Золотой','linear-gradient(110deg,#f2d783,#ef9fbb)']
  ];
  const statuses = ['', '✨','🌙','🎬','⭐','🔥','💫'];
  const audioPresets = [
    { id:0, name:'Без музыки', desc:'Оригинальная тишина', notes:[] },
    { id:1, name:'Тихий вечер', desc:'Мягкие светлые ноты', notes:[220,277.18,329.63,440,329.63,277.18] },
    { id:2, name:'Космический свет', desc:'Спокойная электроника', notes:[196,246.94,293.66,392,293.66,246.94] }
  ];
  const products = window.KomiShopCatalog?.items || [];
  let storeCategory = 'all';
  const state = {
    client:null, userId:'', displayName:'Пользователь Komi', avatarUrl:'',
    entitled:false, entitlementChecked:false, saved:{style:0,nick_theme:0,status_emoji:'',music_theme:0},
    draft:{style:0,nick_theme:0,status_emoji:'',music_theme:0},
    wallet:null, equipped:{frame_id:null,title_id:null,banner_id:null,overlay_id:null,showcase_id:null,card_id:null,icon_id:null,shape_id:null,plate_id:null,mascot_id:null,xp_id:null,name_id:null},
    trial:{frame:null,title:null,banner:null,overlay:null,showcase:null,card:null,icon:null,shape:null,plate:null,mascot:null,xp:null,name:null}, saving:false, shopping:false, serial:0
  };
  let player = null;
  const $ = id => document.getElementById(id);

  function message(id, value) {
    const node = $(id);
    if (node) node.textContent = value || '';
  }
  function safeHttpsUrl(value) {
    if (!value || typeof value !== 'string') return '';
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' ? parsed.href : '';
    } catch { return ''; }
  }
  function normalizedPrefs(input) {
    const style = Number(input?.style);
    const nick = Number(input?.nick_theme);
    const music = Number(input?.music_theme);
    return {
      style:Number.isInteger(style)&&style>=0&&style<themes.length ? style : 0,
      nick_theme:Number.isInteger(nick)&&nick>=0&&nick<nickStyles.length ? nick : 0,
      status_emoji:statuses.includes(input?.status_emoji) ? input.status_emoji : '',
      music_theme:Number.isInteger(music)&&music>=0&&music<audioPresets.length ? music : 0
    };
  }
  function owns(id) {
    return Array.isArray(state.wallet?.owned) && state.wallet.owned.includes(id);
  }
  function activeItem(type) {
    const preview = state.trial[type];
    if (preview !== null) return preview;
    const key=type+'_id';
    return state.wallet?.[key] || state.equipped[key] || null;
  }
  function setImage(imgId, fallbackId, url) {
    const img = $(imgId), fallback = $(fallbackId);
    if (!img || !fallback) return;
    const src = safeHttpsUrl(url);
    if (!src) { img.onload = null; img.onerror = null; img.removeAttribute('src'); img.hidden = true; fallback.hidden = false; return; }
    img.onload = () => { if (img.src === src) { img.hidden = false; fallback.hidden = true; } };
    img.onerror = () => { img.hidden = true; fallback.hidden = false; };
    img.src = src;
  }
  function applyName(node, gradient) {
    node.classList.toggle('gradient-text',Boolean(gradient));
    if (gradient) node.style.setProperty('--nick-gradient',gradient);
    else node.style.removeProperty('--nick-gradient');
  }
  function updatePreview() {
    const draft = state.draft;
    const nickname = state.displayName || 'Пользователь Komi';
    const gradient = nickStyles[draft.nick_theme]?.[1] || '';
    for (const id of ['preview-name','comment-name']) {
      const node = $(id);
      node.textContent = nickname;
      applyName(node,gradient);
    }
    const theme = themes[draft.style] || themes[0];
    for (const id of ['preview-badge','comment-badge']) {
      const badge = $(id);
      badge.style.setProperty('--badge-fg',theme[1]);
      badge.style.setProperty('--badge-bg',badgeGradients[draft.style] || theme[2]);
    }
    $('preview-emoji').textContent = draft.status_emoji;
    $('preview-emoji').hidden = !draft.status_emoji;
    const frame = activeItem('frame');
    const frameClass = products.find(p=>p.id===frame && p.type==='frame')?.frameClass || '';
    const frameClasses=products.filter(p=>p.type==='frame').map(p=>p.frameClass);
    for (const id of ['preview-avatar-frame','comment-avatar-frame']) {
      $(id).classList.remove(...frameClasses);
      if (frameClass) $(id).classList.add(frameClass);
    }
    const banner = activeItem('banner');
    const bannerClass=products.find(p=>p.id===banner && p.type==='banner')?.bannerClass || '';
    const cover=document.querySelector('.preview-cover');
    if (cover) {
      cover.classList.remove(...products.filter(p=>p.type==='banner').map(p=>p.bannerClass));
      if (bannerClass) cover.classList.add(bannerClass);
      const overlayClass=products.find(p=>p.id===activeItem('overlay'))?.cosmeticClass||'';
      cover.classList.remove(...products.filter(p=>p.type==='overlay').map(p=>p.cosmeticClass));
      if(overlayClass) cover.classList.add(overlayClass);
    }
    const profileCard=$('preview-shop-card');
    if(profileCard){
      profileCard.classList.remove(...products.filter(p=>p.type==='card').map(p=>'komi-store-'+p.cosmeticClass));
      const bg=products.find(p=>p.id===activeItem('card'))?.cosmeticClass;
      if(bg)profileCard.classList.add('komi-store-'+bg);
    }
    const showcase=$('preview-shop-showcase');
    if(showcase){
      showcase.classList.remove(...products.filter(p=>p.type==='showcase').map(p=>'komi-store-'+p.cosmeticClass));
      const item=products.find(p=>p.id===activeItem('showcase'));
      showcase.hidden=!item;
      if(item)showcase.classList.add('komi-store-'+item.cosmeticClass);
    }
    const iconItem=products.find(p=>p.id===activeItem('icon'));
    const iconClasses=products.filter(p=>p.type==='icon'&&p.cosmeticClass).map(p=>'komi-store-'+p.cosmeticClass);
    for(const id of ['preview-shop-icon','comment-shop-icon']){
      const node=$(id);if(!node)continue;
      node.classList.remove(...iconClasses);
      if(iconItem?.type==='icon'&&iconItem.cosmeticClass)node.classList.add('komi-store-'+iconItem.cosmeticClass);
      node.textContent=iconItem?.symbol||'';
      node.hidden=!iconItem;
    }
    const shape=products.find(p=>p.id===activeItem('shape'));
    for(const id of ['preview-avatar','comment-avatar','preview-avatar-fallback','comment-avatar-fallback']){
      const el=$(id);
      if(!el)continue;
      el.classList.remove(...products.filter(p=>p.type==='shape').map(p=>'komi-store-'+p.cosmeticClass));
      if(shape?.cosmeticClass)el.classList.add('komi-store-'+shape.cosmeticClass);
    }
    const nameStyle=products.find(p=>p.id===activeItem('name'));
    for(const id of ['preview-name','comment-name']){
      const el=$(id);if(!el)continue;
      el.classList.remove(...products.filter(p=>p.type==='name').map(p=>'komi-store-'+p.cosmeticClass));
      if(nameStyle?.cosmeticClass)el.classList.add('komi-store-'+nameStyle.cosmeticClass);
    }
    const plate=products.find(p=>p.id===activeItem('plate'));
    const commentPanel=document.querySelector('.comment-preview');
    if(commentPanel){
      commentPanel.classList.remove(...products.filter(p=>p.type==='plate').map(p=>'komi-store-'+p.cosmeticClass));
      if(plate?.cosmeticClass)commentPanel.classList.add('komi-store-'+plate.cosmeticClass);
    }
    const mascot=products.find(p=>p.id===activeItem('mascot'));
    const previewCard=$('preview-shop-card');
    if(previewCard){
      let node=previewCard.querySelector('[data-komi-preview-mascot]');
      if(mascot){
        if(!node){node=document.createElement('i');node.dataset.komiPreviewMascot='';previewCard.append(node);}
        node.className='komi-profile-mascot komi-store-'+mascot.cosmeticClass;
      }else node?.remove();
    }
    const xp=products.find(p=>p.id===activeItem('xp'));
    const xpBar=$('preview-shop-xp');
    if(xpBar){
      xpBar.classList.remove(...products.filter(p=>p.type==='xp').map(p=>'komi-store-'+p.cosmeticClass));
      if(xp?.cosmeticClass)xpBar.classList.add('komi-store-'+xp.cosmeticClass);
    }
    const activeEquip=Object.fromEntries(['frame','title','shape','plate','mascot'].map(type=>[type+'_id',activeItem(type)]));
    const activeSets=window.KomiShopCatalog?.activeSets?.(activeEquip)||[];
    const previewLabel=$('preview-shop-set');
    if(previewLabel){previewLabel.hidden=!activeSets.length;previewLabel.textContent=activeSets.length?'✦ '+activeSets.map(x=>x.label).join(', '):'';}
    if(previewCard){
      previewCard.classList.remove(...(window.KomiShopCatalog?.sets||[]).map(x=>x.className));
      for(const set of activeSets)previewCard.classList.add(set.className);
    }
    const title = activeItem('title');
    const equippedTitle=products.find(p=>p.id===title && p.type==='title');
    const titleText=window.KomiShopCatalog?.titleText?.(equippedTitle)||equippedTitle?.title||'';
    $('preview-title').textContent = titleText;
    if(titleText) $('preview-title').dataset.komiTitleId=title;
    else delete $('preview-title').dataset.komiTitleId;
    $('preview-title').hidden = !titleText;
    $('try-on-note').hidden = !Object.values(state.trial).some(id=>id && !owns(id));
    const initial = nickname.trim().slice(0,1).toUpperCase() || 'K';
    $('preview-avatar-fallback').textContent = initial;
    $('comment-avatar-fallback').textContent = initial;
  }
  function isDirty() {
    const d = state.draft, s = state.saved;
    return d.style !== s.style || d.nick_theme !== s.nick_theme ||
      d.status_emoji !== s.status_emoji || d.music_theme !== s.music_theme;
  }
  function updateAccess() {
    // Keep the purchase banner hidden until entitlement has been verified.
    // Guests see the offer; verified Premium members never see a purchase prompt.
    const offer = $('premium-offer');
    if (offer) offer.hidden = !state.entitlementChecked || state.entitled;
    const canSave = state.userId && state.entitled && state.entitlementChecked;
    $('save-style').disabled = !canSave || state.saving || !isDirty();
    if (!state.entitlementChecked) {
      message('premium-access','Статус не удалось проверить');
      message('studio-availability','Сохранение недоступно, пока не подтверждён статус Premium.');
    } else if (!state.userId) {
      message('premium-access','Гостевой предпросмотр');
      message('studio-availability','Войди на главной странице, чтобы сохранить оформление.');
    } else if (!state.entitled) {
      message('premium-access','Premium не активен');
      message('studio-availability','Сначала активируй Premium. Примерять стили можно бесплатно.');
    } else {
      message('premium-access','✦ PREMIUM АКТИВЕН');
      message('studio-availability',isDirty() ? 'Настройки пока не сохранены.' : 'Все изменения стиля сохранены.');
    }
    const button = $('save-style');
    button.firstChild.textContent = state.saving ? 'Сохраняем… ' : isDirty() ? 'Сохранить стиль ' : 'Стиль сохранён ';
  }
  function refreshSelected() {
    document.querySelectorAll('[data-badge-index]').forEach(node => {
      node.setAttribute('aria-pressed',String(Number(node.dataset.badgeIndex)===state.draft.style));
    });
    document.querySelectorAll('[data-nick-index]').forEach(node => {
      node.setAttribute('aria-pressed',String(Number(node.dataset.nickIndex)===state.draft.nick_theme));
    });
    document.querySelectorAll('[data-status-value]').forEach(node => {
      node.setAttribute('aria-pressed',String(node.dataset.statusValue===state.draft.status_emoji));
    });
    document.querySelectorAll('[data-audio-index]').forEach(node => {
      node.setAttribute('aria-pressed',String(Number(node.dataset.audioIndex)===state.draft.music_theme));
    });
    updatePreview();
    updateAccess();
  }
  function createButton(label, cssClass, dataset, callback) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = cssClass;
    node.setAttribute('aria-pressed','false');
    node.setAttribute('aria-label',label);
    for (const [key,value] of Object.entries(dataset)) node.dataset[key] = String(value);
    node.addEventListener('click',callback);
    return node;
  }
  function buildBadgeChoices() {
    const grid = $('badge-grid');
    themes.forEach((item,index) => {
      const button = createButton('Значок Premium — '+item[0],'badge-choice',{badgeIndex:index},()=>{
        state.draft.style=index; message('save-status','');refreshSelected();
      });
      button.style.setProperty('--badge-fg',item[1]);
      button.style.setProperty('--badge-bg',badgeGradients[index] || item[2]);
      const badge = document.createElement('span');badge.className='badge-symbol';badge.textContent='✦ PREMIUM';
      const name = document.createElement('small');name.textContent=item[0];
      button.append(badge,name);
      grid.append(button);
    });
  }
  function buildNicknameChoices() {
    const grid = $('gradient-grid');
    nickStyles.forEach((item,index) => {
      const button = createButton('Градиент ника: '+item[0],'gradient-choice',{nickIndex:index},()=>{
        state.draft.nick_theme=index;message('save-status','');refreshSelected();
      });
      const label=document.createElement('span');
      label.textContent=item[0];
      applyName(label,item[1]);
      button.append(label);
      grid.append(button);
    });
    const emojis = $('emoji-grid');
    statuses.forEach(emoji => {
      const button = createButton(emoji ? 'Эмодзи-статус: '+emoji : 'Без статуса',
        'emoji-choice',{statusValue:emoji},()=>{
          state.draft.status_emoji=emoji;message('save-status','');refreshSelected();
        });
      button.textContent=emoji||'Без статуса';
      emojis.append(button);
    });
  }
  function stopAudio() {
    if (!player) return;
    const old = player;
    player = null;
    if (old.timer) clearTimeout(old.timer);
    if (old.ctx) void old.ctx.close().catch(()=>{});
    document.querySelectorAll('.audio-test').forEach(btn=>{btn.textContent='▶ Тест';});
  }
  async function previewAudio(index,button) {
    if (player?.index === index) { stopAudio();return; }
    stopAudio();
    const preset = audioPresets[index];
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!preset?.notes.length || !AudioContext) {
      message('save-status','Этот браузер не поддерживает предварительное прослушивание.');
      return;
    }
    try {
      const ctx = new AudioContext();
      player = {index,ctx,timer:null};
      await ctx.resume();
      if (player?.ctx !== ctx) { await ctx.close();return; }
      const start = ctx.currentTime + 0.04;
      preset.notes.forEach((frequency,i) => {
        const osc = ctx.createOscillator(),gain=ctx.createGain();
        const t=start+i*.36;
        osc.type='sine';
        osc.frequency.setValueAtTime(frequency,t);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(.026,t+.05);
        gain.gain.exponentialRampToValueAtTime(.0001,t+.65);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start(t);osc.stop(t+.68);
      });
      button.textContent='■ Стоп';
      player.timer=setTimeout(stopAudio,Math.ceil((preset.notes.length*.36+.8)*1000));
    } catch {
      stopAudio();
      message('save-status','Не удалось воспроизвести звук на этом устройстве.');
    }
  }
  function buildAudioChoices() {
    const grid=$('audio-grid');
    audioPresets.forEach(preset => {
      const card=document.createElement('article');
      card.className='audio-choice';
      card.dataset.audioIndex=String(preset.id);
      card.setAttribute('aria-pressed','false');
      const top=document.createElement('div');top.className='audio-top';
      const title=document.createElement('div');
      const name=document.createElement('div');name.className='audio-name';name.textContent=preset.name;
      const desc=document.createElement('div');desc.className='audio-desc';desc.textContent=preset.desc;
      title.append(name,desc);
      const symbol=document.createElement('span');symbol.className='audio-wave';symbol.textContent=preset.id?'♫':'○';
      top.append(title,symbol);
      const pick=document.createElement('button');
      pick.className='audio-select';pick.type='button';pick.textContent='Выбрать тему';
      pick.setAttribute('aria-label','Выбрать '+preset.name);
      pick.addEventListener('click',()=>{state.draft.music_theme=preset.id;message('save-status','');refreshSelected();});
      card.append(top,pick);
      if (preset.id) {
        const test=document.createElement('button');
        test.className='audio-test';test.type='button';test.textContent='▶ Тест';
        test.setAttribute('aria-label','Послушать '+preset.name);
        test.addEventListener('click',()=>{void previewAudio(preset.id,test);});
        card.append(test);
      }
      grid.append(card);
    });
  }
  function paintStore() {
    const grid=$('store-grid');
    grid.replaceChildren();
    const filters=$('store-filters');
    if (filters) {
      filters.replaceChildren();
      for (const [key,label] of [['all','Все'],['frame','Рамки'],['title','Титулы'],['banner','Обложки'],['overlay','Эффекты'],['showcase','Топ-3'],['card','Карточки'],['icon','Иконки'],['shape','Формы аватара'],['plate','Комментарии'],['mascot','Маскоты'],['xp','XP-полоски'],['name','Стили ника'],['reaction','Watch Party'],['owned','Мои покупки']]) {
        const tab=document.createElement('button');tab.type='button';tab.textContent=label;
        tab.setAttribute('aria-pressed',String(storeCategory===key));
        tab.addEventListener('click',()=>{storeCategory=key;paintStore();});
        filters.append(tab);
      }
    }
    const wallet=state.wallet, active=Boolean(state.userId);
    const balance=Number(wallet?.balance);
    message('store-balance',wallet && Number.isFinite(balance)
      ? '◈ '+balance.toLocaleString('ru-RU')+' AniCoin' : '◈ — AniCoin');
    products.filter(p=>storeCategory==='owned'?owns(p.id):!window.KomiShopCatalog?.isArchived?.(p.id)&&(storeCategory==='all'||p.type===storeCategory)).forEach(product => {
      const item=document.createElement('article');
      item.className='store-item';
      item.dataset.rarity=product.rarity||'common';
      item.tabIndex=0;
      item.setAttribute('aria-label',product.label+' — примерить');
      const isTrial=state.trial[product.type]===product.id;
      item.classList.toggle('is-trying',isTrial);
      const top=document.createElement('div');
      if (product.type==='frame') {
        top.className='store-icon '+product.frameClass;
        if (state.avatarUrl) {
          const img=document.createElement('img');
          img.src=state.avatarUrl;img.alt='';
          img.onerror=()=>{img.remove();top.textContent=state.displayName.slice(0,1)||'K';};
          top.append(img);
        } else top.textContent=state.displayName.slice(0,1)||'K';
      } else if (product.type==='banner') {
        top.className='store-banner-swatch '+product.bannerClass;
        top.textContent='KOMI ANIME';
      } else if(product.type==='overlay'){
        top.className='komi-preview-cover';
        const layer=document.createElement('span');layer.className='komi-shop-overlay-layer '+product.cosmeticClass;top.append(layer);
      } else if(product.type==='showcase'){
        top.className='komi-shop-showcase-demo komi-store-'+product.cosmeticClass;
        for(let i=0;i<3;i++)top.append(document.createElement('i'));
      } else if(product.type==='card'){
        top.className='komi-shop-mini-swatch komi-store-'+product.cosmeticClass;top.textContent='KOMI';
      } else if(product.type==='icon'){
        top.className='komi-shop-icon-swatch komi-store-'+product.cosmeticClass;top.textContent=product.symbol;
      } else if(product.type==='reaction'){
        top.className='komi-shop-reaction-swatch';
        for(const reaction of product.reactions){
          const preview=document.createElement('span');
          preview.setAttribute('role','img');preview.setAttribute('aria-label',reaction.label||reaction.id);
          if(window.KomiShopReactions)preview.innerHTML=window.KomiShopReactions.render(reaction.emoji);
          else preview.textContent=reaction.label||reaction.id;
          top.append(preview);
        }
      } else if(['shape','plate','mascot','xp','name'].includes(product.type)){
        top.className='komi-shop-visual-sample komi-store-'+product.cosmeticClass;
        top.classList.add('komi-shop-'+({shape:'avatar-shape',plate:'plate-swatch',mascot:'mascot-swatch',xp:'xp-swatch',name:'name-swatch'}[product.type]));
        if(product.type==='mascot'){
          const mascot=document.createElement('i');mascot.className='komi-profile-mascot komi-store-'+product.cosmeticClass;top.append(mascot);
        }else if(product.type==='xp')top.textContent='';
        else if(product.type==='name')top.textContent=state.displayName||'Komi';
        else if(product.type==='plate')top.textContent='Пример комментария';
        else if(product.type==='shape'){
          if(state.avatarUrl){const img=document.createElement('img');img.alt='';img.src=state.avatarUrl;top.append(img);}else top.textContent='K';
        }
      } else {top.className='store-title-chip';top.textContent=window.KomiShopCatalog?.titleText?.(product)||product.title;top.dataset.komiTitleId=product.id;}
      const heading=document.createElement('h3');heading.textContent=product.label;
      const subtitle=document.createElement('p');subtitle.className='store-subtitle';
      const owned=owns(product.id);
      const equippedKey=product.type+'_id';
      const equippedId=state.wallet?.[equippedKey] || state.equipped[equippedKey];
      const currentlyEquipped=equippedId===product.id;
      subtitle.textContent=owned ? currentlyEquipped?'Надето':'Уже куплено' : product.cost+' AniCoin';
      const controls=document.createElement('div');controls.className='store-controls';
      const preview=document.createElement('button');
      preview.className='store-action store-try';preview.type='button';preview.textContent=isTrial?'Снять примерку':'Примерить';
      preview.addEventListener('click',event=>{event.stopPropagation();tryOn(product);});
      if(product.type==='reaction'){preview.disabled=true;preview.textContent='Состав набора';}
      const action=document.createElement('button');
      action.className='store-action';action.type='button';
      if (owned) {
        action.textContent=product.type==='reaction'?'Набор куплен':currentlyEquipped?'Снять':'Надеть';
        action.disabled=!active || !wallet || state.shopping||product.type==='reaction';
      } else {
        action.textContent=wallet && Number(wallet.balance)<product.cost?'Не хватает AniCoin':(product.type==='reaction'?'Купить набор · ':'Купить и надеть · ')+product.cost+' ◈';
        action.disabled=!active || !wallet || Number(wallet.balance)<product.cost || state.shopping;
      }
      if(window.KomiShopCatalog?.isPreview?.()===true||!owned&&window.KomiShopCatalog?.canCheckout?.()!==true){
        action.disabled=true;action.textContent=window.KomiShopCatalog?.isPreview?.()?'Только примерка':'Покупки пока недоступны';
      }
      action.addEventListener('click',event=>{event.stopPropagation();void storeAction(product,owned?(currentlyEquipped?'unequip':'equip'):(product.type==='reaction'?'buy':'buy_equip'));});
      controls.append(preview,action);
      const rarity=document.createElement('span');rarity.className='komi-shop-rarity';
      rarity.textContent=({common:'Обычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный'})[product.rarity]||'Обычный';
      item.append(rarity,top,heading,subtitle,controls);
      item.addEventListener('click',event=>{if(!event.target.closest('button'))tryOn(product);});
      item.addEventListener('keydown',event=>{
        if ((event.key==='Enter'||event.key===' ') && event.target===item) {event.preventDefault();tryOn(product);}
      });
      grid.append(item);
    });
  }
  function tryOn(product) {
    state.trial[product.type]=state.trial[product.type]===product.id?null:product.id;
    updatePreview();paintStore();
    message('store-status',!state.trial[product.type]?'Примерка снята.':owns(product.id)?'Можно примерять купленные предметы без надевания.':
      'Предпросмотр: предмет ещё не куплен. AniCoin не списаны.');
  }
  function assertResponse(result) {
    if (result.error) throw result.error;
    return result.data;
  }
  async function verifiedOwner() {
    if (!state.client || !state.userId) throw Error('Войди в аккаунт Komi.');
    const {data,error}=await state.client.auth.getUser();
    if (error || data?.user?.id !== state.userId) throw Error('Сессия изменена. Войди снова.');
    return data.user.id;
  }
  async function storeAction(product,action) {
    if (state.shopping || !state.wallet || !['buy','equip','buy_equip','unequip'].includes(action) || window.KomiShopCatalog?.isPreview?.()===true) return;
    if (['buy','buy_equip'].includes(action) && window.KomiShopCatalog?.canCheckout?.()!==true) return;
    if (['buy','buy_equip'].includes(action) && !window.confirm('Купить «'+product.label+'» за '+product.cost+' AniCoin?')) return;
    state.shopping=true;paintStore();
    message('store-status',action==='buy_equip'?'Покупаем и надеваем…':action==='buy'?'Покупаем набор…':action==='equip'?'Надеваем предмет…':'Снимаем предмет…');
    const snapshot=state.userId;
    try {
      await verifiedOwner();
      const data=assertResponse(await state.client.rpc('komi_premium_store',{p_action:action,p_item:product.id}));
      if (state.userId!==snapshot)return;
      if (!data || !Array.isArray(data.owned)) throw Error('Неожиданный ответ магазина.');
      state.wallet=data;
      state.equipped={frame_id:data.frame_id||null,title_id:data.title_id||null,banner_id:data.banner_id||null,overlay_id:data.overlay_id||null,showcase_id:data.showcase_id||null,card_id:data.card_id||null,icon_id:data.icon_id||null,shape_id:data.shape_id||null,plate_id:data.plate_id||null,mascot_id:data.mascot_id||null,xp_id:data.xp_id||null,name_id:data.name_id||null};
      if (action!=='buy') state.trial[product.type]=null;
      message('store-status',action==='buy_equip'?'Покупка подтверждена. Предмет надет.':action==='buy'?'Набор реакций куплен и доступен в Watch Party.':action==='equip'?'Предмет надет.':'Предмет снят.');
    } catch (error) {
      message('store-status',error?.message||'Операция недоступна.');
    } finally {
      state.shopping=false;paintStore();updatePreview();
    }
  }
  async function saveStyle() {
    if (state.saving || !isDirty() || !state.entitled) return;
    state.saving=true;updateAccess();
    message('save-status','Проверяем Premium и сохраняем…');
    const before={...state.saved},wanted={...state.draft},snapshot=state.userId;
    let savedCount=0;
    try {
      await verifiedOwner();
      const prefsChanged=wanted.nick_theme!==before.nick_theme ||
        wanted.status_emoji!==before.status_emoji || wanted.music_theme!==before.music_theme;
      const badgeChanged=wanted.style!==before.style;
      if (prefsChanged) {
        assertResponse(await state.client.from('komi_premium_profile_prefs').upsert({
          user_id:snapshot,nick_theme:wanted.nick_theme,
          status_emoji:wanted.status_emoji,music_theme:wanted.music_theme
        },{onConflict:'user_id'}));
        savedCount++;
        if (state.userId!==snapshot) return;
        Object.assign(state.saved,{nick_theme:wanted.nick_theme,
          status_emoji:wanted.status_emoji,music_theme:wanted.music_theme});
      }
      if (badgeChanged) {
        assertResponse(await state.client.from('komi_premium_badge_styles').upsert({
          user_id:snapshot,style:wanted.style
        },{onConflict:'user_id'}));
        savedCount++;
        if (state.userId!==snapshot) return;
        state.saved.style=wanted.style;
      }
      message('save-status','Стиль сохранён в профиле.');
    } catch (error) {
      message('save-status',savedCount
        ? 'Часть изменений сохранена. Проверь и сохрани оставшиеся: '+(error?.message||'ошибка') 
        : error?.message||'Не удалось сохранить стиль.');
    } finally {
      state.saving=false;refreshSelected();
    }
  }
  async function fetchSingle(table,columns,userId) {
    const result=await state.client.from(table).select(columns).eq('user_id',userId).maybeSingle();
    return assertResponse(result);
  }
  async function loadAccount() {
    const request=++state.serial;
    stopAudio();
    state.entitlementChecked=false;
    state.userId='';state.entitled=false;state.wallet=null;state.avatarUrl='';
    state.displayName='Пользователь Komi';
    setImage('preview-avatar','preview-avatar-fallback','');
    setImage('comment-avatar','comment-avatar-fallback','');
    state.saved=normalizedPrefs(null);state.draft={...state.saved};
    state.equipped={frame_id:null,title_id:null,banner_id:null,overlay_id:null,showcase_id:null,card_id:null,icon_id:null,shape_id:null,plate_id:null,mascot_id:null,xp_id:null,name_id:null};
    state.trial={frame:null,title:null,banner:null,overlay:null,showcase:null,card:null,icon:null,shape:null,plate:null,mascot:null,xp:null,name:null};
    message('store-status','');
    message('save-status','');
    refreshSelected();paintStore();
    if (!state.client) {message('premium-access','Supabase недоступен');return;}
    try {
      const auth=await state.client.auth.getUser();
      if (request!==state.serial)return;
      if (auth.error) throw auth.error;
      const id=auth.data?.user?.id;
      if (!id) {
        state.entitlementChecked=true;refreshSelected();paintStore();return;
      }
      state.userId=id;
      const results=await Promise.allSettled([
        fetchSingle('komi_profiles','username,display_name,avatar_url',id),
        fetchSingle('komi_premium_badges','user_id',id),
        fetchSingle('komi_premium_badge_styles','style',id),
        fetchSingle('komi_premium_profile_prefs','nick_theme,status_emoji,music_theme',id),
        fetchSingle('komi_premium_media','avatar_path',id),
        fetchSingle('komi_premium_cosmetic_equips','frame_id,title_id,banner_id,overlay_id,showcase_id,card_id,icon_id,shape_id,plate_id,mascot_id,xp_id,name_id',id)
      ]);
      if (request!==state.serial)return;
      const val=index=>results[index].status==='fulfilled'?results[index].value:null;
      const premiumStatus=results[1];
      if (premiumStatus.status==='rejected') throw premiumStatus.reason;
      if (results[2].status==='rejected' || results[3].status==='rejected')
        throw Error('Не удалось загрузить текущие настройки Premium. Сохранение отключено.');
      state.entitled=Boolean(val(1)?.user_id);
      state.entitlementChecked=true;
      const profile=val(0);
      state.displayName=String(profile?.display_name || profile?.username ||
        auth.data.user.user_metadata?.display_name ||
        auth.data.user.user_metadata?.full_name || 'Пользователь Komi').slice(0,60);
      state.saved=normalizedPrefs({...val(2),...val(3)});
      state.draft={...state.saved};
      state.equipped={frame_id:val(5)?.frame_id||null,title_id:val(5)?.title_id||null,banner_id:val(5)?.banner_id||null,overlay_id:val(5)?.overlay_id||null,showcase_id:val(5)?.showcase_id||null,card_id:val(5)?.card_id||null,icon_id:val(5)?.icon_id||null,shape_id:val(5)?.shape_id||null,plate_id:val(5)?.plate_id||null,mascot_id:val(5)?.mascot_id||null,xp_id:val(5)?.xp_id||null,name_id:val(5)?.name_id||null};
      const path=val(4)?.avatar_path;
      const premiumAvatar=state.entitled && path
        ? state.client.storage.from('avatars').getPublicUrl(path).data?.publicUrl : '';
      state.avatarUrl=safeHttpsUrl(premiumAvatar)||safeHttpsUrl(profile?.avatar_url);
      setImage('preview-avatar','preview-avatar-fallback',state.avatarUrl);
      setImage('comment-avatar','comment-avatar-fallback',state.avatarUrl);
      if (state.userId) {
        try {
          const wallet=assertResponse(await state.client.rpc('komi_premium_store',{p_action:'read',p_item:null}));
          await window.KomiShopCatalog?.checkPricing?.(state.client);
          if (request!==state.serial)return;
          if (!wallet || !Array.isArray(wallet.owned) ||
              !Number.isSafeInteger(Number(wallet.balance))) throw Error('Некорректный баланс.');
          state.wallet=wallet;
          state.equipped={frame_id:wallet.frame_id||null,title_id:wallet.title_id||null,banner_id:wallet.banner_id||null,overlay_id:wallet.overlay_id||null,showcase_id:wallet.showcase_id||null,card_id:wallet.card_id||null,icon_id:wallet.icon_id||null,shape_id:wallet.shape_id||null,plate_id:wallet.plate_id||null,mascot_id:wallet.mascot_id||null,xp_id:wallet.xp_id||null,name_id:wallet.name_id||null};
        } catch (error) {message('store-status',error?.message||'Не удалось загрузить баланс.');}
      }
      refreshSelected();paintStore();
    } catch (error) {
      if (request!==state.serial)return;
      state.entitlementChecked=false;state.entitled=false;
      message('save-status',error?.message||'Не удалось загрузить настройки.');
      refreshSelected();paintStore();
    }
  }
  function initialize() {
    buildBadgeChoices();
    buildNicknameChoices();
    buildAudioChoices();
    refreshSelected();paintStore();
    $('save-style').addEventListener('click',()=>{void saveStyle();});
    document.addEventListener('visibilitychange',()=>{
      if (document.hidden) stopAudio();
      else if (state.client && !state.saving) void loadAccount();
    });
    window.addEventListener('pageshow',(event)=>{
      if (event.persisted && state.client && !state.saving) void loadAccount();
    });
    window.addEventListener('pagehide',stopAudio);
    if (!window.supabase?.createClient) {
      state.entitlementChecked=false;
      message('save-status','Не удалось загрузить библиотеку Supabase.');
      message('premium-access','Нет соединения');
      return;
    }
    try {
      // Deliberately use the same default Supabase auth storage key as app-main.js.
      state.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
      });
      state.client.auth.onAuthStateChange((event)=>{
        if (event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED')
          Promise.resolve().then(()=>loadAccount());
      });
      void loadAccount();
    } catch (error) {
      message('save-status',error?.message||'Не удалось подключиться к Supabase.');
    }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
