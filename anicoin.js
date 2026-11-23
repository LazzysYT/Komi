const aniCoinItems = [
    { id: 'viewer', name: 'Зритель', cost: 1 },
    { id: 'explorer', name: 'Исследователь', cost: 3 },
    { id: 'collector', name: 'Коллекционер', cost: 5 }
];
let aniCoinShopWallet=null;
let aniCoinShopOwner='';
let aniCoinShopLoading=false;
let aniCoinShopBusy=false;
let aniCoinShopCategory='all';
let aniCoinShopStatus='';
let aniCoinShopFailedFor='';
let aniCoinShopAvatar='';
let aniCoinShopRegularAvatar='';
let aniCoinShopDisplayName='Пользователь Komi';
let aniCoinWallet;
let aniCoinOwner;
let aniCoinStatus = '';
let aniCoinPlayer;
let aniCoinWatchQueue = Promise.resolve();

async function aniCoinRequest(action, options = {}, expectedOwner = currentUser?.authUserId) {
    const owner = currentUser?.authUserId;
    if (!owner || owner !== expectedOwner || !_supabase) return;
    const previousBalance = aniCoinOwner === owner && Number.isSafeInteger(Number(aniCoinWallet?.balance))
        ? Number(aniCoinWallet.balance) : null;
    const { data, error } = await _supabase.rpc('komi_anicoin', { p_action: action, ...options });
    if (error) throw error;
    if (currentUser?.authUserId !== owner) return;
    aniCoinOwner = owner;
    aniCoinWallet = data;
    const headerCoinValue = document.getElementById('komiHeaderAniCoinValue');
    if (headerCoinValue) {
        const balance = Number(data && data.balance);
        headerCoinValue.textContent = Number.isSafeInteger(balance) && balance >= 0
            ? balance.toLocaleString('ru-RU') : '—';
        window.komiHeaderAniCoinOwner = owner;
    }
    if (currentView === 'shop') renderAniCoinShop(document.getElementById('mainContainer'));
    for (const badge of document.querySelectorAll('[data-anicoin-badge]')) {
        badge.textContent = aniCoinBadge();
        badge.hidden = !badge.textContent;
    }
    if (window.KomiProfileUI?.syncWallet) window.KomiProfileUI.syncWallet();
    if (action === 'watch') {
        const balance = Number(data?.balance);
        const earned = previousBalance === null || !Number.isSafeInteger(balance)
            ? 0 : Math.max(0, balance - previousBalance);
        const status = document.getElementById('komi-embed-coin-status');
        if (status && aniCoinEmbedSession?.owner === owner) {
            const seconds = Math.max(0, Math.min(1199, Number(data?.seconds) || 0));
            status.textContent = 'Учёт активного времени · ' +
                Math.floor(seconds / 60) + ' мин ' + seconds % 60 +
                ' сек / 20 мин · Баланс: ' + balance.toLocaleString('ru-RU') + ' AniCoin';
        }
        if (earned > 0 && typeof komiStatusFeedback === 'function')
            komiStatusFeedback('+' + earned + ' AniCoin за просмотр!');
    }
    return data;
}

function aniCoinBadge() {
    if (!aniCoinOwner || aniCoinOwner !== currentUser?.authUserId) return '';
    return aniCoinItems.find(item => item.id === aniCoinWallet?.equipped)?.name || '';
}

async function openAniCoinShop(fromRoute = false) {
    aniCoinStatus = '';
    if (!fromRoute) navigate('shop');
    if (!currentUser?.authUserId) return;
    let timeout;
    try {
        await Promise.race([
            aniCoinRequest('read'),
            new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('Request timed out')), 12000);
            })
        ]);
    } catch {
        aniCoinStatus = navigator.onLine
            ? 'Не удалось загрузить кошелёк. Попробуйте ещё раз.'
            : 'Нет соединения с Интернетом. Повторите после подключения.';
        if (currentView === 'shop') renderAniCoinShop(document.getElementById('mainContainer'));
    } finally {
        clearTimeout(timeout);
    }
}

