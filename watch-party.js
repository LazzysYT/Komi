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
    return (anime?.episodes || []).flatMap((episode, index) =>
        Object.entries(episode.sources || { Default: episode.url }).flatMap(([source, rawUrl]) => {
            const kind = komiPlayerKind(rawUrl);
            if (!['video', 'embed', 'iframe'].includes(kind)) return [];
            let url = rawUrl;
            if (kind === 'iframe') {
                const match = String(rawUrl).match(/src\\s*=\\s*["']([^"']+)["']/i);
                url = match?.[1] || '';
            }
            const safe = komiSafeUrl(url);
            if (!safe) return [];
            return [{
                episode: index, source, url: safe,
                kind: kind === 'video' ? 'video' : 'iframe',
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

function partyPanel(html) {
    document.getElementById('watchPartyModalContent').innerHTML = html;
    document.getElementById('watchPartyModal').classList.add('active');
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
    const selectedAnime = animeList.find(anime => String(anime.id) === String(animeId));
    if (!selectedAnime) { alert('Выберите аниме из списка.'); return; }
    try { await ensureKomiAnimeDetails(selectedAnime); }
    catch (error) { alert('Не удалось загрузить серии: ' + error.message); return; }
    const options = partyOptions(selectedAnime);
    const episodeOptions = episodeIndex === null ? options : options.filter(item => item.episode === episodeIndex);
    const initial = episodeOptions.find(item => item.source === source) || episodeOptions[0];
    if (!initial) {
        alert('У этого аниме пока нет доступных источников для совместного просмотра.');
        return;
    }
    const generation = ++partyGeneration;
    try {
        const room = await partyCall('create', null, {
            name: name.trim() || 'Совместный просмотр', animeId: String(animeId),
            private: privateRoom, episode: initial.episode, source: initial.source
        });
        if (generation === partyGeneration) await enterParty(room);
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
    const anime = animeList.find(item => String(item.id) === room.anime_id);
    if (anime) {
        try { await ensureKomiAnimeDetails(anime); }
        catch (error) { alert('Не удалось загрузить серии для комнаты: ' + error.message); return; }
    }
    if (generation !== partyGeneration) return;
    const options = partyOptions(anime);
    partyPanel(`
        <button class="modal-close" onclick="leaveWatchPartyRoom()">×</button>
        <h2>${escapeFriendHtml(room.name)}</h2>
        <p>${escapeFriendHtml(anime?.title || 'Аниме')} · ${host ? 'Ведущий' : 'Зритель'}</p>
        <div id="partyPlayerFrame" style="width:100%;aspect-ratio:16/9;max-height:65vh;background:#08080b;border-radius:16px;overflow:hidden"><video id="partyVideoElement" style="width:100%;height:100%" playsinline preload="metadata" ${host ? 'controls' : ''}></video><iframe id="partyEmbedElement" title="Внешний видеоплеер" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;border:0;display:none"></iframe></div>
        <p id="partyEmbedHint" style="display:none;color:#bfb2bb;font-size:13px">Внешний плеер: выбор серии синхронизируется для всех. Управление Play, паузой и перемоткой внутри стороннего плеера не передаётся сайту — каждый участник управляет им самостоятельно.</p>
        <p id="partyStatus" role="status"></p>
        <div id="partyChatBox" class="party-chat-box" role="log"></div>
        <form id="partyChat"><input name="message" maxlength="300" required placeholder="Сообщение"><button class="btn-secondary">Отправить</button></form>
        <div id="partyReactions"></div>
        ${host ? '<label>Серия и источник <select id="partyEpisode"></select></label>' : '<button id="partyUnlock" class="btn-secondary" hidden>Разрешить воспроизведение</button>'}
        ${host && room.private ? '<form id="partyInvite"><input name="username" required placeholder="Имя пользователя"><button class="btn-secondary">Пригласить</button></form>' : ''}
    `);
    const video = document.getElementById('partyVideoElement');
    const embed = document.getElementById('partyEmbedElement');
    const embedHint = document.getElementById('partyEmbedHint');
    const status = document.getElementById('partyStatus');
    const unlock = document.getElementById('partyUnlock');
    const select = document.getElementById('partyEpisode');
    const chatBox = document.getElementById('partyChatBox');
    const chatForm = document.getElementById('partyChat');
    let lastMessages = '';
    function showMessages(messages) {
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

    function applyState(state) {
        const option = options.find(item => item.episode === state.episode && item.source === state.source);
        if (!option) {
            status.textContent = 'Этот источник отсутствует в вашем каталоге.';
            video.pause();
            video.removeAttribute('src');
            video.load();
            embed.removeAttribute('src');
            loadedOption = null;
            return;
        }
        if (loadedOption !== option) {
            loadedOption = option;
            const external = option.kind === 'iframe';
            video.pause();
            video.style.display = external ? 'none' : 'block';
            embed.style.display = external ? 'block' : 'none';
            embedHint.style.display = external ? 'block' : 'none';
            if (external) {
                video.removeAttribute('src');
                video.load();
                embed.src = option.url;
            } else {
                embed.removeAttribute('src');
                video.src = option.url;
            }
        }
        if (option.kind === 'iframe') {
            if (select) select.value = String(options.indexOf(option));
            return;
        }
        if (select) select.value = String(options.indexOf(option));
        if (host || video.readyState < 1) return;
        const elapsed = state.playing ? Math.max(0, Date.parse(state.server_now) - Date.parse(state.changed_at) + performance.now() - sampleAt) / 1000 : 0;
        const desired = Math.min(video.duration || Infinity, state.position + elapsed);
        if (Math.abs(video.currentTime - desired) > (state.playing ? 0.7 : 0.12)) video.currentTime = desired;
        if (!state.playing) {
            video.pause();
            unlock.hidden = true;
        } else if (video.paused) {
            video.play().then(() => { unlock.hidden = true; }).catch(() => { unlock.hidden = false; });
        }
    }

    function publish(option, position, playing) {
        partyWrites = partyWrites.catch(() => {}).then(async () => {
            if (!isActive()) return;
            await partyCall('state', room.id, { episode: option.episode, source: option.source, position, playing });
            status.textContent = '';
        }).catch(error => { status.textContent = 'Синхронизация: ' + error.message; });
    }

    async function poll() {
        if (!isActive() || sampling) return;
        sampling = true;
        try {
            const heartbeat = host && (!partyHeartbeat || performance.now() - partyHeartbeat > 15000);
            const state = await partyCall(heartbeat ? 'heartbeat' : 'read', room.id);
            if (!isActive()) return;
            showMessages(state.messages);
            if (!host) {
                partyRoom = state;
                sampleAt = performance.now();
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
                if (!loadedOption || video.readyState < 1) return;
                publish(loadedOption, video.currentTime, !video.paused && !video.ended && event !== 'waiting' && video.readyState >= 3);
            });
        }
        video.onloadedmetadata = () => {
            if (loadedOption?.episode === room.episode && loadedOption?.source === room.source && room.position > 0) {
                video.currentTime = Math.min(room.position, video.duration || Infinity);
                publish(loadedOption, video.currentTime, false);
            }
            video.onloadedmetadata = null;
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
        video.onloadedmetadata = () => { if (isActive()) applyState(partyRoom); };
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
    document.getElementById('watchPartyModalContent').replaceChildren();
    document.getElementById('watchPartyModal').classList.remove('active');
    return room?.host === currentUser?.authUserId && room
        ? partyCall('close', room.id).catch(error => console.warn('Закрытие комнаты:', error.message))
        : Promise.resolve();
}

function closeWatchPartyModal() { return leaveWatchPartyRoom(); }
