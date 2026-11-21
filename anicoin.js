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
let aniCoinWallet;
let aniCoinOwner;
let aniCoinStatus = '';
let aniCoinPlayer;
let aniCoinWatchQueue = Promise.resolve();

async function aniCoinRequest(action, options = {}, expectedOwner = currentUser?.authUserId) {
    const owner = currentUser?.authUserId;
    if (!owner || owner !== expectedOwner || !_supabase) return;
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
    return data;
}

function aniCoinBadge() {
    if (!aniCoinOwner || aniCoinOwner !== currentUser?.authUserId) return '';
    return aniCoinItems.find(item => item.id === aniCoinWallet?.equipped)?.name || '';
}

async function openAniCoinShop() {
    aniCoinStatus = '';
    navigate('shop');
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

async function aniCoinLoadStore(id) {
    if (!id || !_supabase || currentUser?.authUserId!==id || aniCoinShopLoading) return;
    aniCoinShopLoading=true;
    aniCoinShopFailedFor='';
    try {
        const {data,error}=await _supabase.rpc('komi_premium_store',{p_action:'read',p_item:null});
        if (error) throw error;
        if (!Array.isArray(data?.owned)) throw Error('Сервер вернул неверные данные магазина.');
        if (currentUser?.authUserId!==id) return;
        aniCoinShopWallet=data;aniCoinShopOwner=id;
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
function renderAniCoinShop(container) {
    if (!container) return;
    const id=currentUser?.authUserId;
    const wallet=id && id===aniCoinOwner ? aniCoinWallet : null;
    const store=id && id===aniCoinShopOwner ? aniCoinShopWallet : null;
    const items=window.KomiShopCatalog?.items || [];
    const categories=[['all','Все · '+items.length],['frame','Рамки'],['title','Титулы'],['banner','Обложки']];
    const selected=items.filter(item=>aniCoinShopCategory==='all'||item.type===aniCoinShopCategory);
    container.innerHTML=`
        <section id="shop" class="anicoin-shop" aria-labelledby="anicoin-title">
            <p class="komi-spotlight-eyebrow">Komi Anime / коллекция</p>
            <h1 id="anicoin-title">Магазин AniCoin</h1>
            <p>Укрась профиль за заработанные AniCoin. В магазине есть рамки аватара, титулы и обложки. Покупка остаётся в коллекции навсегда, надеть или снять предмет можно в любой момент.</p>
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
            <div class="komi-shop-tabs" role="group" aria-label="Категории AniCoin">
              ${categories.map(([key,label])=>`<button type="button" data-shop-category="${key}" aria-pressed="${key===aniCoinShopCategory}">${label}</button>`).join('')}
            </div>
            <div class="komi-coin-grid">
              ${selected.map(product=>{
                const owned=Boolean(store?.owned?.includes(product.id));
                const equipped=store?.[product.type+'_id']===product.id;
                const affordable=Number(store?.balance)>=product.cost;
                const action=equipped?'unequip':owned?'equip':'buy';
                const caption=equipped?'Надето ✓':owned?'В коллекции':product.cost+' AniCoin';
                const symbol=product.type==='frame'
                  ? `<div class="komi-coin-frame komi-store-${product.frameClass}">K</div>`
                  :product.type==='banner'
                    ?`<div class="store-banner-swatch ${product.bannerClass}">KOMI</div>`
                    :`<span class="komi-coin-title">${product.title}</span>`;
                return `<article class="komi-coin-card ${equipped?'is-equipped':''}">
                    <div class="komi-coin-sample">${symbol}</div>
                    <h3>${product.label}</h3><p>${caption}</p>
                    <div class="komi-coin-actions"><button type="button" data-shop-item-action="${product.id}" data-shop-operation="${action}"
                      ${!id||!store||aniCoinShopBusy||(!owned&&!affordable)?'disabled':''}>
                      ${equipped?'Снять':owned?'Надеть':affordable?'Купить · '+product.cost+' ◈':'Недостаточно AniCoin'}</button></div>
                  </article>`;
              }).join('')}
            </div>
            <p role="status" aria-live="polite">${escapeFriendHtml(aniCoinShopStatus)}</p>
            ${id && aniCoinShopFailedFor===id ? '<button type="button" class="btn-secondary" data-shop-retry>Повторить загрузку товаров</button>' : ''}
            ${id && !store && aniCoinShopLoading ? '<p>Загружаем покупки и коллекцию…</p>' : ''}
        </section>`;
    if (id && !store && !aniCoinShopLoading && aniCoinShopFailedFor!==id)
        void aniCoinLoadStore(id);
}
document.addEventListener('click',async event=>{
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
    if(!button||button.disabled||aniCoinShopBusy||currentView!=='shop'||!_supabase)return;
    const id=currentUser?.authUserId;
    const product=window.KomiShopCatalog?.find(button.dataset.shopItemAction);
    const operation=button.dataset.shopOperation;
    if(!id||!product||!['buy','equip','unequip'].includes(operation)||aniCoinShopOwner!==id)return;
    if(operation==='buy'&&!window.confirm('Купить «'+product.label+'» за '+product.cost+' AniCoin?'))return;
    aniCoinShopBusy=true;
    aniCoinShopStatus=operation==='buy'?'Подтверждаем покупку…':'Обновляем оформление…';
    renderAniCoinShop(document.getElementById('mainContainer'));
    try {
        const auth=await _supabase.auth.getUser();
        if(auth.error||auth.data?.user?.id!==id)throw Error('Войди в аккаунт повторно.');
        const {data,error}=await _supabase.rpc('komi_premium_store',{p_action:operation,p_item:product.id});
        if(error)throw error;
        if(currentUser?.authUserId!==id)return;
        if(!data||!Array.isArray(data.owned))throw Error('Неожиданный ответ сервера.');
        aniCoinShopWallet=data;aniCoinShopOwner=id;
        aniCoinShopStatus=operation==='buy'?'Куплено! Теперь можно надеть.':operation==='equip'?'Предмет надет.':'Предмет снят.';
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
}
function aniCoinStartEmbed() {
    const iframe = document.querySelector('#watchModal.active #watchModalContent .player-box iframe');
    if (!iframe || !currentUser?.authUserId) {
        aniCoinStatus = 'Войдите в аккаунт, чтобы учитывать время просмотра.';
        return;
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
}

// Initial shop deep-link: subsequent hash changes use the central vanilla-JS router.
if (location.hash === '#shop') openAniCoinShop();


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
    description.textContent = '1 AniCoin за 20 минут активного времени в открытом плеере. Внешний плеер не передаёт данные о паузах — останови учёт, если не смотришь.';
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
        if (begin) {
            aniCoinStartEmbed();
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