// Match the main profile avatar: active Premium GIF takes precedence over the
// regular Supabase profile photo. Never reuse an avatar from a previous account.
function aniCoinCurrentProfileAvatar(id,base='') {
    const regular=typeof base==='string'&&/^https:\/\//i.test(base)?base:'';
    if(!id||currentUser?.authUserId!==id)return '';
    const premium=window.KomiPremium;
    if(!premium?.isActiveId?.(id))return regular;
    const path=premium.getMediaForId?.(id)?.avatar_path;
    if(typeof path!=='string'||!path||!_supabase?.storage)return regular;
    try{
        const url=_supabase.storage.from('avatars').getPublicUrl(path).data?.publicUrl||'';
        const parsed=new URL(url);
        return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?parsed.href:regular;
    }catch{return regular;}
}
window.addEventListener('komi:premium-refreshed',()=>{
    const id=currentUser?.authUserId;
    if(!id||id!==aniCoinShopOwner||currentView!=='shop')return;
    const preferred=aniCoinCurrentProfileAvatar(id,aniCoinShopRegularAvatar);
    if(preferred===aniCoinShopAvatar)return;
    aniCoinShopAvatar=preferred;
    renderAniCoinShop(document.getElementById('mainContainer'));
});

async function aniCoinLoadStore(id) {
    if (!id || !_supabase || currentUser?.authUserId!==id || aniCoinShopLoading) return;
    aniCoinShopLoading=true;
    aniCoinShopFailedFor='';
    aniCoinShopAvatar='';aniCoinShopRegularAvatar='';aniCoinShopDisplayName='Пользователь Komi';
    try {
        const {data,error}=await _supabase.rpc('komi_premium_store',{p_action:'read',p_item:null});
        if (error) throw error;
        if (!Array.isArray(data?.owned)) throw Error('Сервер вернул неверные данные магазина.');
        if (currentUser?.authUserId!==id) return;
        aniCoinShopWallet=data;aniCoinShopOwner=id;
        const profile=await _supabase.from('komi_profiles').select('username,display_name,avatar_url').eq('user_id',id).maybeSingle();
        if(currentUser?.authUserId===id && !profile.error && profile.data){
            const url=profile.data.avatar_url;
            aniCoinShopRegularAvatar=typeof url==='string' && /^https:\/\//i.test(url) ? url : '';
            aniCoinShopDisplayName=String(profile.data.display_name||profile.data.username||'Пользователь Komi').slice(0,50);
        }
        // Premium profile media may load after the wallet; read its verified
        // public avatar before painting the fitting room to avoid stale GIFs.
        try{await window.KomiPremium?.refresh?.(false);}catch{}
        if(currentUser?.authUserId!==id)return;
        aniCoinShopAvatar=aniCoinCurrentProfileAvatar(id,aniCoinShopRegularAvatar);
    } catch(error) {
        if (currentUser?.authUserId===id) {
            aniCoinShopStatus=error?.message||'Не удалось загрузить магазин.';
            aniCoinShopFailedFor=id;
        }
    } finally {
        aniCoinShopLoading=false;
        if (currentView==='shop' && currentUser?.authUserId===id)
            renderAniCoinShop(document.getElementById('mainContainer'));
    }
}
window.komiShopReloadStore=async function(){
    const owner=currentUser?.authUserId;
    if(!owner||!_supabase)return;
    try{
        const {data,error}=await _supabase.rpc('komi_premium_store',{p_action:'read',p_item:null});
        if(error)throw error;
        if(currentUser?.authUserId!==owner)return;
        aniCoinShopWallet=data;aniCoinShopOwner=owner;
        if(currentView==='shop')renderAniCoinShop(document.getElementById('mainContainer'));
        await aniCoinRequest('read',{},owner);
    }catch(error){
        aniCoinShopStatus=error?.message||'Не удалось обновить баланс.';
        if(currentView==='shop')renderAniCoinShop(document.getElementById('mainContainer'));
    }
};
// The fitting-room checkout uses a single database transaction; legacy card handlers remain intact.
window.komiShopCheckoutCart=async function(itemIds,expectedOwner){
    const id=currentUser?.authUserId;
    if(!id||id!==expectedOwner||!_supabase)throw Error('Войди в Komi, чтобы покупать.');
    if(!Array.isArray(itemIds)||!itemIds.length||itemIds.length>12||aniCoinShopBusy)
        throw Error('Выбери от 1 до 12 предметов.');
    const unique=new Set(itemIds);
    if(unique.size!==itemIds.length||!itemIds.every(item=>window.KomiShopCatalog?.find(item)))
        throw Error('Некорректный состав корзины.');
    aniCoinShopBusy=true;
    try{
        const {data:authentication,error:authenticationError}=await _supabase.auth.getUser();
        if(authenticationError||authentication?.user?.id!==id)throw Error('Повтори вход в аккаунт.');
        const {data,error}=await _supabase.rpc('komi_shop_cart_buy_equip',{p_items:itemIds});
        if(error)throw error;
        if(currentUser?.authUserId!==id)return null;
        if(!data||!Array.isArray(data.owned)||!Number.isSafeInteger(Number(data.balance)))
            throw Error('Некорректный ответ сервера покупок.');
        aniCoinShopOwner=id;aniCoinShopWallet=data;
        if(typeof window.KomiPremiumStore?.refresh==='function')void window.KomiPremiumStore.refresh();
        void aniCoinRequest('read',{},id).catch(()=>{});
        return data;
    }finally{aniCoinShopBusy=false;}
};

