        const SUPABASE_URL = 'https://xebglnnpoutmdcgukbxf.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_SzKz649coUbxHWXjQfdSXQ_GGzzbHrs'; 
        let _supabase = null;
        try {
            if (window.supabase) {
                _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        // Keep the default storage key so existing sessions are not discarded.
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
            }
        } catch(e) {}

        const availableGenresList = ['Экшен', 'Романтика', 'Фэнтези', 'Киберпанк', 'Комедия', 'Хоррор', 'Приключения', 'Драма', 'Мистика', 'Меха', 'Спорт', 'Детектив'];
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        function playSound() {
            try {
                if (audioCtx.state === 'suspended') audioCtx.resume();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(680, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(340, audioCtx.currentTime + 0.05);
                gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.05);
            } catch(e) {}
        }

        let defaultAnime = [
            {
                id: 'anime_1',
                title: 'Форма Голоса',
                poster: 'https://cdn.myanimelist.net/images/anime/1122/96435.jpg',
                shikiRating: '9.0',
                screenshots: [
                    'https://cdn.myanimelist.net/images/anime/1122/96435l.jpg',
                    'https://cdn.myanimelist.net/images/anime/1567/104953.jpg',
                    'https://cdn.myanimelist.net/images/anime/1255/104954.jpg',
                    'https://cdn.myanimelist.net/images/anime/1865/104955.jpg'
                ],
                trailer: 'https://www.youtube.com/embed/9272MmqsjgY',
                genres: ['Романтика', 'Драма'],
                year: '2016',
                type: 'Фильм',
                desc: 'Молодой человек Сёя Исида раскаявается в том, что в школе издевался над глухой одноклассницей Сёко.',
                episodes: [
                    { 
                        season: 1, 
                        title: 'Фильм', 
                        sources: {
                            'Kodik': '<iframe src="https://kodik.info/serial/49733/843198357832?only_episode=true" allowfullscreen></iframe>',
                            'Direct MP4': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                        }
                    }
                ],
                ratings: { Admin: 9.8 }
            },
            {
                id: 'anime_2',
                title: 'Аой Асито',
                poster: 'https://cdn.myanimelist.net/images/anime/1480/121730.jpg',
                shikiRating: '8.2',
                screenshots: [
                    'https://cdn.myanimelist.net/images/anime/1480/121730l.jpg',
                    'https://cdn.myanimelist.net/images/anime/1204/121731.jpg',
                    'https://cdn.myanimelist.net/images/anime/1377/121732.jpg',
                    'https://cdn.myanimelist.net/images/anime/1480/121730.jpg'
                ],
                trailer: 'https://www.youtube.com/embed/JtqIas3bYhg',
                genres: ['Спорт', 'Комедия'],
                year: '2022',
                type: 'Сериал',
                desc: 'История одаренного футбольного юноши, стремящегося к вершинам профессионального спорта.',
                episodes: [
                    { 
                        season: 1, 
                        title: 'Эпизод 1', 
                        sources: {
                            'Kodik': '<iframe src="https://kodik.info/serial/49733/843198357832?only_episode=true" allowfullscreen></iframe>',
                            'Direct MP4': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                        }
                    }
                ],
                ratings: { Admin: 8.9 }
            },
            {
                id: 'anime_3',
                title: 'Счастливая Звезда',
                poster: 'https://s.anixmirai.com/posters/z9skcF06hnw5RGUGYeBwHKpA7JDJos.jpg',
                shikiRating: '7.8',
                screenshots: [
                    'https://cdn.myanimelist.net/images/anime/13/35715l.jpg',
                    'https://cdn.myanimelist.net/images/anime/12/35717l.jpg',
                    'https://cdn.myanimelist.net/images/anime/11/35719l.jpg',
                    'https://cdn.myanimelist.net/images/anime/13/35715.jpg'
                ],
                trailer: 'https://www.youtube.com/embed/9272MmqsjgY',
                genres: ['Комедия'],
                year: '2007',
                type: 'Сериал',
                desc: 'Повседневная жизнь японских школьниц, их увлечения аниме, видеоиграми и учебой.',
                episodes: [
                    { 
                        season: 1, 
                        title: 'Эпизод 1', 
                        sources: {
                            'Kodik': '<iframe src="https://kodik.info/serial/49733/843198357832?only_episode=true" allowfullscreen></iframe>',
                            'Direct MP4': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
                        }
                    }
                ],
                ratings: { Admin: 8.5 }
            }
        ];

        let animeList = defaultAnime;
        function safeParse(raw, fallback) { try { const v=JSON.parse(raw); return v == null ? fallback : v; } catch { return fallback; } }
        let userAnimeStatuses = {};
        let userCustomFolders = {};
        let profileWalls = safeParse(localStorage.getItem('komi_profile_walls'), {}); 
        let currentUser = null;
        let userProfiles = { 
            'Admin': { avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin', status: 'Администратор ★', regDate: '05 ноября 2026 года' }
        };
        let userFavorites = {};
        let userWatchHistory = {};
        let komiEpisodeProgress = {};
        let searchHistory = safeParse(localStorage.getItem('komi_search_history'), ['Экшен', 'Романтика']);
        let siteStats = safeParse(localStorage.getItem('komi_stats'), { visits: 1420, views: 8900 });

        let currentView = location.hash === '#catalog' ? 'catalog' : location.hash === '#shop' ? 'shop' : location.hash === '#partners' ? 'partners' : 'home';
        let profileTargetUser = null;
        let profileActiveTab = 'Просмотрено';
        let profilePageSection = 'overview';
        let profileCollectionSearchQuery = '';
        let catalogFilterGenre = 'Все';
        let catalogFilterYear = 'Все';
        let catalogFilterType = 'Все';
        let catalogSort = 'popular';
        let catalogSearchQuery = '';
        let currentSlideIndex = 0;
        let slideInterval = null;
        let activePlayerSource = 'Kodik';
        let globalAllOnlineUsersList = [];
        const myUniqueKey = 'user_' + Math.random().toString(36).substring(2, 9);
        

        function saveData() {
            localStorage.setItem('komi_search_history', JSON.stringify(searchHistory));
            localStorage.setItem('komi_stats', JSON.stringify(siteStats));
            localStorage.setItem('komi_profile_walls', JSON.stringify(profileWalls));
        }


let catalogRefreshSince = new Date().toISOString();
let catalogRefreshInProgress = false;
let catalogInitialLoadComplete = false;
let catalogInitialLoadFailed = false;
let komiSeoDeepLinkOpened = false;
function komiMaybeOpenSeoAnime() {
    if (komiSeoDeepLinkOpened) return;
    const requested = new URLSearchParams(location.search).get('anime');
    if (!requested || !/^[1-9][0-9]{0,11}$/.test(requested)) return;
    if (!animeList.some(anime => String(anime.id) === requested)) return;
    komiSeoDeepLinkOpened = true;
    const next = new URL(location.href);
    next.searchParams.delete('anime');
    history.replaceState(null, '', next.pathname + next.search + next.hash);
    setTimeout(() => openWatchModal(requested), 0);
}

async function loadDataFromCloud(attempt = 0) {
    catalogInitialLoadFailed = false;
    try {
        if (!_supabase) throw new Error('Supabase не подключён');

        const catalog = [];
        let lastId = 0;
        while (true) {
            const pageSize = catalog.length ? 500 : 48;
            const { data: rows, error } = await _supabase
                .from('komi_catalog_cards').select('shikimori_id,data,updated_at')
                .gt('shikimori_id', lastId)
                .order('shikimori_id', { ascending: true })
                .limit(pageSize);
            if (error) throw error;
            if (!rows || rows.length === 0) break;
            for (const row of rows) {
                const anime = row.data;
                if (!anime || typeof anime !== 'object') continue;
                catalog.push({
                    ...anime,
                    id: String(row.shikimori_id),
                    shikimoriId: Number(row.shikimori_id),
                    title: anime.title || anime.originalTitle || 'Без названия',
                    poster: anime.poster || '',
                    shikiRating: anime.shikiRating || 0,
                    genres: Array.isArray(anime.genres) ? anime.genres : [],
                    episodeCount: Math.max(0, Number(anime.episodeCount) || 0),
                    komiCardUpdatedAt: row.updated_at,
                    // Full episode sources are fetched only when opening a title.
                    episodes: []
                });
            }
            lastId = rows[rows.length - 1].shikimori_id;
            // Display the first 48 cards immediately; later pages load without blocking UI.
            // Keep the in-memory search collection growing while the remaining pages arrive.
            if (catalog.length) {
                animeList = catalog.slice();
                if (typeof komiMaybeOpenSeoAnime === 'function') komiMaybeOpenSeoAnime();
                if (!catalogInitialLoadComplete) {
                    catalogInitialLoadComplete = true;
                    render();
                }
            }
            if (rows.length < pageSize) break;
        }
        animeList = catalog;
        catalogInitialLoadComplete = true;
        console.log(`Komi Anime Hub: загружено ${animeList.length} аниме из anime_catalog`);
    } catch (err) {
        console.error('Ошибка загрузки каталога:', err);
        // Preserve already displayed records while retrying.
        if (attempt < 3) {
            setTimeout(() => loadDataFromCloud(attempt + 1), 2000 * 2 ** attempt);
        } else {
            catalogInitialLoadFailed = true;
        }
    }
    render();
    updateNotificationsUI();
}

        async function saveAnimeToCloud() {
            // Retired: never overwrite the preserved 16 MB legacy catalog.
            throw new Error('Редактирование каталога доступно только через защищённую форму и anime_catalog.');
        }

        const komiPresenceSession = crypto.randomUUID();
        let presenceRequestInFlight = false;
        let presenceRequestEpoch = 0;
        async function updateOnlinePresence() {
            if (!_supabase || !navigator.onLine) {
                const label = document.getElementById('onlineCountText');
                if (label) label.textContent = navigator.onLine ? 'Аккаунтов онлайн: недоступно' : 'Нет соединения';
                return;
            }
            if (document.hidden || presenceRequestInFlight) return;
            presenceRequestInFlight = true;
            const epoch = ++presenceRequestEpoch;
            const requestController = new AbortController();
            const requestTimeout = setTimeout(() => {
                requestController.abort();
                if (epoch === presenceRequestEpoch) {
                    presenceRequestInFlight = false;
                    const el = document.getElementById('onlineCountText');
                    if (el) el.textContent = navigator.onLine ? 'Аккаунтов онлайн: —' : 'Нет соединения';
                }
            }, 4000);
            try {
                const {data: count,error} = await _supabase.rpc('komi_site_presence', {
                    p_session:komiPresenceSession
                }).abortSignal(requestController.signal);
                if (error) throw error;
                if (requestController.signal.aborted || epoch !== presenceRequestEpoch) return;
                const online = Number(count);
                if (!Number.isSafeInteger(online) || online < 0) throw Error('Неверное число онлайн');
                // The RPC intentionally reveals only an aggregate number, not a list
                // of usernames, session IDs, timestamps or anonymous visitors.
                globalAllOnlineUsersList = [];
                const el = document.getElementById('onlineCountText');
                if (el) el.textContent = 'Аккаунтов онлайн: ' + online;
            } catch(error) {
                if (epoch === presenceRequestEpoch) {
                    const el = document.getElementById('onlineCountText');
                    if (el) el.textContent = navigator.onLine ? 'Аккаунтов онлайн: —' : 'Нет соединения';
                }
            } finally {
                clearTimeout(requestTimeout);
                if (epoch === presenceRequestEpoch) presenceRequestInFlight = false;
            }
        }

        setInterval(updateOnlinePresence, 8000);
        document.addEventListener('visibilitychange', updateOnlinePresence);
        window.addEventListener('online', updateOnlinePresence);
        window.addEventListener('offline', () => {
            const indicator = document.getElementById('onlineCountText');
            if (indicator) indicator.textContent = 'Нет соединения';
        });
        updateOnlinePresence();


        // Community drawer: available on every page, without taking space from the hero.
        let komiFriendsTab = 'all';
        function escapeFriendHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        }
        function toggleFriendsDrawer() {
            const drawer = document.getElementById('komiFriendsDrawer');
            if (!drawer) return;
            if (drawer.classList.contains('open')) closeFriendsDrawer();
            else openFriendsDrawer();
        }
        function openFriendsDrawer() {
            loadKomiCommunityProfiles().then(() => renderFriendsDrawer()).catch(console.warn);
            const drawer = document.getElementById('komiFriendsDrawer');
            drawer.removeAttribute('inert');
            drawer.removeAttribute('aria-hidden');
            drawer.classList.add('open');
            document.getElementById('komiFriendsBackdrop').classList.add('open');
            document.getElementById('sideFriendsBtn')?.setAttribute('aria-expanded','true');
            renderFriendsDrawer();
            document.getElementById('komiFriendsSearch')?.focus();
        }
        function closeFriendsDrawer() {
            const drawer = document.getElementById('komiFriendsDrawer');
            if (drawer?.contains(document.activeElement)) {
                document.getElementById('sideFriendsBtn')?.focus();
            }
            drawer?.classList.remove('open');
            drawer?.setAttribute('inert', '');
            drawer?.setAttribute('aria-hidden', 'true');
            document.getElementById('komiFriendsBackdrop')?.classList.remove('open');
            document.getElementById('sideFriendsBtn')?.setAttribute('aria-expanded','false');
        }
        function setFriendsDrawerTab(tab) {
            komiFriendsTab = tab === 'friends' ? 'friends' : 'all';
            renderFriendsDrawer();
        }
        function openCommunityProfile(name) {
            closeFriendsDrawer();
            openProfile(name);
        }
        async function requestCommunityFriend(name) {
            await sendFriendRequest(name);
            await loadKomiCommunityProfiles();
            renderFriendsDrawer();
        }
        let komiCommunityVerifiedNames = new Set();
        async function loadKomiCommunityProfiles() {
            if (!_supabase) return;
            const { data, error } = await _supabase.from('komi_profiles').select('username,display_name,avatar_url').limit(1000);
            if (error) { console.warn('Komi profiles:', error.message); return; }
            komiCommunityVerifiedNames = new Set();
            for (const profile of data || []) {
                if (!profile.username) continue;
                komiCommunityVerifiedNames.add(profile.username);
                if (!userProfiles[profile.username]) userProfiles[profile.username] = {};
                if (profile.avatar_url) userProfiles[profile.username].avatar = profile.avatar_url;
                userProfiles[profile.username].displayName = profile.display_name?.trim() || profile.username;
            }
        }
        function renderFriendsDrawer() {
            const list = document.getElementById('komiFriendsDrawerList');
            if (!list) return;
            document.getElementById('komiFriendsAllTab')?.classList.toggle('active', komiFriendsTab === 'all');
            document.getElementById('komiFriendsMyTab')?.classList.toggle('active', komiFriendsTab === 'friends');
            const query = (document.getElementById('komiFriendsSearch')?.value || '').trim().toLocaleLowerCase();
            const me = currentUser?.username;
            const friends = me ? friendsFor(me) : [];
            const pendingNames = protectedFriendSent.owner === currentUser?.authUserId
                ? protectedFriendSent.names : new Set();
            const names = komiFriendsTab === 'friends' ? friends : [...new Set([...Object.keys(userProfiles), ...komiCommunityVerifiedNames])];
            const unique = [...new Set(names)].filter(n => n && n !== me && (
                n.toLocaleLowerCase().includes(query) || (userProfiles[n]?.displayName || '').toLocaleLowerCase().includes(query)
            )).sort((a,b)=>(userProfiles[a]?.displayName || a).localeCompare(userProfiles[b]?.displayName || b,'ru'));
            if (komiFriendsTab === 'friends' && !me) {
                list.innerHTML = '<div class="komi-friends-empty"><strong>Войди в аккаунт</strong><p>Чтобы увидеть друзей, нужно авторизоваться.</p><button class="btn-glow" data-komi-onclick="closeFriendsDrawer();openAuthModal(\'login\')">Войти</button></div>';
                return;
            }
            if (!unique.length) {
                list.innerHTML = '<div class="komi-friends-empty"><span></span><strong>'+(query ? 'Никого не найдено' : komiFriendsTab === 'friends' ? 'Пока нет друзей' : 'Пользователей пока нет')+'</strong><p>'+(query ? 'Попробуй другой ник.' : 'Пользователи появятся здесь после создания профиля.')+'</p></div>';
                return;
            }
            list.innerHTML = '<div class="komi-friends-count">Найдено: '+unique.length+'</div>'+unique.map((name,index)=>{
                const profile = userProfiles[name] || {};
                const safeName = escapeFriendHtml(profile.displayName || name);
                const avatar = escapeFriendHtml(profile.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed='+encodeURIComponent(name));
                const isFriend = friends.includes(name);
                const isPending = pendingNames.has(name);
                const canRequest = Boolean(currentUser?.authUserId && komiCommunityVerifiedNames.has(name) && name !== me);
                return '<div class="komi-friends-person"><button class="komi-friends-identity" data-komi-onclick="openCommunityProfile(window.komiFriendNames['+index+'])"><img src="'+avatar+'" alt="" loading="lazy" data-komi-onerror="this.onerror=null;this.src=\'https://api.dicebear.com/7.x/bottts/svg?seed=Komi\'"><span><strong>'+safeName+'</strong><small>'+(isFriend?'✓ В друзьях':isPending?' Заявка отправлена':(canRequest?'Участник Komi':'Старый профиль · без привязки'))+'</small></span></button>'+(isFriend?'<span class="komi-friends-added">✓</span>':isPending?'<span class="komi-friends-pending">Ожидание</span>' : canRequest ? '<button class="komi-friends-add" data-komi-onclick="requestCommunityFriend(window.komiFriendNames['+index+'])" title="Добавить в друзья">＋</button>' : '<span class="komi-friends-unavailable" title="Для заявок нужен аккаунт Supabase у обоих пользователей">Недоступно</span>')+'</div>';
            }).join('');
            window.komiFriendNames = unique;
        }
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFriendsDrawer(); });

        function handleFriendSearchInput(inputVal) {
            const listEl = document.getElementById('dynamicFriendSearchResults');
            if (!listEl) return;
            const query = String(inputVal || '').trim().toLocaleLowerCase();

            if (!query) {
                window.komiSidebarSearchNames = [];
                listEl.innerHTML = '';
                listEl.style.display = 'none';
                return;
            }

            const myFriends = currentUser ? friendsFor(currentUser.username) : [];
            const combinedPool = [...new Set([...Object.keys(userProfiles), ...myFriends])];
            const foundResults = combinedPool.filter(name =>
                name.toLocaleLowerCase().includes(query) && name !== currentUser?.username
            );
            window.komiSidebarSearchNames = foundResults;
            listEl.style.display = 'flex';

            if (!foundResults.length) {
                listEl.innerHTML = '<div style="font-size:10px;color:var(--text-muted);padding:4px;text-align:center;">Никого не найдено</div>';
                return;
            }

            listEl.innerHTML = foundResults.map((name,index) => {
                const profile = userProfiles[name] || {};
                const safeName = escapeFriendHtml(name);
                const safeAvatar = escapeFriendHtml(profile.avatar ||
                    'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(name));
                const friend = myFriends.includes(name);
                return `
                    <div class="sidebar-friend-item" style="justify-content:space-between;margin-bottom:4px;">
                        <button type="button" class="komi-friends-identity"
                            data-komi-onclick="playSound();openProfile(window.komiSidebarSearchNames[${index}])">
                            <img src="${safeAvatar}" class="sidebar-friend-avatar" alt="" loading="lazy"
                                data-komi-onerror="this.onerror=null;this.src='https://api.dicebear.com/7.x/bottts/svg?seed=fallback'">
                            <span>${safeName}</span>
                        </button>
                        ${friend ? '<span style="font-size:9px;color:var(--success);">В друзьях</span>' :
                            `<button type="button" class="btn-glow" style="padding:2px 6px;font-size:9px;"
                                data-komi-onclick="playSound();sendFriendRequest(window.komiSidebarSearchNames[${index}])">+ Добавить</button>`}
                    </div>`;
            }).join('');
        }

        function renderSidebarFriendsList() {
            const friendsContainer = document.getElementById('sidebarFriendsListContainer');
            if (!friendsContainer) return;

            if (!currentUser) {
                window.komiSidebarFriendNames = [];
                friendsContainer.innerHTML = '<span style="color:var(--text-muted);font-size:11px;padding:4px;">Войдите, чтобы искать друзей</span>';
                return;
            }

            const myFriends = friendsFor(currentUser.username);
            window.komiSidebarFriendNames = myFriends.slice();
            let friendsHtml = `
                <div style="margin-bottom:8px;display:flex;flex-direction:column;gap:4px;">
                    <input type="text" id="friendSearchInputBox" class="form-control"
                        placeholder="Найти по нику..." data-komi-oninput="handleFriendSearchInput(this.value)"
                        style="font-size:10px;padding:6px 8px;">
                    <div id="dynamicFriendSearchResults"
                        style="display:none;flex-direction:column;max-height:120px;overflow-y:auto;"></div>
                </div>`;

            if (myFriends.length) {
                friendsHtml += myFriends.map((name,index) => {
                    const profile = userProfiles[name] || {};
                    const safeName = escapeFriendHtml(name);
                    const safeAvatar = escapeFriendHtml(profile.avatar ||
                        'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(name));
                    return `
                        <button type="button" class="sidebar-friend-item"
                            data-komi-onclick="playSound();openProfile(window.komiSidebarFriendNames[${index}])">
                            <img src="${safeAvatar}" class="sidebar-friend-avatar" alt="" loading="lazy"
                                data-komi-onerror="this.onerror=null;this.src='https://api.dicebear.com/7.x/bottts/svg?seed=fallback'">
                            <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeName}</span>
                            <span style="width:6px;height:6px;border-radius:50%;background:var(--success);"></span>
                        </button>`;
                }).join('');
            } else {
                friendsHtml += '<span style="color:var(--text-muted);font-size:11px;padding:4px;">Список друзей пуст. Введите ник выше для поиска.</span>';
            }
            friendsContainer.innerHTML = friendsHtml;
        }

        let accountNotifications = { owner: null, rows: [], count: 0 };
        let notificationRequest = 0;
        const markingNotifications = new Set();

        async function loadAccountNotifications() {
            const uid = currentUser?.authUserId;
            if (!uid || !_supabase) return;
            const request = ++notificationRequest;
            const { data, count, error } = await _supabase.from('komi_notifications')
                .select('id,message,created_at', { count: 'exact' })
                .eq('recipient_id', uid).is('read_at', null)
                .order('id', { ascending: false }).limit(50);
            if (currentUser?.authUserId !== uid || notificationRequest !== request) return;
            if (error) throw error;
            accountNotifications = { owner: uid, rows: data, count: count ?? data.length };
            updateNotificationsUI();
        }

        function toggleNotifications() {
            const dropdown = document.getElementById('notifDropdown');
            if (!dropdown.classList.toggle('active')) return;
            if (!currentUser?.authUserId) {
                dropdown.classList.remove('active');
                openAuthModal('login');
                return;
            }
            loadProtectedFriends().catch(error => console.warn('Список друзей:', error.message));
            loadAccountNotifications().catch(() => komiStatusFeedback('Не удалось загрузить уведомления. Откройте список ещё раз.'));
        }

        async function markNotificationsRead() {
            const uid = currentUser?.authUserId;
            if (!uid || !_supabase || markingNotifications.has(uid)) return;
            markingNotifications.add(uid);
            updateNotificationsUI();
            try {
                const { error } = await _supabase.from('komi_notifications')
                    .update({ read_at: new Date().toISOString() })
                    .eq('recipient_id', uid).is('read_at', null);
                if (error) throw error;
                if (currentUser?.authUserId === uid) await loadAccountNotifications();
            } catch {
                if (currentUser?.authUserId === uid) komiStatusFeedback('Не удалось обновить уведомления. Попробуйте ещё раз.');
            } finally {
                markingNotifications.delete(uid);
                updateNotificationsUI();
            }
        }

        function updateNotificationsUI() {
            const uid = currentUser?.authUserId;
            const ownsNotifications = accountNotifications.owner === uid;
            const notifs = ownsNotifications ? accountNotifications.rows : [];
            const requests = protectedFriendRequests.filter(row => row.owner === uid);
            const unreadCount = (ownsNotifications ? accountNotifications.count : 0) + requests.length;
            const badge = document.getElementById('notifBadge');
            badge.textContent = unreadCount;
            badge.style.display = unreadCount ? 'flex' : 'none';
            document.getElementById('markNotificationsReadBtn').disabled = !notifs.length || markingNotifications.has(uid);

            const requestMarkup = requests.map(row =>
                '<div class="notif-item">' + escapeFriendHtml(row.name) + ' хочет добавить вас в друзья. ' +
                '<button class="btn-glow" data-komi-onclick="respondProtectedFriendRequest(' + Number(row.id) + ', true)">Принять</button> ' +
                '<button class="btn-danger" data-komi-onclick="respondProtectedFriendRequest(' + Number(row.id) + ', false)">Отклонить</button></div>'
            ).join('');
            const noticeMarkup = notifs.map(row =>
                '<div class="notif-item">' + escapeFriendHtml(row.message) +
                '<br><time datetime="' + escapeFriendHtml(row.created_at) + '">' +
                escapeFriendHtml(new Date(row.created_at).toLocaleString('ru-RU')) + '</time></div>'
            ).join('');
            document.getElementById('notifListContainer').innerHTML = requestMarkup + noticeMarkup ||
                '<div class="notif-item">Нет новых уведомлений</div>';
        }


        function komiCatalogType(anime) {
            const kind=String(anime?.type || anime?.kind || '').toLowerCase();
            if (['movie','film','фильм'].includes(kind)) return 'Фильм';
            if (kind==='ova') return 'OVA';
            if (kind==='ona') return 'ONA';
            if (kind==='special') return 'Special';
            return 'Сериал';
        }
        let catalogCollection = 'all';
        const komiCollections = {all:'Все аниме', recent:'Свежие серии', short:'На один вечер', movies:'Фильмы', best:'Высокая оценка'};
        function komiInCollection(anime, collection) {
            const episodes = Number(anime.episodeCount) || (Array.isArray(anime.episodes) ? anime.episodes.length : 0);
            if (collection === 'recent') return Number.isFinite(Date.parse(anime.lastEpisodeAddedAt));
            if (collection === 'short') return komiCatalogType(anime) === 'Сериал' && episodes > 0 && episodes <= 13 && Number(anime.shikiRating) >= 7;
            if (collection === 'movies') return komiCatalogType(anime) === 'Фильм';
            if (collection === 'best') return Number(anime.shikiRating) >= 8;
            return true;
        }
        function openKomiCollection(collection) {
            catalogFilterGenre='Все'; catalogFilterYear='Все'; catalogFilterType='Все';
            catalogSearchQuery=''; catalogVisibleCount=48;
            catalogCollection=Object.hasOwn(komiCollections, collection) ? collection : 'all';
            catalogSort=collection === 'recent' ? 'updated' : 'rating';
            navigate('catalog');
        }
        function komiCollectionButtons() {
            return Object.entries(komiCollections).map(([key,label]) =>
                '<button type="button" class="komi-catalog-chip" aria-pressed="'+(currentView==='catalog' && catalogCollection===key)+'" data-komi-onclick="openKomiCollection(\''+key+'\')">'+label+'</button>').join('');
        }
        function komiHomeShelves() {
            const genres = ['Экшен','Романтика','Фэнтези','Комедия','Драма','Спорт'].filter(g => animeList.some(a => (a.genres || []).includes(g)));
            const genreButtons = genres.map(g => '<button type="button" class="komi-catalog-chip" data-komi-genre="'+escapeFriendHtml(g)+'">'+escapeFriendHtml(g)+'</button>').join('');
            const recent = animeList.filter(a=>komiInCollection(a,'recent')).sort((a,b)=>Date.parse(b.lastEpisodeAddedAt)-Date.parse(a.lastEpisodeAddedAt)).slice(0,7);
            return '<section class="komi-feature-section"><h2 class="section-title">Что посмотреть сегодня</h2><div class="komi-catalog-chips">'+komiCollectionButtons()+'</div><div class="komi-catalog-chips" aria-label="Выбор жанра">'+genreButtons+'</div></section>'+
                (recent.length ? '<section class="komi-feature-section"><div class="section-header"><h2 class="section-title">Свежие серии</h2><button class="section-see-all" data-komi-onclick="openKomiCollection(\'recent\')">Все обновления</button></div><div class="anime-grid">'+recent.map(a=>renderCard(a)).join('')+'</div></section>' : '');
        }
        document.addEventListener('click', event => {
            const button = event.target.closest('[data-komi-genre]');
            if (!button) return;
            catalogCollection='all'; catalogFilterYear='Все'; catalogFilterType='Все';
            catalogSearchQuery=''; catalogVisibleCount=48; catalogFilterGenre=button.dataset.komiGenre;
            navigate('catalog');
        });
        function komiFindEpisode(value) {
            const buttons = document.querySelectorAll('.komi-episode-number-grid button');
            let count = 0;
            for (const button of buttons) {
                button.hidden = !!value && !button.textContent.trim().includes(value.trim());
                if (!button.hidden) count++;
            }
            document.getElementById('komiEpisodeSearchStatus').textContent = count ? '' : 'Серия не найдена. Измените номер.';
        }
        function komiCatalogFiltered() {
            const q=catalogSearchQuery.trim().toLocaleLowerCase('ru-RU');
            const filtered=animeList.filter(a=>{
                if (!komiInCollection(a,catalogCollection)) return false;
                const genres=Array.isArray(a.genres)?a.genres:[a.genre].filter(Boolean);
                if(catalogFilterGenre!=='Все'&&!genres.includes(catalogFilterGenre))return false;
                if(catalogFilterYear!=='Все'&&komiAnimeYear(a)!==String(catalogFilterYear))return false;
                if(catalogFilterType!=='Все'&&komiCatalogType(a)!==catalogFilterType)return false;
                if(q&&![a.title,a.originalTitle,a.english,a.japanese,...(Array.isArray(a.synonyms)?a.synonyms:[]),...genres].some(v=>String(v||'').toLocaleLowerCase('ru-RU').includes(q)))return false;
                return true;
            });
            if(catalogSort==='popular')filtered.sort((a,b)=>
                Number(komiAnimeYear(b))-Number(komiAnimeYear(a))||
                (Number(b.shikiRating)||0)-(Number(a.shikiRating)||0));
            else if(catalogSort==='updated')filtered.sort((a,b)=>(Date.parse(b.lastEpisodeAddedAt)||0)-(Date.parse(a.lastEpisodeAddedAt)||0));
            else if(catalogSort==='rating')filtered.sort((a,b)=>(Number(b.shikiRating)||0)-(Number(a.shikiRating)||0));
            else if(catalogSort==='alphabet')filtered.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'ru'));
            else if(catalogSort==='year')filtered.sort((a,b)=>Number(komiAnimeYear(b))-Number(komiAnimeYear(a))||Number(b.shikimoriId||b.id)-Number(a.shikimoriId||a.id));
            return filtered;
        }
        function komiCatalogChipsMarkup() {
            return ['Все', ...Array.from({length:3},(_,i)=>String(new Date().getFullYear()-i))].map(y=>'<button type="button" class="komi-catalog-chip'+(catalogFilterYear===y?' active':'')+'" data-komi-onclick="setKomiCatalogYear(\''+y+'\')">'+(y==='Все'?'Все годы':y)+'</button>').join('');
        }
        function setKomiCatalogYear(year) {catalogFilterYear=String(year);catalogVisibleCount=48;render();}
        function komiResetCatalogFilters() {
            catalogCollection='all';
            catalogFilterGenre='Все';catalogFilterYear='Все';catalogFilterType='Все';
            catalogSort='popular';catalogSearchQuery='';catalogVisibleCount=48;render();
        }
        function komiRefreshCatalogGrid() {
            if(currentView!=='catalog')return;
            const filtered=komiCatalogFiltered();
            const grid=document.getElementById('komiCatalogGrid');
            const count=document.getElementById('komiCatalogCount');
            const more=document.getElementById('komiCatalogMore');
            if(grid)grid.innerHTML=filtered.length
                ?filtered.slice(0,catalogVisibleCount).map(a=>renderCard(a)).join('')
                :'<div class="komi-catalog-empty"><strong>Ничего не найдено</strong><p>Измени запрос или сбрось фильтры.</p><button class="komi-catalog-clear" data-komi-onclick="komiResetCatalogFilters()">Сбросить фильтры</button></div>';
            if(count)count.textContent='Найдено: '+filtered.length;
            if(more){
                more.style.display=filtered.length>catalogVisibleCount?'flex':'none';
                more.innerHTML=filtered.length>catalogVisibleCount?'<button class="btn-glow" data-komi-onclick="showMoreCatalog()">Показать ещё · '+Math.min(catalogVisibleCount,filtered.length)+' из '+filtered.length+'</button>':'';
            }
        }
        function komiUpdateCatalogQuery(value){
            catalogSearchQuery=String(value||'').slice(0,120);
            catalogVisibleCount=48;
            komiRefreshCatalogGrid();
        }
        function komiIntroMarkup(){
            const currentYearCount=animeList.filter(a=>komiAnimeYear(a)==='2026').length;
            return '<div class="komi-spotlight-heading"><div><div class="komi-spotlight-eyebrow">KOMI ANIME HUB · ТВОЯ БИБЛИОТЕКА</div><h1>Выбирай историю на сегодня</h1><p>Свежие серии, любимые жанры и подборки для любого настроения — всё в одном месте.</p></div><div class="komi-spotlight-metrics"><span><strong>'+animeList.length.toLocaleString('ru-RU')+'</strong> аниме в каталоге</span><span><strong>'+currentYearCount+'</strong> тайтлов 2026</span></div></div>'+
                '<nav class="komi-fastnav" aria-label="Быстрые разделы"><button class="is-prominent" data-komi-onclick="showKomiYear(\'2026\')"> Новинки 2026</button><button data-komi-onclick="navigate(\'catalog\')">▦ Весь каталог</button><button data-komi-onclick="document.getElementById(\'komiCalendarSection\')?.scrollIntoView({behavior:\'smooth\',block:\'start\'})"> Новые серии</button><button data-komi-onclick="randomAnimeWithAnimation()">◇ Случайное аниме</button></nav>';
        }

        let catalogVisibleCount = 48;
        function showMoreCatalog() { catalogVisibleCount += 48; komiRefreshCatalogGrid(); }

        function navigate(view) {
            if (slideInterval) clearInterval(slideInterval);
            currentView = view;
            const route = view === 'shop' ? '#shop' : view === 'catalog' ? '#catalog' : view === 'partners' ? '#partners' : '';
            if (location.hash !== route) history.replaceState(null, '', location.pathname + location.search + route);
            render();
            renderHeaderUser();
        }

        function openProfile(username) {
            if (slideInterval) clearInterval(slideInterval);
            currentView = 'profile';
            if (location.hash !== '#profile') history.replaceState(null, '', location.pathname + location.search + '#profile');
            profileTargetUser = username;
            render();
            renderHeaderUser();
        }

        function renderHeaderUser() {
            const area = document.getElementById('userHeaderArea');
            const sidebarAvatarIcon = document.getElementById('sidebarAvatarIcon');
            if (sidebarAvatarIcon) {
                const avatar = currentUser && (userProfiles[currentUser.username]?.avatar || (!currentUser.authUserId && localStorage.getItem('komi_avatar_' + currentUser.username)));
                if (avatar) {
                    const img = document.createElement('img');
                    img.alt = 'Аватар профиля';
                    img.src = avatar;
                    img.onerror = () => { sidebarAvatarIcon.textContent = '◉'; };
                    sidebarAvatarIcon.replaceChildren(img);
                } else sidebarAvatarIcon.textContent = '◉';
            }
            const adminBtn = document.getElementById('adminPanelBtn');
            const addBtn = document.getElementById('addAnimeBtn');
// Only a verified Supabase RPC can grant this session admin UI access.
            const isAdmin = Boolean(currentUser?.authUserId && komiAdminVerified);

            if (isAdmin) {
                adminBtn.style.display = 'inline-flex';
                addBtn.style.display = 'inline-flex';
            } else {
                adminBtn.style.display = 'none';
                addBtn.style.display = 'none';
            }

            if (currentUser) {
                const username = String(currentUser.username || '');
                const p = userProfiles[username] || {};
                const pill = document.createElement('div');
                pill.className = 'user-pill';
                pill.addEventListener('click', () => { playSound(); openProfile(username); });
                const img = document.createElement('img');
                img.className = 'user-avatar-small';
                img.alt = 'Аватар пользователя';
                const avatar = String(p.avatar || '');
                img.src = /^https:\/\//i.test(avatar)
                    ? avatar : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(username);
                img.onerror = () => { img.onerror = null; img.src = 'https://api.dicebear.com/7.x/bottts/svg?seed=fallback'; };
                const name = document.createElement('span');
                name.textContent = username;
                const logout = document.createElement('button');
                logout.type = 'button';
                logout.textContent = 'Выйти';
                logout.title = 'Выйти';
                logout.setAttribute('aria-label', 'Выйти из аккаунта');
                logout.style.cssText = 'background:#1b1b1b;border:1px solid #444444;border-radius:12px;padding:9px 13px;min-height:40px;color:#ffffff;cursor:pointer;font-size:14px;font-weight:700;margin-left:8px';
                logout.addEventListener('click', event => { event.stopPropagation(); logoutUser(); });
                pill.append(img, name, logout);
                area.replaceChildren(pill);
                updateNotificationsUI();
            } else {
                area.innerHTML = `<button class="nav-btn" style="border: 1px solid var(--border);" data-komi-onclick="playSound(); openAuthModal('login')">Войти</button>`;
            }
        }

        function clearKomiAccountData(user) {
            if (!user?.authUserId) return;
            notificationRequest++;
            accountNotifications = { owner: null, rows: [], count: 0 };
            document.getElementById("notifDropdown")?.classList.remove("active");
            delete userAnimeStatuses[user.username];
            delete userFavorites[user.username];
            delete userCustomFolders[user.username];
            ++komiFolderLoadEpoch;
            if (komiSavedCardsOwner === user.authUserId) {
                komiSavedAnimeCards.clear();
                komiSavedCardsOwner = null;
            }
            for (const data of [komiEpisodeProgress, userWatchHistory]) {
                for (const key of Object.keys(data)) if (key.startsWith(user.username + '_')) delete data[key];
            }
        }

        let komiSignOutInProgress = false;
        async function logoutUser(scope = 'local') {
            const signingOut = currentUser;
            if (!signingOut?.authUserId || !_supabase || komiSignOutInProgress) return;
            komiSignOutInProgress = true;
            try {
                await leaveWatchPartyRoom();
                if (currentUser?.authUserId !== signingOut.authUserId) return;
                closeWatchModal();
                await komiProgressWriter.flush();
                if (currentUser?.authUserId !== signingOut.authUserId) return;

                const { data, error: sessionError } = await _supabase.auth.getSession();
                if (sessionError) throw sessionError;
                if (currentUser?.authUserId !== signingOut.authUserId) return;
                if (data.session) {
                    if (data.session.user.id !== signingOut.authUserId) return;
                    const { error } = await _supabase.auth.signOut({ scope });
                    if (error) throw error;
                }
                if (currentUser && currentUser.authUserId !== signingOut.authUserId) return;
                clearKomiAccountData(signingOut);
                avatarDraft = null;
                currentUser = null;
                saveData();
                updateNotificationsUI();
                navigate('home');
                if (!data.session && scope === 'global') {
                    komiStatusFeedback('Сеанс истёк. Войдите снова, чтобы завершить сеансы на всех устройствах.');
                }
            } catch {
                if (!currentUser || currentUser.authUserId === signingOut.authUserId) {
                    komiStatusFeedback(scope === 'global'
                        ? 'Не удалось завершить все сеансы. Попробуйте ещё раз.'
                        : 'Не удалось подтвердить выход на сервере. Попробуйте ещё раз.');
                }
            } finally {
                komiSignOutInProgress = false;
            }
        }

        function komiCatalogLoadingMarkup() {
            return '<section id="catalog" class="komi-static-catalog" aria-label="Каталог аниме">' +
                '<div class="section-header"><h1 class="section-title">Каталог аниме</h1></div>' +
                '<div id="anime-grid" class="anime-grid" aria-busy="true" aria-label="Загрузка каталога">' +
                '<div class="komi-catalog-skeleton-card" aria-hidden="true"></div>'.repeat(6) +
                '</div><p class="komi-catalog-skeleton-label" role="status">Загружаем каталог аниме…</p></section>';
        }

        function render() {
            renderHeaderUser();
            const container = document.getElementById('mainContainer');
            if (!container) return;
            
            if (currentView === 'home') {
                if (!catalogInitialLoadComplete) {
                    // Keep crawlable, real card links visible until the live catalog is ready.
                    if (!catalogInitialLoadFailed && container.querySelector('.komi-seo-card')) return;
                    clearInterval(slideInterval);
                    container.innerHTML = catalogInitialLoadFailed
                        ? '<section class="komi-catalog-empty" role="status"><strong>Не удалось загрузить каталог</strong><button class="komi-catalog-clear" data-komi-onclick="loadDataFromCloud(); render()">Повторить загрузку</button></section>'
                        : komiCatalogLoadingMarkup();
                    return;
                }
                const sliderItems = [...animeList].filter(a=>a.poster && /^https:\/\//i.test(String(a.poster)))
                    .sort((a,b)=>Number(komiAnimeYear(b))-Number(komiAnimeYear(a))||(Number(b.shikiRating)||0)-(Number(a.shikiRating)||0)).slice(0,5);
                const bestShiki = [...animeList].sort((a,b) => parseFloat(b.shikiRating || '0') - parseFloat(a.shikiRating || '0')).slice(0, 7);
                const bestMovies = animeList.filter(a => komiCatalogType(a) === 'Фильм').sort((a,b)=>(Number(b.shikiRating)||0)-(Number(a.shikiRating)||0)).slice(0,7);
                const popularNow = [...animeList].filter(a=>Number(komiAnimeYear(a))>=2024)
                    .sort((a,b)=>{
                        const recentA=a.lastEpisodeAddedAt?Date.parse(a.lastEpisodeAddedAt)||0:0;
                        const recentB=b.lastEpisodeAddedAt?Date.parse(b.lastEpisodeAddedAt)||0:0;
                        return recentB-recentA||(Number(b.shikiRating)||0)-(Number(a.shikiRating)||0);
                    }).slice(0,7);


                let continueWatchingHtml = '';
                if (currentUser) {
                    const history = Object.entries(komiEpisodeProgress).filter(([key])=>key.startsWith(currentUser.username+'_')).sort((a,b)=>(b[1].updated||0)-(a[1].updated||0)).slice(0,8);
                    const items=history.map(([key,p])=>({anime:animeList.find(a=>String(a.id)===key.slice(currentUser.username.length+1)),p})).filter(x=>x.anime);
                    if (items.length) continueWatchingHtml='<section class="komi-feature-section"><div class="section-header"><h2 class="section-title">▷ Продолжить просмотр</h2></div><div class="komi-progress-grid">'+items.map(({anime,p})=>'<button class="komi-progress-card" data-komi-onclick="resumeKomiAnime(\''+anime.id+'\')"><img src="'+escapeFriendHtml(anime.poster||'')+'" loading="lazy" alt=""><span><strong>'+escapeFriendHtml(anime.title)+'</strong><small>Сезон '+p.season+' · Серия '+(p.index+1)+'</small></span></button>').join('')+'</div></section>';
                }
                const komiRecommended = komiRecommendations();
                const komiRecommendedHtml = komiRecommended.length ? '<section class="komi-feature-section"><div class="section-header"><h2 class="section-title"> Тебе понравится</h2></div><div class="anime-grid">'+komiRecommended.map(a=>renderCard(a)).join('')+'</div></section>' : '';

                container.innerHTML = `
                    <div class="top-hero-section-grid">
                        <div class="hero-slider-container" id="heroSlider">
                            <button class="hero-slider-arrow hero-arrow-prev" data-komi-onclick="playSound(); changeSlide(-1)">❮</button>
                            <button class="hero-slider-arrow hero-arrow-next" data-komi-onclick="playSound(); changeSlide(1)">❯</button>
                            
                            <div class="hero-slides-wrapper" style="position:relative; width:100%; height:100%;">
                                ${sliderItems.map((anime, idx) => `
                                    <div class="hero-slide ${idx === currentSlideIndex ? 'active' : ''}" style="background-image: url(&quot;${animeArtwork(anime)}&quot;);">
                                        <div class="hero-meta">
                                            <span>★ ${escapeFriendHtml(anime.shikiRating || '8.5')} Shikimori</span>
                                            <span>${escapeFriendHtml((Array.isArray(anime.genres) ? anime.genres : [anime.genre || 'Экшен']).join(', '))}</span>
                                            <span>${escapeFriendHtml(anime.year || '2026')}</span>
                                            <span>${escapeFriendHtml(anime.type || 'Сериал')}</span>
                                        </div>
                                        <h1>${escapeFriendHtml(anime.title)}</h1>
                                        <p>${cleanAnimeDescription(anime.desc) || 'Описание пока не добавлено.'}</p>
                                        <div class="hero-buttons">
                                            <button class="btn-glow" data-komi-onclick="playSound(); openWatchModal('${anime.id}')">▷ Смотреть сейчас</button>
                                            <button class="btn-glow-secondary" data-komi-onclick="playSound(); openWatchModal('${anime.id}')"> Подробнее</button>
                                            <button class="btn-glow-secondary" data-komi-onclick="playSound(); createWatchPartyFromAnime('${anime.id}')"> Party</button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="hero-dots">
                                ${sliderItems.map((_, idx) => `
                                    <button type="button" class="hero-dot ${idx === currentSlideIndex ? 'active' : ''}" aria-label="Показать аниме ${idx + 1}" data-komi-onclick="playSound(); setSlide(${idx})"></button>
                                `).join('')}
                            </div>
                        </div>


                    </div>

                    ${continueWatchingHtml}
                    ${komiHomeShelves()}
                    ${komiRecommendedHtml}

                    ${popularNow.length ? `
                    <section class="komi-feature-section komi-discovery-row">
                        <div class="section-header">
                            <h2 class="section-title">Новинки и продолжения</h2>
                            <button class="section-see-all" data-komi-onclick="playSound(); navigate('catalog')">Смотреть все</button>
                        </div>
                        <div class="anime-grid">
                            ${popularNow.map(a => renderCard(a)).join('')}
                        </div>
                    </section>` : ''}
                    ${komiReleaseCalendar()}
                    ${komiYearSections()}
                    ${komiIntroMarkup()}

                    <div>
                        <div class="section-header">
                            <h2 class="section-title"> Лучшие по рейтингу</h2>
                            <button class="section-see-all" data-komi-onclick="playSound(); navigate('catalog')">Смотреть все</button>
                        </div>
                        <div class="anime-grid">
                            ${bestShiki.length === 0 ? `<div class="empty-state"><h3>Нет доступных аниме в базе</h3></div>` : bestShiki.map(a => renderCard(a)).join('')}
                        </div>
                    </div>

                    <div>
                        <div class="section-header">
                            <h2 class="section-title"> Лучшие фильмы</h2>
                            <button class="section-see-all" data-komi-onclick="playSound(); openKomiCollection('movies')">Смотреть все</button>
                        </div>
                        <div class="anime-grid">
                            ${bestMovies.length === 0 ? `<div class="empty-state"><h3>Фильмы пока не добавлены</h3></div>` : bestMovies.map(a => renderCard(a)).join('')}
                        </div>
                    </div>


                `;

                startHeroAutoSlide();


            } else if (currentView === 'catalog') {
                if (slideInterval) clearInterval(slideInterval);
                if (!catalogInitialLoadComplete) {
                    container.innerHTML = catalogInitialLoadFailed
                      ? '<section class="komi-catalog-empty" role="status"><h1>Не удалось загрузить каталог</h1><button class="komi-catalog-clear" data-komi-onclick="loadDataFromCloud()">Повторить загрузку</button></section>'
                      : komiCatalogLoadingMarkup();
                    return;
                }
                const genres = ['Все', ...availableGenresList];
                const years = ['Все', ...[...new Set(animeList.map(a => komiAnimeYear(a)).filter(Boolean))].sort((a,b) => Number(b) - Number(a))];
                const types = ['Все', 'Сериал', 'Фильм', 'OVA', 'ONA', 'Special'];

                const filtered = komiCatalogFiltered();

                container.innerHTML = `
                    <div class="komi-catalog-header">
                        <div><div class="komi-spotlight-eyebrow">БИБЛИОТЕКА KOMI</div><h1>Каталог аниме</h1>
                        <p>Найди сериал или фильм по названию, жанру, году и типу.</p></div>
                        <button class="komi-catalog-clear" data-komi-onclick="komiResetCatalogFilters()">Сбросить фильтры</button>
                    </div>
                    <div class="komi-catalog-search">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 5 5"></path></svg>
                        <input id="komiCatalogSearchInput" type="search" value="${escapeFriendHtml(catalogSearchQuery)}" placeholder="Название аниме, оригинальное название или жанр..." aria-label="Поиск в каталоге" data-komi-oninput="komiUpdateCatalogQuery(this.value)" autocomplete="off">
                    </div>
                    <div class="komi-catalog-chips" aria-label="Подборки">${komiCollectionButtons()}</div>
                    <div class="komi-catalog-chips">${komiCatalogChipsMarkup()}</div>
                    <div class="catalog-filters-box">
                        <div class="form-group" style="margin:0;">
                            <label>Жанр</label>
                            <select class="form-control" data-komi-onchange="catalogFilterGenre=this.value; render()">
                                ${genres.map(g => `<option ${catalogFilterGenre===g?'selected':''}>${g}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label>Год</label>
                            <select class="form-control" data-komi-onchange="catalogFilterYear=this.value; render()">
                                ${years.map(y => `<option ${catalogFilterYear===y?'selected':''}>${y}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label>Тип</label>
                            <select class="form-control" data-komi-onchange="catalogFilterType=this.value; render()">
                                ${types.map(t => `<option ${catalogFilterType===t?'selected':''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label>Сортировка</label>
                            <select class="form-control" data-komi-onchange="catalogSort=this.value; render()">
                                <option value="popular" ${catalogSort==='popular'?'selected':''}>Актуальные</option>
                                <option value="updated" ${catalogSort==='updated'?'selected':''}>По обновлению серий</option>
                                <option value="rating" ${catalogSort==='rating'?'selected':''}>Рейтинг</option>
                                <option value="year" ${catalogSort==='year'?'selected':''}>Сначала новые по году</option>
                                <option value="alphabet" ${catalogSort==='alphabet'?'selected':''}>Алфавит</option>
                            </select>
                        </div>
                    </div>
                    <div class="komi-catalog-status"><span class="komi-catalog-count" id="komiCatalogCount">Найдено: ${filtered.length}</span><span>Аниме с доступными сериями</span></div>
                    <div class="anime-grid" id="komiCatalogGrid">
                        ${filtered.length === 0 ? `<div class="komi-catalog-empty"><strong>Ничего не найдено</strong><p>Измени запрос или сбрось фильтры.</p><button class="komi-catalog-clear" data-komi-onclick="komiResetCatalogFilters()">Сбросить фильтры</button></div>` : filtered.slice(0, catalogVisibleCount).map(a => renderCard(a)).join('')}
                    </div>
                    <div id="komiCatalogMore" style="display:${filtered.length > catalogVisibleCount ? 'flex' : 'none'};justify-content:center;margin:24px 0;">
                        ${filtered.length > catalogVisibleCount ? `<button class="btn-glow" data-komi-onclick="showMoreCatalog()">Показать ещё · ${Math.min(catalogVisibleCount, filtered.length)} из ${filtered.length}</button>` : ''}
                    </div>
                `;
            } else if (currentView === 'partners') {
                container.innerHTML = `
                    <section class="komi-partners-page" aria-labelledby="komiPartnersTitle">
                        <div class="komi-partners-hero">
                            <span class="komi-partners-eyebrow">KOMI ANIME HUB · COMMUNITY</span>
                            <h1 id="komiPartnersTitle">Партнёры Komi Anime</h1>
                            <p>Здесь будут представлены проекты и сообщества, с которыми мы сотрудничаем. Мы открыты к интересным предложениям для развития аниме-сообщества.</p>
                        </div>
                        <div class="komi-partners-grid">
                            <article class="komi-partners-panel">
                                <span class="komi-partners-symbol" aria-hidden="true">◇</span>
                                <h2>Наши партнёры</h2>
                                <p>Пока опубликованных партнёров нет. Когда сотрудничество будет подтверждено, здесь появятся названия и ссылки.</p>
                            </article>
                            <article class="komi-partners-panel">
                                <span class="komi-partners-symbol" aria-hidden="true">✧</span>
                                <h2>Сотрудничество</h2>
                                <p>Мы рады новым идеям и совместным проектам. Следите за объявлениями в официальном сообществе Komi Anime.</p>
                                <div class="komi-partners-actions">
                                    <a href="https://t.me/+X9yUQPEBldo2MzNi" target="_blank" rel="noopener noreferrer">Наш Telegram</a>
                                    <a href="https://www.tiktok.com/@komi_animeofficial" target="_blank" rel="noopener noreferrer">Наш TikTok</a>
                                </div>
                            </article>
                        </div>
                    </section>`;
            } else if (currentView === 'shop') {
                if (typeof renderAniCoinShop === 'function') renderAniCoinShop(container);
                else container.innerHTML = '<section id="shop" class="komi-catalog-empty" role="status"><h1>Магазин AniCoin</h1><p>Загружаем магазин…</p></section>';
            } else if (currentView === 'profile') {
                if (slideInterval) clearInterval(slideInterval);
                renderProfileView(container);
            }
        }

        function startHeroAutoSlide() {
            if (slideInterval) clearInterval(slideInterval);
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            slideInterval = setInterval(() => {
                if (document.hidden || document.querySelector('#heroSlider:hover, #heroSlider:focus-within')) return;
                const maxSlides = document.querySelectorAll('.hero-slide').length;
                if (maxSlides > 1) {
                    currentSlideIndex = (currentSlideIndex + 1) % maxSlides;
                    updateHeroSlideView();
                }
            }, 6000);
        }

        function changeSlide(direction) {
            const maxSlides = document.querySelectorAll('.hero-slide').length;
            if (!maxSlides) return;
            currentSlideIndex = (currentSlideIndex + direction + maxSlides) % maxSlides;
            updateHeroSlideView();
            startHeroAutoSlide();
        }

        function setSlide(index) {
            currentSlideIndex = index;
            updateHeroSlideView();
            startHeroAutoSlide();
        }

        function updateHeroSlideView() {
            const slides = document.querySelectorAll('.hero-slide');
            const dots = document.querySelectorAll('.hero-dot');
            if (slides.length) currentSlideIndex %= slides.length;
            slides.forEach((slide, idx) => {
                if (idx === currentSlideIndex) slide.classList.add('active');
                else slide.classList.remove('active');
            });
            dots.forEach((dot, idx) => {
                if (idx === currentSlideIndex) dot.classList.add('active');
                else dot.classList.remove('active');
            });
        }

        function updateProfileCollectionSearch(input) {
            profileCollectionSearchQuery = input.value;
            const start = input.selectionStart, end = input.selectionEnd;
            render();
            const restored = document.querySelector('input[data-komi-oninput="updateProfileCollectionSearch(this)"]');
            if (restored) {
                restored.focus({ preventScroll: true });
                try { restored.setSelectionRange(start, end); } catch (_) {}
            }
        }
        function safeProfileText(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
        function renderProfileView(container) {
            const username = profileTargetUser || (currentUser ? currentUser.username : 'Гость');
            const p = userProfiles[username] || { 
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`, 
                status: 'Отаку ★', 
                regDate: '05 ноября 2026 года' 
            };
            // Recover existing avatars saved before cloud storage was introduced.
            if (currentUser && !currentUser.authUserId && username === currentUser.username) {
                const previousAvatar = localStorage.getItem('komi_avatar_' + username);
                if (previousAvatar && (!p.avatar || p.avatar.includes('dicebear.com'))) p.avatar = previousAvatar;
            }

            const myFriends = friendsFor(username);
            const isMe = currentUser && currentUser.username === username;
            const amIFriend = currentUser && friendsFor(currentUser.username).includes(username);

            const userStatuses = userAnimeStatuses[username] || {};
            // Rendering a saved collection should not repeatedly scan all 7k+ cards.
            const profileAnimeById = new Map(animeList.map(anime => [String(anime.id), anime]));
            // The full catalog is loaded in pages. User-owned cards can be resolved
            // directly while their catalog page has not arrived yet.
            if (isMe && currentUser?.authUserId === komiSavedCardsOwner) {
                for (const [id,anime] of komiSavedAnimeCards) {
                    if (!profileAnimeById.has(id)) profileAnimeById.set(id,anime);
                }
            }
            const statsCounts = { 'Просмотрено': 0, 'В планах': 0, 'Смотрю': 0, 'Отложено': 0, 'Брошено': 0, 'Любимые': 0 };
            
            const customFolders = userCustomFolders[username] || {};
            const customFolderNames = Object.keys(customFolders);

            const listForTab = [];
            Object.entries(userStatuses).forEach(([aId, st]) => {
                if (statsCounts[st] !== undefined) statsCounts[st]++;
                if (st === profileActiveTab) {
                    const anObj = profileAnimeById.get(String(aId));
                    if (anObj) listForTab.push(anObj);
                }
            });

            if (profileActiveTab === 'Любимые') {
                const favs = userFavorites[username] || {};
                Object.keys(favs).forEach(aId => {
                    const anObj = profileAnimeById.get(String(aId));
                    if (anObj && !listForTab.some(x => String(x.id) === String(aId))) listForTab.push(anObj);
                });
                statsCounts['Любимые'] = listForTab.length;
            } else if (customFolderNames.includes(profileActiveTab)) {
                const folderAnimeIds = customFolders[profileActiveTab] || [];
                folderAnimeIds.forEach(aId => {
                    const anObj = profileAnimeById.get(String(aId));
                    if (anObj) listForTab.push(anObj);
                });
            }

            // Calculate real genre preferences from titles saved to the library.
            const genreTotals = {};
            Object.keys(userStatuses).forEach(aId => {
                const item = profileAnimeById.get(String(aId));
                if (!item) return;
                const genres = Array.isArray(item.genres) ? item.genres : [item.genre];
                genres.filter(Boolean).forEach(g => { genreTotals[g] = (genreTotals[g] || 0) + 1; });
            });
            const topGenres = Object.entries(genreTotals).sort((a,b) => b[1] - a[1]).slice(0,5);
            const watchedCount = statsCounts['Просмотрено'] || 0;
            const calculatedLevel = komiAchievements(username).level;

            const favoritesCount = Object.keys(userFavorites[username] || {}).length;
            const profileSavedCount = profileActiveTab === 'Любимые' ? favoritesCount
                : customFolderNames.includes(profileActiveTab)
                    ? (customFolders[profileActiveTab] || []).length
                    : (statsCounts[profileActiveTab] || 0);
            const missingProfileCards = Math.max(0, profileSavedCount - listForTab.length);
            const wallMessages = profileWalls[username] || [];

            const searchedList = listForTab.filter(an => {
                if (!profileCollectionSearchQuery) return true;
                return an.title.toLowerCase().includes(profileCollectionSearchQuery.toLowerCase());
            });

            window.komiWallProfileName=username;
            window.komiViewedProfileName=username;
            window.komiProfileFriendNames=myFriends.slice();
            window.komiProfileFolderNames=customFolderNames.slice();
            window.komiWallAuthorByIndex=(profileWalls[username]||[]).map(m=>m.author);
            container.innerHTML = `
                <div class="profile-container komi-profile-v2">
                    <div class="profile-header-card">
                        <img src="${safeProfileText(komiSafeUrl(p.avatar) || 'https://api.dicebear.com/7.x/bottts/svg?seed=fallback')}" class="profile-avatar-box" alt="Аватар профиля" data-komi-onerror="this.onerror=null;this.src='https://api.dicebear.com/7.x/bottts/svg?seed=fallback'">
                        <div class="profile-info-grid">
                            <div class="profile-name-row">
                                <h2>${safeProfileText(p.displayName || (username.startsWith('google_') ? (isMe ? 'Мой профиль' : 'Пользователь Komi') : username))}</h2>
                                ${!isMe && currentUser ? `
                                    ${amIFriend ? `<button class="btn-danger" data-komi-onclick="playSound(); removeFriend(window.komiViewedProfileName)">Удалить из друзей</button>` : 
                                     `<button class="btn-glow" data-komi-onclick="playSound(); sendFriendRequest(window.komiViewedProfileName)">+ Добавить в друзья</button>`}
                                ` : ''}
                            </div>
                            
                            <div class="profile-badges-row">
                                ${isMe ? `<span class="profile-badge-item" data-anicoin-badge ${typeof aniCoinBadge === 'function' && aniCoinBadge() ? '' : 'hidden'}>${typeof aniCoinBadge === 'function' ? escapeFriendHtml(aniCoinBadge()) : ''}</span>` : ''}
                                <div class="profile-badge-level">Уровень ${calculatedLevel} </div>
                                <div class="profile-badge-item"> Статус: ${safeProfileText(p.status)}</div>
                            </div>

                            <div class="komi-level-progress"><label>До следующего уровня · ${komiAchievements(username).xp % 300} из 300 XP <progress max="300" value="${komiAchievements(username).xp % 300}"></progress></label></div>
                            <div class="profile-reg-date">Дата регистрации: <b>${escapeFriendHtml(p.regDate || 'Не указана')}</b></div>
                            <div class="komi-profile-actions">
                                ${isMe ? '<button class="komi-profile-action" data-komi-onclick="document.querySelector(\'.profile-settings-box\')?.classList.toggle(\'is-open\')"> Настройки</button>' : ''}
                                ${isMe ? '<button type="button" class="komi-profile-action" data-komi-onclick="openAniCoinShop()">Кошелёк AniCoin</button>' : ''}
                            </div>

                            ${isMe ? `
                            <div class="profile-settings-box">
                                <h4> Настройки профиля</h4>
                                <label for="newDisplayName" style="font-size:11px; color:var(--text-muted);">Никнейм (отображаемое имя)</label>
                                <input type="text" id="newDisplayName" maxlength="40" class="form-control" placeholder="Твой никнейм" value="${safeProfileText(p.displayName || '')}">
                                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                                    <div style="flex:2; min-width:160px;">
                                        <label for="avatarFileInput" style="font-size:10px; color:var(--text-muted); margin-bottom:2px; display:block;">Фото с устройства</label>
                                        <input type="file" id="avatarFileInput" accept="image/*" class="form-control" style="padding: 4px; font-size:10px;" data-komi-onchange="handleAvatarFileUpload(event)">
                                    </div>
                                    <div style="flex:2; min-width:130px;">
                                        <label for="newStatusText" style="font-size:10px; color:var(--text-muted); margin-bottom:2px; display:block;">Текст статуса</label>
                                        <input type="text" id="newStatusText" class="form-control" placeholder="Твой статус..." maxlength="100" value="${safeProfileText(p.status)}">
                                    </div>
                                    <button class="btn-glow" style="padding: 7px 14px; align-self:flex-end;" data-komi-onclick="playSound(); updateUserProfile(this)">Сохранить</button>
                                </div>
                                <button type="button" class="btn-secondary" data-komi-onclick="logoutUser('global')">Выйти на всех устройствах</button>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="profile-stats-grid">
                        <button type="button" class="profile-stat-card ${profileActiveTab === 'Просмотрено' ? 'active' : ''}" data-komi-onclick="playSound(); profileActiveTab='Просмотрено'; profilePageSection='anime'; render()">
                            <div class="stat-num">${statsCounts['Просмотрено']}</div>
                            <div class="stat-label">Просмотрено</div>
                        </button>
                        <button type="button" class="profile-stat-card ${profileActiveTab === 'В планах' ? 'active' : ''}" data-komi-onclick="playSound(); profileActiveTab='В планах'; profilePageSection='anime'; render()">
                            <div class="stat-num">${statsCounts['В планах']}</div>
                            <div class="stat-label">В планах</div>
                        </button>
                        <button type="button" class="profile-stat-card ${profileActiveTab === 'Смотрю' ? 'active' : ''}" data-komi-onclick="playSound(); profileActiveTab='Смотрю'; profilePageSection='anime'; render()">
                            <div class="stat-num">${statsCounts['Смотрю']}</div>
                            <div class="stat-label">Смотрю</div>
                        </button>
                        <button type="button" class="profile-stat-card ${profileActiveTab === 'Отложено' ? 'active' : ''}" data-komi-onclick="playSound(); profileActiveTab='Отложено'; profilePageSection='anime'; render()">
                            <div class="stat-num">${statsCounts['Отложено']}</div>
                            <div class="stat-label">Отложено</div>
                        </button>
                        <button type="button" class="profile-stat-card ${profileActiveTab === 'Брошено' ? 'active' : ''}" data-komi-onclick="playSound(); profileActiveTab='Брошено'; profilePageSection='anime'; render()">
                            <div class="stat-num">${statsCounts['Брошено']}</div>
                            <div class="stat-label">Брошено</div>
                        </button>
                        <button type="button" class="profile-stat-card ${profileActiveTab === 'Любимые' ? 'active' : ''}" data-komi-onclick="playSound(); profileActiveTab='Любимые'; profilePageSection='anime'; render()">
                            <div class="stat-num">${favoritesCount}</div>
                            <div class="stat-label">Любимое</div>
                        </button>
                    </div>

                    <section class="komi-achievement-panel"><div><strong>Достижения</strong><span>${komiAchievements(username).xp} XP</span></div><div class="komi-badges">${komiAchievements(username).badges.length?komiAchievements(username).badges.map(b=>'<span>'+b+'</span>').join(''):'<span> Первое достижение впереди</span>'}</div></section>
                    <nav class="komi-profile-tabs" aria-label="Разделы профиля">
                        <button class="komi-profile-tab ${profilePageSection === 'overview' ? 'active' : ''}" data-komi-onclick="profilePageSection='overview';render()">Профиль</button>
                        <button class="komi-profile-tab ${profilePageSection === 'anime' ? 'active' : ''}" data-komi-onclick="profilePageSection='anime';render()">Аниме</button>
                        <button class="komi-profile-tab ${profilePageSection === 'friends' ? 'active' : ''}" data-komi-onclick="profilePageSection='friends';render()">Друзья</button>
                        <button class="komi-profile-tab ${profilePageSection === 'comments' ? 'active' : ''}" data-komi-onclick="profilePageSection='comments';render()">Комментарии</button>
                    </nav>
                    ${profilePageSection === 'overview' ? `
                        <div class="komi-profile-overview">
                            <section><h3>Списки</h3>
                                ${['Смотрю','В планах','Просмотрено','Брошено'].map((name,i)=>`
                                    <button class="komi-overview-list-row" data-komi-onclick="profilePageSection='anime';profileActiveTab='${name}';render()">
                                        <span><i class="komi-list-dot dot-${i}"></i>${name}</span><b>${statsCounts[name] || 0}</b>
                                    </button>`).join('')}
                            </section>
                            <section><h3>Любимые жанры</h3>
                                ${topGenres.length ? topGenres.map(([genre,count]) => `<div class="komi-genre-row"><span>${safeProfileText(genre)}</span><b>${count}</b></div>`).join('') : '<p>Добавь аниме в коллекцию, чтобы увидеть любимые жанры.</p>'}
                            </section>
                            <section><h3>Активность</h3>
                                <div class="komi-overview-list-row"><span>В библиотеке</span><b>${Object.keys(userStatuses).length}</b></div>
                                <div class="komi-overview-list-row"><span>Друзей</span><b>${myFriends.length}</b></div>
                                <div class="komi-overview-list-row"><span>Любимое</span><b>${favoritesCount}</b></div>
                            </section>
                        </div>
                        <div class="komi-profile-ratings"><h3>Оценки</h3><p>Оценённые аниме появятся в твоей коллекции.</p></div>
                    ` : ''}
                    <div class="komi-profile-anime-section" style="display:${profilePageSection === 'anime' ? 'block' : 'none'}">
                    ${customFolderNames.length > 0 || isMe ? `
                        <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap; background:var(--bg-card); padding:10px 14px; border-radius:12px; border:1px solid var(--border);">
                            <span style="font-size:11px; font-weight:700; color:var(--text-muted);">Папки:</span>
                            ${customFolderNames.map((fname,i) => `
                                <button class="season-tab-btn ${profileActiveTab === fname ? 'active' : ''}" data-komi-onclick="playSound(); profileActiveTab=window.komiProfileFolderNames[${i}]; render()"> ${safeProfileText(fname)} (${customFolders[fname].length})</button>
                                ${isMe && currentUser?.authUserId ? `<button type="button" class="btn-danger" style="padding:4px 7px;border-radius:8px" aria-label="Удалить папку ${safeProfileText(fname)}" title="Удалить папку" data-komi-onclick="deleteCustomFolder(window.komiProfileFolderNames[${i}])">×</button>` : ''}
                            `).join('')}
                            ${isMe && currentUser?.authUserId && komiFolderImportableCount(username)
                                ? `<button class="btn-secondary" type="button" data-komi-onclick="importLocalCustomFolders()">Импорт локальных папок</button>` : ''}
                            ${isMe ? `
                                <div style="display:flex; gap:5px; margin-left:auto; align-items:center;">
                                    <input type="text" id="newFolderNameInput" class="form-control" placeholder="Новая папка..." style="max-width:140px; padding:5px 8px; font-size:11px;">
                                    <button class="btn-secondary" style="padding:5px 8px; font-size:11px;" data-komi-onclick="playSound(); createCustomFolder()">+ Папка</button>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    <div class="profile-layout-grid">
                        <div class="profile-main-content">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                                <h3 style="font-size:15px; font-weight:800;">Коллекция: <span style="color:var(--primary);">${safeProfileText(profileActiveTab)}</span></h3>
                                <div style="position:relative; width: 180px;">
                                    <input type="text" class="form-control" placeholder="Поиск в коллекции..." value="${safeProfileText(profileCollectionSearchQuery)}" data-komi-oninput="updateProfileCollectionSearch(this)" style="padding: 6px 8px; font-size: 11px;">
                                </div>
                            </div>

                            ${missingProfileCards > 0 ? `
                                <p class="komi-profile-notice" role="status" style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
                                    ${missingProfileCards} сохранённых аниме ещё загружаются или отсутствуют в каталоге. Статусы не удалены.
                                </p>
                            ` : ''}
                            ${searchedList.length === 0 ? `
                                <div class="empty-state">
                                    <div style="font-size:26px; margin-bottom:6px;"></div>
                                    <h3 style="font-size:13px; margin-bottom:3px;">${profileCollectionSearchQuery ? 'По запросу ничего не найдено' : profileSavedCount ? 'Ожидаем карточки каталога' : 'В этой категории пока пусто'}</h3>
                                    <p style="font-size:11px; color:var(--text-muted);">${profileSavedCount ? 'Сохранённые записи останутся в аккаунте.' : 'Добавляйте аниме из каталога или при просмотре.'}</p>
                                </div>
                            ` : `
                                <div class="anime-grid">
                                    ${searchedList.map(an => renderCard(an)).join('')}
                                </div>
                            `}
                        </div>

                        <div class="profile-sidebar-menu">
                            <h3 style="font-size:12px; font-weight:700; margin-bottom:4px;"> Статистика</h3>
                            <div class="profile-menu-item" data-komi-onclick="playSound(); profileActiveTab='Просмотрено'; render()"><span> Просмотрено</span> <b>${statsCounts['Просмотрено']}</b></div>
                            <div class="profile-menu-item" data-komi-onclick="playSound(); profileActiveTab='Любимые'; render()"><span>♡ Любимое</span> <b>${favoritesCount}</b></div>
                            <div class="profile-menu-item"><span> Друзья</span> <b>${myFriends.length}</b></div>
                        </div>
                    </div>

                    </div>
                    <div class="komi-profile-friends-section" style="display:${profilePageSection === 'friends' ? 'block' : 'none'}"><h3>Друзья (${myFriends.length})</h3><div class="komi-profile-friend-list">${myFriends.length ? myFriends.map((friend,i)=>`<button class="komi-profile-friend" data-komi-onclick="openProfile(window.komiProfileFriendNames[${i}])">${safeProfileText(friend)}</button>`).join('') : '<p>Пока нет друзей.</p>'}</div></div>
                    <div class="komi-profile-comments-section" style="display:${profilePageSection === 'comments' ? 'block' : 'none'}">
                    <div class="profile-wall-section">
                        <h3 style="font-size:14px; font-weight:800; margin-bottom:10px;"> Стена сообщений</h3>
                        <div style="display:flex; gap:6px; margin-bottom:14px;">
                            <input type="text" id="wallMessageInput" class="form-control" placeholder="Написать на стену..." data-komi-onkeydown="if(event.key==='Enter') postToProfileWall(window.komiWallProfileName)">
                            <button class="btn-glow" style="padding: 7px 16px;" data-komi-onclick="playSound(); postToProfileWall(window.komiWallProfileName)">Отпр.</button>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${wallMessages.length === 0 ? `
                                <div style="color:var(--text-muted); font-size:11px; text-align:center; padding:16px; background:var(--bg-input); border-radius:8px; border:1px dashed var(--border);">
                                    На стене пока нет сообщений. Будьте первыми!
                                </div>
                            ` : wallMessages.map((m, mIdx) => {
                                const senderAvatar = (userProfiles[m.author] || {}).avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.author}`;
                                const canDelete = currentUser && (currentUser.username === username || currentUser.username === m.author || false);
                                return `
                                    <div class="wall-message-item">
                                        <div class="wall-message-author" data-komi-onclick="playSound(); openProfile(window.komiWallAuthorByIndex[${mIdx}])">
                                            <img src="${safeProfileText(komiSafeUrl(senderAvatar) || 'https://api.dicebear.com/7.x/bottts/svg?seed=fallback')}" data-komi-onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=fallback'">
                                            <span>${escapeFriendHtml(userProfiles[m.author]?.displayName || m.author)}</span>
                                            <span style="font-size:10px; color:var(--text-muted); margin-left:auto; font-weight:normal;">${escapeFriendHtml(m.time)}</span>
                                            ${canDelete ? `<button class="btn-danger" style="padding:2px 5px; font-size:10px; margin-left:4px;" data-komi-onclick="playSound(); deleteWallMessage(window.komiWallProfileName, ${mIdx})">Удалить</button>` : ''}
                                        </div>
                                        <div class="wall-message-text">${escapeFriendHtml(m.text)}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    </div>
                </div>
            `;
        }

        let avatarDraft = null;
        let profileSavePending = false;

        function handleAvatarFileUpload(event) {
            const file = event.target.files[0];
            const owner = currentUser?.authUserId || currentUser?.username;
            avatarDraft = null;
            if (!file || !owner) return;
            if (!file.type.startsWith('image/')) {
                komiStatusFeedback('Выберите изображение.');
                return;
            }
            const image = new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
                reader.onload = () => {
                    const preview = new Image();
                    preview.onerror = () => reject(new Error('Не удалось открыть изображение.'));
                    preview.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            const scale = Math.min(1, 320 / Math.max(preview.width, preview.height));
                            canvas.width = Math.max(1, Math.round(preview.width * scale));
                            canvas.height = Math.max(1, Math.round(preview.height * scale));
                            canvas.getContext('2d').drawImage(preview, 0, 0, canvas.width, canvas.height);
                            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось подготовить изображение.')), 'image/jpeg', .78);
                        } catch (error) { reject(error); }
                    };
                    preview.src = reader.result;
                };
                reader.readAsDataURL(file);
            });
            const draft = avatarDraft = { owner, image };
            image.then(() => {
                if (avatarDraft === draft) komiStatusFeedback('Фото выбрано. Нажмите «Сохранить».');
            }, error => {
                if (avatarDraft !== draft) return;
                avatarDraft = null;
                komiStatusFeedback(error.message);
            });
        }

        async function uploadAvatarToStorage(blob, owner) {
            const filename = owner + '/' + crypto.randomUUID() + '.jpg';
            const storage = _supabase.storage.from('avatars');
            const { error } = await storage.upload(filename, blob, {
                contentType: 'image/jpeg', upsert: false, cacheControl: '3600'
            });
            if (error) throw new Error('Не удалось загрузить аватар. ' + error.message);
            return storage.getPublicUrl(filename).data.publicUrl;
        }

        async function updateUserProfile(button) {
            if (!currentUser || profileSavePending) return;
            const { username, authUserId } = currentUser;
            if (!authUserId || !_supabase) {
                komiStatusFeedback('Войдите в аккаунт Komi через Google или email для сохранения профиля.');
                return;
            }
            const displayName = document.getElementById('newDisplayName')?.value.trim() || '';
            const status = (document.getElementById('newStatusText')?.value || '').trim().slice(0, 100);
            if (displayName && displayName.length < 2) {
                komiStatusFeedback('Имя должно содержать хотя бы 2 символа.');
                return;
            }
            const draft = avatarDraft?.owner === authUserId ? avatarDraft : null;
            profileSavePending = true;
            if (button) button.disabled = true;
            try {
                const fields = { display_name: displayName.slice(0, 40), bio: status };
                if (draft) {
                    const blob = await draft.image;
                    if (currentUser?.authUserId !== authUserId) return;
                    draft.url ||= await uploadAvatarToStorage(blob, authUserId);
                    fields.avatar_url = draft.url;
                }
                if (currentUser?.authUserId !== authUserId) return;
                const columns = 'display_name,avatar_url,bio,created_at';
                const profiles = _supabase.from('komi_profiles');
                let { data: saved, error } = await profiles.update(fields)
                    .eq('user_id', authUserId).select(columns).maybeSingle();
                if (error) throw error;
                if (!saved && currentUser?.authUserId === authUserId) {
                    ({ data: saved, error } = await _supabase.from('komi_profiles')
                        .insert({ user_id: authUserId, username: komiSafeAccountUsername(username, authUserId), ...fields }).select(columns).single());
                    if (error) throw error;
                }
                if (!saved || currentUser?.authUserId !== authUserId) return;
                applySavedKomiProfile(username, saved);
                if (avatarDraft === draft) avatarDraft = null;
                saveData();
                render();
                komiStatusFeedback('Профиль сохранён.');
            } catch (error) {
                if (currentUser?.authUserId === authUserId) komiStatusFeedback('Не удалось сохранить профиль. ' + error.message);
            } finally {
                profileSavePending = false;
                if (button) button.disabled = false;
            }
        }

        const pendingFolderWrites = new Set();
        let komiFolderLoadEpoch = 0;
        function komiFolderNameAllowed(name) {
            const normalized = String(name ?? '');
            const reserved = new Set(['__proto__','constructor','prototype','Просмотрено','В планах',
                'Смотрю','Отложено','Брошено','Любимые']);
            return normalized.length>=1 && normalized.length<=40 &&
                normalized===normalized.trim() && !/[\x00-\x1F\x7F]/.test(normalized) &&
                !reserved.has(normalized);
        }
        function komiLegacyFolderSnapshot(username) {
            const legacy = safeParse(localStorage.getItem('komi_custom_folders'),{});
            return legacy && typeof legacy==='object' &&
                Object.prototype.hasOwnProperty.call(legacy,username) &&
                legacy[username] && typeof legacy[username]==='object'
                ? legacy[username] : null;
        }
        function komiFolderImportableCount(username) {
            const archived = komiLegacyFolderSnapshot(username);
            if (!archived) return 0;
            return Object.keys(archived).filter(name=>komiFolderNameAllowed(name)).length;
        }
        async function createCustomFolder() {
            if (!currentUser?.authUserId || !_supabase) { openAuthModal('login'); return; }
            const {username,authUserId:owner} = currentUser;
            const name = String(document.getElementById('newFolderNameInput')?.value||'').trim();
            if (!komiFolderNameAllowed(name)) {
                komiStatusFeedback('Название папки: от 1 до 40 символов, без служебных названий.');
                return;
            }
            if (Object.prototype.hasOwnProperty.call(userCustomFolders[username]||{},name)) {
                komiStatusFeedback('Такая папка уже существует.');return;
            }
            const key=owner+':folder:'+name;
            if(pendingFolderWrites.has(key))return;
            pendingFolderWrites.add(key);
            try{
                const {data,error}=await _supabase.from('komi_custom_folders')
                    .insert({user_id:owner,name}).select('name').single();
                if(error)throw error;
                if(!data||data.name!==name)throw new Error('Сервер не подтвердил папку.');
                if(currentUser?.authUserId!==owner)return;
                userCustomFolders[username] ||= Object.create(null);
                ++komiFolderLoadEpoch;
                userCustomFolders[username][name]=[];
                saveData();render();komiStatusFeedback('Папка создана.');
            }catch(error){
                if(currentUser?.authUserId===owner)
                    komiStatusFeedback('Не удалось создать папку: '+error.message);
            }finally{pendingFolderWrites.delete(key)}
        }
        async function deleteCustomFolder(folderName) {
            if(!currentUser?.authUserId||!_supabase){openAuthModal('login');return}
            const {username,authUserId:owner}=currentUser;
            if(!komiFolderNameAllowed(folderName)||
                !Object.prototype.hasOwnProperty.call(userCustomFolders[username]||{},folderName))return;
            if(!confirm('Удалить папку «'+folderName+'» и её записи? Сами аниме не удаляются.'))return;
            const key=owner+':folder:'+folderName;
            if(pendingFolderWrites.has(key))return;
            pendingFolderWrites.add(key);
            try{
                const {data,error}=await _supabase.from('komi_custom_folders').delete()
                    .eq('user_id',owner).eq('name',folderName).select('name');
                if(error)throw error;
                if(!Array.isArray(data)||!data.some(x=>x.name===folderName))
                    throw new Error('Сервер не подтвердил удаление.');
                if(currentUser?.authUserId!==owner)return;
                ++komiFolderLoadEpoch;
                delete userCustomFolders[username][folderName];
                if(profileActiveTab===folderName)profileActiveTab='Просмотрено';
                saveData();render();komiStatusFeedback('Папка удалена.');
            }catch(error){
                if(currentUser?.authUserId===owner)
                    komiStatusFeedback('Не удалось удалить папку: '+error.message);
            }finally{pendingFolderWrites.delete(key)}
        }
        // The legacy browser archive is not identity proof. Import only after
        // the authenticated owner explicitly opts in to copying these local files.
        async function importLocalCustomFolders() {
            if(!currentUser?.authUserId||!_supabase){openAuthModal('login');return}
            const {username,authUserId:owner}=currentUser;
            const archive=komiLegacyFolderSnapshot(username);
            if(!archive){komiStatusFeedback('Локальных папок не найдено.');return}
            if(!confirm('Перенести локальные папки из этого браузера в текущий аккаунт? Проверьте, что эти папки ваши. Сохранённые в облаке записи не будут заменены.'))return;
            const key=owner+':import-local-folders';
            if(pendingFolderWrites.has(key))return;
            pendingFolderWrites.add(key);
            try{
                const folderNames=Object.keys(archive).filter(komiFolderNameAllowed);
                if(folderNames.length>80) throw new Error('Слишком много локальных папок для одного переноса (максимум 80).');
                const folderRows=folderNames.map(name=>({user_id:owner,name}));
                const itemRows=[];
                for(const name of folderNames) {
                    const seen=new Set();
                    for(const raw of Array.isArray(archive[name])?archive[name]:[]){
                        const id=Number(raw);
                        if(!Number.isSafeInteger(id)||id<=0||seen.has(id))continue;
                        seen.add(id);itemRows.push({user_id:owner,folder_name:name,anime_id:id});
                    }
                }
                if(folderRows.length){
                    const {error}=await _supabase.from('komi_custom_folders').upsert(folderRows,{
                        onConflict:'user_id,name',ignoreDuplicates:true
                    });
                    if(error)throw error;
                }
                for(let i=0;i<itemRows.length;i+=100){
                    const {error}=await _supabase.from('komi_folder_items')
                        .upsert(itemRows.slice(i,i+100),{
                            onConflict:'user_id,folder_name,anime_id',ignoreDuplicates:true
                        });
                    if(error)throw error;
                }
                if(currentUser?.authUserId!==owner)return;
                await komiLoadCloudFolders(owner,username);
                komiStatusFeedback('Локальные папки перенесены. Исходная копия сохранена.');
                render();
            }catch(error){
                if(currentUser?.authUserId===owner)
                    komiStatusFeedback('Перенос не завершён: '+error.message);
            }finally{pendingFolderWrites.delete(key)}
        }

        async function postToProfileWall(profileOwner) {
            if (!currentUser) { openAuthModal('login'); return; }
            const input = document.getElementById('wallMessageInput');
            const text = input ? input.value.trim() : '';
            if (!text) return;

            if (!profileWalls[profileOwner]) profileWalls[profileOwner] = [];
            profileWalls[profileOwner].unshift({
                author: currentUser.username,
                text,
                time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            });

            saveData();
            input.value = '';
            render();
        }

        async function deleteWallMessage(profileOwner, msgIndex) {
            if (!confirm('Удалить это сообщение?')) return;
            if (profileWalls[profileOwner]) {
                profileWalls[profileOwner].splice(msgIndex, 1);
                saveData();
                render();
            }
        }

        function cleanAnimeDescription(value) {
            return escapeFriendHtml(String(value || '')
                .replace(/\[(?:character|anime|manga|person|user|url|b|i|s|spoiler|quote|code|size|color|center|left|right|poster|image|video|audio|youtube|html)[^\]]*\]/gi, ' ')
                .replace(/\[\/(?:character|anime|manga|person|user|url|b|i|s|spoiler|quote|code|size|color|center|left|right|poster|image|video|audio|youtube|html)\]/gi, ' ')
                .replace(/<[^>]*>/g, ' ')
                .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
                .replace(/&(?:#?x?[\w]+);/gi, ' ')
                .replace(/[\u0000-\u001f\s]+/g, ' ').trim());
        }
        // Shikimori's legacy REST image API exposes original and preview sizes.
        // Prefer the smaller size in cards without rewriting saved anime metadata.
        function komiCardPosterSource(raw) {
            const original = komiSafeUrl(raw) || '/anime-artwork.svg';
            const usePreview = /^https:\/\/shikimori\.(?:one|io)\/system\/animes\/original\/[0-9]+\.jpg(?:\?[0-9]+)?$/i.test(original);
            const preferred = usePreview ? original.replace('/system/animes/original/', '/system/animes/preview/') : original;
            return {preferred, original:usePreview ? original : ''};
        }
        function komiCardPosterFallback(img) {
            if (!img) return;
            const source = String(img.dataset?.posterOriginal || '');
            if (source && !img.dataset.posterTriedOriginal && /^https:\/\//i.test(source)) {
                img.dataset.posterTriedOriginal = '1';
                img.src = source;
                return;
            }
            img.onerror = null;
            img.src = '/anime-artwork.svg';
        }
        function renderCard(anime) {
            const year=komiAnimeYear(anime);
            const type=komiCatalogType(anime);
            const score=Number(anime.shikiRating);
            const rating=Number.isFinite(score)&&score>0?score.toFixed(1):'—';
            const genres=Array.isArray(anime.genres)?anime.genres:[anime.genre].filter(Boolean);
            const genreText=escapeFriendHtml(genres.slice(0,2).join(', '));
            const name=escapeFriendHtml(anime.title||anime.originalTitle||'Без названия');
            const id=String(anime.id);
            const posterSource=komiCardPosterSource(anime.poster || anime.banner);
            const poster=escapeFriendHtml(posterSource.preferred);
            const posterOriginalAttr=posterSource.original ? ' data-poster-original="'+escapeFriendHtml(posterSource.original)+'"' : '';
            const episodeCount=Number(anime.episodeCount)||(Array.isArray(anime.episodes)?anime.episodes.length:0);
            const lastAdded=Date.parse(anime.lastEpisodeAddedAt);
            const fresh=Number.isFinite(lastAdded)&&Date.now()>=lastAdded&&Date.now()-lastAdded<72*3600000;
            return '<div class="anime-card" role="button" tabindex="0" aria-label="Открыть аниме '+name+'" '+
                'data-komi-onclick="playSound();openWatchModal(\''+id+'\')" data-komi-onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openWatchModal(\''+id+'\')}">'+
                '<div class="anime-rating-badge">★ '+rating+'</div>'+
                '<div class="anime-poster-box">'+
                    '<img src="'+poster+'" alt="Постер: '+name+'" class="anime-poster" loading="lazy" decoding="async" referrerpolicy="no-referrer"'+posterOriginalAttr+' data-komi-onerror="komiCardPosterFallback(this)">'+
                    '<div class="anime-poster-fallback" style="display:'+(poster?'none':'flex')+';position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:10px;padding:12px;text-align:center;background:linear-gradient(145deg,#1f1f1f,#101010);color:#939393"><span style="font-size:30px;font-weight:800;color:#eaeaea">K</span><span style="font-size:11px;line-height:1.4">Постер недоступен</span></div>'+
                    '<div class="anime-quick-view"><span class="btn-glow" style="padding:7px 12px;font-size:11px">▷ Смотреть</span></div>'+
                '</div>'+
                '<div class="anime-info"><div class="anime-title" title="'+name+'">'+name+'</div>'+
                  '<div class="komi-card-meta">'+(year?'<span>'+year+'</span>':'')+'<span>'+type+'</span>'+(fresh?'<span class="komi-new-ep">● Новая серия</span>':'')+'</div>'+
                  '<div class="anime-meta-card"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;color:var(--text-muted)">'+genreText+'</span><span>'+episodeCount+' сер.</span></div>'+
                '</div></div>';
        }

        let komiRouletteRun = 0;
        let komiRoulettePool = [];
        let komiRouletteCatalogKey = '';
        let komiRouletteLastId = null;
        const komiRoulettePosterCache = new Map();

        // "Случайное аниме" means something the visitor can actually watch.
        // Anime without episode sources remains available in the full catalog.
        function komiRandomPlayableAnime(items) {
            const unique = new Map();
            for (const item of items || []) {
                if (!item || item.id == null) continue;
                const cardCount = Number(item.episodeCount) || 0;
                const realSources = Array.isArray(item.episodes) &&
                    item.episodes.some(ep => ep && (Object.values(ep.sources || {}).some(Boolean) || ep.url));
                if (cardCount > 0 || realSources) unique.set(String(item.id), item);
            }
            return [...unique.values()];
        }

        function komiPreloadRoulettePoster(url, maxWait = 1600) {
            const safe = typeof url === 'string' && /^https:\/\//i.test(url.trim()) ? url.trim() : '';
            if (!safe) return Promise.resolve('');
            if (komiRoulettePosterCache.has(safe)) return komiRoulettePosterCache.get(safe);
            const pending = new Promise(resolve => {
                const image = new Image();
                let settled = false;
                const finish = result => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeout);
                    image.onload = image.onerror = null;
                    resolve(result);
                };
                const timeout = setTimeout(() => finish(''), maxWait);
                image.onload = () => finish(safe);
                image.onerror = () => finish('');
                image.src = safe;
            });
            komiRoulettePosterCache.set(safe, pending);
            if (komiRoulettePosterCache.size > 80) {
                komiRoulettePosterCache.delete(komiRoulettePosterCache.keys().next().value);
            }
            return pending;
        }

        async function komiResolveRoulettePoster(item) {
            const primary = await komiPreloadRoulettePoster(item?.poster, 1600);
            if (primary) return primary;
            const banner = await komiPreloadRoulettePoster(item?.banner, 900);
            if (banner) return banner;
            // Use the anime's verified MAL/Shikimori ID, never a fuzzy title match.
            const id = Number(item?.shikimoriId || item?.id);
            if (!Number.isSafeInteger(id) || id < 1) return '';
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            try {
                const response = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', Accept: 'application/json'},
                    body: JSON.stringify({
                        query: 'query ($id: Int) { Media(idMal: $id, type: ANIME) { coverImage { extraLarge large medium } } }',
                        variables: {id}
                    }),
                    signal: controller.signal
                });
                if (!response.ok) return '';
                const json = await response.json();
                const cover = json?.data?.Media?.coverImage;
                const candidate = cover?.extraLarge || cover?.large || cover?.medium;
                return await komiPreloadRoulettePoster(candidate, 1800);
            } catch {
                return '';
            } finally {
                clearTimeout(timeout);
            }
        }

        function closeKomiRoulette() {
            ++komiRouletteRun;
            document.getElementById('randomRouletteModal')?.classList.remove('active');
            document.getElementById('rouletteContainer')?.classList.remove('is-loading');
        }

        function randomAnimeWithAnimation() {
            const items = komiRandomPlayableAnime(animeList);
            const modal = document.getElementById('randomRouletteModal');
            const imgEl = document.getElementById('rouletteImage');
            const titleEl = document.getElementById('rouletteTitle');
            if (!modal || !imgEl || !titleEl) return;
            const run = ++komiRouletteRun;
            const retry = document.getElementById('rouletteRetry');
            if (retry) retry.hidden = Boolean(items.length);
            if (!items.length) {
                titleEl.textContent = catalogInitialLoadComplete
                    ? 'Пока нет аниме с доступными сериями'
                    : 'Каталог загружается. Повтори попытку через несколько секунд.';
                imgEl.src = '/anime-artwork.svg';
                modal.classList.add('active');
                // A stale timer must never dismiss a newer roulette run.
                setTimeout(() => {
                    if (run === komiRouletteRun) modal.classList.remove('active');
                }, 4500);
                return;
            }
            playSound();
            modal.classList.add('active');
            const container = document.getElementById('rouletteContainer');
            const byId = new Map(items.map(item => [String(item.id), item]));
            const key = items.map(item => String(item.id)).join('|');
            if (!komiRoulettePool.length || key !== komiRouletteCatalogKey) {
                komiRoulettePool = [...byId.keys()];
                for (let i = komiRoulettePool.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [komiRoulettePool[i], komiRoulettePool[j]] =
                        [komiRoulettePool[j], komiRoulettePool[i]];
                }
                komiRouletteCatalogKey = key;
            }
            let finalId = komiRoulettePool.pop();
            if (items.length > 1 && finalId === String(komiRouletteLastId)) {
                const alternative = komiRoulettePool.pop();
                if (alternative) {
                    komiRoulettePool.unshift(finalId);
                    finalId = alternative;
                }
            }
            const finalItem = byId.get(finalId) || items[0];
            komiRouletteLastId = String(finalItem.id);
            let imageToken = 0;
            const finalPoster = komiResolveRoulettePoster(finalItem);

            function showSpinTitle(item) {
                titleEl.textContent = item.title || item.originalTitle || 'Аниме';
                imgEl.alt = 'Постер: ' + titleEl.textContent;
                imgEl.style.opacity = '0';
                container?.classList.add('is-loading');
                const token = ++imageToken;
                komiPreloadRoulettePoster(item.poster, 850).then(url => {
                    if (!url || token !== imageToken || run !== komiRouletteRun ||
                        !modal.classList.contains('active')) return;
                    imgEl.src = url;
                    imgEl.style.opacity = '1';
                    container?.classList.remove('is-loading');
                });
            }

            let step = 0;
            let previousId = finalId;
            function spinStep() {
                if (run !== komiRouletteRun || !modal.classList.contains('active')) return;
                if (step < 7) {
                    let option = items[Math.floor(Math.random() * items.length)];
                    if (items.length > 1 && String(option.id) === String(previousId))
                        option = items.find(item => String(item.id) !== String(previousId)) || option;
                    previousId = String(option.id);
                    showSpinTitle(option);
                    step++;
                    setTimeout(spinStep, 100 + step * 35);
                    return;
                }
                showSpinTitle(finalItem);
                const token = imageToken;
                // Give the final picture time to load. An unsuccessful provider
                // shows a monochrome fallback, never the poster of another anime.
                Promise.all([
                    Promise.race([
                        finalPoster,
                        new Promise(resolve => setTimeout(() => resolve(''), 3600))
                    ]),
                    new Promise(resolve => setTimeout(resolve, 1000))
                ]).then(([poster]) => {
                    if (run !== komiRouletteRun || token !== imageToken ||
                        !modal.classList.contains('active')) return;
                    imgEl.src = poster || '/anime-artwork.svg';
                    imgEl.style.opacity = '1';
                    container?.classList.remove('is-loading');
                    if (poster && poster !== finalItem.poster) {
                        finalItem.poster = poster;
                    }
                    setTimeout(() => {
                        if (run !== komiRouletteRun || !modal.classList.contains('active')) return;
                        modal.classList.remove('active');
                        openWatchModal(String(finalItem.id));
                    }, 600);
                });
            }
            spinStep();
        }

        let protectedFriendRequests = [];
        let protectedFriendList = { owner: null, idsByName: new Map() };
        let protectedFriendSent = { owner: null, names: new Set() };

        function friendsFor(username) {
            if (username !== currentUser?.username || protectedFriendList.owner !== currentUser?.authUserId) return [];
            return [...protectedFriendList.idsByName.keys()];
        }
        async function loadProtectedFriends() {
            const uid = currentUser?.authUserId;
            if (!uid || !_supabase) return;
            const [requests, friendships, outgoing] = await Promise.all([
                _supabase.from('komi_friend_requests').select('id,sender_id').eq('receiver_id', uid).eq('status', 'pending'),
                _supabase.from('komi_friendships').select('user_a,user_b'),
                _supabase.from('komi_friend_requests').select('receiver_id').eq('sender_id', uid).eq('status', 'pending')
            ]);
            if (requests.error || friendships.error || outgoing.error) throw requests.error || friendships.error || outgoing.error;
            const friendIds = friendships.data.map(row => row.user_a === uid ? row.user_b : row.user_a);
            const ids = [...new Set([...friendIds, ...requests.data.map(row => row.sender_id), ...outgoing.data.map(row => row.receiver_id)])];
            const profiles = ids.length
                ? await _supabase.from('komi_profiles').select('user_id,username').in('user_id', ids)
                : { data: [] };
            if (profiles.error) throw profiles.error;
            if (currentUser?.authUserId !== uid) return;
            const names = new Map(profiles.data.map(row => [row.user_id, row.username]));
            protectedFriendList = {
                owner: uid,
                idsByName: new Map(friendIds.filter(id => names.has(id)).map(id => [names.get(id), id]))
            };
            protectedFriendSent = {
                owner: uid,
                names: new Set(outgoing.data.map(row => names.get(row.receiver_id)).filter(Boolean))
            };
            protectedFriendRequests = requests.data.map(row => ({
                owner: uid, id: row.id, name: names.get(row.sender_id) || 'Пользователь'
            }));
            updateNotificationsUI();
            renderFriendsDrawer();
            window.KomiFriendRooms?.refresh();
        }

        async function respondProtectedFriendRequest(id, accept) {
            try {
                const { error } = await _supabase.rpc('komi_respond_friend_request', {
                    p_request_id: id, p_accept: accept
                });
                if (error) throw error;
                await loadProtectedFriends();
            } catch (error) {
                alert('Не удалось обработать заявку: ' + error.message);
            }
        }

        async function sendFriendRequest(targetUsername) {
            const sender = currentUser?.authUserId;
            if (!sender) { openAuthModal('login'); return; }
            if (currentUser.username === targetUsername) return;
            try {
                const { data: target, error: lookupError } = await _supabase.from('komi_profiles')
                    .select('user_id').eq('username', targetUsername).maybeSingle();
                if (lookupError) throw lookupError;
                if (!target) throw new Error('Профиль пользователя недоступен.');
                if (currentUser?.authUserId !== sender) return;
                if (target.user_id === sender || friendsFor(currentUser.username).includes(targetUsername)) return;
                const { error } = await _supabase.from('komi_friend_requests')
                    .insert({ sender_id: sender, receiver_id: target.user_id });
                if (error) throw error;
                await loadProtectedFriends().catch(e => console.warn('Обновление заявок:', e.message));
                if (currentUser?.authUserId === sender) alert('Заявка отправлена.');
            } catch (error) {
                if (currentUser?.authUserId === sender) alert('Не удалось отправить заявку: ' + error.message);
            }
        }

        async function removeFriend(friendUsername) {
            const uid = currentUser?.authUserId;
            const friendId = uid && protectedFriendList.owner === uid && protectedFriendList.idsByName.get(friendUsername);
            if (!friendId || !confirm("Удалить " + friendUsername + " из друзей?")) return;
            try {
                const { error } = await _supabase.rpc("komi_remove_friend", { p_friend_id: friendId });
                if (error) throw error;
                if (currentUser?.authUserId !== uid) return;
                await loadProtectedFriends();
                if (currentUser?.authUserId === uid) openProfile(friendUsername);
            } catch (error) {
                if (currentUser?.authUserId === uid) alert("Не удалось удалить друга: " + error.message);
            }
        }

        function closeSearchDropdown() {
            const dd = document.getElementById('searchDropdown');
            if (dd) dd.classList.remove('active');
        }
        document.addEventListener('pointerdown', function(e) {
            if (!e.target.closest('.search-container')) closeSearchDropdown();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { closeSearchDropdown(); document.getElementById('searchInput')?.blur(); }
        });

        // Build search suggestions with DOM nodes, never interpolated HTML or
        // inline JavaScript from catalog metadata.
        function komiSearchSuggestion(anime, compact = false) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'search-dropdown-item';
            button.addEventListener('click', () => selectAnimeFromSearch(String(anime.id)));

            const poster = document.createElement('img');
            poster.src = komiSafeUrl(anime.poster) || '/anime-artwork.svg';
            poster.alt = '';
            poster.style.cssText = compact
                ? 'width:26px;height:36px;object-fit:cover;border-radius:6px;background:#222'
                : 'width:38px;height:53px;object-fit:cover;border-radius:8px;background:#222';
            const details = document.createElement('span');
            details.style.cssText = 'flex:1;min-width:0;text-align:left;overflow:hidden';
            const name = document.createElement('b');
            name.textContent = String(anime.title || 'Без названия');
            name.style.cssText = 'display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
            details.append(name);
            if (!compact) {
                const subtitle = document.createElement('small');
                subtitle.style.cssText = 'color:#a6a6a6';
                subtitle.textContent = String(komiAnimeYear(anime) || '') + ' · ' + komiCatalogType(anime);
                details.append(subtitle);
            }
            const rating = document.createElement('span');
            rating.style.cssText = 'font-size:11px;color:#eaeaea';
            const score = Number(anime.shikiRating);
            rating.textContent = '★ ' + (Number.isFinite(score) ? score : 0).toFixed(1);
            button.append(poster,details,rating);
            return button;
        }

        function showSearchDropdown() {
            const dd = document.getElementById('searchDropdown');
            if (!dd) return;
            const query = document.getElementById('searchInput')?.value.trim() || '';
            if (query) { handleInstantSearch(query); return; }
            const heading = document.createElement('div');
            heading.textContent = 'Популярное';
            heading.style.cssText = 'padding:5px 10px;font-size:10px;color:var(--text-muted)';
            dd.replaceChildren(heading,...animeList.slice(0,5).filter(Boolean).map(a=>komiSearchSuggestion(a,true)));
            dd.classList.add('active');
        }

        function handleInstantSearch(q) {
            const dd = document.getElementById('searchDropdown');
            if (!dd) return;
            const input = String(q || '');
            const query = input.trim().toLocaleLowerCase('ru-RU');
            if (!query) {
                catalogSearchQuery = '';
                dd.replaceChildren();
                if (currentView === 'catalog') komiRefreshCatalogGrid();
                dd.classList.remove('active');
                return;
            }
            const results = animeList.filter(a=>a && [
                a.title,a.originalTitle,...(Array.isArray(a.genres) ? a.genres : [])
            ].some(v=>String(v || '').toLocaleLowerCase('ru-RU').includes(query))).slice(0,8);
            if (results.length) {
                dd.replaceChildren(...results.map(a=>komiSearchSuggestion(a)));
            } else {
                const empty = document.createElement('div');
                empty.textContent = 'По запросу ничего не найдено';
                empty.style.cssText = 'padding:16px;color:#a7a7a7;font-size:12px;text-align:center';
                dd.replaceChildren(empty);
            }
            dd.classList.add('active');
            catalogSearchQuery = input.slice(0,120);
            if (currentView !== 'catalog') {
                currentView = 'catalog';
                catalogFilterGenre = 'Все';
                catalogFilterYear = 'Все';
                catalogFilterType = 'Все';
                render();
            }
            const field = document.getElementById('komiCatalogSearchInput');
            if (field && field.value !== catalogSearchQuery) field.value = catalogSearchQuery;
            komiRefreshCatalogGrid();
        }

        function selectAnimeFromSearch(id) {
            document.getElementById('searchDropdown').classList.remove('active');
            openWatchModal(id);
        }

        let komiApiSearchController;
        async function searchAnimeFromAPI() {
            komiApiSearchController?.abort();
            const controller = komiApiSearchController = new AbortController();
            const query = document.getElementById('apiSearchTitle').value.trim();
            const results = document.getElementById('apiSearchResultsList');
            results.style.display = 'block';
            results.textContent = query ? 'Поиск в базе Shikimori…' : 'Введите название аниме.';
            if (!query) return;
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                const target = 'https://shikimori.me/api/animes?search='+encodeURIComponent(query)+'&limit=6';
                const response = await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent(target), {signal:controller.signal});
                if (!response.ok) throw Error('HTTP '+response.status);
                const rows = await response.json();
                if (!Array.isArray(rows)) throw Error('Некорректный ответ каталога');
                if (komiApiSearchController !== controller || !results.isConnected || document.getElementById('apiSearchTitle').value.trim() !== query) return;
                results.replaceChildren();
                if (!rows.length) results.textContent = 'Ничего не найдено.';
                for (const anime of rows) {
                    const button = document.createElement('button');
                    button.type = 'button'; button.className = 'search-dropdown-item';
                    button.textContent = (anime.russian || anime.name || 'Без названия')+' · '+(anime.aired_on?.slice(0,4) || 'Год не указан');
                    button.onclick = () => {
                        const poster = anime.image?.original ? new URL(anime.image.original,'https://shikimori.me').href : '';
                        fillFormWithAnimeData({id:anime.id, title:anime.russian || anime.name, poster, score:anime.score || 0,
                            year:anime.aired_on?.slice(0,4) || '', type:anime.kind === 'movie' ? 'Фильм' : 'Сериал',
                            synopsis:anime.description || '', genres:[], images:poster ? [poster] : []});
                    };
                    results.append(button);
                }
            } catch (error) {
                if (komiApiSearchController === controller && results.isConnected)
                    results.textContent = 'Не удалось выполнить поиск. Проверьте соединение и повторите.';
            } finally { clearTimeout(timer); }
        }

        async function importTopSeasonalAnime() {
            const resultsContainer = document.getElementById('apiSearchResultsList');
            resultsContainer.innerHTML = '<div style="padding: 5px; font-size: 11px; color: var(--text-muted);">Импорт из топа Shikimori...</div>';
            resultsContainer.style.display = 'block';

            try {
                const targetUrl = `https://shikimori.me/api/animes?order=popularity&limit=40`;
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error('Ошибка');

                const data = await res.json();
                if (data && data.length > 0) {
                    const randomAnime = data[Math.floor(Math.random() * data.length)];
                    const posterUrl = randomAnime.image?.original ? `https://shikimori.me${randomAnime.image.original}` : 'https://cdn.myanimelist.net/images/anime/1122/96435.jpg';
                    fillFormWithAnimeData({
                        id:randomAnime.id,
                        title: randomAnime.russian || randomAnime.name,
                        poster: posterUrl,
                        score: randomAnime.score || '8.8',
                        year: randomAnime.aired_on ? randomAnime.aired_on.split('-')[0] : '2026',
                        type: randomAnime.kind === 'movie' ? 'Фильм' : 'Сериал',
                        synopsis: randomAnime.description || 'Популярное аниме.',
                        genres: [],
                        images: [posterUrl]
                    });
                }
            } catch(e) {
                resultsContainer.innerHTML = `<div style="padding: 5px; font-size: 11px; color: #eaeaea;">Ошибка загрузки.</div>`;
            }
        }

        function fillFormWithAnimeData(animeData) {
            const idInput = document.getElementById('animeShikimoriId');
            if (idInput && animeData.id && !idInput.readOnly) idInput.value = animeData.id;
            document.getElementById('animeTitle').value = animeData.title || '';
            document.getElementById('animePoster').value = animeData.poster || '';
            document.getElementById('animeShikiRating').value = animeData.score || '8.5';
            document.getElementById('animeScreenshots').value = animeData.images.join(', ');
            document.getElementById('animeYear').value = animeData.year || '2026';
            document.getElementById('animeType').value = animeData.type || 'Сериал';
            document.getElementById('animeDesc').value = animeData.synopsis || '';
            document.getElementById('apiSearchResultsList').style.display = 'none';
        }

        let komiAdminVerified = false;
        async function requireServerAdmin(silent = false) {
            const uid = currentUser?.authUserId;
            if (!_supabase || !uid) {
                komiAdminVerified = false;
                if (!silent) alert('Войдите в подтверждённый аккаунт Supabase.');
                return false;
            }
            try {
                const {data, error} = await _supabase.rpc('komi_is_admin');
                const verified = !error && data === true && currentUser?.authUserId === uid;
                komiAdminVerified = verified;
                renderHeaderUser();
                if (!verified && !silent) alert('Нет прав администратора. Права выдаёт только владелец Supabase.');
                return verified;
            } catch (error) {
                komiAdminVerified = false;
                if (!silent) alert('Проверка администратора недоступна.');
                console.warn('Komi admin role check:',error.message);
                return false;
            }
        }
        async function openAdminPanel() {
            if (!(await requireServerAdmin())) return;
            const modal = document.getElementById('adminModal');
            const content = document.getElementById('adminModalContent');
            content.replaceChildren();
            const heading = document.createElement('h2');
            heading.textContent = 'Панель администратора';
            heading.style.cssText = 'margin:0 0 14px;font-size:22px';
            const close = document.createElement('button');
            close.type='button';close.className='modal-close';close.textContent='×';
            close.setAttribute('aria-label','Закрыть админ-панель');
            close.onclick=()=>modal.classList.remove('active');
            const actions = document.createElement('div');
            actions.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin-bottom:15px';
            const add = document.createElement('button');
            add.className='btn-glow';add.textContent='+ Добавить аниме';
            add.onclick=()=>{modal.classList.remove('active');openAddModal();};
            const backup = document.createElement('button');
            backup.className='btn-secondary';backup.textContent='Скачать список JSON';
            backup.onclick=()=>exportBackup();
            actions.append(add,backup);
            const input = document.createElement('input');
            input.type='search';input.className='form-control';
            input.placeholder='Поиск по названию или Shikimori ID';
            input.setAttribute('aria-label','Поиск аниме для редактирования');
            input.style.cssText='margin:0 0 12px;width:100%';
            const list = document.createElement('div');
            list.id='komiAdminResults';
            list.style.cssText='max-height:55vh;overflow:auto;display:grid;gap:8px';
            input.addEventListener('input',()=>komiRenderAdminResults(input.value));
            content.append(close,heading,actions,input,list);
            modal.classList.add('active');
            komiRenderAdminResults('');
            input.focus();
        }
        function komiRenderAdminResults(term) {
            const list = document.getElementById('komiAdminResults');
            if (!list) return;
            const search = String(term || '').trim().toLowerCase();
            const matches = animeList.filter(a =>
                !search || String(a.id).includes(search) ||
                String(a.title || '').toLocaleLowerCase('ru').includes(search)).slice(0,80);
            list.replaceChildren();
            for (const item of matches) {
                const row=document.createElement('div');
                row.style.cssText='display:flex;gap:12px;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid #333;border-radius:12px';
                const label=document.createElement('span');
                label.textContent=String(item.title||'Аниме')+' · #'+String(item.id);
                const button=document.createElement('button');
                button.type='button';button.className='btn-secondary';button.textContent='Редактировать';
                button.addEventListener('click',()=>{
                    document.getElementById('adminModal')?.classList.remove('active');
                    openAddModal(String(item.id));
                });
                row.append(label,button);
                list.append(row);
            }
            if (!matches.length) list.textContent='Аниме не найдено.';
        }
        function exportBackup() {
            if (!komiAdminVerified || !currentUser?.authUserId) return;
            const blob = new Blob([JSON.stringify(animeList)],{type:'application/json'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;a.download='komi_anime_cards_backup.json';a.click();
            setTimeout(()=>URL.revokeObjectURL(url),2000);
        }
        async function deleteAnime() {
            alert('Удаление отключено для сохранности архива. Редактирование доступно через защищённую панель.');
        }

        function renderGenresCheckboxes(selectedGenres = []) {
            const container = document.getElementById('genresCheckboxList');
            container.innerHTML = availableGenresList.map(g => `
                <label style="display:flex; align-items:center; gap:5px; font-size:11px; cursor:pointer;">
                    <input type="checkbox" class="genre-checkbox" value="${g}" ${selectedGenres.includes(g) ? 'checked' : ''}> ${g}
                </label>
            `).join('');
        }

        async function openAddModal(editId = null) {
            if (!(await requireServerAdmin())) return;
            if (!document.getElementById('addModal')) {
                const template = document.getElementById('komiAdminAnimeModalTemplate');
                if (template) document.body.appendChild(template.content.cloneNode(true));
            }
            const modal=document.getElementById('addModal');
            if (!modal) return;
            const form=document.getElementById('animeForm');
            form.reset();
            const animeId=document.getElementById('animeShikimoriId');
            animeId.readOnly=false;
            document.getElementById('editAnimeId').value='';
            document.getElementById('episodesList').replaceChildren();
            renderGenresCheckboxes();
            if (editId) {
                const numeric=Number(editId);
                if (!Number.isSafeInteger(numeric)||numeric<1) return;
                const {data:row,error}=await _supabase.from('anime_catalog')
                    .select('shikimori_id,data').eq('shikimori_id',numeric).maybeSingle();
                if (error || !row || !(await requireServerAdmin(true))) {
                    alert('Не удалось получить данные аниме для правки.');
                    return;
                }
                const a=row.data || {};
                document.getElementById('editAnimeId').value=String(row.shikimori_id);
                animeId.value=String(row.shikimori_id);
                animeId.readOnly=true;
                document.getElementById('animeTitle').value=a.title||'';
                document.getElementById('animePoster').value=a.poster||'';
                document.getElementById('animeShikiRating').value=a.shikiRating||'';
                document.getElementById('animeScreenshots').value=(a.screenshots||[]).join(', ');
                document.getElementById('animeTrailer').value=a.trailer||'';
                document.getElementById('animeYear').value=a.year||'';
                document.getElementById('animeType').value=a.type||'';
                document.getElementById('animeDesc').value=a.desc||'';
                renderGenresCheckboxes(a.genres||[a.genre].filter(Boolean));
                if (Array.isArray(a.episodes)) {
                    for (const ep of a.episodes) {
                        const sources=ep.sources || (ep.url?{'Default':ep.url}:{});
                        for (const [source,url] of Object.entries(sources)) {
                            addEpisodeField();
                            const group=document.getElementById('episodesList').lastElementChild;
                            group.querySelector('.ep-season').value=String(ep.season||1);
                            group.querySelector('.ep-title').value=String(ep.title||'Эпизод');
                            group.querySelector('.ep-source-name').value=String(source);
                            group.querySelector('.ep-url').value=String(url||'');
                        }
                    }
                }
            }
            modal.classList.add('active');
        }

        function closeAddModal() { komiApiSearchController?.abort(); document.getElementById('addModal')?.classList.remove('active'); }
        
        function addEpisodeField() {
            const div = document.createElement('div');
            div.style.cssText = "display:flex; gap:5px; margin-top:5px; align-items:center; flex-wrap:wrap; background:var(--bg-input); padding:6px; border-radius:6px;";
            div.innerHTML = `
                <input type="number" class="form-control ep-season" value="1" min="1" style="width:50px;">
                <input type="text" class="form-control ep-title" value="Эпизод" style="flex:1; min-width:70px;">
                <input type="text" class="form-control ep-source-name" value="Kodik" style="width:80px;">
                <input type="text" class="form-control ep-url" placeholder="iframe код или mp4..." style="flex:2; min-width:140px;" required>
            `;
            document.getElementById('episodesList').appendChild(div);
        }

        async function saveAnimeForm(event) {
            event.preventDefault();
            if (!(await requireServerAdmin())) return;
            const uid=currentUser?.authUserId;
            const form=document.getElementById('animeForm');
            if (!form.reportValidity()) return;
            const editId=String(document.getElementById('editAnimeId').value||'');
            const rawId=String(document.getElementById('animeShikimoriId').value||'');
            if (!/^[1-9][0-9]{0,11}$/.test(rawId)) {
                alert('Укажите действительный числовой Shikimori ID.');
                return;
            }
            const id=Number(rawId);
            if (!Number.isSafeInteger(id)||id<1 || (editId && editId!==rawId)) return;
            const title=document.getElementById('animeTitle').value.trim().slice(0,200);
            const poster=document.getElementById('animePoster').value.trim().slice(0,2000);
            if (!title || !poster.startsWith('https://')) {
                alert('Введите название и безопасную HTTPS-ссылку на постер.');
                return;
            }
            const episodesByKey=new Map();
            for(const group of document.querySelectorAll('#episodesList > div')) {
                const season=Number(group.querySelector('.ep-season')?.value);
                const epTitle=String(group.querySelector('.ep-title')?.value||'').trim().slice(0,200);
                const source=String(group.querySelector('.ep-source-name')?.value||'Плеер 1').trim().slice(0,90);
                const url=String(group.querySelector('.ep-url')?.value||'').trim();
                if(!url)continue;
                if(!Number.isInteger(season)||season<1||season>100||!epTitle||url.length>4096) {
                    alert('Проверьте номер сезона, название и адрес серии.');
                    return;
                }
                const key=season+'_'+epTitle;
                if(!episodesByKey.has(key))episodesByKey.set(key,{season,title:epTitle,sources:{}});
                episodesByKey.get(key).sources[source]=url;
            }
            const episodes=[...episodesByKey.values()];
            const {data:old,error:readError}=await _supabase.from('anime_catalog')
                .select('data').eq('shikimori_id',id).maybeSingle();
            if (readError || (editId && !old) || (!editId && old)) {
                alert(readError?.message || (editId?'Аниме больше не найдено.':'Такое аниме уже существует. Откройте редактирование.'));
                return;
            }
            if (uid!==currentUser?.authUserId || !(await requireServerAdmin(true))) return;
            const previous=old?.data||{};
            const genreValues=[...document.querySelectorAll('#genresCheckboxList .genre-checkbox:checked')].map(x=>x.value);
            const screenshots=document.getElementById('animeScreenshots').value.split(',').map(x=>x.trim()).filter(x=>x.startsWith('https://')).slice(0,20);
            const rating=Number(document.getElementById('animeShikiRating').value);
            const data={...previous,id:String(id),shikimoriId:id,title,poster,
                shikiRating:Number.isFinite(rating)&&rating>=0&&rating<=10?rating:0,
                year:document.getElementById('animeYear').value.trim().slice(0,10),
                type:document.getElementById('animeType').value.trim().slice(0,32)||'Сериал',
                desc:document.getElementById('animeDesc').value.slice(0,20000),
                trailer:document.getElementById('animeTrailer').value.trim().slice(0,2000),
                screenshots,genres:genreValues,genre:genreValues[0]||''};
            // Keep original episodes whenever the editor has no episode sources.
            if (episodes.length) data.episodes=episodes;
            const now=new Date().toISOString();
            let result;
            if (editId) result=await _supabase.from('anime_catalog')
                .update({data,updated_at:now}).eq('shikimori_id',id).select('shikimori_id').single();
            else result=await _supabase.from('anime_catalog')
                .insert({shikimori_id:id,data,updated_at:now}).select('shikimori_id').single();
            if (result.error || !result.data || Number(result.data.shikimori_id)!==id) {
                alert('Ошибка сохранения в Supabase: '+(result.error?.message||'изменение не подтверждено'));
                return;
            }
            if (uid!==currentUser?.authUserId) return;
            const episodeCount=Array.isArray(data.episodes)?data.episodes.length:Number(data.episodeCount)||0;
            const card={...data,episodeCount,episodes:[]};
            const index=animeList.findIndex(item=>String(item.id)===rawId);
            if(index>=0)animeList[index]=card;
            else animeList.push(card);
            closeAddModal();
            render();
            alert('Аниме сохранено в защищённом каталоге.');
        }

        async function showGoogleAuthInfo() {
            if (!_supabase) { alert('Supabase недоступен. Попробуй позже.'); return; }
            try {
                const { error } = await _supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin + window.location.pathname }
                });
                if (error) throw error;
            } catch (error) {
                console.error('Google OAuth:', error);
                alert('Не удалось открыть Google: ' + (error.message || 'проверь настройки Google OAuth в Supabase'));
            }
        }

        // Google identities are namespaced by verified Supabase user ID, never by
        // an editable display name, email, or a privileged local username.
        function komiReservedAccountName(value) {
            const name = String(value || '').trim().toLowerCase();
            return /^(admin|administrator|moderator|mod|staff|support|system|owner|komianime|komi_anime)$/.test(name)
                || name.startsWith('google_');
        }
        function googleProfileName(authUser) {
            const requested = String(authUser.user_metadata?.username || '').trim();
            if (authUser.app_metadata?.provider !== 'google'
                && /^[A-Za-z0-9_]{3,24}$/.test(requested)
                && !komiReservedAccountName(requested)) return requested;
            return 'google_' + String(authUser.id || '').replace(/[^a-fA-F0-9]/g, '');
        }
        function komiSafeAccountUsername(username, authUserId) {
            const value = String(username || '').trim();
            // Reserved labels and Google-ID namespaces may only belong to their server owner.
            if (/^[A-Za-z0-9_]{3,48}$/.test(value) && !komiReservedAccountName(value)) return value;
            return 'google_' + String(authUserId || '').replace(/[^a-fA-F0-9]/g, '').slice(0, 32);
        }
        function applySavedKomiProfile(username, profile) {
            userProfiles[username] = {
                ...userProfiles[username],
                displayName: profile.display_name || '',
                avatar: profile.avatar_url || userProfiles[username]?.avatar || '',
                status: profile.bio ?? 'Новичок',
                regDate: profile.created_at ? new Date(profile.created_at).toLocaleDateString('ru-RU') : ''
            };
        }
        async function restoreGoogleSession() {
            if (!_supabase) return;
            try {
                const { data: { session }, error } = await _supabase.auth.getSession();
                if (error) throw error;
                if (!session?.user) {
                    if (currentUser?.authUserId) {
                        clearKomiAccountData(currentUser);
                        currentUser = null;
                        updateNotificationsUI();
                        closeWatchModal();
                        await leaveWatchPartyRoom();
                        saveData();
                        render();
                    }
                    return;
                }
                const username = googleProfileName(session.user);
                const previousVerified = currentUser?.authUserId ? {...currentUser} : null;
                if (previousVerified && (previousVerified.authUserId !== session.user.id ||
                    previousVerified.username !== username)) {
                    // Auth changes can arrive without an explicit sign-out. Never leave
                    // the preceding owner's private lists or folders in memory/localStorage.
                    closeWatchModal();
                    await leaveWatchPartyRoom().catch(error =>
                        console.warn('Закрытие прежней комнаты:',error.message));
                    clearKomiAccountData(previousVerified);
                    protectedFriendRequests = [];
                    protectedFriendList = {owner:null,idsByName:new Map()};
                    protectedFriendSent = {owner:null,names:new Set()};
                    komiAdminVerified = false;
                    currentUser = null;
                }
                // Verified Supabase sessions take precedence; legacy browser data is retained.
                currentUser = { username, authProvider: session.user.app_metadata?.provider || 'email', authUserId: session.user.id };
                updateNotificationsUI();
                requireServerAdmin(true).catch(e => console.warn('Admin role restore:',e.message));
                // Discard unverified local copies before loading this user's server-owned records.
                userAnimeStatuses[username] = {};
                userFavorites[username] = {};
                for (const key of Object.keys(komiEpisodeProgress)) if (key.startsWith(username + '_')) delete komiEpisodeProgress[key];
                if (!userProfiles[username]) {
                    const meta = session.user.user_metadata || {};
                    userProfiles[username] = {
                        avatar: typeof meta.avatar_url === 'string' && meta.avatar_url.startsWith('https://') ? meta.avatar_url : 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(username),
                        status: 'Новичок ★',
                        regDate: new Date().toLocaleDateString('ru-RU')
                    };
                    // Google profile data must not be written to legacy shared JSON.
                }
                try {
                    const { data: savedProfile, error: profileError } = await _supabase.from('komi_profiles').select('display_name,avatar_url,bio,created_at').eq('user_id', session.user.id).maybeSingle();
                    if (profileError) console.warn('Profile load:', profileError.message);
                    else if (savedProfile) {
                        if (currentUser?.authUserId === session.user.id) applySavedKomiProfile(username, savedProfile);
                    } else {
                        const { error: createError } = await _supabase.from('komi_profiles').insert({
                            user_id: session.user.id, username: komiSafeAccountUsername(username, session.user.id),
                            display_name: String(session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'Пользователь Komi').slice(0, 40),
                            avatar_url: userProfiles[username]?.avatar || null,
                            bio: userProfiles[username]?.status || 'Новичок ★'
                        });
                        if (createError) console.warn('Profile create:', createError.message);
                    }
                } catch (profileError) { console.warn('Profile sync:', profileError); }
                await loadAuthenticatedAnimeData();
                if (typeof aniCoinRequest === 'function') aniCoinRequest('read').catch(() => {});
                loadProtectedFriends().catch(error => console.warn('Список друзей:', error.message));
                loadAccountNotifications().catch(error => console.warn('Уведомления:', error.message));
                if (location.hash === '#profile') { currentView = 'profile'; profileTargetUser = username; }
                saveData(); closeAuthModal(); render();
            } catch (error) {
                console.error('Google session:', error);
            }
        }
        // Keep async profile loads in order when OAuth and initial-session events overlap.
        let komiSessionRestoreQueue = Promise.resolve();
        function queueKomiSessionRestore() {
            komiSessionRestoreQueue = komiSessionRestoreQueue
                .catch(error => console.warn('Previous session restore:', error))
                .then(() => restoreGoogleSession());
            return komiSessionRestoreQueue;
        }
        if (_supabase) {
            _supabase.auth.onAuthStateChange((event) => {
                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                    // Never call Supabase APIs synchronously inside an auth callback.
                    setTimeout(() => queueKomiSessionRestore(), 0);
                }
            });
        }

        function openAuthModal(mode = 'login') {
            switchAuthTab(mode);
            document.getElementById('authModal').classList.add('active');
        }

        function closeAuthModal() { document.getElementById('authModal').classList.remove('active'); }

        function switchAuthTab(mode) {
            const loginBtn = document.getElementById('tabLoginBtn');
            const regBtn = document.getElementById('tabRegisterBtn');
            const loginForm = document.getElementById('loginFormContainer');
            const regForm = document.getElementById('registerFormContainer');

            if (mode === 'login') {
                loginBtn.classList.add('active');
                regBtn.classList.remove('active');
                loginForm.style.display = 'block';
                regForm.style.display = 'none';
            } else {
                regBtn.classList.add('active');
                loginBtn.classList.remove('active');
                regForm.style.display = 'block';
                loginForm.style.display = 'none';
            }
        }

        async function handleLoginSubmit(e) {
            e.preventDefault();
            const email = document.getElementById("loginUsername").value.trim();
            const password = document.getElementById("loginPassword").value;
            if (!email.includes("@") || !password) return;
            if (!_supabase) { alert("Сервис входа недоступен"); return; }
            const { error } = await _supabase.auth.signInWithPassword({ email, password });
            if (error) { alert("Не удалось войти: " + error.message); return; }
            await queueKomiSessionRestore();
        }

        async function handleRegisterSubmit(e) {
            e.preventDefault();
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const passwordInput = document.getElementById('regPassword').value;
            if (!username || !email || !passwordInput) return;
            if (!_supabase) { alert('Сервис регистрации недоступен'); return; }
            if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) { alert('Никнейм: 3–24 символа, латиница, цифры и _'); return; }
            if (komiReservedAccountName(username)) { alert('Этот никнейм зарезервирован. Выбери другой.'); return; }
            if (passwordInput.length < 12) { alert('Используйте уникальный пароль минимум из 12 символов.'); return; }
            const { data: signupData, error: signupError } = await _supabase.auth.signUp({
                email, password: passwordInput,
                options: { data: { username }, emailRedirectTo: window.location.origin + window.location.pathname }
            });
            if (signupError) { alert('Не удалось зарегистрироваться: ' + signupError.message); return; }
            if (!signupData.session) {
                closeAuthModal();
                alert('Проверь почту и подтверди регистрацию. Старые данные Komi останутся на месте.');
                return;
            }
            await queueKomiSessionRestore();
            alert('Аккаунт Komi Anime создан. Старый аккаунт Komi не удалён.');
            return;
        }

        const komiFavoritePending = new Set();
        const komiCollectionMutations = { statuses:new Map(), favorites:new Map() };
        const komiSavedAnimeCards = new Map();
        let komiSavedCardsOwner = null;
        let komiCollectionLoadEpoch = 0;
        function komiRecordCollectionMutation(kind, uid, animeId, value) {
            komiCollectionMutations[kind].set(uid + ':' + String(animeId), {value,at:Date.now()});
        }
        function komiMergeCollectionMutations(kind, uid, loadStarted, rows) {
            const result = Object.assign(Object.create(null), rows);
            const prefix = uid + ':';
            for (const [key, change] of komiCollectionMutations[kind]) {
                if (!key.startsWith(prefix)) continue;
                const animeId = key.slice(prefix.length);
                if (change.at < loadStarted) {
                    komiCollectionMutations[kind].delete(key);
                } else if (change.value == null) {
                    delete result[animeId];
                } else {
                    result[animeId] = change.value;
                }
            }
            return result;
        }
        async function toggleFavorite(id, category) {
            if (!currentUser) { openAuthModal('login'); return; }
            const user = currentUser;
            const key = (user.authUserId || user.username) + ':' + id;
            if (komiFavoritePending.has(key)) return;
            const next = userFavorites[user.username]?.[id] === category ? null : category;
            komiFavoritePending.add(key);
            try {
                if (!user.authUserId || !_supabase)
                    throw new Error('Войдите через подтверждённый аккаунт Komi.');
                await persistAuthenticatedFavorite(id, next);
                if (currentUser?.authUserId !== user.authUserId ||
                    currentUser?.username !== user.username) return;
                komiRecordCollectionMutation('favorites',user.authUserId,id,next);
                userFavorites[user.username] ||= {};
                if (next) userFavorites[user.username][id] = next;
                else delete userFavorites[user.username][id];
                saveData();
                if (next) komiHydrateSavedAnimeCards(user.authUserId)
                    .catch(error=>console.warn('Карточки избранного:',error.message));
                komiStatusFeedback(next ? 'Добавлено в избранное' : 'Удалено из избранного');
                if (document.getElementById('watchModal')?.classList.contains('active') && String(window.komiActiveAnimeId) === String(id))
                    openWatchModal(id,window.komiActiveSeason,window.komiActiveEpisode);
            } catch (error) { komiStatusFeedback('Не удалось сохранить избранное. '+error.message); }
            finally { komiFavoritePending.delete(key); }
        }

        async function persistAuthenticatedFavorite(animeId, category) {
            const id = Number(animeId);
            if (!_supabase || !currentUser?.authUserId)
                throw new Error('Нет подтверждённого входа в аккаунт.');
            if (!/^\d+$/.test(String(animeId)) || !Number.isSafeInteger(id) || id <= 0)
                throw new Error('Некорректный ID аниме.');
            const uid = currentUser.authUserId;
            const query = _supabase.from('komi_favorites');
            const result = category
                ? await query.upsert({user_id:uid, anime_id:id, category}, {onConflict:'user_id,anime_id'})
                    .select('anime_id,category').single()
                : await query.delete().eq('user_id',uid).eq('anime_id',id).select('anime_id');
            if (result.error) throw result.error;
            if (category && (!result.data || Number(result.data.anime_id) !== id || result.data.category !== category))
                throw new Error('Сервер не подтвердил сохранение избранного.');
            return true;
        }

        async function addToCustomFolder(id,folderName) {
            if(!currentUser?.authUserId||!_supabase){openAuthModal('login');return}
            const {username,authUserId:owner}=currentUser;
            const animeId=Number(id);
            if(!Number.isSafeInteger(animeId)||animeId<=0||!komiFolderNameAllowed(folderName)||
               !Object.prototype.hasOwnProperty.call(userCustomFolders[username]||{},folderName)){
                komiStatusFeedback('Некорректная папка или ID аниме.');return;
            }
            const key=owner+':'+folderName+':'+animeId;
            if(pendingFolderWrites.has(key))return;
            pendingFolderWrites.add(key);
            const before=userCustomFolders[username][folderName];
            const exists=before.some(x=>String(x)===String(animeId));
            try{
                const query=_supabase.from('komi_folder_items');
                if(exists){
                    const {error}=await query.delete().eq('user_id',owner)
                        .eq('folder_name',folderName).eq('anime_id',animeId);
                    if(error)throw error;
                }else{
                    const {data,error}=await query.insert({
                        user_id:owner,folder_name:folderName,anime_id:animeId
                    }).select('anime_id').single();
                    if(error)throw error;
                    if(!data||Number(data.anime_id)!==animeId)
                        throw new Error('Сервер не подтвердил добавление.');
                }
                if(currentUser?.authUserId!==owner)return;
                ++komiFolderLoadEpoch;
                userCustomFolders[username][folderName]=exists
                    ?before.filter(x=>String(x)!==String(animeId))
                    :[...before,String(animeId)];
                saveData();openWatchModal(String(animeId));
                komiStatusFeedback(exists?'Удалено из папки.':'Добавлено в папку.');
            }catch(error){
                if(currentUser?.authUserId===owner)
                    komiStatusFeedback('Не удалось изменить папку: '+error.message);
            }finally{pendingFolderWrites.delete(key)}
        }

        // Supabase-owned data is loaded from RLS-protected tables, never imported from shared legacy blobs.
        // Read every account-owned row, not just the first Supabase API page.
        // An error on a later page must not replace the existing saved collection.
        async function komiLoadAllOwnedRows(table, columns, uid) {
            const allowed = {
                komi_anime_lists:'anime_id,status',
                komi_favorites:'anime_id,category',
                komi_watch_progress:'anime_id,season,episode_index,position_seconds,duration_seconds,updated_at'
            };
            if (!Object.prototype.hasOwnProperty.call(allowed,table) || allowed[table] !== columns)
                return {data:[],error:new Error('Некорректный запрос личной коллекции.')};
            const all = [];
            const pageSize = 500;
            for (let offset = 0; ; offset += pageSize) {
                if (!_supabase || currentUser?.authUserId !== uid)
                    return {data:[],error:new Error('Аккаунт изменился.')};
                const {data,error} = await _supabase.from(table).select(columns)
                    .eq('user_id',uid).order('anime_id',{ascending:true})
                    .range(offset,offset+pageSize-1);
                if (error) return {data:[],error};
                all.push(...(data||[]));
                if (!data || data.length < pageSize) break;
            }
            return {data:all,error:null};
        }

        // Fetch metadata for only saved items whose catalog pages have not arrived.
        // Never fetch private lists here; they are already loaded via owner-only RLS.
        async function komiHydrateSavedAnimeCards(uid) {
            if (!_supabase || !uid || currentUser?.authUserId !== uid) return;
            if (komiSavedCardsOwner !== uid) {
                komiSavedAnimeCards.clear();
                komiSavedCardsOwner = uid;
            }
            const username = currentUser.username;
            const needed = new Set([
                ...Object.keys(userAnimeStatuses[username] || {}),
                ...Object.keys(userFavorites[username] || {})
            ]);
            const alreadyLoaded = new Set(animeList.map(item => String(item.id)));
            const missing = [...needed].filter(id => /^\d+$/.test(id) &&
                Number.isSafeInteger(Number(id)) && Number(id) > 0 &&
                !alreadyLoaded.has(id) && !komiSavedAnimeCards.has(id)).slice(0,300);
            if (!missing.length) return;
            for (let i=0; i<missing.length; i+=75) {
                if (currentUser?.authUserId !== uid || currentUser?.username !== username) return;
                const ids = missing.slice(i,i+75).map(Number);
                const {data,error} = await _supabase.from('komi_catalog_cards')
                    .select('shikimori_id,data,updated_at').in('shikimori_id',ids);
                if (error) throw error;
                if (currentUser?.authUserId !== uid || currentUser?.username !== username) return;
                for (const row of data || []) {
                    const raw = row.data;
                    const id = String(row.shikimori_id);
                    if (!raw || typeof raw !== 'object' || !needed.has(id)) continue;
                    komiSavedAnimeCards.set(id,{
                        ...raw, id, shikimoriId:Number(row.shikimori_id),
                        title:raw.title || raw.originalTitle || 'Без названия',
                        poster:raw.poster || '',
                        shikiRating:raw.shikiRating || 0,
                        genres:Array.isArray(raw.genres) ? raw.genres : [],
                        episodeCount:Math.max(0, Number(raw.episodeCount) || 0),
                        komiCardUpdatedAt:row.updated_at, episodes:[]
                    });
                }
                render();
            }
        }

        async function komiLoadCloudFolders(uid,username) {
            if(!uid||currentUser?.authUserId!==uid||!_supabase)return;
            const epoch = ++komiFolderLoadEpoch;
            async function allRows(table,fields,ordered) {
                const result=[];
                for(let offset=0;;offset+=500){
                    if(currentUser?.authUserId!==uid)return {data:[],error:new Error('Аккаунт изменился.')};
                    let query=_supabase.from(table).select(fields).eq('user_id',uid);
                    for(const column of ordered)query=query.order(column,{ascending:true});
                    const {data,error}=await query.range(offset,offset+499);
                    if(error)return {data:[],error};
                    result.push(...(data||[]));
                    if(!data||data.length<500)break;
                }
                return {data:result,error:null};
            }
            const [folders,items]=await Promise.all([
                allRows('komi_custom_folders','name',['name']),
                allRows('komi_folder_items','folder_name,anime_id',['folder_name','anime_id'])
            ]);
            if(currentUser?.authUserId!==uid||currentUser?.username!==username||
               epoch!==komiFolderLoadEpoch)return;
            if(folders.error||items.error){
                console.warn('Не удалось загрузить папки:',folders.error?.message||items.error?.message);
                return;
            }
            const loaded=Object.create(null);
            for(const row of folders.data)if(komiFolderNameAllowed(row.name))loaded[row.name]=[];
            for(const row of items.data)if(Object.prototype.hasOwnProperty.call(loaded,row.folder_name))
                loaded[row.folder_name].push(String(row.anime_id));
            userCustomFolders[username]=loaded;
            render();
        }

        async function loadAuthenticatedAnimeData() {
            if (!_supabase || !currentUser?.authUserId) return;
            const uid = currentUser.authUserId;
            const username = currentUser.username;
            const loadStarted = Date.now();
            const loadEpoch = ++komiCollectionLoadEpoch;
            const [lists, progress, favorites] = await Promise.all([
                komiLoadAllOwnedRows('komi_anime_lists','anime_id,status',uid),
                komiLoadAllOwnedRows('komi_watch_progress','anime_id,season,episode_index,position_seconds,duration_seconds,updated_at',uid),
                komiLoadAllOwnedRows('komi_favorites','anime_id,category',uid)
            ]);
            if (currentUser?.authUserId !== uid || currentUser?.username !== username ||
                loadEpoch !== komiCollectionLoadEpoch) return;
            if (lists.error) console.warn('Не удалось загрузить личные списки:', lists.error.message);
            else {
                const serverStatuses = Object.create(null);
                for (const item of lists.data || []) serverStatuses[item.anime_id] = item.status;
                userAnimeStatuses[username] =
                    komiMergeCollectionMutations('statuses',uid,loadStarted,serverStatuses);
            }
            if (favorites.error) console.warn('Не удалось загрузить избранное:', favorites.error.message);
            else {
                const serverFavorites = Object.create(null);
                for (const item of favorites.data || []) serverFavorites[item.anime_id] = item.category;
                userFavorites[username] =
                    komiMergeCollectionMutations('favorites',uid,loadStarted,serverFavorites);
            }
            if (progress.error) console.warn('Не удалось загрузить прогресс:', progress.error.message);
            else {
                const newerProgress = Object.fromEntries(Object.entries(komiEpisodeProgress).filter(([key,value]) =>
                    key.startsWith(username + '_') && value.updated >= loadStarted));
                for (const key of Object.keys(komiEpisodeProgress)) {
                    if (key.startsWith(username + '_')) delete komiEpisodeProgress[key];
                }
                for (const key of Object.keys(userWatchHistory)) {
                    if (key.startsWith(username + '_')) delete userWatchHistory[key];
                }
                for (const item of progress.data || []) {
                    userWatchHistory[username + '_' + item.anime_id] = Number(item.position_seconds) || 0;
                    komiEpisodeProgress[username + '_' + item.anime_id] = {
                        season: item.season, index: item.episode_index,
                        time: item.position_seconds, duration: item.duration_seconds,
                        updated: Date.parse(item.updated_at) || Date.now()
                    };
                }
                for (const [key,value] of Object.entries(newerProgress)) {
                    komiEpisodeProgress[key] = value;
                    userWatchHistory[key] = value.time;
                }
            }
            render();
            komiHydrateSavedAnimeCards(uid)
                .catch(error=>console.warn('Дополнительные карточки профиля:',error.message));
            komiLoadCloudFolders(uid,username)
                .catch(error=>console.warn('Облачные папки:',error.message));
        }
        async function persistAuthenticatedStatus(animeId, status) {
            const id = Number(animeId);
            if (!_supabase || !currentUser?.authUserId)
                throw new Error('Нет подтверждённого входа в аккаунт.');
            if (!/^\d+$/.test(String(animeId)) || !Number.isSafeInteger(id) || id <= 0)
                throw new Error('Некорректный ID аниме.');
            const uid = currentUser.authUserId;
            const query = _supabase.from('komi_anime_lists');
            const result = status
                ? await query.upsert({user_id:uid, anime_id:id, status}, {onConflict:'user_id,anime_id'})
                    .select('anime_id,status').single()
                : await query.delete().eq('user_id',uid).eq('anime_id',id).select('anime_id');
            if (result.error) throw result.error;
            if (status && (!result.data || Number(result.data.anime_id) !== id || result.data.status !== status))
                throw new Error('Сервер не подтвердил сохранение статуса.');
            return true;
        }
        const komiProgressWriter = KomiPlayerCore.createWriter(async ({uid, animeId, progress}) => {
            if (currentUser?.authUserId !== uid) return;
            const {error} = await _supabase.from('komi_watch_progress').upsert({
                user_id:uid, anime_id:Number(animeId), season:progress.season, episode_index:progress.index,
                position_seconds:Math.floor(progress.time), duration_seconds:Math.floor(progress.duration),
                updated_at:new Date(progress.updated).toISOString()
            }, {onConflict:'user_id,anime_id'});
            if (error) throw error;
        }, (error, item) => {
            if (currentUser?.authUserId === item.uid) komiStatusFeedback('Не удалось сохранить прогресс. Проверьте соединение; следующая запись повторит попытку.');
            console.warn('Сохранение прогресса:', error.message);
        });
        async function persistAuthenticatedProgress(animeId, progress) {
            if (!_supabase || !currentUser?.authUserId || !/^\d+$/.test(String(animeId))) return;
            const uid = currentUser.authUserId;
            return komiProgressWriter.enqueue(uid + ':' + animeId, {uid, animeId, progress:{...progress}});
        }

        const pendingAnimeStatuses = new Set();
        function komiStatusFeedback(message) {
            let notice = document.getElementById('komiStatusFeedback');
            if (!notice) {
                notice = document.createElement('div');
                notice.id = 'komiStatusFeedback';
                notice.setAttribute('role', 'status');
                notice.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000;max-width:90vw;padding:14px 20px;background:#171717;border:1px solid #272727;border-radius:14px;color:#f4f4f4';
                document.body.append(notice);
            }
            notice.textContent = message;
            clearTimeout(komiStatusFeedback.timer);
            komiStatusFeedback.timer = setTimeout(() => notice.remove(), 5000);
        }
        async function setAnimeStatus(animeId, status) {
            if (!currentUser) { openAuthModal('login'); return; }
            const user = currentUser;
            const requestKey = (user.authUserId || user.username) + ':' + animeId;
            if (pendingAnimeStatuses.has(requestKey)) return;
            const previous = userAnimeStatuses[user.username]?.[animeId];
            const next = previous === status ? null : status;
            pendingAnimeStatuses.add(requestKey);
            komiStatusFeedback('Сохраняем статус…');
            try {
                if (user.authUserId) {
                    await persistAuthenticatedStatus(animeId, next);
                } else {
                    throw new Error('Войдите через аккаунт Komi, чтобы сохранить список.');
                }
                if (currentUser?.authUserId !== user.authUserId ||
                    currentUser?.username !== user.username) return;
                if (!userAnimeStatuses[user.username]) userAnimeStatuses[user.username] = {};
                komiRecordCollectionMutation('statuses',user.authUserId,animeId,next);
                if (next) userAnimeStatuses[user.username][animeId] = next;
                else delete userAnimeStatuses[user.username][animeId];
                saveData();
                render();
                if (next) komiHydrateSavedAnimeCards(user.authUserId)
                    .catch(error=>console.warn('Карточки списка:',error.message));
                komiStatusFeedback(next ? 'Статус сохранён: ' + next : 'Статус снят');
                if (String(window.komiActiveAnimeId) === String(animeId)) {
                    for (const button of document.querySelectorAll('#watchModalContent [data-watch-status]')) {
                        const selected = button.dataset.watchStatus === next;
                        button.classList.toggle('active', selected);
                        button.setAttribute('aria-pressed', String(selected));
                    }
                }
            } catch (error) {
                if (currentUser?.authUserId === user.authUserId) komiStatusFeedback('Не удалось сохранить статус. ' + error.message);
            } finally {
                pendingAnimeStatuses.delete(requestKey);
            }
        }

        function komiProgressKey(animeId) { return currentUser ? currentUser.username + '_' + animeId : ''; }
        function getKomiProgress(animeId) { return komiEpisodeProgress[komiProgressKey(animeId)] || null; }
        function resumeKomiAnime(animeId) {
            const p = getKomiProgress(animeId);
            openWatchModal(String(animeId), p ? p.season : null, p ? p.index : 0);
        }
        function saveKomiEpisode(animeId, season, index, time=0, duration=0) {
            if (!currentUser) return;
            const key = komiProgressKey(animeId);
            komiEpisodeProgress[key] = {season:Math.max(1,Math.floor(KomiPlayerCore.finite(season))),index:Math.floor(KomiPlayerCore.finite(index)),time:KomiPlayerCore.finite(time),duration:KomiPlayerCore.finite(duration),updated:Date.now()};
            userWatchHistory[key] = komiEpisodeProgress[key].time;
            saveData();
            if (currentUser?.authUserId) persistAuthenticatedProgress(animeId, komiEpisodeProgress[key]);
        }
        function komiPlayerKind(url) {
            return KomiPlayerCore.source(url).kind;
        }
        function komiSafeUrl(url) {
            try { const u = new URL(url); return u.protocol === 'https:' ? u.href.replace(/"/g,'%22') : ''; } catch { return ''; }
        }
        function komiPlayerHtml(url) {
            const source = KomiPlayerCore.source(url);
            if (!source.url) return '<div class="komi-player-notice" role="status">Для этой серии пока нет доступного плеера.</div>';
            if (source.kind === 'video' || source.kind === 'hls') return '<div class="player-box"><video id="animeVideoPlayer" aria-label="Видеоплеер аниме" controls preload="metadata" playsinline></video></div>';
            // Limit third-party popups. In-player ads are controlled by the external provider.
            const external = new URL(source.url, location.href).origin !== location.origin;
            const sandbox = external ? ' sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"' : '';
            return '<div class="player-box"><iframe title="Видеоплеер аниме" src="'+escapeFriendHtml(source.url)+'"'+sandbox+' allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;border:0"></iframe></div><p class="komi-player-hint">Всплывающие окна внешних плееров ограничены. Реклама внутри видео зависит от провайдера.</p>';
        }
        function showKomiPlayerError(video) {
            if (video !== document.getElementById('animeVideoPlayer')) return;
            video.komiMediaFailed = true;
            document.getElementById('komiPlayerRecovery').hidden = false;
            document.getElementById('komiPlayerStatus').textContent = 'Не удалось загрузить видео.';
        }
        function restoreKomiVideo(video) {
            const p = getKomiProgress(video.dataset.animeId || window.komiActiveAnimeId);
            if (p && p.season === window.komiActiveSeason && p.index === window.komiActiveEpisode && p.time > 0 && (!video.duration || p.time < video.duration-5)) {
                try { video.currentTime = p.time; } catch(e) {}
            }
        }
        function playNextEp(animeId, season, index) {
            const anime = animeList.find(a=>String(a.id)===String(animeId));
            if (!anime) return;
            const eps=anime.episodes.filter(ep=>Number(ep.season||1)===Number(season));
            if (index+1<eps.length) openWatchModal(String(animeId),season,index+1);
        }
        function komiAchievements(username) {
            const statuses=userAnimeStatuses[username]||{};
            const watched=Object.values(statuses).filter(v=>v==='Просмотрено').length;
            const watching=Object.values(statuses).filter(v=>v==='Смотрю').length;
            const friends=friendsFor(username).length;
            const xp=watched*100+watching*20+friends*15;
            return {watched,watching,friends,xp,level:Math.floor(xp/300)+1,badges:[watched>=1&&' Первый просмотр',watched>=10&&' 10 аниме',watched>=50&&' Знаток аниме',friends>=1&&' Первый друг',watching>=5&&' Марафон'].filter(Boolean)};
        }
        function komiRecommendations() {
            if (!currentUser) return [];
            const statuses=userAnimeStatuses[currentUser.username]||{};
            const favs=userFavorites[currentUser.username]||{};
            const tastes={};
            animeList.forEach(a=>{if(statuses[a.id]||favs[a.id]) (a.genres||[]).forEach(g=>{tastes[g]=(tastes[g]||0)+1;});});
            return animeList.filter(a=>!statuses[a.id]&&!favs[a.id]).map(a=>({anime:a,score:(a.genres||[]).reduce((n,g)=>n+(tastes[g]||0),0)*10+(Number(a.shikiRating)||0)})).sort((a,b)=>b.score-a.score).slice(0,7).map(x=>x.anime);
        }

        function komiRecentMarkup(username, limit=6) {
            if (!username || username !== currentUser?.username) return '';
            const prefix=username+'_';
            const items=Object.entries(komiEpisodeProgress).filter(([key,p])=>key.startsWith(prefix)&&p&&p.updated).sort((a,b)=>b[1].updated-a[1].updated).slice(0,limit).map(([key,p])=>({anime:animeList.find(a=>String(a.id)===key.slice(prefix.length)),p})).filter(x=>x.anime);
            if (!items.length) return '<div class="komi-recent-empty">Здесь появятся аниме, которые ты недавно открывал для просмотра.</div>';
            return '<div class="komi-recent-grid">'+items.map(({anime,p})=>'<button class="komi-recent-card" data-komi-onclick="resumeKomiAnime(\''+anime.id+'\')"><img loading="lazy" src="'+escapeFriendHtml(anime.poster||'')+'" alt=""><span class="komi-recent-info"><strong>'+escapeFriendHtml(anime.title)+'</strong><small>Сезон '+p.season+' · Серия '+(p.index+1)+'</small><em>Продолжить →</em></span></button>').join('')+'</div>';
        }

        function komiAnimeYear(anime) {
            const candidates = [anime?.year, anime?.aired_on, anime?.airedOn, anime?.releaseYear];
            for (const value of candidates) {
                const found = String(value ?? '').match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
                if (found) return found[1];
            }
            return '';
        }

        function showKomiYear(year) {
            catalogFilterYear = String(year);
            catalogVisibleCount = 48;
            navigate('catalog');
        }

        function komiYearSections() {
            const years = ['2026', '2025', '2024'];
            return years.map(year => {
                const items = animeList.filter(a => komiAnimeYear(a) === year);
                if (!items.length) return '';
                return '<section class="komi-feature-section"><div class="section-header"><h2 class="section-title"> Аниме ' + year + '</h2><button class="section-see-all" data-komi-onclick="showKomiYear(\'' + year + '\')">Все аниме ' + year + ' · ' + items.length + '</button></div><div class="anime-grid">' + items.slice(0, 7).map(a => renderCard(a)).join('') + '</div></section>';
            }).join('');
        }


        const komiExternalCalendar = new Map();
        let komiCalendarLoading = false;
        let komiCalendarError = '';
        let komiCalendarLastFetch = 0;

        // Fetch public broadcast dates directly as a fallback for delayed GitHub Actions.
        // No secrets or private user information are sent to AniList.
        async function loadKomiEpisodeSchedule(force = false) {
            const now = Date.now();
            if (komiCalendarLoading || !animeList.length) return;
            if (!force && now - komiCalendarLastFetch < 25 * 60 * 1000) return;
            komiCalendarLoading = true;
            komiCalendarError = '';
            // Store public airing dates independently of catalog loading progress.
            const query = 'query ($page:Int,$from:Int,$to:Int) { Page(page:$page,perPage:50) { pageInfo { hasNextPage } airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME) { airingAt episode media { idMal isAdult } } } }';
            try {
                const discovered = new Map();
                const start = Math.floor(now / 1000) - 60;
                const end = start + 14 * 86400;
                for (let page = 1; page <= 12; page++) {
                    const response = await fetch('https://graphql.anilist.co', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                        body: JSON.stringify({ query, variables: { page, from: start, to: end } }),
                        signal: AbortSignal.timeout(15000)
                    });
                    if (!response.ok) throw new Error('AniList HTTP ' + response.status);
                    const body = await response.json();
                    if (body.errors?.length) throw new Error(body.errors[0].message || 'Ошибка API');
                    const pageData = body.data?.Page;
                    if (!pageData) throw new Error('Нет ответа расписания');
                    for (const item of pageData.airingSchedules || []) {
                        const id = Number(item.media?.idMal);
                        const time = Number(item.airingAt) * 1000;
                        if (!Number.isSafeInteger(id) || id <= 0 || item.media?.isAdult || time <= now) continue;
                        if (!discovered.has(id) || discovered.get(id).at > time) {
                            discovered.set(id, { at: time, episode: Number(item.episode) || null });
                        }
                    }
                    if (!pageData.pageInfo?.hasNextPage) break;
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                // Preserve known dates if there was a temporary upstream issue.
                komiExternalCalendar.clear();
                for (const [id, value] of discovered) komiExternalCalendar.set(id, value);
                komiCalendarLastFetch = Date.now();
            } catch (error) {
                komiCalendarError = error.message || 'Неизвестная ошибка';
                // Retry later but do not hammer a rate-limited API on every render.
                komiCalendarLastFetch = Date.now() - 20 * 60 * 1000;
                console.warn('Komi AniList calendar:', komiCalendarError);
            } finally {
                komiCalendarLoading = false;
                if (currentView === 'home') {
                    const section = document.getElementById('komiCalendarSection');
                    if (section) section.outerHTML = komiReleaseCalendar();
                }
            }
        }

        function komiReleaseCalendar() {
            const now = Date.now();
            const maxTime = now + 14 * 86400000;
            const upcoming = animeList.map(anime => {
                const stored = new Date(anime.nextEpisodeAt || anime.next_episode_at || anime.nextEpisodeDate).getTime();
                const live = komiExternalCalendar.get(Number(anime.shikimoriId || anime.id));
                const date = Number.isFinite(stored) && stored > now ? stored : live?.at;
                return {
                    anime,
                    date,
                    episode: Number.isFinite(stored) && stored > now
                        ? (Number(anime.nextEpisodeNumber) || live?.episode)
                        : live?.episode
                };
            }).filter(x => Number.isFinite(x.date) && x.date > now && x.date < maxTime)
              .sort((a,b) => a.date - b.date).slice(0,18);
            const latest = animeList.map(anime => ({
                anime,
                date: Date.parse(anime.lastEpisodeAddedAt)
            })).filter(x => Number.isFinite(x.date) && x.date <= now && now - x.date <= 3 * 86400000)
              .sort((a,b) => b.date - a.date).slice(0,8);

            let result = '<section class="komi-feature-section" id="komiCalendarSection"><div class="section-header"><h2 class="section-title"> Календарь серий</h2>'+
                '<button type="button" class="section-see-all" data-komi-onclick="loadKomiEpisodeSchedule(true)">↻ Обновить расписание</button></div>';
            if (upcoming.length) {
                result += '<p class="komi-feature-muted">Ближайшие эфиры · время указано в твоём часовом поясе. Озвучка может появиться позже.</p>';
                result += '<div class="komi-release-list">' + upcoming.map(entry => {
                    const date = new Date(entry.date);
                    const title = escapeFriendHtml(entry.anime.title);
                    const poster = escapeFriendHtml(entry.anime.poster || '');
                    const day = date.toLocaleDateString('ru-RU', {weekday:'short',day:'numeric',month:'short'});
                    const hour = date.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
                    const episodeText = entry.episode ? 'Серия ' + entry.episode : 'Следующая серия';
                    return '<button type="button" data-komi-onclick="openWatchModal(\'' + entry.anime.id + '\')" class="komi-release-row">'+
                        '<img loading="lazy" src="' + poster + '" alt="" class="komi-calendar-poster" data-komi-onerror="this.style.display=\'none\'">'+
                        '<span class="komi-calendar-info"><small>' + day + ' · ' + hour + '</small><strong>' + title + '</strong><em>' + episodeText + '</em></span>'+
                        '<span class="komi-calendar-tag">Эфир</span></button>';
                }).join('') + '</div>';
            } else {
                const message = komiCalendarLoading
                    ? 'Проверяем подтверждённое расписание на ближайшие 14 дней…'
                    : komiCalendarError
                        ? 'Не удалось получить расписание из AniList. Попробуй обновить позже.'
                        : 'На ближайшие 14 дней пока нет подтверждённых дат для аниме из каталога.';
                result += '<p class="komi-feature-muted">' + message + '</p>';
            }
            if (latest.length) {
                result += '<div class="section-header" style="margin-top:17px"><h3 class="section-title" style="font-size:15px!important"> Добавлены новые серии</h3></div>';
                result += '<div class="komi-release-list">' + latest.map(entry =>
                    '<button type="button" data-komi-onclick="openWatchModal(\'' + entry.anime.id + '\')" class="komi-release-row">'+
                        '<img loading="lazy" src="' + escapeFriendHtml(entry.anime.poster || '') + '" alt="" class="komi-calendar-poster" data-komi-onerror="this.style.display=\'none\'">'+
                        '<span class="komi-calendar-info"><small>' + new Date(entry.date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) + '</small>'+
                        '<strong>' + escapeFriendHtml(entry.anime.title) + '</strong><em>' + (entry.anime.lastEpisodeNumber ? 'Серия ' + Number(entry.anime.lastEpisodeNumber) : 'Новая серия') + '</em></span>'+
                    '</button>').join('') + '</div>';
            }
            return result + '</section>';
        }

        function toggleKomiWatchFullscreen() {
            const modal=document.getElementById('watchModal');
            modal?.classList.toggle('komi-watch-fullscreen');
            const button=modal?.querySelector('.komi-watch-expand span');
            if(button) button.textContent=modal.classList.contains('komi-watch-fullscreen')?'Обычный размер':'На весь экран';
        }
        function closeWatchModal() {
            ++komiDetailOpenToken;
            if (typeof aniCoinStopEmbed === 'function') aniCoinStopEmbed();
            document.getElementById('watchModal')?.classList.remove('komi-watch-fullscreen');
            const videoEl = document.getElementById('animeVideoPlayer');
            if (videoEl) {
                saveProgress(videoEl.dataset.animeId, videoEl, true);
                videoEl.komiRestored = false;
                disposeKomiMedia(videoEl);
            }
            document.getElementById('watchModal').classList.remove('active');
            document.getElementById('watchModalContent').replaceChildren();
        }

        function changePlayerSource(animeId, season, epIdx, sourceName) {
            try { localStorage.setItem('komi_source_' + animeId, sourceName); } catch {}
            return openWatchModal(animeId, season, epIdx, sourceName);
        }

        // Cache only active title details; card payloads never include playback URLs.
        const komiDetailsPending = new Map();
        let komiDetailOpenToken = 0;
        async function ensureKomiAnimeDetails(anime) {
            const id = String(anime.shikimoriId || anime.id);
            if (anime.komiDetailsLoaded && anime.komiDetailsLoadedAt === anime.komiCardUpdatedAt) return anime;
            if (komiDetailsPending.has(id)) {
                const loaded = await komiDetailsPending.get(id);
                if (loaded !== anime) Object.assign(anime, loaded, {komiCardUpdatedAt:anime.komiCardUpdatedAt});
                return anime;
            }
            const version = anime.komiCardUpdatedAt;
            const request = (async () => {
                const { data: row, error } = await _supabase.from('anime_catalog')
                    .select('data').eq('shikimori_id', Number(id)).single();
                if (error) throw error;
                if (!row?.data || typeof row.data !== 'object') throw new Error('Данные аниме отсутствуют');
                Object.assign(anime, row.data, {
                    id, shikimoriId: Number(id),
                    episodes: Array.isArray(row.data.episodes) ? row.data.episodes : [],
                    episodeCount: Array.isArray(row.data.episodes) ? row.data.episodes.length : 0,
                    komiDetailsLoaded: true,
                    komiDetailsLoadedAt: version
                });
                return anime;
            })().finally(() => komiDetailsPending.delete(id));
            komiDetailsPending.set(id, request);
            return request;
        }

        async function openWatchModal(id, selectedSeason = null, selectedEpIdx = 0, requestedSource = null) {
            siteStats.views++;
            saveData();
            
            // Avoid fetching these tables on each episode switch.
            const anime = animeList.find(a => String(a.id) === String(id));
            if (!anime) return;
            closeWatchModal();
            const requestToken = komiDetailOpenToken;
            if (!anime.komiDetailsLoaded || anime.komiDetailsLoadedAt !== anime.komiCardUpdatedAt) {
                const modal = document.getElementById('watchModal');
                const body = document.getElementById('watchModalContent');
                body.innerHTML = '<button class="modal-close" data-komi-onclick="closeWatchModal()">×</button><p role="status" style="padding:35px">Загружаем описание и серии…</p>';
                modal.classList.add('active');
                try {
                    await ensureKomiAnimeDetails(anime);
                } catch (error) {
                    if (requestToken === komiDetailOpenToken && modal.classList.contains('active'))
                        body.innerHTML = '<button class="modal-close" data-komi-onclick="closeWatchModal()">×</button><p role="alert" style="padding:35px">Не удалось загрузить серии. Попробуйте открыть аниме снова.</p>';
                    return;
                }
                if (requestToken !== komiDetailOpenToken || !modal.classList.contains('active')) return;
            }
            if (!Array.isArray(anime.episodes) || anime.episodes.length === 0) { document.getElementById('watchModalContent').innerHTML = '<button class="modal-close" data-komi-onclick="closeWatchModal()">×</button>'+animeDetailsMarkup(anime)+'<div class="komi-player-notice" style="margin:35px">Серии для «'+escapeFriendHtml(anime.title)+'» пока не добавлены. Бот проверит источники при следующей синхронизации.</div>'; document.getElementById('watchModal').classList.add('active'); renderAnimeExtras(anime); window.KomiComments?.mount(anime.id); return; }

            const seasonsMap = {};
            anime.episodes.forEach((ep, idx) => {
                const season = Number(ep?.season) || 1;
                if (!seasonsMap[season]) seasonsMap[season] = [];
                seasonsMap[season].push({ ...ep, originalIdx: idx });
            });
            const seasonNumbers = Object.keys(seasonsMap).map(Number).sort((a,b) => a - b);
            const progressForResume = selectedSeason === null ? getKomiProgress(anime.id) : null;
            const seasonWanted = selectedSeason === null ? Number(progressForResume?.season) : Number(selectedSeason);
            const activeSeason = seasonsMap[seasonWanted] ? seasonWanted : seasonNumbers[0];
            const currentSeasonEpisodes = seasonsMap[activeSeason] || [];
            currentSeasonEpisodes.sort((a,b) => (Number(a.number)||0) - (Number(b.number)||0));
            const targetIndex = progressForResume?.season === activeSeason ? Number(progressForResume.index) : Number(selectedEpIdx);
            const activeIndex = Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < currentSeasonEpisodes.length ? targetIndex : 0;
            const currentEp = currentSeasonEpisodes[activeIndex];
            if (!currentEp) return;
            const sources = currentEp.sources && typeof currentEp.sources === 'object' ? currentEp.sources : { 'Default': currentEp.url || '' };
            const sourceNames = Object.keys(sources).filter(name => typeof sources[name] === 'string' && komiPlayerKind(sources[name]) !== 'missing');
            if (!sourceNames.length) sourceNames.push('Недоступно');
            let preferredSource = requestedSource;
            if (preferredSource === null) {
                try { preferredSource = localStorage.getItem('komi_source_' + anime.id); } catch {}
            }
            // Prefer built-in HTML5 video or HLS when available, but keep explicit viewer choice.
            const directSource = sourceNames.find(name => ['video', 'hls'].includes(komiPlayerKind(sources[name])));
            activePlayerSource = sourceNames.includes(preferredSource) ? preferredSource : (directSource || sourceNames[0]);
            const activeUrl = sources[activePlayerSource] || '';
            const selectedSource = activePlayerSource;
            const alternateSource = sourceNames.length > 1
                ? sourceNames[(sourceNames.indexOf(selectedSource) + 1) % sourceNames.length]
                : null;
            const isExternalPlayer = komiPlayerKind(activeUrl) === 'embed';
            window.komiActiveAnimeId=String(anime.id);
            window.komiActiveSeason=Number(activeSeason);
            window.komiActiveEpisode=activeIndex;
            const previousProgress = getKomiProgress(anime.id);
            const resuming = previousProgress?.season === Number(activeSeason) && previousProgress?.index === activeIndex;
            saveKomiEpisode(String(anime.id),activeSeason,activeIndex,resuming ? previousProgress.time : 0,resuming ? previousProgress.duration : 0);
            const playerHtml = komiPlayerHtml(activeUrl);
            const hasPrevious = activeIndex > 0;
            const hasNext = activeIndex + 1 < currentSeasonEpisodes.length;
            const displayNumber = Number(currentEp.number) || activeIndex + 1;

            const userHistoryKey = currentUser ? `${currentUser.username}_${anime.id}` : null;
            const savedTime = userHistoryKey ? (userWatchHistory[userHistoryKey] || 0) : 0;
            const userFavCategory = currentUser ? ((userFavorites[currentUser.username] || {})[anime.id] || '') : '';
            const shikiRating = anime.shikiRating || '8.5';
            const myCurrentStatus = currentUser && userAnimeStatuses[currentUser.username] ? (userAnimeStatuses[currentUser.username][anime.id] || '') : '';
            
            const customFolders = currentUser ? (userCustomFolders[currentUser.username] || {}) : {};
            const screenshots = (anime.screenshots && anime.screenshots.length > 0) ? anime.screenshots : [anime.poster, anime.poster, anime.poster, anime.poster];

            document.getElementById('watchModalContent').innerHTML = `
                <button class="komi-watch-expand" data-komi-onclick="toggleKomiWatchFullscreen()" title="Полный экран">⛶ <span>На весь экран</span></button>
                <button class="modal-close" data-komi-onclick="playSound(); closeWatchModal()">&times;</button>
                <div class="watch-cinema-layout">
                    ${animeDetailsMarkup(anime)}
                    <div class="crunchy-hero-section">
                        <img src="${animeArtwork({poster:anime.poster})}" class="crunchy-hero-poster" alt="" data-komi-onerror="this.onerror=null;this.src='/anime-artwork.svg'">
                        <div class="crunchy-hero-info">
                            <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Просмотр</span>
                            <h1>${escapeFriendHtml(anime.title)}</h1>
                            <p style="color:var(--text-muted); font-size:11px; line-height:1.4;">${cleanAnimeDescription(anime.desc)}</p>
                            <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:2px;">
                                <span style="color:#eaeaea; font-weight:700; font-size:11px;">★ ${escapeFriendHtml(shikiRating)} Shikimori</span>
                                <span style="background:var(--bg-input); padding:2px 6px; border-radius:5px; font-size:10px; border:1px solid var(--border);">${escapeFriendHtml((Array.isArray(anime.genres) ? anime.genres : []).join(', '))}</span>
                                <span style="background:var(--bg-input); padding:2px 6px; border-radius:5px; font-size:10px; border:1px solid var(--border);">${escapeFriendHtml(anime.year || '2026')}</span>
                                <button class="btn-secondary" style="padding:3px 8px; font-size:10px;" data-komi-onclick="playSound(); toggleFavorite('${anime.id}', 'Любимые')">★ ${userFavCategory ? 'В избранном' : 'В избранное'}</button>
                                <button class="btn-glow-secondary" style="padding:3px 8px; font-size:10px;" data-komi-onclick="playSound(); createWatchPartyFromAnime('${anime.id}', '', false, ${currentEp.originalIdx}, document.getElementById('komiWatchSourceSelect').value)"> Party</button>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap; background:var(--bg-input); padding:6px 10px; border-radius:8px;">
                        <span style="font-size:11px; color:var(--text-muted);">Статус:</span>
                        ${['Просмотрено', 'В планах', 'Смотрю', 'Отложено', 'Брошено'].map(st => `
                            <button class="season-tab-btn ${myCurrentStatus === st ? 'active' : ''}" data-watch-status="${st}" aria-pressed="${myCurrentStatus === st}" data-komi-onclick="playSound(); setAnimeStatus('${anime.id}', '${st}')">${st}</button>
                        `).join('')}
                    </div>

                    ${Object.keys(customFolders).length > 0 ? `
                        <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap; background:var(--bg-input); padding:6px 10px; border-radius:8px;">
                            <span style="font-size:11px; color:var(--text-muted);">Папки:</span>
                            ${Object.keys(customFolders).map(fname => {
                                const inFolder = (customFolders[fname] || []).includes(anime.id);
                                return `<button type="button" class="season-tab-btn ${inFolder ? 'active' : ''}" data-komi-folder="${escapeFriendHtml(fname)}"> ${escapeFriendHtml(fname)} ${inFolder ? '✓' : ''}</button>`;
                            }).join('')}
                        </div>
                    ` : ''}

                    <div class="komi-watch-stage">
                        <div class="komi-watch-main">
                            <div class="komi-player-heading">
                                <div><small>СМОТРЕТЬ ОНЛАЙН · KOMI</small><h2>${escapeFriendHtml(anime.title)}</h2>
                                    <span>Сезон ${activeSeason} · Серия ${displayNumber} из ${currentSeasonEpisodes.length}</span>
                                </div>
                            </div>
                            <div class="player-wrapper">${playerHtml}</div>
                            <div class="komi-watch-controls">
                                <button type="button" class="komi-watch-navbtn" ${hasPrevious?'':'disabled'} data-komi-onclick="openWatchModal('${anime.id}',${activeSeason},${activeIndex - 1})">← Предыдущая</button>
                                <div class="komi-watch-source">
                                    <label for="komiWatchSourceSelect">Озвучка / плеер</label>
                                    <select id="komiWatchSourceSelect" data-komi-onchange="changePlayerSource('${anime.id}',${activeSeason},${activeIndex},this.value)">
                                        ${sourceNames.map(name => '<option value="' + escapeFriendHtml(name) + '" ' + (name === activePlayerSource ? 'selected' : '') + '>' + escapeFriendHtml(name) + '</option>').join('')}
                                    </select>
                                </div>
                                <button type="button" class="komi-watch-navbtn primary" ${hasNext?'':'disabled'} data-komi-onclick="openWatchModal('${anime.id}',${activeSeason},${activeIndex + 1})">Следующая →</button>
                            </div>
                            ${activeUrl ? `
                                <div id="komiPlayerRecovery" class="komi-player-notice" ${isExternalPlayer ? '' : 'hidden'}>
                                    <p id="komiPlayerStatus" role="status">${isExternalPlayer ? 'Если внешний плеер не открывается, повторите загрузку или смените источник.' : ''}</p>
                                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                                        <button id="komiRetryPlayer" type="button" class="btn-secondary">Повторить загрузку</button>
                                        ${alternateSource ? '<button id="komiAlternatePlayer" type="button" class="btn-secondary">Сменить источник</button>' : ''}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <aside class="komi-watch-sidebar" aria-label="Список серий">
                            <div class="komi-watch-side-heading">
                                <div><small>ВЫБОР СЕРИИ</small><h3>${currentSeasonEpisodes.length} серий</h3></div>
                                <span>Сезон ${activeSeason}</span>
                            </div>
                            ${seasonNumbers.length > 1 ? '<div class="season-tabs" aria-label="Выбор сезона">' + seasonNumbers.map(n => '<button type="button" class="season-tab-btn ' + (n===activeSeason?'active':'') + '" data-komi-onclick="openWatchModal(\'' + anime.id + '\',' + n + ',0)">Сезон ' + n + '</button>').join('') + '</div>' : ''}
                            <label for="komiEpisodeSearch">Найти серию</label><input id="komiEpisodeSearch" type="search" inputmode="numeric" class="form-control" placeholder="Номер серии" data-komi-oninput="komiFindEpisode(this.value)"><p id="komiEpisodeSearchStatus" role="status"></p>
                            <div class="komi-episode-number-grid" role="group" aria-label="Выбрать серию">
                                ${currentSeasonEpisodes.map((ep,i) => '<button type="button" class="komi-episode-number ' + (i===activeIndex?'active':'') + '" aria-label="Серия '+(Number(ep.number)||i+1)+'" aria-current="'+(i===activeIndex?'true':'false')+'" data-komi-onclick="openWatchModal(\''+anime.id+'\','+activeSeason+','+i+')">'+(Number(ep.number)||i+1)+'</button>').join('')}
                            </div>
                        </aside>
                    </div>
                </div>
            `;
            document.getElementById('watchModal').classList.add('active');
            document.getElementById('komiRetryPlayer')?.addEventListener('click', () =>
                openWatchModal(anime.id, activeSeason, activeIndex, selectedSource));
            document.getElementById('komiAlternatePlayer')?.addEventListener('click', () =>
                changePlayerSource(anime.id, activeSeason, activeIndex, alternateSource));
            bindKomiPlayer(String(anime.id), activeSeason, activeIndex, activeUrl);
            const watchedOwner = currentUser?.authUserId || null;
            const watchedLocalOwner = watchedOwner || currentUser?.username || '';
            window.KomiPlayerUX?.mount({
                animeId:String(anime.id),
                userId:watchedLocalOwner,
                authId:watchedOwner,
                client:watchedOwner ? _supabase : null,
                ownerIsCurrent:() => (currentUser?.authUserId || currentUser?.username || '') === watchedLocalOwner,
                season:activeSeason,
                index:activeIndex,
                hasNext,
                displayNumber,
                originalIndex: currentEp.originalIdx,
                episodeMeta:currentSeasonEpisodes.map(ep=>({
                    preview:ep?.preview || ep?.thumbnail || ep?.screenshot || '',
                    duration:ep?.duration ?? ep?.durationSeconds ?? null
                }))
            });
            for (const button of document.querySelectorAll('#watchModalContent [data-komi-folder]'))
                button.onclick = () => addToCustomFolder(anime.id, button.dataset.komiFolder);
            renderAnimeExtras(anime, seasonNumbers);
            window.KomiComments?.mount(anime.id);
        }

        function saveProgress(animeId, video, force = false) {
            if (!currentUser || !video.komiRestored || !video.isConnected ||
                video.komiMediaFailed || video.error ||
                video.dataset.owner !== (currentUser.authUserId || currentUser.username)) return;
            const now = Date.now();
            if (!force && now - (video.komiLastSave || 0) < 10000) return;
            video.komiLastSave = now;
            saveKomiEpisode(animeId,Number(video.dataset.season),Number(video.dataset.episode),video.currentTime,video.duration);
        }


        async function refreshKomiCatalogUpdates() {
            if (!_supabase || document.hidden || !catalogInitialLoadComplete || catalogRefreshInProgress) return;
            catalogRefreshInProgress = true;
            const until = new Date().toISOString();
            try {
                const rows = [];
                const pageSize = 100;
                let lastUpdatedId = 0;
                while (true) {
                    const { data, error } = await _supabase.from('komi_catalog_cards')
                        .select('shikimori_id,data,updated_at')
                        .gte('updated_at', catalogRefreshSince)
                        .lt('updated_at', until)
                        .gt('shikimori_id', lastUpdatedId)
                        .order('shikimori_id', { ascending: true })
                        .limit(pageSize);
                    if (error) throw error;
                    rows.push(...(data || []));
                    if (!data || data.length < pageSize) break;
                    lastUpdatedId = data[data.length - 1].shikimori_id;
                }
                let changed = false;
                const indexById = new Map(animeList.map((item, index) => [String(item.id), index]));
                for (const row of rows || []) {
                    const data = row.data;
                    if (!data || typeof data !== 'object') continue;
                    const id = String(row.shikimori_id);
                    const normalized = {
                        ...data, id, shikimoriId: Number(row.shikimori_id),
                        title: data.title || data.originalTitle || 'Без названия',
                        genres: Array.isArray(data.genres) ? data.genres : [],
                        episodeCount: Math.max(0, Number(data.episodeCount) || 0),
                        komiCardUpdatedAt: row.updated_at,
                        episodes: []
                    };
                    const index = indexById.get(id);
                    if (index === undefined) {
                        indexById.set(id, animeList.length);
                        animeList.push(normalized);
                        changed = true;
                    } else {
                        const previous = animeList[index];
                        if (previous.komiDetailsLoaded && previous.komiDetailsLoadedAt === normalized.komiCardUpdatedAt) {
                            normalized.episodes = previous.episodes;
                            normalized.desc = previous.desc;
                            normalized.screenshots = previous.screenshots;
                            normalized.komiDetailsLoaded = true;
                            normalized.komiDetailsLoadedAt = previous.komiDetailsLoadedAt;
                        }
                        if (JSON.stringify(previous) === JSON.stringify(normalized)) continue;
                        animeList[index] = normalized;
                        changed = true;
                    }
                }
                if (changed && (currentView === 'home' || currentView === 'catalog') &&
                    !document.getElementById('watchModal')?.classList.contains('active')) render();
            } catch (error) {
                console.warn('Обновление каталога:', error.message);
                return;
            } finally {
                catalogRefreshInProgress = false;
            }
            catalogRefreshSince = until;
        }
        setInterval(refreshKomiCatalogUpdates, 120000);

        function applyKomiHashRoute() {
            const hash = location.hash.toLowerCase();
            if (hash === '#shop') {
                if (typeof openAniCoinShop === 'function') openAniCoinShop();
                else navigate('shop');
            } else if (hash === '#catalog') {
                if (currentView !== 'catalog') { currentView='catalog'; render(); }
            } else if (hash === '#partners') {
                if (currentView !== 'partners') { currentView='partners'; render(); }
            } else if (hash === '#profile') {
                if (currentUser) {
                    profileTargetUser=currentUser.username;
                    if (currentView !== 'profile') { currentView='profile'; render(); }
                } else openAuthModal('login');
            } else if (!hash && ['shop','catalog','profile','partners'].includes(currentView)) {
                currentView='home';
                render();
            }
        }
        window.addEventListener('hashchange', applyKomiHashRoute);

        render();
        loadDataFromCloud();
        // Broadcast dates can load in parallel with the 6,000+ item catalog.
        loadKomiEpisodeSchedule();
        setInterval(() => { if (!document.hidden) loadKomiEpisodeSchedule(); }, 30 * 60 * 1000);
        queueKomiSessionRestore().finally(() => {
            if (location.hash === '#profile') applyKomiHashRoute();
        });
        // Restore the stored session when returning from browser back/forward cache.
        window.addEventListener('pageshow', event => {
            if (event.persisted) queueKomiSessionRestore();
        });
