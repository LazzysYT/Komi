/* Public anime comments backed by Supabase RLS. Never trust client-supplied author names. */
(function () {
    'use strict';
    const cache = new Map();
    const requestVersions = new Map();
    const MAX_TEXT = 1000;
    let activeView = null;

    // Public episode identity is the season and episode number, never a source
    // array index: switching voice-over must keep the same discussion.
    function commentScope(animeId, episode = {}) {
        const id = Number(animeId);
        if (!Number.isSafeInteger(id) || id <= 0) return null;
        if (!episode || typeof episode !== 'object' || Array.isArray(episode)) return null;
        const hasSeason = episode.season !== undefined && episode.season !== null;
        const hasEpisode = episode.episodeNumber !== undefined && episode.episodeNumber !== null;
        if (hasSeason !== hasEpisode) return null;
        const season = hasSeason ? Number(episode.season) : null;
        const episodeNumber = hasEpisode ? Number(episode.episodeNumber) : null;
        if (hasSeason && (!Number.isSafeInteger(season) || season < 1 || season > 9999 ||
            !Number.isSafeInteger(episodeNumber) || episodeNumber < 1 || episodeNumber > 99999)) return null;
        return { animeId: id, season, episodeNumber,
            key: id + ':' + (hasSeason ? season + ':' + episodeNumber : 'general') };
    }

    function currentSection(scope) {
        const section = document.getElementById('komiAnimeComments');
        return section?.dataset.scopeKey === scope.key ? section : null;
    }

    function applyScope(query, scope) {
        query = query.eq('anime_id', scope.animeId);
        return scope.episodeNumber === null
            ? query.is('season', null).is('episode_number', null)
            : query.eq('season', scope.season).eq('episode_number', scope.episodeNumber);
    }

    function invalidateScope(scope) {
        cache.delete(scope.key);
        // A read that began before a completed write cannot repopulate the
        // cache, including when the viewer has switched to another thread.
        requestVersions.set(scope.key, (requestVersions.get(scope.key) || 0) + 1);
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    // Timecodes are DOM nodes, never HTML; only native media elements can seek.
    function appendTimecodes(target, body) {
        const text = String(body || '');
        const pattern = /\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g;
        let cursor = 0;
        for (const match of text.matchAll(pattern)) {
            const index = match.index;
            if (index > cursor) target.append(document.createTextNode(text.slice(cursor, index)));
            const seconds = match[1] === undefined
                ? Number(match[2]) * 60 + Number(match[3])
                : Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
            const button = element('button', 'komi-comment-timecode', match[0]);
            button.type = 'button';
            button.title = 'Перейти к ' + match[0] + ' во встроенном плеере';
            button.style.cssText = 'border:0;background:transparent;color:inherit;text-decoration:underline;cursor:pointer;font:inherit;padding:0 2px';
            button.addEventListener('click', () => {
                const section = button.closest('#komiAnimeComments');
                if (!section || section.dataset.scopeKey !== section.dataset.playerScopeKey) {
                    statusMessage(section, 'Таймкоды доступны в обсуждении выбранной серии.');
                    return;
                }
                const modal = document.getElementById('watchModal');
                const video = modal?.classList.contains('active') ? modal.querySelector('#watchModalContent video') : null;
                if (!video || !Number.isFinite(video.duration) || seconds >= video.duration) {
                    const status = document.querySelector('#komiAnimeComments .komi-comments-status');
                    if (status) status.textContent = 'Таймкод доступен только во встроенном плеере с открытой серией.';
                    return;
                }
                video.currentTime = seconds;
                video.scrollIntoView({behavior:'smooth',block:'center'});
            });
            target.append(button);
            cursor = index + match[0].length;
        }
        if (cursor < text.length) target.append(document.createTextNode(text.slice(cursor)));
    }

    // Spoilers are plain text by default; reveal only the exact ||...|| range on demand.
    // Never use innerHTML for text supplied by community members.
    function appendSpoilerAware(target, body) {
        const source = String(body || '');
        const spoiler = /\|\|([\s\S]{1,800}?)\|\|/g;
        let cursor = 0;
        for (const match of source.matchAll(spoiler)) {
            if (match.index > cursor) appendTimecodes(target, source.slice(cursor, match.index));
            const button = element('button', 'komi-spoiler', 'Спойлер · показать');
            button.type = 'button';
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-label', 'Показать скрытый текст');
            button.style.cssText = 'display:inline-block;border:1px solid #888;background:#222;color:#eee;border-radius:7px;cursor:pointer;padding:2px 7px;max-width:100%;overflow-wrap:anywhere;vertical-align:baseline';
            let revealed = false;
            button.addEventListener('click', () => {
                revealed = !revealed;
                button.textContent = revealed ? match[1] : 'Спойлер · показать';
                button.setAttribute('aria-pressed', String(revealed));
                button.setAttribute('aria-label', revealed ? 'Скрыть спойлер' : 'Показать скрытый текст');
                button.style.filter = revealed ? 'none' : 'blur(0)';
                button.style.background = revealed ? '#090909' : '#222';
            });
            target.append(button);
            cursor = match.index + match[0].length;
        }
        if (cursor < source.length) appendTimecodes(target, source.slice(cursor));
    }

    function legacyComments(animeId) {
        const entries = (typeof animeComments !== 'undefined' && animeComments)
            ? animeComments[String(animeId)] : null;
        if (!Array.isArray(entries)) return [];
        return entries.slice(-30).reverse().map((entry, index) => ({
            id: 'legacy-' + index,
            user_id: null,
            author_name: String(entry.username || entry.author || 'Участник Komi'),
            body: String(entry.text || entry.comment || '').slice(0, MAX_TEXT),
            created_at: entry.created_at || null
        })).filter(entry => entry.body.trim());
    }

    function formatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function statusMessage(section, message) {
        const status = section?.querySelector('.komi-comments-status');
        if (status) status.textContent = message;
    }

    function renderAnimatedReactions(card,item,scope,cacheEntry,viewerId){
        const id=Number(item.id),r=cacheEntry?.animatedReactions;
        if(!Number.isSafeInteger(id)||id<=0||!item.user_id||!r)return;
        const catalog=window.KomiShopCatalog,own=r.viewer===viewerId?r.mine.get(id):null,active=r.viewer===viewerId?r.equipped:null;
        const row=element('div','komi-comment-fx-row');
        for(const p of (catalog?.items||[]).filter(p=>p.type==='commentfx')){
            const n=r.counts.get(id)?.get(p.id)||0,selected=own===p.id,canUse=!!viewerId&&(active===p.id||selected);
            if(!n&&!canUse)continue;
            const chip=element(canUse?'button':'span','komi-comment-fx-chip komi-fx-'+p.cosmeticClass,p.symbol+' '+n);
            chip.setAttribute('aria-label',p.label+': '+n);
            if(canUse){chip.type='button';chip.setAttribute('aria-pressed',String(selected));chip.addEventListener('click',async()=>{
                if(chip.disabled||currentUser?.authUserId!==viewerId)return;chip.disabled=true;
                try{const {data:{user},error:authError}=await _supabase.auth.getUser();if(authError||user?.id!==viewerId||currentUser?.authUserId!==viewerId)throw Error('Повторно войди в аккаунт.');
                    const response=selected?await _supabase.from('komi_comment_animated_reactions').delete().eq('comment_id',id).eq('user_id',viewerId):await _supabase.from('komi_comment_animated_reactions').upsert({comment_id:id,user_id:viewerId,effect_id:p.id},{onConflict:'comment_id,user_id'});
                    if(response.error)throw response.error;if(currentUser?.authUserId===viewerId)await refreshScope(scope,true);
                }catch(error){statusMessage(currentSection(scope),error?.message||'Реакция недоступна.');chip.disabled=false;}
            });}
            row.append(chip);
        }if(row.childNodes.length)card.append(row);
    }
    function redraw(scope) {
        const section = currentSection(scope);
        if (!section) return;
        const list = section.querySelector('.komi-comments-list');
        if (!list) return;
        list.replaceChildren();
        const cacheEntry=cache.get(scope.key);
        const records=cacheEntry?.rows||[];
        const activeHighlights=cacheEntry?.highlights||new Map();
        const decorations=cacheEntry?.decorations||new Map();
        const cosmetics=window.KomiShopCatalog?.items||[];
        const all=records.slice().sort((a,b)=>{
            const aActive=activeHighlights.has(Number(a.id)) && Date.parse(activeHighlights.get(Number(a.id)))>Date.now();
            const bActive=activeHighlights.has(Number(b.id)) && Date.parse(activeHighlights.get(Number(b.id)))>Date.now();
            return Number(bActive)-Number(aActive) || Date.parse(b.created_at||0)-Date.parse(a.created_at||0);
        }).concat(scope.episodeNumber === null ? legacyComments(scope.animeId) : []);
        section.querySelector('.komi-comments-count').textContent =
            all.length ? String(all.length) + (records.length >= 50 ? '+' : '') : '0';
        if (!all.length) {
            if (cacheEntry) list.append(element('p', 'komi-comments-empty', scope.episodeNumber === null
                ? 'Об аниме пока нет комментариев.'
                : 'К этой серии пока нет комментариев.'));
            else section.querySelector('.komi-comments-count').textContent = '…';
            return;
        }
        const viewerId = (typeof currentUser !== 'undefined' && currentUser?.authUserId) || '';
        for (const item of all) {
            const card = element('article', 'komi-comment');
            const authorStyle=decorations.get(String(item.user_id))||{};
            const plate=cosmetics.find(p=>p.type==='plate'&&p.id===authorStyle.plate_id);
            if(plate?.cosmeticClass)card.classList.add('komi-store-'+plate.cosmeticClass);
            const expiry=activeHighlights.get(Number(item.id));
            const promoted=expiry && Date.parse(expiry)>Date.now();
            if(promoted){
                card.classList.add('komi-comment-promoted');
                card.append(element('span','komi-comment-promo-label','✧ Выделено за AniCoin · до '+formatDate(expiry)));
            }
            const head = element('div', 'komi-comment-header');
            const name = element('strong', 'komi-comment-name', String(item.author_name || 'Участник Komi').slice(0, 60));
            if (item.user_id) name.dataset.komiPremiumId = String(item.user_id);
            const nickStyle=cosmetics.find(p=>p.type==='name'&&p.id===authorStyle.name_id);
            if(nickStyle?.cosmeticClass)name.classList.add('komi-store-'+nickStyle.cosmeticClass);
            const date = element('time', 'komi-comment-date', formatDate(item.created_at));
            if (item.created_at) date.dateTime = item.created_at;
            head.append(name, date);
            if (viewerId && String(item.user_id) === String(viewerId)) {
                const button = element('button', 'komi-comment-delete', 'Удалить');
                button.type = 'button';
                button.addEventListener('click', () => removeComment(scope, item.id, button));
                head.append(button);
                if(!promoted && Number.isSafeInteger(Number(item.id)) && Number(item.id)>0){
                    const promote=element('button','komi-comment-highlight-buy','Выделить · 12 ◈');
                    promote.type='button';
                    promote.title='Выделение своего комментария на 24 часа за 12 AniCoin';
                    promote.addEventListener('click',()=>buyHighlight(scope,Number(item.id),promote));
                    head.append(promote);
                }
            }
            const body = element('p', 'komi-comment-body');
            appendSpoilerAware(body, item.body);
            card.append(head, body);
            renderAnimatedReactions(card,item,scope,cacheEntry,viewerId);
            list.append(card);
        }
    }

    function loadError(scope, section) {
        if (!section || currentSection(scope) !== section) return;
        section.removeAttribute('aria-busy');
        statusMessage(section, 'Не удалось загрузить комментарии. ');
        const retry = element('button', 'btn-secondary komi-comments-retry', 'Повторить');
        retry.type = 'button';
        retry.addEventListener('click', () => void refreshScope(scope, true));
        section.querySelector('.komi-comments-status')?.append(retry);
    }

    async function refreshScope(scope, force) {
        const section = currentSection(scope);
        if (typeof _supabase === 'undefined' || !_supabase) {
            loadError(scope, section);
            return;
        }
        const existing = cache.get(scope.key);
        if (!force && existing?.loadedAt && Date.now() - existing.loadedAt < 60000) {
            statusMessage(section, '');
            section?.removeAttribute('aria-busy');
            redraw(scope);
            return;
        }
        const version = (requestVersions.get(scope.key) || 0) + 1;
        requestVersions.set(scope.key, version);
        const isLatest = () => requestVersions.get(scope.key) === version;
        section?.setAttribute('aria-busy', 'true');
        statusMessage(section, 'Загружаем комментарии…');
        try {
            const { data, error } = await applyScope(_supabase.from('komi_comments')
                .select('id,anime_id,season,episode_number,user_id,author_name,body,created_at'), scope)
                .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
            if (!isLatest()) return;
            if (error) throw error;
            // Keep the boundary explicit even when a stale API/cache returns a
            // broader set. General comments are never labelled as episode ones.
            const rows = (Array.isArray(data) ? data : []).filter(row =>
                Number(row.anime_id) === scope.animeId &&
                (scope.episodeNumber === null
                    ? row.season == null && row.episode_number == null
                    : Number(row.season) === scope.season && Number(row.episode_number) === scope.episodeNumber));
            const highlights = new Map();
            const ids = rows.map(row => Number(row.id)).filter(Number.isSafeInteger);
            if (ids.length) {
                try {
                    const promotions = await _supabase.from('komi_comment_highlights')
                        .select('comment_id,expires_at').in('comment_id', ids)
                        .gt('expires_at', new Date().toISOString());
                    if (!promotions.error)
                        for (const promo of promotions.data || []) highlights.set(Number(promo.comment_id), promo.expires_at);
                } catch { /* Optional decoration must not hide the discussion. */ }
            }
            if (!isLatest()) return;
            const decorations = new Map();
            const authorIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
            if (authorIds.length) {
                try {
                    const publicCosmetics = await _supabase.from('komi_premium_cosmetic_equips')
                        .select('user_id,plate_id,name_id').in('user_id', authorIds);
                    if (!publicCosmetics.error)
                        for (const cosmetic of publicCosmetics.data || []) decorations.set(String(cosmetic.user_id), cosmetic);
                } catch { /* Public cosmetics are not required to read text. */ }
            }
            if (!isLatest()) return;
            let animatedReactions=null;
            const viewer=(typeof currentUser!=='undefined'&&currentUser?.authUserId)||'';
            try{if(ids.length&&await window.KomiShopCatalog?.checkAnimatedPricing?.(_supabase)){
                const [react,equip]=await Promise.all([
                    _supabase.from('komi_comment_animated_reactions').select('comment_id,user_id,effect_id').in('comment_id',ids).limit(1000),
                    viewer?_supabase.from('komi_premium_cosmetic_equips').select('commentfx_id').eq('user_id',viewer).maybeSingle():Promise.resolve({data:null})]);
                if(!react.error){const counts=new Map(),mine=new Map();for(const r of react.data||[]){const id=Number(r.comment_id);if(!ids.includes(id)||window.KomiShopCatalog.find(r.effect_id)?.type!=='commentfx')continue;if(!counts.has(id))counts.set(id,new Map());const n=counts.get(id);n.set(r.effect_id,(n.get(r.effect_id)||0)+1);if(viewer&&r.user_id===viewer)mine.set(id,r.effect_id);}
                animatedReactions={viewer,counts,mine,equipped:equip.error?null:equip.data?.commentfx_id};}
            }}catch{/* Optional decoration never blocks discussion. */}
            if(!isLatest())return;
            cache.set(scope.key, { rows, highlights, decorations, animatedReactions, loadedAt: Date.now() });
            if (currentSection(scope) === section) {
                statusMessage(section, '');
                section?.removeAttribute('aria-busy');
                redraw(scope);
            }
        } catch (error) {
            if (!isLatest()) return;
            console.warn('Komi comments:', error?.message || 'Unavailable');
            loadError(scope, section);
        }
    }

    async function refresh(animeId, force, episode) {
        const scope = episode === undefined && activeView?.scope.animeId === Number(animeId)
            ? activeView.scope : commentScope(animeId, episode);
        if (scope) return refreshScope(scope, force);
    }

    async function buyHighlight(scope,id,button){
        if(typeof currentUser==='undefined'||!currentUser?.authUserId||!_supabase)return;
        if(!window.confirm('Выделить этот комментарий на 24 часа за 12 AniCoin? Появится пометка о платном выделении.'))return;
        button.disabled=true;
        const section=currentSection(scope);
        statusMessage(section,'Подтверждаем выделение на сервере…');
        try{
            const {data:{user},error:authError}=await _supabase.auth.getUser();
            if(authError||user?.id!==currentUser.authUserId)throw Error('Повторно войди в аккаунт.');
            const {error}=await _supabase.rpc('komi_shop_highlight',{p_comment_id:id});
            if(error)throw error;
            await refreshScope(scope,true);
            if(typeof window.komiShopReloadStore==='function')void window.komiShopReloadStore();
            if(currentSection(scope)===section)statusMessage(section,'Комментарий выделен на 24 часа.');
        }catch(error){
            button.disabled=false;
            if(currentSection(scope)===section)statusMessage(section,error?.message||'Выделение не удалось.');
        }
    }

    async function addComment(event, view) {
        event.preventDefault();
        const scope = view.scope;
        const section = currentSection(scope);
        if (!section || activeView !== view) return;
        if (typeof currentUser === 'undefined' || !currentUser?.authUserId || typeof _supabase === 'undefined' || !_supabase) {
            if (typeof openAuthModal === 'function') openAuthModal('login');
            statusMessage(section, 'Для комментариев войди через Google или email.');
            return;
        }
        const form = section.querySelector('.komi-comments-form');
        const field = form?.querySelector('textarea');
        const button = form?.querySelector('button[type="submit"]');
        const message = field?.value.trim() || '';
        if (!message || message.length > MAX_TEXT) {
            statusMessage(section, !message ? 'Напиши комментарий перед отправкой.' : 'Комментарий должен быть не длиннее 1000 символов.');
            field?.setAttribute('aria-invalid', 'true');
            field?.focus();
            return;
        }
        field?.removeAttribute('aria-invalid');
        const owner = currentUser.authUserId;
        const pendingKey = owner + ':' + scope.key;
        if (view.pending.has(pendingKey)) return;
        view.pending.add(pendingKey);
        button.disabled = true;
        statusMessage(section, 'Отправляем комментарий…');
        try {
            const { error } = await _supabase.from('komi_comments')
                .insert({ anime_id: scope.animeId, season: scope.season, episode_number: scope.episodeNumber,
                    user_id: owner, body: message });
            if (error) throw error;
            invalidateScope(scope);
            if (view.drafts.get(scope.key)?.trim() === message) view.drafts.delete(scope.key);
            if (currentSection(scope) === section && activeView === view && currentUser?.authUserId === owner) {
                if (field?.value.trim() === message) field.value = '';
                await refreshScope(scope, true);
                if (currentSection(scope) === section && activeView === view && currentUser?.authUserId === owner)
                    statusMessage(section, 'Комментарий опубликован.');
            }
        } catch (error) {
            if (currentSection(scope) !== section || activeView !== view || currentUser?.authUserId !== owner) return;
            if (error?.code === 'PT429') {
                statusMessage(section, error.message);
                return;
            }
            console.error('Komi comment post:', error);
            statusMessage(section, 'Не удалось отправить комментарий. Попробуй снова.');
        } finally {
            view.pending.delete(pendingKey);
            if (activeView === view) button.disabled = view.pending.has((currentUser?.authUserId || '') + ':' + view.scope.key);
        }
    }

    async function removeComment(scope, id, button) {
        if (!currentUser?.authUserId || !_supabase || !Number.isSafeInteger(Number(id))) return;
        button.disabled = true;
        const section = currentSection(scope);
        const owner = currentUser.authUserId;
        try {
            const { error } = await applyScope(_supabase.from('komi_comments')
                .delete().eq('id', Number(id)).eq('user_id', owner), scope);
            if (error) throw error;
            invalidateScope(scope);
            await refreshScope(scope, true);
        } catch {
            button.disabled = false;
            if (currentSection(scope) === section) statusMessage(section, 'Не удалось удалить комментарий.');
        }
    }

    function selectThread(view, scope) {
        if (activeView !== view) return;
        const { section } = view;
        const field = section.querySelector('.komi-comments-input');
        if (view.scope && field) view.drafts.set(view.scope.key, field.value);
        view.scope = scope;
        section.dataset.scopeKey = scope.key;
        const episode = scope.episodeNumber !== null;
        const label = section.querySelector('.komi-comments-episode-label');
        label.textContent = episode ? 'Сезон ' + scope.season + ', серия ' + scope.episodeNumber : 'Об аниме';
        label.hidden = !episode;
        const note = section.querySelector('.komi-comments-thread-note');
        note.textContent = 'Чтобы скрыть спойлер, заключи текст в ||двойные черты||.';
        for (const button of section.querySelectorAll('[data-comment-thread]'))
            button.setAttribute('aria-pressed', String(button.dataset.commentThread === (episode ? 'episode' : 'general')));
        if (field) {
            field.value = view.drafts.get(scope.key) || '';
            field.placeholder = episode ? 'Поделись впечатлениями о серии…' : 'Поделись впечатлениями об аниме…';
            field.removeAttribute('aria-invalid');
        }
        section.querySelector('button[type="submit"]').disabled = view.pending.has((currentUser?.authUserId || '') + ':' + scope.key);
        statusMessage(section, '');
        redraw(scope);
        void refreshScope(scope, false);
    }

    function mount(animeId, episode = {}) {
        const container = document.getElementById('watchModalContent');
        const scope = commentScope(animeId, episode);
        if (!container || !scope) return;
        container.querySelector('#komiAnimeComments')?.remove();
        const section = element('section', 'komi-comments');
        section.id = 'komiAnimeComments';
        section.dataset.animeId = String(scope.animeId);
        section.dataset.scopeKey = scope.key;
        section.dataset.playerScopeKey = scope.episodeNumber === null ? '' : scope.key;
        section.setAttribute('aria-labelledby', 'komiCommentsHeading');
        const view = { section, scope: null, drafts: new Map(), pending: new Set() };
        activeView = view;

        const heading = element('div', 'komi-comments-heading');
        heading.append(element('h2', '', 'Комментарии'));
        heading.querySelector('h2').id = 'komiCommentsHeading';
        heading.append(element('span', 'komi-comments-count', '0'));
        heading.append(element('span', 'komi-comments-episode-label'));
        section.append(heading);

        if (scope.episodeNumber !== null) {
            const threads = element('div', 'komi-comments-thread-switch');
            threads.setAttribute('role', 'group');
            threads.setAttribute('aria-label', 'Выбрать обсуждение');
            for (const [key, label, selected] of [
                ['episode', 'Серия ' + scope.episodeNumber, scope],
                ['general', 'Об аниме', commentScope(animeId)]
            ]) {
                const button = element('button', 'btn-secondary', label);
                button.type = 'button';
                button.dataset.commentThread = key;
                button.setAttribute('aria-pressed', 'false');
                button.addEventListener('click', () => selectThread(view, selected));
                threads.append(button);
            }
            section.append(threads);
        }
        const threadNote = element('p', 'komi-comments-thread-note');
        threadNote.id = 'komiCommentsThreadNote';
        section.append(threadNote);

        const form = element('form', 'komi-comments-form');
        form.noValidate = true;
        const input = element('textarea', 'komi-comments-input');
        input.name = 'body';
        input.maxLength = MAX_TEXT;
        input.rows = 3;
        input.style.resize = 'none';
        input.required = true;
        input.placeholder = 'Поделись впечатлениями… Спойлеры: ||скрытый текст||';
        input.setAttribute('aria-label', 'Текст комментария');
        input.setAttribute('aria-describedby', 'komiCommentsThreadNote komiCommentsStatus');
        input.addEventListener('input', () => {
            input.removeAttribute('aria-invalid');
            // Short comments stay compact; long drafts remain readable without
            // an unbounded textarea expanding the watch page.
            input.style.height = 'auto';
            input.style.height = Math.min(180, Math.max(44, input.scrollHeight)) + 'px';
        });
        const actions = element('div', 'komi-comments-actions');
        const note = element('small', '', currentUser?.authUserId ? 'Имя берётся из твоего профиля Komi.' : 'Для публикации нужен вход через Google или email.');
        const send = element('button', '', 'Отправить');
        send.type = 'submit';
        actions.append(note, send);
        form.append(input, actions);
        form.addEventListener('submit', event => void addComment(event, view));
        section.append(form);
        const status = element('p', 'komi-comments-status');
        status.id = 'komiCommentsStatus';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        section.append(status);
        section.append(element('div', 'komi-comments-list'));
        container.append(section);
        selectThread(view, scope);
        return section;
    }

    window.KomiComments = { mount, refresh };
})();
