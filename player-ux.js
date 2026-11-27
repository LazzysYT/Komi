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
        return !!target?.closest?.('input, textarea, select, button, summary, [contenteditable="true"], [role="textbox"]');
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
            const slots = context.episodeSlots?.[idx] || [idx];
            const done = slots.some(slot => saved.has(context.season + ':' + slot));
            button.classList.toggle('komi-episode-watched', done);
            if (done) button.title = context.authId ? 'Серия досмотрена · синхронизация с аккаунтом' : 'Серия досмотрена на этом устройстве';
        }
    }
    function markCurrentWatched(context) {
        if (!context?.userId || (context.ownerIsCurrent && !context.ownerIsCurrent())) return;
        const slot = context.episodeSlots?.[context.index]?.[0] ?? context.index;
        if (addWatched(context.userId, context.animeId, context.season, slot)) {
            paintWatched(context);
            if (activeCloudContext(context))
                void writeCloudWatched(context,[context.season+':'+slot]).catch(()=>syncError(context));
        }
    }
    function showPlaybackStatus(context, text) {
        if (context?.note) context.note.textContent = text;
    }
    function currentIntro(context) {
        const video = context?.video;
        if (!video || video.ended || video.seeking || video.komiMediaFailed) return null;
        const meta = context.episodeMeta || {};
        const intro = validSegment(meta.introStart, meta.introEnd, video.duration);
        const time = video.currentTime;
        return intro && Number.isFinite(time) && time >= intro.start && time < intro.end ? intro : null;
    }
    function updateSkip(context) {
        if (context?.skip) context.skip.hidden = !currentIntro(context);
    }

    // Only validated episode metadata can authorize skipping OP/ED.
    function validSegment(start, end, duration) {
        const isTimecode = value => (typeof value === 'number' ||
            (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
        if (!isTimecode(start) || !isTimecode(end) || !Number.isFinite(duration)) return null;
        const a = Number(start), b = Number(end);
        return a >= 0 && b > a && b <= duration && b - a <= 210 ? {start:a,end:b} : null;
    }
    function nativePreference(name) {
        try {
            const saved = root.localStorage?.getItem('komi_native_' + name);
            // Newly enabled by default; a user's explicit off switch is respected.
            return name === 'autonext' ? saved !== '0' : saved === '1';
        } catch { return name === 'autonext'; }
    }
    function saveNativePreference(name,value) {
        try { root.localStorage?.setItem('komi_native_' + name, value ? '1' : '0'); }
        catch { /* Private browsing may block localStorage. */ }
    }
    function maybeAutoSkip(context) {
        if (active !== context || !context.video?.isConnected || !context.autoSkip ||
            !root.KomiPremium?.isActiveId?.(context.authId) ||
            context.video.seeking || context.video.ended) return;
        const video = context.video;
        const meta = context.episodeMeta || {};
        const opening = validSegment(meta.introStart,meta.introEnd,video.duration);
        const ending = validSegment(meta.outroStart,meta.outroEnd,video.duration);
        const time = Number(video.currentTime);
        if (!Number.isFinite(time)) return;
        if (opening && !context.skippedOpening && time >= opening.start && time < opening.end) {
            context.skippedOpening = true;
            video.currentTime = opening.end;
            showPlaybackStatus(context, 'Опенинг пропущен по подтверждённым таймкодам серии.');
        } else if (ending && !context.skippedEnding && time >= ending.start && time < ending.end) {
            context.skippedEnding = true;
            video.currentTime = ending.end;
            showPlaybackStatus(context, 'Эндинг пропущен по подтверждённым таймкодам серии.');
        }
    }

    function clearNextCountdown(context) {
        if (!context) return;
        if (context.nextTimer != null) clearInterval(context.nextTimer);
        context.nextTimer = null;
        context.nextBanner?.remove();
        context.nextBanner = null;
    }
    function cancelPendingNext() {
        clearNextCountdown(active);
        if (active?.tapIndicatorTimer != null) clearTimeout(active.tapIndicatorTimer);
        if (active) active.tapIndicatorTimer = null;
    }
    function nextEpisodeCountdown(context) {
        if (active !== context || !context.video?.isConnected || !context.hasNext ||
            !context.modal.classList.contains('active') ||
            typeof root.openWatchModal !== 'function') return;
        clearNextCountdown(context);
        const overlay = document.createElement('div');
        overlay.className = 'komi-next-countdown';
        overlay.setAttribute('role', 'group');
        overlay.setAttribute('aria-label', 'Переход к следующей серии');
        const title = document.createElement('span');
        title.className = 'komi-next-countdown-title';
        const watch = makeButton('Смотреть сейчас', 'komi-next-now', 'Смотреть следующую серию сейчас');
        const cancel = makeButton('Остаться', 'komi-next-cancel', 'Остаться на этой серии');
        const actions = document.createElement('div');
        actions.className = 'komi-next-countdown-actions';
        actions.append(watch,cancel);
        overlay.append(title,actions);
        context.nextBanner = overlay;
        context.wrapper.append(overlay);
        let remaining = 5;
        function stillCurrent() {
            return active === context && context.video?.isConnected &&
                context.modal.classList.contains('active');
        }
        function advance() {
            if (!stillCurrent()) { clearNextCountdown(context); return; }
            clearNextCountdown(context);
            root.openWatchModal(context.animeId, context.season, context.index + 1, null, null, {playNative:true});
        }
        watch.addEventListener('click', advance);
        cancel.addEventListener('click', () => {
            clearNextCountdown(context);
            showPlaybackStatus(context, 'Автопереход на следующую серию отменён.');
        });
        if (!context.autoNext) {
            title.textContent = 'Серия завершена. Перейти к следующей?';
            return;
        }
        title.textContent = 'Следующая серия через ' + remaining + '…';
        context.nextTimer = setInterval(() => {
            if (!stillCurrent() || !context.autoNext) {
                clearNextCountdown(context);
                return;
            }
            remaining -= 1;
            if (remaining <= 0) { advance(); return; }
            title.textContent = 'Следующая серия через ' + remaining + '…';
        }, 1000);
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
            episodeSlots: settings.episodeSlots,
            hasNext: !!settings.hasNext,
            client:settings.client || null,
            authId:settings.authId || null,
            ownerIsCurrent:typeof settings.ownerIsCurrent === 'function' ? settings.ownerIsCurrent : null,
            episodeMeta: settings.episodeMeta?.[Number(settings.index) || 0] || {},
            autoSkip: nativePreference('autoskip'), autoNext: nativePreference('autonext'),
            skippedOpening:false, skippedEnding:false,
            skip: null, note: null
        };
        cancelPendingNext();
        active = context;
        context.wrapper = wrapper;
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
            const skip = makeButton('Пропустить заставку', 'komi-cinema-skip', 'Пропустить заставку по таймкоду серии');
            skip.hidden = true;
            skip.addEventListener('click', () => {
                if (active !== context || !video.isConnected) return;
                const intro = currentIntro(context);
                if (!intro) { updateSkip(context); return; }
                context.skippedOpening = true;
                video.currentTime = intro.end;
                showPlaybackStatus(context, 'Заставка пропущена.');
                updateSkip(context);
            });
            context.skip = skip;
            bar.append(skip);
            const autoNext = makeButton('⏭ Автоследующая серия', 'komi-native-autonext',
                'Переход к следующей серии после завершения встроенного видео');
            autoNext.setAttribute('aria-pressed',String(context.autoNext));
            autoNext.addEventListener('click',()=>{
                context.autoNext = !context.autoNext;
                saveNativePreference('autonext',context.autoNext);
                autoNext.setAttribute('aria-pressed',String(context.autoNext));
                showPlaybackStatus(context,context.autoNext ? 'Автопереход включён' : 'Автопереход выключен');
                if (video.ended) nextEpisodeCountdown(context);
            });
            bar.append(autoNext);
            if (settings.authId && root.KomiPremium?.isActiveId?.(settings.authId)) {
                const autoSkip = makeButton('⏭ Пропуск OP/ED', 'komi-native-autoskip',
                    'Только для Premium и только при наличии таймкодов открытия/концовки');
                autoSkip.setAttribute('aria-pressed',String(context.autoSkip));
                autoSkip.addEventListener('click',()=>{
                    context.autoSkip = !context.autoSkip;
                    saveNativePreference('autoskip',context.autoSkip);
                    autoSkip.setAttribute('aria-pressed',String(context.autoSkip));
                    showPlaybackStatus(context,context.autoSkip ? 'Пропуск по таймкодам включён' : 'Пропуск выключен');
                });
                bar.append(autoSkip);
            }
            const help = document.createElement('details');
            help.className = 'komi-cinema-shortcuts';
            const summary = document.createElement('summary');
            summary.textContent = '⌨ Горячие клавиши';
            const explanation = document.createElement('p');
            explanation.textContent = 'Пробел — пауза, ← / → — 10 сек, ↑ / ↓ — громкость, F — полный экран, M — звук, Shift+N — следующая серия.';
            help.append(summary, explanation);
            bar.append(help);
            for (const event of ['loadedmetadata', 'durationchange', 'seeking', 'seeked', 'ended', 'emptied', 'error'])
                video.addEventListener(event, () => updateSkip(context));
            video.addEventListener('komi:autoplay-blocked', () => {
                if (active !== context || !modal.classList.contains('active') || !video.isConnected) return;
                showPlaybackStatus(context, 'Серия готова. Нажми «Воспроизвести», чтобы начать.');
                const focused = document.activeElement;
                if (!focused || focused === document.body || wrapper.contains(focused)) {
                    const play = wrapper.querySelector('[data-control="play"]');
                    if (play && !play.disabled) play.focus({preventScroll:true});
                    else if (video.controls) video.focus({preventScroll:true});
                }
            });
            video.addEventListener('playing', () => {
                if (active === context && context.note?.textContent.startsWith('Серия готова.'))
                    showPlaybackStatus(context, '');
            });
            video.addEventListener('timeupdate', () => {
                if (active !== context) return;
                updateSkip(context);
                maybeAutoSkip(context);
                if (Number.isFinite(video.duration) && video.duration > 60 &&
                    video.currentTime / video.duration >= 0.92) markCurrentWatched(context);
            }, {passive:true});
            video.addEventListener('ended', () => markCurrentWatched(context));
            video.addEventListener('ended', () => {
                if (active !== context || !video.isConnected) return;
                if (context.hasNext) nextEpisodeCountdown(context); // With autoplay off, manual action only.
            });
            video.addEventListener('playing', () => clearNextCountdown(context));
            video.addEventListener('seeking', () => clearNextCountdown(context));
            // Double-tap on native video only. Swipes and external embeds are never intercepted.
            let previousTap = {time:0,side:''};
            let down = null;
            const indicator = document.createElement('div');
            indicator.className = 'komi-tap-seek-feedback';
            indicator.setAttribute('aria-hidden','true');
            wrapper.append(indicator);
            video.addEventListener('pointerdown', event => {
                if (event.pointerType !== 'touch' || active !== context) return;
                down = {id:event.pointerId, x:event.clientX, y:event.clientY, time:Date.now()};
            }, {passive:true});
            video.addEventListener('pointercancel', () => { down=null; previousTap={time:0,side:''}; }, {passive:true});
            video.addEventListener('pointerup', event => {
                if (event.pointerType !== 'touch' || active !== context || !down) return;
                const start = down;
                down = null;
                const now = Date.now();
                if (start.id !== event.pointerId || now - start.time > 450 ||
                    Math.hypot(start.x - event.clientX, start.y - event.clientY) > 26) {
                    previousTap = {time:0,side:''};
                    return;
                }
                const bounds = video.getBoundingClientRect();
                if (!bounds.width || video.komiMediaFailed || !Number.isFinite(video.duration) ||
                    video.duration <= 1) return;
                const side = event.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right';
                if (previousTap.side === side && now - previousTap.time <= 360) {
                    video.currentTime = seekTarget(video.currentTime,
                        side === 'left' ? -10 : 10, video.duration);
                    indicator.dataset.side = side;
                    indicator.textContent = side === 'left' ? '↶ 10 с' : '10 с ↷';
                    indicator.classList.remove('is-visible');
                    void indicator.offsetWidth;
                    indicator.classList.add('is-visible');
                    clearTimeout(context.tapIndicatorTimer);
                    context.tapIndicatorTimer = setTimeout(() => indicator.classList.remove('is-visible'),650);
                    showPlaybackStatus(context, side === 'left' ? '−10 секунд' : '+10 секунд');
                    previousTap = {time:0,side:''};
                } else previousTap = {time:now,side};
            }, {passive:true});
            updateSkip(context);
        } else if (wrapper.querySelector('iframe')) {
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
                if (context.video?.isConnected) {
                    clearNextCountdown(context);
                    root.openWatchModal(context.animeId, context.season, context.index + 1, null, null, {playNative:true});
                } else root.openWatchModal(context.animeId, context.season, context.index + 1);
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
    const api = {mount,cancelPendingNext,seekTarget,validSegment,watchedStorageKey,readWatched,addWatched,mergeWatched,validMarker,handleKeyboard,loadCloudWatched};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KomiPlayerUX = api;
})(globalThis);
