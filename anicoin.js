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

async function aniCoinRequest(action, options = {}, expectedOwner = currentUser?.authUserId) {
    const owner = currentUser?.authUserId;
    if (!owner || owner !== expectedOwner || !_supabase) return;
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

function renderAniCoinShop(container) {
    if (!container) return;
    const owner = currentUser?.authUserId;
    const wallet = owner && owner === aniCoinOwner ? aniCoinWallet : null;
    container.innerHTML = `
        <section id="shop" class="anicoin-shop" aria-labelledby="anicoin-title">
            <p class="komi-spotlight-eyebrow">Komi Anime</p>
            <h1 id="anicoin-title">Магазин AniCoin</h1>
            <p>За каждые 20 минут воспроизведения во встроенном видеоплеере начисляется 1 AniCoin. Паузы, перемотка и внешние плееры не учитываются.</p>
            ${!owner ? '<button type="button" class="btn-glow" data-komi-onclick="openAuthModal(\'login\')">Войти в Komi</button>' : ''}
            ${owner && !wallet && !aniCoinStatus ? '<p role="status" aria-live="polite">Загружаем кошелёк…</p>' : ''}
            ${wallet ? `<div class="anicoin-wallet">
                <div><span>Баланс</span><strong>${wallet.balance} AniCoin</strong></div>
                <div><label for="anicoin-progress">До следующего коина · ${Math.floor(wallet.seconds / 60)} мин ${wallet.seconds % 60} сек из 20 мин</label>
                    <progress id="anicoin-progress" value="${wallet.seconds}" max="1200"></progress></div>
            </div>` : ''}
            <p role="status">${escapeFriendHtml(aniCoinStatus)}</p>
            ${owner && !wallet && aniCoinStatus ? '<button type="button" class="btn-secondary" data-komi-onclick="openAniCoinShop()">Повторить</button>' : ''}
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