function renderAniCoinShop(container) {
    if (!container) return;
    const id=currentUser?.authUserId;
    const wallet=id && id===aniCoinOwner ? aniCoinWallet : null;
    const store=id && id===aniCoinShopOwner ? aniCoinShopWallet : null;
    const items=window.KomiShopCatalog?.items || [];
    if(window.KomiShopV3?.render){
        window.KomiShopV3.render(container,{
            owner:id||'',wallet,store,
            avatar:id===aniCoinShopOwner?aniCoinShopAvatar:'',
            displayName:id===aniCoinShopOwner?aniCoinShopDisplayName:'Пользователь Komi',
            shopStatus:aniCoinShopStatus||aniCoinStatus||'',
            loading:aniCoinShopLoading,busy:aniCoinShopBusy,
            failedFor:aniCoinShopFailedFor===id&&id
        });
        if(window.KomiShopSocial?.mount)
            window.KomiShopSocial.mount(container,{userId:id,store,wallet,products:items});
        if(id&&!store&&!aniCoinShopLoading&&aniCoinShopFailedFor!==id)
            void aniCoinLoadStore(id);
        return;
    }
    const categories=[['all','Все · '+items.length],['frame','Рамки'],['title','Титулы'],['banner','Обложки'],['overlay','Эффекты профиля'],['showcase','Топ-3'],['card','Карточки'],['icon','Иконки'],['shape','Формы'],['plate','Комментарии'],['mascot','Маскоты'],['xp','XP-полоски'],['name','Ники'],['reaction','Watch Party'],['owned','Мои покупки']];
    const selected=items.filter(item=>aniCoinShopCategory==='all'||(aniCoinShopCategory==='owned'&&store?.owned?.includes(item.id))||item.type===aniCoinShopCategory);
    const name=typeof escapeFriendHtml==='function'?escapeFriendHtml(aniCoinShopDisplayName):'Пользователь Komi';
    const symbolFor=product=>{
        if(product.type==='frame')return '<span class="komi-coin-frame komi-store-'+product.frameClass+'"><img data-komi-shop-avatar alt="" hidden><span aria-hidden="true">K</span></span>';
        if(product.type==='banner')return '<div class="store-banner-swatch '+product.bannerClass+'">KOMI</div>';
        if(product.type==='title')return '<span class="komi-coin-title">'+product.title+'</span>';
        if(product.type==='overlay')return '<div class="komi-preview-cover"><div class="komi-shop-overlay-layer '+product.cosmeticClass+'"></div></div>';
        if(product.type==='showcase')return '<div class="komi-shop-showcase-demo komi-store-'+product.cosmeticClass+'"><i></i><i></i><i></i></div>';
        if(product.type==='card')return '<div class="komi-shop-mini-swatch komi-store-'+product.cosmeticClass+'">KOMI</div>';
        if(product.type==='icon')return '<span class="komi-shop-icon-swatch komi-store-'+product.cosmeticClass+'">'+product.symbol+'</span> <strong>'+name+'</strong>';
        if(product.type==='reaction')return '<div class="komi-shop-reaction-swatch">'+product.reactions.map(r=>'<span>'+r.emoji+'</span>').join('')+'</div>';
        if(['shape','plate','mascot','xp','name'].includes(product.type)){
          const sampleType={shape:'avatar-shape',plate:'plate-swatch',mascot:'mascot-swatch',xp:'xp-swatch',name:'name-swatch'}[product.type];
          const inner=product.type==='shape'?'<img data-komi-shop-avatar alt="" hidden><span aria-hidden="true">K</span>':
            product.type==='mascot'?'<i class="komi-profile-mascot komi-store-'+product.cosmeticClass+'"></i>':
            product.type==='xp'?'':product.type==='name'?name:product.type==='plate'?'Комментарий':'K';
          return '<span class="komi-shop-visual-sample komi-shop-'+sampleType+' komi-store-'+product.cosmeticClass+'">'+inner+'</span>';
        }
        return 'K';
    };
    const sets=window.KomiShopCatalog?.sets||[];
    const names={common:'Обычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный'};
    container.innerHTML=`
        <section id="shop" class="anicoin-shop" aria-labelledby="anicoin-title">
            <p class="komi-spotlight-eyebrow">Komi Anime / коллекция</p>
            <h1 id="anicoin-title">Магазин AniCoin</h1>
            <p>85 товаров за AniCoin: новые рамки, формы аватара, стили комментариев, маскоты, XP-полоски, градиенты ника и реакции Watch Party. Наборы содержат заранее известные реакции, без случайных наград. Все цены фиксированы. Покупка остаётся в коллекции; примерка бесплатная.</p>
            <article class="anicoin-item" aria-labelledby="komi-premium-shop-title">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">Ежемесячная подписка</p>
                <h2 id="komi-premium-shop-title" style="margin:0 0 8px;">✧ Komi Premium</h2>
                <p>Анимированный профиль, разовые +2000 XP и +500 AniCoin, публичный значок Premium. Стоимость будет показана в USD. Бонусы начисляются после подтверждённой активации аккаунта.</p>
                <a class="btn-secondary" href="https://app.lava.top/products/b37a75ab-e500-4431-b61e-5c2a7e3edd8a/f1b11818-74d5-4e94-a013-15d89a545cdd?currency=USD" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;margin-top:16px;padding:14px 22px;border-radius:14px;background:#f5f5f5;color:#090909;font-weight:750;">Оформить Premium ↗</a>
                <div><a href="/premium.html" style="display:inline-block;margin-top:12px;font-size:13px;text-decoration:underline;text-underline-offset:3px;">Условия подписки</a></div>
            </article>
            ${!id ? '<button type="button" class="btn-glow" data-komi-onclick="openAuthModal(\'login\')">Войти в Komi</button>' : ''}
            ${id && !wallet && !aniCoinStatus ? '<p role="status" aria-live="polite">Загружаем кошелёк…</p>' : ''}
            ${wallet ? `<div class="anicoin-wallet">
                <div><span>Баланс</span><strong>${Number(wallet.balance).toLocaleString('ru-RU')} AniCoin</strong></div>
                <div><label for="anicoin-progress">До следующего коина · ${Math.floor(wallet.seconds / 60)} мин ${wallet.seconds % 60} сек из 20 мин</label>
                    <progress id="anicoin-progress" value="${wallet.seconds}" max="1200"></progress></div>
            </div>` : ''}
            <p role="status">${escapeFriendHtml(aniCoinStatus)}</p>
            ${id && !wallet && aniCoinStatus ? '<button type="button" class="btn-secondary" data-komi-onclick="openAniCoinShop()">Повторить</button>' : ''}
            <section class="komi-shop-sets-guide" aria-label="Тематические коллекции">
                <h2>Тематические сеты</h2>
                <p>Надень одновременно 3 указанных предмета и получи бесплатный визуальный эффект для шапки профиля. Никаких случайных наград.</p>
                <div class="komi-shop-set-list">
                ${sets.map(set=>{
                    const progress=set.items.filter(i=>store?.[i.split('_',1)[0]+'_id']===i).length;
                    const requirements=set.items.map(i=>window.KomiShopCatalog.find(i)?.label||i).join(' + ');
                    return `<div class="komi-shop-set-card"><strong>${set.label}</strong><small>${requirements}</small><span>${progress} / 3 надето ${progress===3?'· Сет активен ✦':''}</span></div>`;
                }).join('')}
                </div>
            </section>
            <div class="komi-shop-tabs" role="group" aria-label="Категории AniCoin">
              ${categories.map(([key,label])=>`<button type="button" data-shop-category="${key}" aria-pressed="${key===aniCoinShopCategory}">${label}</button>`).join('')}
            </div>
            <div class="komi-coin-grid">
              ${selected.map(product=>{
                const owned=Boolean(store?.owned?.includes(product.id));
                const equipped=store?.[product.type+'_id']===product.id;
                const affordable=Number(store?.balance)>=product.cost;
                const action=product.type==='reaction'?(owned?'owned':'buy'):equipped?'unequip':owned?'equip':'buy_equip';
                const caption=equipped?'Надето ✓':owned?'В коллекции':product.cost+' AniCoin';
                const symbol=symbolFor(product);
                return `<article class="komi-coin-card ${equipped?'is-equipped':''}" data-rarity="${product.rarity||'common'}">
                    <span class="komi-shop-rarity">${names[product.rarity]||names.common}</span>
                    <div class="komi-coin-sample">${symbol}</div>
                    <h3>${product.label}</h3><p>${caption}</p>
                    <div class="komi-coin-actions"><button type="button" data-shop-item-action="${product.id}" data-shop-operation="${action}"
                      ${id&&(!store||aniCoinShopBusy||(owned&&product.type==='reaction')||(!owned&&!affordable))?'disabled':''}>
                      ${!id?'Войти, чтобы купить':product.type==='reaction'&&owned?'Набор куплен':equipped?'Снять':owned?'Надеть':affordable?(product.type==='reaction'?'Купить набор · ':'Купить и надеть · ')+product.cost+' ◈':'Недостаточно AniCoin'}</button>
                      <button type="button" class="komi-shop-preview-btn" data-shop-preview="${product.id}" aria-label="Примерить ${product.label}">◉</button></div>
                  </article>`;
              }).join('')}
            </div>
            <p role="status" aria-live="polite">${escapeFriendHtml(aniCoinShopStatus)}</p>
            <dialog class="komi-shop-dialog" id="komiShopPreviewDialog" aria-labelledby="komiShopPreviewTitle">
                <div class="komi-shop-dialog-inner">
                    <div class="komi-shop-dialog-header"><h2 id="komiShopPreviewTitle"></h2>
                       <button type="button" class="komi-shop-dialog-close" data-shop-preview-close aria-label="Закрыть примерку">✕</button></div>
                    <div class="komi-shop-modal-scene" id="komiShopPreviewScene"></div>
                    <p id="komiShopPreviewDescription"></p>
                    <button type="button" data-shop-modal-buy>Загрузка…</button>
                </div>
            </dialog>
            ${id && aniCoinShopFailedFor===id ? '<button type="button" class="btn-secondary" data-shop-retry>Повторить загрузку товаров</button>' : ''}
            ${id && !store && aniCoinShopLoading ? '<p>Загружаем покупки и коллекцию…</p>' : ''}
        </section>`;
    for(const img of container.querySelectorAll('[data-komi-shop-avatar]')){
        if(aniCoinShopAvatar && id===aniCoinShopOwner){
            img.src=aniCoinShopAvatar;img.hidden=false;
            img.addEventListener('error',()=>{img.hidden=true;}, {once:true});
        }
    }
    if(window.KomiShopSocial?.mount)window.KomiShopSocial.mount(container,{userId:id,store,wallet,products:items});
    if(id && !store && !aniCoinShopLoading && aniCoinShopFailedFor!==id)
        void aniCoinLoadStore(id);
}
document.addEventListener('click',async event=>{
    if(event.target.closest?.('[data-shop-preview-close]')){
        document.getElementById('komiShopPreviewDialog')?.close();
        return;
    }
    const previewButton=event.target.closest?.('[data-shop-preview]');
    if(previewButton && currentView==='shop'){
        const product=window.KomiShopCatalog?.find(previewButton.dataset.shopPreview);
        const dialog=document.getElementById('komiShopPreviewDialog');
        if(!product||!dialog)return;
        dialog.querySelector('#komiShopPreviewTitle').textContent=product.label;
        const scene=dialog.querySelector('#komiShopPreviewScene');
        scene.replaceChildren();
        const card=previewButton.closest('.komi-coin-card');
        const sample=card?.querySelector('.komi-coin-sample');
        if(sample)scene.append(sample.cloneNode(true));
        const owned=aniCoinShopWallet?.owned?.includes(product.id)&&aniCoinShopOwner===currentUser?.authUserId;
        const equipped=aniCoinShopWallet?.[product.type+'_id']===product.id && owned;
        const action=product.type==='reaction'?(owned?'owned':'buy'):equipped?'unequip':owned?'equip':'buy_equip';
        const button=dialog.querySelector('[data-shop-modal-buy]');
        button.dataset.shopItemAction=product.id;
        button.dataset.shopOperation=action;
        button.textContent=!currentUser?.authUserId?'Войти, чтобы купить':product.type==='reaction'&&owned?'Набор в коллекции':equipped?'Снять':owned?'Надеть':(product.type==='reaction'?'Купить пакет · ':'Купить и сразу надеть · ')+product.cost+' AniCoin';
        button.disabled=!!currentUser?.authUserId && (!aniCoinShopWallet||aniCoinShopBusy||(product.type==='reaction'&&owned)||(!owned&&Number(aniCoinShopWallet.balance)<product.cost));
        dialog.querySelector('#komiShopPreviewDescription').textContent=owned
          ? 'Предмет в твоей коллекции. Его можно надевать и снимать без повторной оплаты.'
          : 'Бесплатная примерка. Цена: '+product.cost+' AniCoin. Покупка подтверждается сервером.';
        if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
        for(const img of scene.querySelectorAll('[data-komi-shop-avatar]')){
          if(aniCoinShopAvatar && currentUser?.authUserId===aniCoinShopOwner){img.src=aniCoinShopAvatar;img.hidden=false;}
        }
        return;
    }
    const loginButton=event.target.closest?.('[data-shop-modal-buy]');
    if(loginButton && !currentUser?.authUserId && currentView==='shop'){
        document.getElementById('komiShopPreviewDialog')?.close();
        if(typeof openAuthModal==='function')openAuthModal('login');
        return;
    }
    const filter=event.target.closest?.('[data-shop-category]');
    if(filter && currentView==='shop'){
        aniCoinShopCategory=filter.dataset.shopCategory;
        renderAniCoinShop(document.getElementById('mainContainer'));
        return;
    }
    if(event.target.closest?.('[data-shop-retry]')&&currentView==='shop'){
        aniCoinShopStatus='';aniCoinShopFailedFor='';
        void aniCoinLoadStore(currentUser?.authUserId);
        return;
    }
    const button=event.target.closest?.('[data-shop-item-action]');
    if(!button||button.disabled||aniCoinShopBusy||currentView!=='shop')return;
    if(!currentUser?.authUserId){
        if(typeof openAuthModal==='function')openAuthModal('login');
        return;
    }
    if(!_supabase)return;
    const id=currentUser?.authUserId;
    const product=window.KomiShopCatalog?.find(button.dataset.shopItemAction);
    const operation=button.dataset.shopOperation;
    if(!id||!product||!['buy','buy_equip','equip','unequip'].includes(operation)||aniCoinShopOwner!==id)return;
    if(['buy','buy_equip'].includes(operation) && !window.confirm('Приобрести «'+product.label+'» за '+product.cost+' AniCoin?'))return;
    document.getElementById('komiShopPreviewDialog')?.close();
    aniCoinShopBusy=true;
    aniCoinShopStatus=operation==='buy_equip'?'Покупаем и надеваем…':operation==='buy'?'Покупаем набор…':'Обновляем оформление…';
    renderAniCoinShop(document.getElementById('mainContainer'));
    try {
        const auth=await _supabase.auth.getUser();
        if(auth.error||auth.data?.user?.id!==id)throw Error('Войди в аккаунт повторно.');
        const {data,error}=await _supabase.rpc('komi_premium_store',{p_action:operation,p_item:product.id});
        if(error)throw error;
        if(currentUser?.authUserId!==id)return;
        if(!data||!Array.isArray(data.owned))throw Error('Неожиданный ответ сервера.');
        aniCoinShopWallet=data;aniCoinShopOwner=id;
        aniCoinShopStatus=operation==='buy_equip'?'Куплено и надето!':operation==='buy'?'Набор куплен! Реакции доступны в Watch Party.':operation==='equip'?'Предмет надет.':'Предмет снят.';
        if (typeof window.KomiPremiumStore?.refresh==='function')void window.KomiPremiumStore.refresh();
        void aniCoinRequest('read',{},id).catch(()=>{});
    }catch(error){
        if(currentUser?.authUserId===id)aniCoinShopStatus=error?.message||'Не удалось выполнить операцию.';
    }finally{
        aniCoinShopBusy=false;
        if(currentView==='shop')renderAniCoinShop(document.getElementById('mainContainer'));
    }
});

