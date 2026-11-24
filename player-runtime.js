let komiHlsLibrary;
function loadKomiHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!komiHlsLibrary) komiHlsLibrary = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.6.19/dist/hls.min.js';
        const timer = setTimeout(() => fail(), 15000);
        const fail = () => { clearTimeout(timer); script.remove(); komiHlsLibrary = null; reject(Error('HLS недоступен')); };
        script.onerror = fail;
        script.onload = () => { clearTimeout(timer); window.Hls ? resolve(window.Hls) : fail(); };
        document.head.append(script);
    });
    return komiHlsLibrary;
}
async function attachKomiMedia(video, raw, onError) {
    const source = KomiPlayerCore.source(raw);
    const token = video.komiMediaToken = {};
    clearTimeout(video.komiHlsRetryTimer);
    video.komiHlsRetryTimer = null;
    video.komiHls?.destroy();
    video.komiHls = null;
    if (source.kind !== 'hls' || video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = source.url;
        return;
    }
    try {
        const Hls = await loadKomiHls();
        if (!video.isConnected || video.komiMediaToken !== token) return;
        if (!Hls.isSupported()) throw Error('HLS не поддерживается браузером');
        const hls = video.komiHls = new Hls();
        let networkRetries = 0;
        let mediaRetries = 0;
        const active = () => video.isConnected && video.komiMediaToken === token && video.komiHls === hls;
        const fail = () => {
            if (!active()) return;
            clearTimeout(video.komiHlsRetryTimer);
            video.komiHlsRetryTimer = null;
            video.komiMediaFailed = true;
            video.komiHls = null;
            hls.destroy();
            video.dispatchEvent(new Event('komi:hls-levels'));
            onError();
        };
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (!data?.fatal || !active()) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
                // Retry temporary network failures twice, with bounded backoff.
                // Never revive a player after a source switch or modal close.
                if (video.komiHlsRetryTimer != null) return;
                const delay = 500 * (2 ** networkRetries++);
                video.komiHlsRetryTimer = setTimeout(() => {
                    video.komiHlsRetryTimer = null;
                    if (!active()) return;
                    try { hls.startLoad(); } catch { fail(); }
                }, delay);
                return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < 1) {
                mediaRetries++;
                try { hls.recoverMediaError(); } catch { fail(); }
                return;
            }
            fail();
        });
        const notifyLevels = () => { if (active()) video.dispatchEvent(new Event('komi:hls-levels')); };
        for (const event of [Hls.Events.MANIFEST_PARSED,Hls.Events.LEVELS_UPDATED,Hls.Events.LEVEL_SWITCHED].filter(Boolean)) hls.on(event,notifyLevels);
        hls.loadSource(source.url);
        hls.attachMedia(video);
    } catch { if (video.isConnected && video.komiMediaToken === token) onError(); }
}
function disposeKomiMedia(video) {
    if (!video) return;
    video.komiControls?.dispose();
    video.komiMediaToken = null;
    clearTimeout(video.komiHlsRetryTimer);
    video.komiHlsRetryTimer = null;
    video.komiHls?.destroy();
    video.komiHls = null;
    video.pause();
    video.removeAttribute('src');
    video.querySelectorAll('source').forEach(source => source.remove());
    video.load();
}
function bindKomiPlayer(animeId, season, index, raw, progressIndex = index) {
    const video = document.getElementById('animeVideoPlayer');
    if (!video) return;
    Object.assign(video.dataset, {animeId: String(animeId), season: String(season), episode: String(progressIndex), owner: currentUser?.authUserId || currentUser?.username || ''});
    video.addEventListener('loadedmetadata', () => {
        video.komiMediaFailed = false;
        restoreKomiVideo(video);
        video.komiRestored = true;
    });
    video.addEventListener('timeupdate', () => saveProgress(animeId, video));
    for (const event of ['pause', 'seeked']) video.addEventListener(event, () => saveProgress(animeId, video, true));
    // The UX layer owns the opt-in 5-second next-episode countdown.
    // Never jump immediately on ended: that bypasses the user's cancel action.
    video.addEventListener('ended', () => saveProgress(animeId, video, true));
    video.komiControls = window.mountKomiPlaybackControls?.(video);
    const showError = () => {
        showKomiPlayerError(video);
        video.komiControls?.showError();
    };
    video.addEventListener('error', showError);
    attachKomiMedia(video, raw, showError);
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        const video = document.getElementById('animeVideoPlayer');
        if (video) saveProgress(video.dataset.animeId, video, true);
    }
});

// One accessible validation owner for the existing static forms.
document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.noValidate) return;
    let first;
    for (const field of form.elements) {
        if (!field.willValidate) continue;
        const invalid = !field.validity.valid;
        field.setAttribute('aria-invalid', String(invalid));
        if (invalid && !first) first = field;
    }
    if (!first) { form.querySelector('[data-form-error]')?.remove(); return; }
    event.preventDefault(); event.stopImmediatePropagation();
    let error = form.querySelector('[data-form-error]');
    if (!error) {
        error = document.createElement('p'); error.dataset.formError = '';
        error.id = (form.id || 'komi-form') + '-error'; error.setAttribute('role','alert');
        form.prepend(error);
    }
    error.textContent = first.validity.valueMissing ? 'Заполните обязательное поле.' : 'Проверьте формат значения в выделенном поле.';
    first.setAttribute('aria-describedby',error.id); first.focus();
}, true);
