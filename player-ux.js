/* Komi Cinema: progressive enhancements for the existing watch modal.
 * Native MP4/HLS only: embedded cross-origin players keep their own controls.
 * Completion markers stay in account-scoped local cache and sync through\n * owner-only Supabase RLS for authenticated accounts.
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
            return Array.isArray(parsed) ? parsed.filter(s => /^\d{1,4}:\d{1,5}$/.test(s)).slice(0, 1800) : [];
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
    function validMarker(marker) {
        const match = /^(\d{1,4}):(\d{1,5})$/.exec(String(marker));
        if (!match) return false;
        const season = Number(match[1]);
        const index = Number(match[2]);
        return season >= 1 && season <= 1000 && index >= 0 && index <= 9999;
    }
    function mergeWatched(userId, animeId, markers) {
        const key = watchedStorageKey(userId, animeId);
        if (!key) return [];
        const merged = [...new Set([...readWatched(userId, animeId), ...(markers || [])]
            .filter(validMarker))].slice(-1800);
        try { root.localStorage.setItem(key, JSON.stringify(merged)); } catch {}
        return merged;
    }
    function cloudEnabled(context) {
        return !!context?.client?.from && !!context.authId &&
            context.authId === context.userId && /^\d+$/.test(context.animeId) &&
            (!context.ownerIsCurrent || context.ownerIsCurrent());
    }
    function activeCloudContext(context) {
        return active === context && context.content.isConnected && cloudEnabled(context);
    }
    function markerRow(context, marker) {
        if (!validMarker(marker)) return null;
        const [season, episode_index] = marker.split(':').map(Number);
        return {
            user_id:context.authId,
            anime_id:Number(context.animeId),
            season,
            episode_index
        };
    }
    async function writeCloudWatched(context, markers) {
        if (!cloudEnabled(context)) return;
        const rows = [...new Set(markers)].map(marker=>markerRow(context,marker)).filter(Boolean);
        for (let offset = 0; offset < rows.length; offset += 80) {
            if (!activeCloudContext(context)) return;
            const {error} = await context.client.from('komi_watched_episodes')
                .upsert(rows.slice(offset, offset + 80), {
                    onConflict:'user_id,anime_id,season,episode_index',
                    ignoreDuplicates:true
                });
            if (error) throw error;
        }
    }
    async function loadCloudWatched(context) {
        if (!activeCloudContext(context)) return;
        const cloud = new Set();
        for (let page = 0; page < 4; page++) {
            const {data,error} = await context.client.from('komi_watched_episodes')
                .select('season,episode_index')
                .eq('user_id',context.authId)
                .eq('anime_id',Number(context.animeId))
                .order('season',{ascending:true})
                .order('episode_index',{ascending:true})
                .range(page*500,page*500+499);
            if (error) throw error;
            if (!activeCloudContext(context)) return;
            for (const item of data || []) {
                const marker = String(item.season) + ':' + String(item.episode_index);
                if (validMarker(marker)) cloud.add(marker);
            }
            if (!data || data.length < 500) break;
        }
        if (!activeCloudContext(context)) return;
        const local = readWatched(context.userId,context.animeId);
        mergeWatched(context.userId,context.animeId,cloud);
        paintWatched(context);
        const missing = local.filter(marker=>validMarker(marker)&&!cloud.has(marker));
        if (missing.length) await writeCloudWatched(context,missing);
    }
    function syncError(context) {
        if (activeCloudContext(context))
            showPlaybackStatus(context,'Отметки сохранены на этом устройстве. Облачная синхронизация временно недоступна.');
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
            if (done) button.title = context.authId ? 'Серия досмотрена · синхронизация с аккаунтом' : 'Серия досмотрена на этом устройстве';
        }
    }
    function markCurrentWatched(context) {
        if (!context?.userId || (context.ownerIsCurrent && !context.ownerIsCurrent())) return;
        if (addWatched(context.userId, context.animeId, context.season, context.index)) {
            paintWatched(context);
            if (activeCloudContext(context))
                void writeCloudWatched(context,[context.season+':'+context.index]).catch(()=>syncError(context));
        }
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
            client:settings.client || null,
            authId:settings.authId || null,
            ownerIsCurrent:typeof settings.ownerIsCurrent === 'function' ? settings.ownerIsCurrent : null,
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
        if (activeCloudContext(context)) void loadCloudWatched(context).catch(()=>syncError(context));
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
                const surface = context.content.querySelector('.player-wrapper') || video;
                if (document.fullscreenElement === surface) document.exitFullscreen?.();
                else surface.requestFullscreen?.().catch?.(() => {});
                break;
            default: break;
        }
    }
    if (typeof document !== 'undefined') document.addEventListener('keydown', handleKeyboard);
    const api = {mount,seekTarget,watchedStorageKey,readWatched,addWatched,mergeWatched,validMarker,handleKeyboard,loadCloudWatched};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KomiPlayerUX = api;
})(globalThis);