// Count real playback time only for the site's HTML5 player. Third-party iframes
// do not expose trustworthy playback events and cannot earn rewards.
function aniCoinStartTracking(video) {
    const owner = currentUser?.authUserId;
    if (!owner || !video || video.paused || video.seeking || video.ended || document.hidden) return;
    if (aniCoinPlayer?.video === video && aniCoinPlayer.owner === owner) return;
    aniCoinPlayer = {
        video, owner, session: crypto.randomUUID(), last: performance.now(),
        position: video.currentTime, pulse: performance.now(), seconds: 0,
        ready: false, sending: false
    };
    const sample = aniCoinPlayer;
    aniCoinWatchQueue = aniCoinWatchQueue.catch(() => {}).then(async () => {
        await aniCoinRequest('watch', { p_session: sample.session, p_seconds: 0 }, sample.owner);
        sample.ready = true;
    }).catch(() => {
        if (aniCoinPlayer === sample) aniCoinStatus = 'Не удалось подключить начисление AniCoin.';
    });
}

document.addEventListener('playing', event => {
    if (event.target instanceof HTMLVideoElement &&
        ['animeVideoPlayer', 'partyVideoElement'].includes(event.target.id)) {
        aniCoinStartTracking(event.target);
    }
}, true);

document.addEventListener('timeupdate', event => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) ||
        !['animeVideoPlayer', 'partyVideoElement'].includes(video.id)) return;
    if (video.paused || video.seeking || video.ended || document.hidden || !currentUser?.authUserId) return;
    aniCoinStartTracking(video);
    const sample = aniCoinPlayer;
    if (!sample || sample.video !== video) return;
    const now = performance.now();
    const elapsed = (now - sample.last) / 1000;
    const movement = video.currentTime - sample.position;
    // A seek, speed exploit or inactive tab never counts as playback.
    if (elapsed > 0 && elapsed <= 3 && movement > 0 &&
        video.playbackRate > 0 && video.playbackRate <= 1.05 &&
        movement <= elapsed * video.playbackRate + 0.35) {
        sample.seconds += Math.min(elapsed, movement / video.playbackRate);
    }
    sample.last = now;
    sample.position = video.currentTime;
    if (!sample.ready || sample.sending || now - sample.pulse < 12000) return;
    const seconds = Math.min(20, Math.floor(sample.seconds));
    if (!seconds) return;
    sample.sending = true;
    sample.pulse = now;
    aniCoinWatchQueue = aniCoinWatchQueue.catch(() => {}).then(async () => {
        await aniCoinRequest('watch', { p_session: sample.session, p_seconds: seconds }, sample.owner);
        sample.seconds = Math.max(0, sample.seconds - seconds);
    }).catch(() => {
        aniCoinStatus = 'Ошибка начисления. Проверяем соединение…';
    }).finally(() => { sample.sending = false; });
}, true);

