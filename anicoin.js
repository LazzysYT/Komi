const aniCoinItems = [
    { id: 'viewer', name: 'Зритель', cost: 1 },
    { id: 'explorer', name: 'Исследователь', cost: 3 },
    { id: 'collector', name: 'Коллекционер', cost: 5 }
];
let aniCoinWallet;
let aniCoinOwner;
let aniCoinBusy = false;
let aniCoinStatus = '';
let aniCoinPlayer;

async function aniCoinRequest(action, options = {}) {
    const owner = currentUser?.authUserId;
    if (!owner || !_supabase) return;
    const { data, error } = await _supabase.rpc('komi_anicoin', { p_action: action, ...options });
    if (error) throw error;
    if (currentUser?.authUserId !== owner) return;
    aniCoinOwner = owner;
    aniCoinWallet = data;
    if (currentView === 'shop') renderAniCoinShop(document.getElementById('mainContainer'));
    for (const badge of document.querySelectorAll('[data-anicoin-badge]')) {
        badge.textContent = aniCoinBadge();
        badge.hidden = !badge.textContent;
    }
    return data;
}

function aniCoinBadge() {
    if (!aniCoinOwner || aniCoinOwner !== currentUser?.authUserId) return '';
    return aniCoinItems.find(item => item.id === aniCoinWallet?.equipped)?.name || '';
}

async function openAniCoinShop() {
    navigate('shop');
    if (!currentUser?.authUserId) return;
    try {
        await aniCoinRequest('read');
    } catch {
        aniCoinStatus = 'Не удалось загрузить кошелёк. Попробуйте ещё раз.';
        if (currentView === 'shop') renderAniCoinShop(document.getElementById('mainContainer'));
    }
}

function renderAniCoinShop(container) {
    if (!container) return;
    const owner = currentUser?.authUserId;
    const wallet = owner && owner === aniCoinOwner ? aniCoinWallet : null;
    container.innerHTML = `
        <section class="anicoin-shop" aria-labelledby="anicoin-title">
            <p class="komi-spotlight-eyebrow">Komi Anime</p>
            <h1 id="anicoin-title">Магазин AniCoin</h1>
            <p>За каждые 20 минут воспроизведения во встроенном видеоплеере начисляется 1 AniCoin. Паузы, перемотка и внешние плееры не учитываются.</p>
            ${!owner ? '<button type="button" class="btn-glow" onclick="openAuthModal(\'login\')">Войти в Komi</button>' : ''}
            ${owner && !wallet && !aniCoinStatus ? '<p role="status">Загружаем кошелёк…</p>' : ''}
            ${wallet ? `<div class="anicoin-wallet">
                <div><span>Баланс</span><strong>${wallet.balance} AniCoin</strong></div>
                <div><label for="anicoin-progress">До следующего коина · ${Math.floor(wallet.seconds / 60)} мин ${wallet.seconds % 60} сек из 20 мин</label>
                    <progress id="anicoin-progress" value="${wallet.seconds}" max="1200"></progress></div>
            </div>` : ''}
            <p role="status">${escapeFriendHtml(aniCoinStatus)}</p>
            ${owner && !wallet && aniCoinStatus ? '<button type="button" class="btn-secondary" onclick="openAniCoinShop()">Повторить</button>' : ''}
            <h2>Значки профиля</h2>
            <div class="anicoin-items">${aniCoinItems.map(item => {
                const owned = wallet?.owned.includes(item.id);
                const equipped = wallet?.equipped === item.id;
                return `<article class="anicoin-item">
                    <span class="anicoin-symbol" aria-hidden="true">AC</span>
                    <h3>${item.name}</h3>
                    <p>${item.cost} AniCoin</p>
                    <button type="button" class="btn-glow" data-anicoin-item="${item.id}" data-anicoin-action="${owned ? 'equip' : 'buy'}"
                        ${!wallet || aniCoinBusy || equipped || (!owned && wallet.balance < item.cost) ? 'disabled' : ''}>
                        ${equipped ? 'Выбран' : owned ? 'Выбрать' : 'Купить'}
                    </button>
                </article>`;
            }).join('')}</div>
        </section>`;
}

document.addEventListener('click', async event => {
    const button = event.target.closest('[data-anicoin-item]');
    if (!button || aniCoinBusy) return;
    aniCoinBusy = true;
    aniCoinStatus = '';
    renderAniCoinShop(document.getElementById('mainContainer'));
    try {
        const wallet = await aniCoinRequest(button.dataset.anicoinAction, { p_item: button.dataset.anicoinItem });
        if (wallet) aniCoinStatus = 'Значок добавлен в профиль.';
    } catch (error) {
        aniCoinStatus = error.message || 'Операция не выполнена.';
    } finally {
        aniCoinBusy = false;
        if (currentView === 'shop') renderAniCoinShop(document.getElementById('mainContainer'));
    }
});

document.addEventListener('timeupdate', event => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement) || !['animeVideoPlayer', 'partyVideoElement'].includes(video.id)) return;
    const owner = currentUser?.authUserId;
    if (!owner || video.paused || video.seeking || video.ended || document.hidden) {
        if (aniCoinPlayer?.video === video) aniCoinPlayer = null;
        return;
    }
    const now = performance.now();
    if (aniCoinPlayer?.video !== video || aniCoinPlayer.owner !== owner) {
        aniCoinPlayer = { video, owner, session: crypto.randomUUID(), last: now, position: video.currentTime, pulse: now, seconds: 0 };
        aniCoinRequest('watch', { p_session: aniCoinPlayer.session }).catch(() => {});
        return;
    }
    const sample = aniCoinPlayer;
    const elapsed = (now - sample.last) / 1000;
    const movement = video.currentTime - sample.position;
    if (elapsed <= 2 && movement > 0 && movement <= elapsed * video.playbackRate + 0.3) {
        sample.seconds += Math.min(elapsed, movement / video.playbackRate);
    }
    sample.last = now;
    sample.position = video.currentTime;
    if (now - sample.pulse < 15000) return;
    sample.pulse = now;
    const seconds = Math.min(20, Math.floor(sample.seconds));
    sample.seconds -= seconds;
    aniCoinRequest('watch', { p_session: sample.session, p_seconds: seconds }).catch(() => {});
}, true);

for (const event of ['seeking', 'pause', 'ended', 'emptied']) {
    document.addEventListener(event, change => {
        if (aniCoinPlayer?.video === change.target) {
            aniCoinPlayer.last = performance.now();
            aniCoinPlayer.position = change.target.currentTime;
        }
    }, true);
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden && aniCoinPlayer) aniCoinPlayer.last = -Infinity;
});

window.addEventListener('hashchange', () => {
    if (location.hash === '#shop' && currentView !== 'shop') openAniCoinShop();
    else if (location.hash !== '#shop' && currentView === 'shop') navigate('home');
});
if (location.hash === '#shop') openAniCoinShop();
