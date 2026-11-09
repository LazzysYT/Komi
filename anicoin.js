const aniCoinItems = [
    { id: 'viewer', name: 'Зритель', cost: 1 },
    { id: 'explorer', name: 'Исследователь', cost: 3 },
    { id: 'collector', name: 'Коллекционер', cost: 5 }
];
let aniCoinWallet;
let aniCoinOwner;
let aniCoinStatus = '';
let aniCoinPlayer;
let aniCoinWatchQueue = Promise.resolve();

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
    aniCoinStatus = '';
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
            <div class="anicoin-item"><h2>Товаров пока нет</h2><p>Заработанные AniCoin видны в кошельке.</p></div>
        </section>`;
}

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
        await aniCoinRequest('watch', { p_session: sample.session, p_seconds: 0 });
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
        await aniCoinRequest('watch', { p_session: sample.session, p_seconds: seconds });
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

window.addEventListener('hashchange', () => {
    if (location.hash === '#shop' && currentView !== 'shop') openAniCoinShop();
    else if (location.hash !== '#shop' && currentView === 'shop') navigate('home');
});
if (location.hash === '#shop') openAniCoinShop();