for (const event of ['seeking', 'seeked', 'pause', 'ended', 'emptied', 'ratechange']) {
    document.addEventListener(event, change => {
        if (aniCoinPlayer?.video === change.target) {
            aniCoinPlayer.last = performance.now();
            aniCoinPlayer.position = change.target.currentTime;
        }
    }, true);
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden && aniCoinPlayer) {
        aniCoinPlayer.last = performance.now();
        aniCoinPlayer.position = aniCoinPlayer.video.currentTime;
    }
});


/* Embedded providers cannot expose reliable playback events across origins.
   Count only explicitly started, foreground watch sessions, not verified video time. */
let aniCoinEmbedSession = null;
let aniCoinEmbedTimer = null;
function aniCoinStopEmbed() {
    aniCoinEmbedSession = null;
    if (aniCoinEmbedTimer) clearInterval(aniCoinEmbedTimer);
    aniCoinEmbedTimer = null;
    const controls = document.querySelector('[data-komi-embed-coins]');
    if (controls) {
        const start = controls.querySelector('[data-komi-coin-embed-start]');
        const stop = controls.querySelector('[data-komi-coin-embed-stop]');
        if (start) start.hidden = false;
        if (stop) stop.hidden = true;
    }
}
function aniCoinStartEmbed() {
    const iframe = document.querySelector('#watchModal.active #watchModalContent .player-box iframe');
    if (!iframe || !currentUser?.authUserId) {
        aniCoinStatus = 'Войдите в аккаунт и откройте серию для учёта.';
        return false;
    }
    aniCoinStopEmbed();
    const sample = {
        iframe, owner: currentUser.authUserId, session: crypto.randomUUID(),
        last: performance.now(), seconds: 0, pulse: performance.now(),
        ready: false, sending: false
    };
    aniCoinEmbedSession = sample;
    const status = document.getElementById('komi-embed-coin-status');
    if (status) status.textContent = 'Подключаем учёт времени…';
    aniCoinWatchQueue = aniCoinWatchQueue.catch(() => {}).then(async () => {
        await aniCoinRequest('watch', {p_session: sample.session, p_seconds: 0}, sample.owner);
        sample.ready = true;
        if (status?.isConnected) status.textContent = 'Учёт активного времени включён';
    }).catch(() => {
        if (status?.isConnected) status.textContent = 'Ошибка подключения. Повторите попытку.';
        aniCoinStopEmbed();
    });
    aniCoinEmbedTimer = setInterval(() => {
        if (aniCoinEmbedSession !== sample) return;
        const now = performance.now();
        const active = !document.hidden &&
            document.querySelector('#watchModal.active #watchModalContent .player-box iframe') === sample.iframe &&
            currentUser?.authUserId === sample.owner;
        const elapsed = (now - sample.last) / 1000;
        sample.last = now;
        if (!active) return;
        if (elapsed > 0 && elapsed <= 2) sample.seconds += elapsed;
        if (!sample.ready || sample.sending || now - sample.pulse < 12000) return;
        const seconds = Math.min(20, Math.floor(sample.seconds));
        if (!seconds) return;
        sample.sending = true;
        sample.pulse = now;
        aniCoinWatchQueue = aniCoinWatchQueue.catch(() => {}).then(async () => {
            await aniCoinRequest('watch', {p_session: sample.session, p_seconds: seconds}, sample.owner);
            sample.seconds = Math.max(0, sample.seconds - seconds);
        }).catch(() => {
            if (status?.isConnected) status.textContent = 'Нет соединения — прогресс ожидает отправки';
        }).finally(() => {sample.sending = false;});
    }, 1000);
    return true;
}

