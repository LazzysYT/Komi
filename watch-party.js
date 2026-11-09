let partyRoom;
let partyTimer;
let partyGeneration = 0;
let partyWrites = Promise.resolve();
let partyHeartbeat = 0;

async function partyCall(action, roomId = null, args = {}) {
    const { data, error } = await _supabase.rpc('komi_party', { action, room_id: roomId, args });
    if (error) throw error;
    return data;
}

function partyOptions(anime) {
    return (Array.isArray(anime?.episodes) ? anime.episodes : []).flatMap((episode, index) =>
        Object.entries(episode?.sources || { Default: episode?.url }).flatMap(([source, rawUrl]) => {
            const {kind, url: safe} = KomiPlayerCore.source(rawUrl);
            if (!safe) return [];
            return [{
                episode: index, source, url: safe,
                kind: ['video','hls'].includes(kind) ? 'video' : 'iframe',
                label: `Сезон ${Number(episode.season) || 1} · Серия ${Number(episode.number) || index + 1} · ${source}`
            }];
        })
    );
}

function partySignedIn() {
    if (currentUser?.authUserId && _supabase) return true;
    alert('Для совместного просмотра войдите в аккаунт Komi.');
    openAuthModal('login');
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
            <button class="modal-close" onclick="leaveWatchPartyRoom()">×</button>
            <h2>Совместный просмотр</h2>
            <form id="partyCreateForm">
                <label>Аниме <input id="partyAnimeSearch" type="search" placeholder="Найти аниме по названию" autocomplete="off" style="width:100%;min-height:44px;margin:8px 0"><select name="anime" required style="width:100%;min-height:44px">${available.map(anime =>
                    `<option value="${escapeFriendHtml(anime.id)}">${escapeFriendHtml(anime.title)}</option>`).join('')}</select></label>
                <label>Комната <input name="room" maxlength="100" placeholder="Совместный просмотр"></label>
                <label><input type="checkbox" name="private"> Только по приглашению</label>
                <button class="btn-glow" ${available.length ? '' : 'disabled'}>Создать комнату</button>
            </form>
            <h3>Доступные комнаты</h3>
            <div id="partyRoomList"></div>
            <button class="btn-secondary" onclick="openWatchPartyHub()">Обновить список</button>
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
        document.getElementById('partyCreateForm').onsubmit = async event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            event.submitter.disabled = true;
            try { await createWatchPartyFromAnime(form.get('anime'), form.get('room'), form.has('private')); }
            finally { event.submitter.disabled = false; }
        };
    } catch (error) {
        if (generation === partyGeneration) alert('Не удалось загрузить комнаты: ' + error.message);
    }
}

