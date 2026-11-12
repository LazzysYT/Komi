/* Komi Cinema: progressive enhancements for the existing watch modal.
 * Native MP4/HLS only: embedded cross-origin players keep their own controls.
 * No new backend writes; per-episode viewed markers are local and account-scoped.
 */
(function (root) {
    'use strict';
    const storagePrefix = 'komi_viewed_episodes_v1:';
    let active = null;

    function seekTarget(current, delta, duration) {
        const position = Number(current);
        const length = Number(duration);
        if (!Number.isFinite(position) || !Number.isFinite(delta)) return 0;
        const upper = Number.isFinite(length) && length > 1 ? length - 1 : Number.POSITIVE_INFINITY;
        return Math.max(0, Math.min(upper, position + delta));
    }

    function watchedStorageKey(userId, animeId) {
        // Authentication identity is part of the key; never leak previous users' progress.
        if (!userId || !animeId) return '';
        return storagePrefix + encodeURIComponent(String(userId)) + ':' + encodeURIComponent(String(animeId));
    }
    function readWatched(userId, animeId) {
        const key = watchedStorageKey(userId, animeId);
        if (!key) return [];
        try {
            const parsed = JSON.parse(root.localStorage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed.filter(s => /^\d{1,3}:\d{1,5}$/.test(s)).slice(0, 1800) : [];
        } catch { return []; }
    }
    function addWatched(userId, animeId, season, index) {
        const key = watchedStorageKey(userId, animeId);
        if (!key) return false;
        const entry = String(season) + ':' + String(index);
        const updated = new Set(readWatched(userId, animeId));
        if (updated.has(entry)) return false;
        updated.add(entry);
        try { root.localStorage.setItem(key, JSON.stringify([...updated].slice(-1800))); }
        catch { return false; }
        return true;
    }
    function isTyping(target) {
        return !!target?.closest?.('input, textarea, select, button, [contenteditable="true"], [role="textbox"]');
    }
    function makeButton(text, className, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'komi-cinema-action ' + (className || '');
        button.textContent = text;
        if (label) button.setAttribute('aria-label', label);
        return button;
    }
    function paintWatched(context) {
        const saved = new Set(readWatched(context.userId, context.animeId));
        const buttons = context.content.querySelectorAll('.komi-episode-number-grid button');
        for (const button of buttons) {
            const idx = Array.prototype.indexOf.call(buttons, button);
            const done = saved.has(context.season + ':' + idx);
            button.classList.toggle('komi-episode-watched', done);
            if (done) button.title = 'Серия досмотрена на этом устройстве';
        }
    }
    function markCurrentWatched(context) {
        if (!context?.userId) return;
        if (addWatched(context.userId, context.animeId, context.season, context.index)) paintWatched(context);
    }
    function showPlaybackStatus(context, text) {
        if (context?.note) context.note.textContent = text;
    }
    function updateSkip(context) {
        if (!context?.skip || !context.video) return;
        const video = context.video;
        const duration = video.duration;
        const time = video.currentTime;
        context.skip.hidden = !(Number.isFinite(duration) && duration > 100 &&
            Number.isFinite(time) && time >= 0 && time < 95 && !video.ended);
    }

    function mount(settings = {}) {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('watchModal');
        const content = document.getElementById('watchModalContent');
        const wrapper = content?.querySelector('.player-wrapper');
        if (!modal || !content || !wrapper) return;
        const video = wrapper.querySelector('#animeVideoPlayer');
        const context = {
            modal, content, video,
            animeId: String(settings.animeId || ''),
            userId: settings.userId || '',
            season: Number(settings.season) || 1,
            index: Number(settings.index) || 0,
            hasNext: !!settings.hasNext,
            skip: null, note: null
        };
        active = context;
        const bar = document.createElement('div');
        bar.className = 'komi-cinema-toolbar';
        bar.setAttribute('role', 'group');
        bar.setAttribute('aria-label', 'Управление просмотром');
        const lights = makeButton('◐ Приглушить интерфейс', 'komi-cinema-lights', 'Переключить режим кинотеатра');
        lights.setAttribute('aria-pressed', String(modal.classList.contains('komi-lights-off')));
        lights.addEventListener('click', () => {
            const enabled = modal.classList.toggle('komi-lights-off');
            lights.setAttribute('aria-pressed', String(enabled));
            lights.textContent = enabled ? '◑ Вернуть интерфейс' : '◐ Приглушить интерфейс';
        });
        if (modal.classList.contains('komi-lights-off')) lights.textContent = '◑ Вернуть интерфейс';
        bar.append(lights);
        if (video) {
            const skip = makeButton('⏭ +85 секунд', 'komi-cinema-skip',
                'Перемотать видео вперёд на 85 секунд. Это не точный таймкод опенинга.');
            skip.hidden = true;
            skip.title = 'Условный пропуск: продолжительность опенинга отличается между сериями.';
            skip.addEventListener('click', () => {
                if (active !== context || !video.isConnected) return;
                video.currentTime = seekTarget(video.currentTime, 85, video.duration);
                showPlaybackStatus(context, 'Перемотка +85 секунд. Проверьте, не пропущена ли часть сюжета.');
                updateSkip(context);
            });
            context.skip = skip;
            bar.append(skip);
            const help = document.createElement('details');
            help.className = 'komi-cinema-shortcuts';
            const summary = document.createElement('summary');
            summary.textContent = '⌨ Горячие клавиши';
            const explanation = document.createElement('p');
            explanation.textContent = 'Пробел — пауза, ← / → — 10 сек, ↑ / ↓ — громкость, F — полный экран, M — звук, Shift+N — следующая серия.';
            help.append(summary, explanation);
            bar.append(help);
            video.addEventListener('loadedmetadata', () => updateSkip(context));
            video.addEventListener('timeupdate', () => {
                if (active !== context) return;
                updateSkip(context);
                if (Number.isFinite(video.duration) && video.duration > 60 &&
                    video.currentTime / video.duration >= 0.92) markCurrentWatched(context);
            }, {passive:true});
            video.addEventListener('ended', () => markCurrentWatched(context));
            // On touch screens video controls remain available; a double tap on
            // the video element (not its native controls) seeks 10 seconds.
            let previousTap = {time:0,side:''};
            video.addEventListener('pointerup', event => {
                if (event.pointerType !== 'touch' || active !== context) return;
                const bounds = video.getBoundingClientRect();
                if (!bounds.width) return;
                const side = event.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right';
                const now = Date.now();
                if (previousTap.side === side && now - previousTap.time <= 330) {
                    video.currentTime = seekTarget(video.currentTime, side === 'left' ? -10 : 10, video.duration);
                    showPlaybackStatus(context, side === 'left' ? '−10 секунд' : '+10 секунд');
                    previousTap = {time:0,side:''};
                } else previousTap = {time:now,side};
            });
            updateSkip(context);
        } else {
            const notice = document.createElement('span');
            notice.className = 'komi-cinema-external-note';
            notice.textContent = 'Внешний плеер: пауза, перемотка и горячие клавиши управляются самим провайдером.';
            bar.append(notice);
        }
        const note = document.createElement('p');
        note.className = 'komi-cinema-action-status';
        note.setAttribute('role', 'status');
        note.setAttribute('aria-live', 'polite');
        context.note = note;
        wrapper.after(bar, note);
        paintWatched(context);
        return context;
    }

    function handleKeyboard(event) {
        const context = active;
        if (!context || !context.modal.classList.contains('active') ||
            !context.content.isConnected || isTyping(event.target) ||
            event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.shiftKey && event.key.toLowerCase() === 'n') {
            if (!context.hasNext) return;
            event.preventDefault();
            if (typeof root.openWatchModal === 'function') {
                root.openWatchModal(context.animeId, context.season, context.index + 1);
            }
            return;
        }
        if (event.shiftKey || !context.video || !context.video.isConnected) return;
        const video = context.video;
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                if (video.paused) Promise.resolve(video.play()).catch(() => {});
                else video.pause();
                break;
            case 'ArrowLeft': case 'ArrowRight':
                event.preventDefault();
                video.currentTime = seekTarget(video.currentTime,
                    event.code === 'ArrowLeft' ? -10 : 10, video.duration);
                break;
            case 'ArrowUp': case 'ArrowDown':
                event.preventDefault();
                video.volume = Math.max(0, Math.min(1, video.volume +
                    (event.code === 'ArrowUp' ? 0.1 : -0.1)));
                break;
            case 'KeyM':
                event.preventDefault();
                video.muted = !video.muted;
                break;
            case 'KeyF':
                event.preventDefault();
                if (document.fullscreenElement === video) document.exitFullscreen?.();
                else video.requestFullscreen?.().catch?.(() => {});
                break;
            default: break;
        }
    }
    if (typeof document !== 'undefined') document.addEventListener('keydown', handleKeyboard);
    const api = {mount,seekTarget,watchedStorageKey,readWatched,addWatched,handleKeyboard};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KomiPlayerUX = api;
})(globalThis);
