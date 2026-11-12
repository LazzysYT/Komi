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
    const openingCache = new Map();
    // The IDs supplied here must be MyAnimeList title IDs, not user-provided URLs.
    function validMalId(value) {
        const n=Number(value);
        return Number.isSafeInteger(n) && n > 0 && n <= 9999999;
    }
    function pickOpeningInterval(payload, duration) {
        if (!payload || payload.found !== true || !Array.isArray(payload.results)) return null;
        const length=Number(duration);
        if (!Number.isFinite(length) || length<150 || length>21600) return null;
        const candidates=[];
        for (const result of payload.results.slice(0,30)) {
            if (!['op','mixed-op'].includes(result?.skipType)) continue;
            const start=Number(result?.interval?.startTime);
            const end=Number(result?.interval?.endTime);
            const sourceLength=Number(result?.episodeLength);
            // Different encodes can shift the opening dramatically. Only trust
            // timings for episodes with a closely matched duration.
            if (!Number.isFinite(start)||!Number.isFinite(end)||
                !Number.isFinite(sourceLength)||sourceLength<150 ||
                Math.abs(sourceLength-length)>Math.max(18,length*.025) ||
                start<0||end>length-3||end-start<35||end-start>180) continue;
            candidates.push({start,end,exact:true});
        }
        return candidates.sort((a,b)=>a.start-b.start)[0] || null;
    }
    async function fetchOpeningInterval(malId, episodeNumber, duration) {
        if (!validMalId(malId) || !Number.isInteger(Number(episodeNumber)) ||
            Number(episodeNumber)<1 || Number(episodeNumber)>10000 ||
            !Number.isFinite(duration) || duration<150 || duration>21600 ||
            typeof root.fetch!=='function') return null;
        const key=[Number(malId),Number(episodeNumber),Math.round(duration)].join(':');
        const prior=openingCache.get(key);
        if (prior && prior.until>Date.now()) return prior.value;
        const url=new URL('https://api.aniskip.com/v2/skip-times/'+
            Number(malId)+'/'+Number(episodeNumber));
        url.searchParams.append('types','op');
        url.searchParams.append('types','mixed-op');
        url.searchParams.set('episodeLength',String(Math.round(duration)));
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),3800);
        let value=null;
        try {
            const response=await root.fetch(url.href,{
                method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
                referrerPolicy:'no-referrer',signal:controller.signal,
                headers:{Accept:'application/json'}
            });
            if (response.ok) value=pickOpeningInterval(await response.json(),duration);
        } catch (_) {
            // Network failure/CORS/API absence cannot disable native playback.
        } finally {
            clearTimeout(timer);
        }
        if (openingCache.size>70) openingCache.clear();
        openingCache.set(key,{value,until:Date.now()+(value?6*3600000:10*60000)});
        return value;
    }
    function updateNextPreview(context) {
        const next=context?.next;
        const video=context?.video;
        if (!next||!video||active!==context)return;
        const remain=video.duration-video.currentTime;
        const show=context.hasNext && !context.cancelAutoNext &&
            Number.isFinite(video.duration) && video.duration>60 &&
            Number.isFinite(remain) && remain>=0 && remain<=15 && !video.ended;
        next.hidden=!show;
        if(show && context.nextCountdown)
            context.nextCountdown.textContent='Следующая серия через '+Math.max(1,Math.ceil(remain))+' с';
    }
    function shouldAutoNext(video) {
        if(!active || active.video!==video || !video?.isConnected) return true;
        return !active.cancelAutoNext &&
            (!active.ownerIsCurrent || active.ownerIsCurrent());
    }
    function updateSkip(context) {
        if (!context?.skip || !context.video) return;
        const video=context.video;
        const duration=video.duration, time=video.currentTime;
        const exact=context.opening;
        const validExact=exact && time>=Math.max(0,exact.start-12) &&
            time<exact.end-2 && exact.end<duration;
        const manual= !exact && Number.isFinite(duration) && duration>100 &&
            Number.isFinite(time) && time>=0 && time<95;
        context.skip.hidden=!(validExact||manual) || video.ended;
        context.skip.textContent=exact?'⏭ Пропустить опенинг':'⏭ +85 секунд';
        context.skip.title=exact
            ? 'Таймкоды AniSkip: от '+Math.round(exact.start)+' до '+Math.round(exact.end)+' секунд.'
            : 'Приблизительная ручная перемотка. Точное время опенинга неизвестно.';
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
            malId:settings.malId || null,
            episodeNumber:Number(settings.episodeNumber) || 0,
            opening:null,
            next:null,
            nextCountdown:null,
            cancelAutoNext:false,
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
                if(context.opening) {
                    video.currentTime=Math.min(video.duration-1,context.opening.end);
                    showPlaybackStatus(context,'Опенинг пропущен по таймкодам AniSkip.');
                } else {
                    video.currentTime = seekTarget(video.currentTime, 85, video.duration);
                    showPlaybackStatus(context,'Перемотка +85 секунд. Проверьте, не пропущена ли часть сюжета.');
                }
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
            video.addEventListener('loadedmetadata', () => {
                updateSkip(context);
                updateNextPreview(context);
                // Request metadata only for a directly controllable native source.
                // MAL IDs refer to standalone anime titles, not Komi grouped seasons.
                if (context.season!==1 || !validMalId(context.malId)) return;
                void fetchOpeningInterval(context.malId,context.episodeNumber,video.duration)
                    .then(opening=>{
                        if(active!==context || !video.isConnected)return;
                        context.opening=opening;
                        updateSkip(context);
                    });
            });
            video.addEventListener('timeupdate', () => {
                if (active !== context) return;
                updateSkip(context);
                updateNextPreview(context);
                if (Number.isFinite(video.duration) && video.duration > 60 &&
                    video.currentTime / video.duration >= 0.92) markCurrentWatched(context);
            }, {passive:true});
            video.addEventListener('ended', () => markCurrentWatched(context));
            if(context.hasNext) {
                const preview=document.createElement('div');
                preview.className='komi-next-episode-preview';
                preview.hidden=true;
                preview.setAttribute('role','group');
                preview.setAttribute('aria-label','Следующая серия');
                const label=document.createElement('span');
                label.className='komi-next-countdown';
                label.textContent='Следующая серия';
                context.nextCountdown=label;
                const now=makeButton('Смотреть сейчас','komi-next-now','Перейти к следующей серии');
                const cancel=makeButton('Отмена','komi-next-cancel','Отменить автоматический переход');
                now.addEventListener('click',()=>{
                    if(active!==context||!video.isConnected)return;
                    root.openWatchModal?.(context.animeId,context.season,context.index+1);
                });
                cancel.addEventListener('click',()=>{
                    if(active!==context)return;
                    context.cancelAutoNext=true;
                    preview.hidden=true;
                    showPlaybackStatus(context,'Автоматический переход отменён для этой серии.');
                });
                preview.append(label,now,cancel);
                wrapper.append(preview);
                context.next=preview;
            }
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
                if (document.fullscreenElement === video) document.exitFullscreen?.();
                else video.requestFullscreen?.().catch?.(() => {});
                break;
            default: break;
        }
    }
    if (typeof document !== 'undefined') document.addEventListener('keydown', handleKeyboard);
    const api = {mount,seekTarget,watchedStorageKey,readWatched,addWatched,mergeWatched,validMarker,handleKeyboard,loadCloudWatched,pickOpeningInterval,fetchOpeningInterval,shouldAutoNext};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KomiPlayerUX = api;
})(globalThis);