// Initial shop deep-link: subsequent hash changes use the central vanilla-JS router.
if (typeof komiRouteView === 'function' && komiRouteView() === 'shop') openAniCoinShop(true);


/* External embeds cannot report their exact playback state across origins.
 * Explicit user opt-in counts only foreground time while the video iframe is visible.
 * Native HTML5 players continue to earn automatically from real playing/timeupdate events.
 */
function aniCoinMountEmbedControls() {
    const modal = document.getElementById('watchModal');
    if (!modal || !modal.classList.contains('active')) {
        if (aniCoinEmbedSession) aniCoinStopEmbed();
        return;
    }
    const box = modal.querySelector('#watchModalContent .player-box');
    const iframe = box?.querySelector('iframe');
    if (aniCoinEmbedSession && (aniCoinEmbedSession.iframe !== iframe ||
        aniCoinEmbedSession.owner !== currentUser?.authUserId)) aniCoinStopEmbed();
    if (!iframe || !currentUser?.authUserId) return;
    if (box.parentElement?.querySelector('[data-komi-embed-coins]')) return;
    const controls = document.createElement('div');
    controls.className = 'komi-embed-coin-controls';
    controls.setAttribute('data-komi-embed-coins', '');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '◈ Начать учёт AniCoin';
    button.setAttribute('data-komi-coin-embed-start', '');
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.textContent = 'Остановить';
    stop.hidden = true;
    stop.setAttribute('data-komi-coin-embed-stop', '');
    const description = document.createElement('p');
    description.id = 'komi-embed-coin-status';
    description.textContent = '1 AniCoin за каждые 20 минут. Во внешнем плеере нажмите «Начать учёт»: учитывается только время в открытой активной вкладке, а не события воспроизведения. При паузе нажмите «Остановить».';
    controls.append(button, stop, description);
    box.insertAdjacentElement('afterend', controls);
}
function aniCoinInitEmbedControls() {
    const modal = document.getElementById('watchModal');
    if (!modal) return;
    const refresh = () => aniCoinMountEmbedControls();
    const observer = new MutationObserver(refresh);
    observer.observe(modal, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
    aniCoinMountEmbedControls();
    document.addEventListener('click', event => {
        const begin = event.target.closest?.('[data-komi-coin-embed-start]');
        const end = event.target.closest?.('[data-komi-coin-embed-stop]');
        if (begin && aniCoinStartEmbed()) {
            begin.hidden = true;
            const stop = begin.parentElement.querySelector('[data-komi-coin-embed-stop]');
            if (stop) stop.hidden = false;
        }
        if (end) {
            aniCoinStopEmbed();
            end.hidden = true;
            const start = end.parentElement.querySelector('[data-komi-coin-embed-start]');
            if (start) start.hidden = false;
            const info = end.parentElement.querySelector('#komi-embed-coin-status');
            if (info) info.textContent = 'Учёт активного времени остановлен.';
        }
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aniCoinInitEmbedControls, {once:true});
} else {
    aniCoinInitEmbedControls();
}
