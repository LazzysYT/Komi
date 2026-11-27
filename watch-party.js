let partyRoom;
let partyTimer;
let partyVisibilityListener = null;
let partyGeneration = 0;
let partyWrites = Promise.resolve();
let partyHeartbeat = 0;

async function partyCall(action, roomId = null, args = {}) {
    const { data, error } = await _supabase.rpc('komi_party', { action, room_id: roomId, args });
    if (error) throw error;
    return data;
}

function partyOptions(anime) {
    const options = (Array.isArray(anime?.episodes) ? anime.episodes : []).flatMap((episode, index) => {
        // Some catalog rows still have a plain episode.url rather than sources.
        const named = episode?.sources && typeof episode.sources === 'object' && !Array.isArray(episode.sources)
            ? Object.entries(episode.sources) : [];
        const entries = named.length ? named : [['Основной источник', episode?.url]];
        return entries.flatMap(([source, rawUrl]) => {
            const {kind, url} = KomiPlayerCore.source(rawUrl);
            if (!url) return [];
            // Legacy imports contain a fake "Kodik (Ожидает ссылки)" source
            // pointing to a public demo movie, not an episode of this anime.
            // Never show a stand-in as synchronized playable content.
            if (/ожидает\s*ссылк|заглушк|placeholder/iu.test(String(source)) ||
                /^https:\/\/(?:commondatastorage|storage)\.googleapis\.com\/gtv-videos-bucket\/sample\//i.test(url)) return [];
            const synchronized = kind === 'video' || kind === 'hls';
            return [{
                episode: index, source, url, synchronized,
                kind: synchronized ? 'video' : 'iframe',
                label: `Сезон ${Number(episode.season) || 1} · Серия ${Number(episode.number) || index + 1} · ${source} · ${synchronized ? 'Полная синхронизация' : 'Без общей паузы'}`
            }];
        });
    });
    // Prefer controllable HTML5/HLS playback in each episode, but keep all
    // existing iframe sources available instead of silently removing series.
    return options.sort((a, b) => a.episode - b.episode || Number(b.synchronized) - Number(a.synchronized));
}

function partySignedIn() {
    if (currentUser?.authUserId && _supabase) return true;
    openAuthModal('login', 'Войди в аккаунт Komi, чтобы смотреть аниме вместе и присоединяться к комнатам.');
    return false;
}

function partyPanel(html, isRoom = false) {
    const modal = document.getElementById('watchPartyModal');
    modal.classList.toggle('komi-party-room-active', isRoom);
    modal.classList.remove('komi-party-fullscreen');
    document.getElementById('watchPartyModalContent').innerHTML = html;
    modal.classList.add('active');
}

function toggleKomiPartyFullscreen() {
    const modal = document.getElementById('watchPartyModal');
    if (!modal?.classList.contains('komi-party-room-active')) return;
    const expanded = modal.classList.toggle('komi-party-fullscreen');
    const button = modal.querySelector('.komi-party-fullscreen-btn');
    if (button) {
        button.setAttribute('aria-pressed', String(expanded));
        button.setAttribute('aria-label', expanded ? 'Вернуться к окну с закруглёнными краями' : 'Развернуть просмотр на весь экран');
        const text = button.querySelector('span');
        if (text) text.textContent = expanded ? 'Обычное окно' : 'На весь экран';
    }
}

async function openWatchPartyHub() {
    if (!partySignedIn()) return;
    if (partyRoom) await leaveWatchPartyRoom();
    const generation = ++partyGeneration;
    try {
        const rooms = await partyCall('list');
        if (generation !== partyGeneration) return;
        const available = animeList.filter(anime => (anime.episodeCount || anime.episodes?.length || 0) > 0);
        partyPanel(`
            <button class="modal-close" data-komi-onclick="leaveWatchPartyRoom()">×</button>
            <h2>Совместный просмотр</h2>
            <form id="partyCreateForm">
                <label>Аниме <input id="partyAnimeSearch" type="search" placeholder="Найти аниме по названию" autocomplete="off" style="width:100%;min-height:44px;margin:8px 0"><select name="anime" required style="width:100%;min-height:44px">${available.map(anime =>
                    `<option value="${escapeFriendHtml(anime.id)}">${escapeFriendHtml(anime.title)}</option>`).join('')}</select></label>
                <label>Комната <input name="room" maxlength="100" placeholder="Совместный просмотр"></label>
                <label><input type="checkbox" name="private"> Только по приглашению</label>
                <p class="komi-party-sync-explanation">Полная синхронизация паузы и перемотки работает только с управляемыми MP4/HLS-потоками. Внешние плееры остаются доступными, но синхронизируют только серию и источник.</p>
                <button class="btn-glow" ${available.length ? '' : 'disabled'}>Создать комнату</button>
            </form>
            <h3>Доступные комнаты</h3>
            <div id="partyRoomList"></div>
            <button class="btn-secondary" data-komi-onclick="openWatchPartyHub()">Обновить список</button>
        `);
        const search = document.getElementById('partyAnimeSearch');
        const animeSelect = document.querySelector('#partyCreateForm select[name="anime"]');
        const allAnimeOptions = available.map(anime => ({id: String(anime.id), title: anime.title || 'Аниме'}));
        const updateAnimeChoices = () => {
            const term = search.value.trim().toLocaleLowerCase();
            const matching = allAnimeOptions.filter(item => item.title.toLocaleLowerCase().includes(term)).slice(0, 150);
            const previous = animeSelect.value;
            animeSelect.replaceChildren(...matching.map(item => new Option(item.title, item.id)));
            if (matching.some(item => item.id === previous)) animeSelect.value = previous;
        };
        search.addEventListener('input', updateAnimeChoices);
        updateAnimeChoices();
        const list = document.getElementById('partyRoomList');
        if (!rooms.length) list.textContent = 'Активных комнат пока нет.';
        for (const room of rooms) {
            const button = document.createElement('button');
            button.className = 'btn-secondary';
            button.textContent = room.name;
            button.onclick = () => joinWatchPartyRoom(room.id);
            list.append(button);
        }
        const createForm = document.getElementById('partyCreateForm');
        let creatingRoom = false;
        createForm.onsubmit = async event => {
            event.preventDefault();
            // Enter and requestSubmit() do not always provide a submitter.
            // Also block duplicate room creation while the RPC is in flight.
            if (creatingRoom) return;
            creatingRoom = true;
            const submitButton = event.submitter || createForm.querySelector('button[type="submit"], button:not([type])');
            if (submitButton) submitButton.disabled = true;
            try {
                const form = new FormData(createForm);
                await createWatchPartyFromAnime(form.get('anime'), form.get('room'), form.has('private'));
            } finally {
                creatingRoom = false;
                if (submitButton?.isConnected) submitButton.disabled = false;
            }
        };
    } catch (error) {
        if (generation === partyGeneration) alert('Не удалось загрузить комнаты: ' + error.message);
    }
}

async function createWatchPartyFromAnime(animeId, name = '', privateRoom = false, episodeIndex = null, source = '', startPosition = 0) {
    if (!partySignedIn()) return;
    const generation = ++partyGeneration;
    const selectedAnime = animeList.find(anime => String(anime.id) === String(animeId));
    if (!selectedAnime) { alert('Выберите аниме из списка.'); return; }
    try { await ensureKomiAnimeDetails(selectedAnime); }
    catch (error) { alert('Не удалось загрузить серии: ' + error.message); return; }
    if (generation !== partyGeneration) return;
    const options = partyOptions(selectedAnime);
    const episodeOptions = episodeIndex === null ? options : options.filter(item => item.episode === episodeIndex);
    const initial = episodeOptions.find(item => item.source === source) || episodeOptions[0];
    if (!initial) {
        alert('У этого аниме пока нет доступных источников для совместного просмотра.');
        return;
    }
    try {
        const room = await partyCall('create', null, {
            name: name.trim() || 'Совместный просмотр', animeId: String(animeId),
            private: privateRoom, episode: initial.episode, source: initial.source
        });
        // Transfer the exact paused position only when both viewers can control MP4/HLS.
        // Existing room-state RPC already enforces host ownership; no schema or RLS changes.
        const seconds = Number(startPosition);
        if (generation === partyGeneration && initial.synchronized && Number.isFinite(seconds) && seconds > 0) {
            const position = Math.max(0, Math.min(86400, seconds));
            try {
                await partyCall('state', room.id, {
                    episode: initial.episode, source: initial.source,
                    position, playing: false
                });
                room.position = position;
                room.playing = false;
                room.updated_at = new Date().toISOString();
            } catch (error) {
                // Never report that the seek was synchronized if the backend refused it.
                console.warn('Не удалось перенести момент просмотра в комнату:', error.message);
                alert('Комната создана, но позицию перенести не удалось. Просмотр начнётся с начала серии.');
            }
        }
        if (generation === partyGeneration) await enterParty(room);
        else await partyCall('close', room.id);
    } catch (error) { alert('Не удалось создать комнату: ' + error.message); }
}

async function joinWatchPartyRoom(id) {
    if (!partySignedIn()) return;
    const generation = ++partyGeneration;
    try {
        const room = await partyCall('read', id);
        if (generation === partyGeneration) await enterParty(room);
    } catch (error) { alert('Не удалось войти в комнату: ' + error.message); }
}

async function partyQueueCall(roomId, action, options={}) {
    const {data,error}=await _supabase.rpc('komi_party_queue',{
        p_room_id:roomId,p_action:action,
        p_episode:options.episode??null,p_source:options.source??null,
        p_entry_id:options.entryId??null
    });
    if(error)throw error;
    return data;
}
async function partyPresenceCall(roomId, action='touch') {
    const {data,error}=await _supabase.rpc('komi_party_presence',{p_room_id:roomId,p_action:action});
    if(error)throw error;
    return Array.isArray(data)?data:[];
}

async function enterParty(room) {
    const generation = partyGeneration;
    const isActive = () => partyGeneration === generation && partyRoom?.id === room.id;
    clearTimeout(partyTimer);
    if (partyVisibilityListener) {
        document.removeEventListener('visibilitychange', partyVisibilityListener);
        partyVisibilityListener = null;
    }
    partyRoom = room;
    partyHeartbeat = 0;
    closeWatchModal();
    const host = room.host === currentUser.authUserId;
    const anime = animeList.find(item => String(item.id) === String(room.anime_id));
    if (anime) {
        try { await ensureKomiAnimeDetails(anime); }
        catch (error) {
            // A stale details request must not close a newer room.
            if (!isActive()) return;
            await leaveWatchPartyRoom();
            alert('Не удалось загрузить серии для комнаты: ' + error.message);
            return;
        }
    }
    if (!isActive()) return;
    let initialMembers=[];
    try { initialMembers=await partyPresenceCall(room.id); }
    catch(error){
        if(!isActive())return;
        await leaveWatchPartyRoom();
        alert('Не удалось присоединиться: '+error.message);
        return;
    }
    if (!isActive()) return;
    const options = partyOptions(anime);

    partyPanel(`
        <div class="komi-party-shell">
            <div class="komi-party-room-header" role="group" aria-label="Информация о комнате">
                <div class="komi-party-room-identity">
                    <div class="komi-party-kicker">KOMI WATCH PARTY <span class="komi-party-role">${host ? 'ВЕДУЩИЙ' : 'ЗРИТЕЛЬ'}</span></div>
                    <h2>${escapeFriendHtml(room.name)}</h2>
                    <p>${escapeFriendHtml(anime?.title || 'Аниме')} · совместный просмотр</p>
                    <div id="partyParticipants" role="group" aria-label="Участники Watch Party"></div>
                </div>
                <div class="komi-party-head-actions">
                    <button class="komi-party-fullscreen-btn" type="button" data-komi-onclick="toggleKomiPartyFullscreen()" aria-pressed="false" aria-label="Развернуть просмотр на весь экран" title="На весь экран">⛶ <span>На весь экран</span></button>
                    <button class="modal-close" type="button" data-komi-onclick="leaveWatchPartyRoom()" aria-label="Закрыть комнату">×</button>
                </div>
            </div>
            <div class="komi-party-room-layout">
                <section class="komi-party-screen-panel" aria-label="Видеоплеер совместного просмотра">
                    <div class="komi-party-video-frame" id="partyPlayerFrame"><div class="komi-party-reactions-overlay" id="partyReactionsOverlay" aria-hidden="true"></div><video id="partyVideoElement" style="width:100%;height:100%" playsinline preload="metadata" ${host ? 'controls' : ''}></video><iframe id="partyEmbedElement" title="Внешний видеоплеер" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;border:0;display:none"></iframe></div>
                    <p id="partyEmbedHint" style="display:none">Внешний плеер: серия и источник меняются для всех участников. Play, паузой и перемоткой стороннего плеера каждый управляет самостоятельно.</p>
                    <p id="partyStatus" role="status"></p>
                    <p id="partySyncMode" class="komi-party-sync-notice" role="status" aria-live="polite"></p>
                    <div class="komi-party-source-panel">
                        ${host ? '<label for="partyEpisode">Серия и озвучка <select id="partyEpisode"></select></label>' : '<button id="partyUnlock" class="btn-secondary" hidden>Разрешить воспроизведение</button>'}
                    </div>
                    <section class="komi-party-queue-panel" aria-label="Очередь Watch Party" style="padding:10px;border:1px solid #ffffff33;border-radius:12px;margin:12px 0">
                        <h3 style="font-size:14px;margin:0 0 6px">Очередь серий</h3>
                        ${host ? '<button type="button" id="partyQueueAdd" class="btn-secondary">+ Добавить выбранную серию</button> <button type="button" id="partyQueueNext" class="btn-secondary">Следующая из очереди</button>' : ''}
                        <div id="partyQueueList" role="list" aria-live="polite"></div>
                    </section>
                </section>
                <section class="komi-party-social-panel" aria-label="Чат и реакции Watch Party">
                    <div class="komi-party-panel-heading"><h3>Чат комнаты</h3><small>Общайтесь во время просмотра</small></div>
                    <div id="partyChatBox" class="party-chat-box" role="log" aria-label="Сообщения в комнате"></div>
                    <form id="partyChat"><input name="message" maxlength="300" required placeholder="Написать сообщение…" aria-label="Новое сообщение"><button class="btn-secondary">Отправить</button></form>
                    <div>
                        <p class="komi-party-reaction-title">Быстрые реакции</p>
                        <div id="partyReactions"></div>
                        <div id="partyPaidReactions" aria-label="Приобретённые наборы реакций"></div>
                    </div>
                    ${host ? `<div class="komi-party-invites">
                        <h4>Пригласить друга</h4>
                        <p>Выбери друга из Komi или введи его ник. Приглашённый увидит комнату в разделе Watch Party.</p>
                        <div id="partyFriendsList" class="komi-party-friends-list" role="group" aria-label="Друзья для приглашения">Загружаем друзей…</div>
                        <form id="partyInvite"><input name="username" required maxlength="48" placeholder="Ник пользователя Komi" aria-label="Ник пользователя"><button class="btn-secondary">Пригласить</button></form>
                    </div>` : ''}
                </section>
            </div>
        </div>
    `, true);
    const video = document.getElementById('partyVideoElement');
    const embed = document.getElementById('partyEmbedElement');
    const embedHint = document.getElementById('partyEmbedHint');
    const status = document.getElementById('partyStatus');
    const syncMode = document.getElementById('partySyncMode');
    const unlock = document.getElementById('partyUnlock');
    const select = document.getElementById('partyEpisode');
    const chatBox = document.getElementById('partyChatBox');
    const chatForm = document.getElementById('partyChat');
    const memberList=document.getElementById('partyParticipants');
    const queueList=document.getElementById('partyQueueList');
    let lastQueueRefresh=0,lastPresenceRefresh=performance.now();
    let knownPartyMembers=new Set(),partyMembersInitialized=false;
    function animatePartyArrivals(members){
        const current=new Set(members.map(m=>String(m.id||'')).filter(Boolean));
        const arriving=members.filter(m=>m.id&&!knownPartyMembers.has(String(m.id))&&(partyMembersInitialized||String(m.id)===currentUser?.authUserId));
        knownPartyMembers=current;partyMembersInitialized=true;
        if(!arriving.length||document.hidden||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
        Promise.resolve().then(()=>_supabase.from('komi_premium_cosmetic_equips').select('user_id,party_id').in('user_id',arriving.map(m=>m.id).slice(0,20))).then(({data,error})=>{
            if(error||!isActive()||document.hidden)return;
            for(const e of (data||[]).slice(0,4)){const p=window.KomiShopCatalog?.find(e.party_id),m=arriving.find(m=>String(m.id)===String(e.user_id));
                if(!p||p.type!=='party'||!m||!knownPartyMembers.has(String(m.id)))continue;
                const token=document.createElement('span');token.className='komi-party-arrival komi-fx-'+p.cosmeticClass;token.textContent=p.symbol+' '+String(m.displayName||m.username||'Участник').slice(0,45)+' вошёл';memberList.append(token);setTimeout(()=>token.remove(),2200);}
        }).catch(()=>{});
    }
    function showMembers(members){
        if(!isActive()||!memberList)return;
        const count=Array.isArray(members)?members.length:0;
        const cap=Number(room.max_participants)||0;
        memberList.replaceChildren();
        const caption=document.createElement('small');
        caption.textContent='Участники: '+count+(cap?' / '+cap:'');
        memberList.append(caption);
        for(const member of (Array.isArray(members)?members:[]).slice(0,20)){
            const label=document.createElement('span');
            label.className='komi-party-member';
            label.style.cssText='display:inline-block;margin:3px 5px;padding:3px 7px;border:1px solid #ffffff33;border-radius:9px;font-size:11px';
            label.textContent=String(member.displayName||member.username||'Участник').slice(0,60)+(member.host?' ★':'');
            memberList.append(label);
        }
        animatePartyArrivals(Array.isArray(members)?members:[]);
    }
    showMembers(initialMembers);
    async function refreshQueue(){
        if(!isActive())return;
        const data=await partyQueueCall(room.id,'read');
        if(!isActive()||!queueList)return;
        queueList.replaceChildren();
        const items=Array.isArray(data?.items)?data.items:[];
        if(!items.length){const empty=document.createElement('small');empty.textContent='Очередь пуста';queueList.append(empty);}
        for(const item of items.slice(0,30)){
            const row=document.createElement('div');
            row.setAttribute('role','listitem');
            row.style.cssText='display:flex;align-items:center;gap:8px;margin-top:6px';
            const label=document.createElement('span');
            label.textContent='Серия '+(Number(item.episode)+1)+' · '+String(item.source||'').slice(0,120);
            row.append(label);
            if(host){
                const remove=document.createElement('button');
                remove.type='button';remove.className='btn-secondary';remove.textContent='× Убрать';
                remove.addEventListener('click',async()=>{
                    try{await partyQueueCall(room.id,'remove',{entryId:Number(item.id)});await refreshQueue();}
                    catch(error){status.textContent='Очередь: '+error.message;}
                });
                row.append(remove);
            }
            queueList.append(row);
        }
        lastQueueRefresh=performance.now();
    }
    if(host){
        document.getElementById('partyQueueAdd')?.addEventListener('click',async()=>{
            const selected=options[Number(select?.value)];
            if(!selected)return;
            try{await partyQueueCall(room.id,'add',{episode:selected.episode,source:selected.source});await refreshQueue();}
            catch(error){status.textContent='Очередь: '+error.message;}
        });
        document.getElementById('partyQueueNext')?.addEventListener('click',async()=>{
            try{
                await partyQueueCall(room.id,'next');
                const state=await partyCall('read',room.id);
                if(isActive()){partyRoom=state;applyState(state);await refreshQueue();}
            }catch(error){status.textContent='Очередь: '+error.message;}
        });
    }
    void refreshQueue().catch(error=>{if(isActive())status.textContent='Очередь: '+error.message;});
    let lastMessages = '';
    const seenReactionEvents=new Set((room.messages||[]).filter(m=>m?.kind==='reaction').map(m=>m.event_id).filter(Boolean));
    const reactionsOverlay=document.getElementById('partyReactionsOverlay');
    function animateReaction(message){
        if(!isActive()||!reactionsOverlay||document.hidden)return;
        const token=document.createElement('span');
        token.className='komi-party-reaction-float';
        token.textContent=String(message.text||'✨').slice(0,3);
        token.style.left=(15+Math.random()*70)+'%';
        reactionsOverlay.append(token);
        setTimeout(()=>token.remove(),1800);
    }
    function showMessages(messages = []) {
        const serialized = JSON.stringify(messages);
        if (serialized === lastMessages) return;
        lastMessages = serialized;
        for(const message of messages){
            if(message?.kind!=='reaction'||!message.event_id||seenReactionEvents.has(message.event_id))continue;
            seenReactionEvents.add(message.event_id);
            animateReaction(message);
        }
        if(seenReactionEvents.size>150){
            const recent=messages.filter(m=>m?.kind==='reaction').map(m=>m.event_id).filter(Boolean);
            seenReactionEvents.clear();for(const id of recent)seenReactionEvents.add(id);
        }
        chatBox.replaceChildren(...messages.map(message => {
            const line = document.createElement('div');
            line.textContent = message.author + ': ' + message.text;
            return line;
        }));
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    async function postMessage(message) {
        try {
            const updated = await partyCall('chat', room.id, { message });
            showMessages(updated.messages);
            return true;
        } catch (error) {
            status.textContent = 'Чат: ' + error.message;
            return false;
        }
    }
    chatForm.onsubmit = async event => {
        event.preventDefault();
        const field = chatForm.elements.message;
        const message = field.value.trim();
        if (message && await postMessage(message) && field.value.trim() === message) field.value = '';
    };
    for (const reaction of ['🔥 Класс', '❤️ Нравится', '😂 Смешно', '😮 Удивило', '👏 Отлично']) {
        const button = document.createElement('button');
        button.className = 'party-react-btn';
        button.textContent = reaction;
        button.onclick = () => postMessage(reaction);
        document.getElementById('partyReactions').append(button);
    }
    const paidContainer=document.getElementById('partyPaidReactions');
    async function loadPaidReactions(){
        if(!paidContainer||!_supabase)return;
        const uid=currentUser?.authUserId;
        const {data,error}=await _supabase.rpc('komi_premium_store',{p_action:'read',p_item:null});
        if(error||!isActive()||currentUser?.authUserId!==uid)return;
        const owned=new Set(data?.owned||[]);
        const packs=(window.KomiShopCatalog?.items||[]).filter(item=>item.type==='reaction'&&(owned.has(item.id)||window.KomiShopCatalog?.isOnSale?.(item.id)));
        paidContainer.replaceChildren();
        const heading=document.createElement('p');
        heading.className='komi-party-reaction-title';
        heading.textContent='Наборы реакций AniCoin';
        paidContainer.append(heading);
        for(const pack of packs){
            const row=document.createElement('div');row.className='komi-party-paid-pack';
            const text=document.createElement('small');
            text.textContent=pack.label+(owned.has(pack.id)?' · куплено':' · в магазине AniCoin');
            row.append(text);
            for(const reaction of pack.reactions){
                const button=document.createElement('button');
                button.type='button';button.className='party-react-btn komi-party-paid-reaction';
                button.textContent=reaction.emoji+' '+reaction.label;
                button.disabled=!owned.has(pack.id);
                button.title=owned.has(pack.id)?'Отправить реакцию всем участникам':'Сначала приобрети набор в магазине AniCoin';
                button.addEventListener('click',async()=>{
                    if(!isActive()||button.disabled)return;
                    button.disabled=true;
                    try{
                        const response=await _supabase.rpc('komi_shop_reaction',{p_room:room.id,p_reaction:reaction.id});
                        if(response.error)throw response.error;
                        if(isActive())showMessages(response.data?.messages||[]);
                    }catch(error){if(isActive())status.textContent='Реакция: '+(error?.message||'Недоступна');}
                    finally{if(isActive())button.disabled=false;}
                });
                row.append(button);
            }
            paidContainer.append(row);
        }
    }
    void loadPaidReactions();
    showMessages(room.messages || []);
    let loadedOption;
    let sampleAt = performance.now();
    let sampling = false;
    let switchingSource = false;
    let latestState = room;

    function applyState(state) {
        latestState = state;
        const option = options.find(item => item.episode === state.episode && item.source === state.source);
        if (!option) {
            status.textContent = 'Этот источник отсутствует в вашем каталоге.';
            disposeKomiMedia(video);
            embed.removeAttribute('src');
            loadedOption = null;
            syncMode.dataset.mode = 'missing';
            syncMode.textContent = 'Источник недоступен: синхронизация этой серии невозможна.';
            return;
        }
        syncMode.dataset.mode = option.synchronized ? 'full' : 'limited';
        syncMode.textContent = option.synchronized
            ? 'Полная синхронизация: воспроизведение, пауза, перемотка и серия (MP4/HLS).'
            : 'Ограниченная синхронизация: только серия и озвучка. Пауза и перемотка внешнего плеера не синхронизируются.';
        if (loadedOption !== option) {
            switchingSource = true;
            loadedOption = option;
            const external = option.kind === 'iframe';
            video.pause();
            video.style.display = external ? 'none' : 'block';
            embed.style.display = external ? 'block' : 'none';
            embedHint.style.display = external ? 'block' : 'none';
            if (external) {
                disposeKomiMedia(video);
                embed.src = option.url;
            } else {
                embed.removeAttribute('src');
                attachKomiMedia(video, option.url, () => { status.textContent = 'Не удалось загрузить видео. Выберите другой источник.'; });
            }
            if (external) switchingSource = false;
        }
        if (option.kind === 'iframe') {
            if (unlock) unlock.hidden = true;
            if (select) select.value = String(options.indexOf(option));
            return;
        }
        if (select) select.value = String(options.indexOf(option));
        if (host || video.readyState < 1) return;
        const elapsed = state.playing ? Math.max(0, Date.parse(state.server_now) - Date.parse(state.changed_at) + performance.now() - sampleAt) / 1000 : 0;
        const desired = Math.min(video.duration || Infinity, Number(state.position) + elapsed);
        // Ignore network jitter during playback; correct only meaningful drift.
        // Paused rooms use a slightly tighter bound for repeatable seeks.
        if (Number.isFinite(desired) && Math.abs(video.currentTime - desired) > (state.playing ? 1.75 : 0.5))
            video.currentTime = desired;
        if (!state.playing) {
            video.pause();
            unlock.hidden = true;
        } else if (video.paused) {
            video.play().then(() => { unlock.hidden = true; }).catch(() => { unlock.hidden = false; });
        }
    }

    const writer = KomiPlayerCore.createWriter(async ({option, position, playing, sampledAt}) => {
            if (!isActive()) return;
            const elapsed = playing ? (performance.now() - sampledAt) / 1000 : 0;
            await partyCall('state', room.id, { episode: option.episode, source: option.source, position: position + elapsed, playing });
            status.textContent = '';
        }, error => { if (isActive()) status.textContent = 'Синхронизация: ' + error.message; });
    function publish(option, position, playing) {
        partyWrites = writer.enqueue(room.id, {option, position, playing, sampledAt: performance.now()});
    }

    async function poll() {
        if (!isActive() || sampling) return;
        sampling = true;
        try {
            const heartbeat = host && (!partyHeartbeat || performance.now() - partyHeartbeat > 15000);
            if (heartbeat && loadedOption?.kind === 'video' && !switchingSource && video.readyState >= 1) {
                publish(loadedOption, video.currentTime, !video.paused && !video.ended && video.readyState >= 3);
                await partyWrites;
            }
            const requestAt = performance.now();
            const state = await partyCall(heartbeat ? 'heartbeat' : 'read', room.id);
            if (!isActive()) return;
            status.textContent = '';
            showMessages(state.messages);
            if (!host) {
                partyRoom = state;
                sampleAt = (requestAt + performance.now()) / 2;
                applyState(state);
            }
            if (heartbeat) partyHeartbeat = performance.now();
            if (performance.now()-lastPresenceRefresh>12000) {
                const members=await partyPresenceCall(room.id);
                if(isActive())showMembers(members);
                lastPresenceRefresh=performance.now();
            }
            if (performance.now()-lastQueueRefresh>12000) {
                try{await refreshQueue();}catch(error){
                    if(isActive())console.warn('Komi Party queue:',error?.message||String(error));
                }
            }
        } catch (error) {
            status.textContent = 'Связь с комнатой: ' + error.message;
            if (!host && loadedOption?.kind !== 'iframe') video.pause();
        } finally {
            sampling = false;
            if (isActive()) partyTimer = setTimeout(poll, host ? 3000 : 900);
        }
    }

    video.onerror = () => { status.textContent = 'Не удалось загрузить видео.'; };
    if (host) {
        for (const [index, option] of options.entries()) select.add(new Option(option.label, index));
        select.onchange = () => {
            const option = options[Number(select.value)];
            if (!option) return;
            applyState({episode: option.episode, source: option.source, playing: false, position: 0});
            publish(option, 0, false);
        };
        for (const event of ['playing', 'pause', 'seeked', 'waiting', 'ended']) {
            video.addEventListener(event, () => {
                if (!isActive() || switchingSource || loadedOption?.kind !== 'video' || video.readyState < 1) return;
                publish(loadedOption, video.currentTime, !video.paused && !video.ended && event !== 'waiting' && video.readyState >= 3);
            });
        }
        video.onloadedmetadata = () => {
            switchingSource = false;
            if (loadedOption) {
                if (latestState.position > 0) video.currentTime = Math.min(latestState.position, video.duration || Infinity);
                publish(loadedOption, video.currentTime, false);
            }
        };
        const friendList = document.getElementById('partyFriendsList');
        if (friendList && currentUser?.authUserId) {
            // Only confirmed Supabase friendships; legacy local friend names are not trusted.
            (async () => {
                const owner = currentUser.authUserId;
                try {
                    const {data:links,error:linkError} = await _supabase.from('komi_friendships')
                        .select('user_a,user_b');
                    if (linkError) throw linkError;
                    const ids = [...new Set((links || [])
                        .filter(link => link.user_a === owner || link.user_b === owner)
                        .map(link => link.user_a === owner ? link.user_b : link.user_a))];
                    const response = ids.length
                        ? await _supabase.from('komi_profiles').select('user_id,username,display_name,avatar_url').in('user_id',ids)
                        : {data:[],error:null};
                    if (response.error) throw response.error;
                    if (!isActive() || owner !== currentUser?.authUserId || !friendList.isConnected) return;
                    friendList.replaceChildren();
                    if (!response.data?.length) {
                        friendList.textContent = 'Пока нет подтверждённых друзей. Можно пригласить по нику ниже.';
                    }
                    for (const profile of response.data || []) {
                        if (!profile.username) continue;
                        const row = document.createElement('div');
                        row.className = 'komi-party-friend-row';
                        const avatar = document.createElement('span');
                        avatar.className = 'komi-party-friend-avatar';
                        if (profile.avatar_url && /^https:\/\//i.test(profile.avatar_url)) {
                            const image = document.createElement('img');
                            image.alt = '';
                            image.loading = 'lazy';
                            image.src = profile.avatar_url;
                            avatar.append(image);
                        } else avatar.textContent = (profile.display_name || profile.username).charAt(0).toUpperCase();
                        const identity = document.createElement('div');
                        identity.className = 'komi-party-friend-identity';
                        const name = document.createElement('strong');
                        name.textContent = profile.display_name?.trim() || profile.username;
                        const username = document.createElement('small');
                        username.textContent = '@' + profile.username;
                        identity.append(name,username);
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.className = 'komi-party-friend-invite';
                        button.textContent = 'Пригласить';
                        button.addEventListener('click', async () => {
                            if (!isActive() || button.disabled) return;
                            button.disabled = true;
                            try {
                                await partyCall('invite', room.id, {username:profile.username});
                                if (!isActive()) return;
                                button.textContent = 'Приглашён';
                                status.textContent = 'Приглашение для ' + (profile.display_name || profile.username) + ' создано.';
                            } catch (error) {
                                button.disabled = false;
                                status.textContent = 'Приглашение: ' + error.message;
                            }
                        });
                        row.append(avatar,identity,button);
                        friendList.append(row);
                    }
                } catch (error) {
                    if (isActive() && friendList.isConnected) friendList.textContent = 'Не удалось загрузить друзей: ' + error.message;
                }
            })();
        }
        const invite = document.getElementById('partyInvite');
        if (invite) invite.onsubmit = async event => {
            event.preventDefault();
            try {
                await partyCall('invite', room.id, { username: invite.elements.username.value.trim() });
                status.textContent = 'Приглашение отправлено. Друг увидит комнату в разделе Watch Party.';
                invite.reset();
            } catch (error) { status.textContent = error.message; }
        };
    } else {
        video.onloadedmetadata = () => { switchingSource = false; if (isActive()) applyState(partyRoom); };
        unlock.onclick = () => { if (isActive()) applyState(partyRoom); };
    }
    applyState(room);
    // Background tabs are throttled by browsers: refetch the authoritative room
    // immediately when the viewer returns, instead of waiting for the next timer.
    partyVisibilityListener = () => {
        if (document.hidden || !isActive() || sampling) return;
        clearTimeout(partyTimer);
        void poll();
    };
    document.addEventListener('visibilitychange', partyVisibilityListener);
    poll();
}

function leaveWatchPartyRoom() {
    ++partyGeneration;
    clearTimeout(partyTimer);
    if (partyVisibilityListener) {
        document.removeEventListener('visibilitychange', partyVisibilityListener);
        partyVisibilityListener = null;
    }
    const room = partyRoom;
    if(room?.id && _supabase) void partyPresenceCall(room.id,'leave').catch(()=>{});
    const embed = document.getElementById('partyEmbedElement');
    if (embed) embed.removeAttribute('src');
    partyRoom = null;
    disposeKomiMedia(document.getElementById('partyVideoElement'));
    document.getElementById('watchPartyModalContent').replaceChildren();
    document.getElementById('watchPartyModal').classList.remove('active', 'komi-party-room-active', 'komi-party-fullscreen');
    return room?.host === currentUser?.authUserId && room
        ? partyCall('close', room.id).catch(error => console.warn('Закрытие комнаты:', error.message))
        : Promise.resolve();
}

function closeWatchPartyModal() { return leaveWatchPartyRoom(); }