async function createWatchPartyFromAnime(animeId, name = '', privateRoom = false, episodeIndex = null, source = '') {
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

async function enterParty(room) {
    const generation = partyGeneration;
    const isActive = () => partyGeneration === generation && partyRoom?.id === room.id;
    clearTimeout(partyTimer);
    partyRoom = room;
    partyHeartbeat = 0;
    closeWatchModal();
    const host = room.host === currentUser.authUserId;
    const anime = animeList.find(item => String(item.id) === String(room.anime_id));
    if (anime) {
        try { await ensureKomiAnimeDetails(anime); }
        catch (error) { alert('Не удалось загрузить серии для комнаты: ' + error.message); return; }
    }
    if (generation !== partyGeneration) return;
    const options = partyOptions(anime);

    partyPanel(`
        <div class="komi-party-shell">
            <div class="komi-party-room-header" role="group" aria-label="Информация о комнате">
                <div class="komi-party-room-identity">
                    <div class="komi-party-kicker">KOMI WATCH PARTY <span class="komi-party-role">${host ? 'ВЕДУЩИЙ' : 'ЗРИТЕЛЬ'}</span></div>
                    <h2>${escapeFriendHtml(room.name)}</h2>
                    <p>${escapeFriendHtml(anime?.title || 'Аниме')} · совместный просмотр</p>
                </div>
                <div class="komi-party-head-actions">
                    <button class="komi-party-fullscreen-btn" type="button" onclick="toggleKomiPartyFullscreen()" aria-pressed="false" aria-label="Развернуть просмотр на весь экран" title="На весь экран">⛶ <span>На весь экран</span></button>
                    <button class="modal-close" type="button" onclick="leaveWatchPartyRoom()" aria-label="Закрыть комнату">×</button>
                </div>
            </div>
            <div class="komi-party-room-layout">
                <section class="komi-party-screen-panel" aria-label="Видеоплеер совместного просмотра">
                    <div class="komi-party-video-frame" id="partyPlayerFrame"><video id="partyVideoElement" style="width:100%;height:100%" playsinline preload="metadata" ${host ? 'controls' : ''}></video><iframe id="partyEmbedElement" title="Внешний видеоплеер" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;border:0;display:none"></iframe></div>
                    <p id="partyEmbedHint" style="display:none">Внешний плеер: серия и источник меняются для всех участников. Play, паузой и перемоткой стороннего плеера каждый управляет самостоятельно.</p>
                    <p id="partyStatus" role="status"></p>
                    <div class="komi-party-source-panel">
                        ${host ? '<label for="partyEpisode">Серия и озвучка <select id="partyEpisode"></select></label>' : '<button id="partyUnlock" class="btn-secondary" hidden>Разрешить воспроизведение</button>'}
                    </div>
                </section>
                <section class="komi-party-social-panel" aria-label="Чат и реакции Watch Party">
                    <div class="komi-party-panel-heading"><h3>Чат комнаты</h3><small>Общайтесь во время просмотра</small></div>
                    <div id="partyChatBox" class="party-chat-box" role="log" aria-label="Сообщения в комнате"></div>
                    <form id="partyChat"><input name="message" maxlength="300" required placeholder="Написать сообщение…" aria-label="Новое сообщение"><button class="btn-secondary">Отправить</button></form>
                    <div>
                        <p class="komi-party-reaction-title">Быстрые реакции</p>
                        <div id="partyReactions"></div>
                    </div>
                    ${host && room.private ? '<form id="partyInvite"><input name="username" required placeholder="Ник для приглашения" aria-label="Ник пользователя"><button class="btn-secondary">Пригласить</button></form>' : ''}
                </section>
            </div>
        </div>
    `, true);
    const video = document.getElementById('partyVideoElement');
    const embed = document.getElementById('partyEmbedElement');
    const embedHint = document.getElementById('partyEmbedHint');
    const status = document.getElementById('partyStatus');
    const unlock = document.getElementById('partyUnlock');
    const select = document.getElementById('partyEpisode');
    const chatBox = document.getElementById('partyChatBox');
    const chatForm = document.getElementById('partyChat');
    let lastMessages = '';
    function showMessages(messages = []) {
        const serialized = JSON.stringify(messages);
        if (serialized === lastMessages) return;
        lastMessages = serialized;
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
    for (const reaction of ['Класс', 'Нравится', 'Смешно', 'Удивило', 'Отлично']) {
        const button = document.createElement('button');
        button.className = 'party-react-btn';
        button.textContent = reaction;
        button.onclick = () => postMessage(reaction);
        document.getElementById('partyReactions').append(button);
    }
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
            return;
        }
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
        if (Math.abs(video.currentTime - desired) > (state.playing ? 0.7 : 0.12)) video.currentTime = desired;
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
        const invite = document.getElementById('partyInvite');
        if (invite) invite.onsubmit = async event => {
            event.preventDefault();
            try {
                await partyCall('invite', room.id, { username: invite.elements.username.value.trim() });
                status.textContent = 'Приглашение выдано. Комната появится у пользователя в списке.';
                invite.reset();
            } catch (error) { status.textContent = error.message; }
        };
    } else {
        video.onloadedmetadata = () => { switchingSource = false; if (isActive()) applyState(partyRoom); };
        unlock.onclick = () => { if (isActive()) applyState(partyRoom); };
    }
    applyState(room);
    poll();
}

function leaveWatchPartyRoom() {
    ++partyGeneration;
    clearTimeout(partyTimer);
    const room = partyRoom;
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
