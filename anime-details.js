const animeExtrasCache = new Map();
const animeArtworkFallback = './anime-artwork.svg';

function animeArtwork(anime) {
    const original = komiSafeUrl(anime?.banner || anime?.poster) || animeArtworkFallback;
    const cached = typeof komiCachedPosterUrl === 'function' ? komiCachedPosterUrl(original) : original;
    return escapeFriendHtml(cached);
}

function animeDetailsMarkup(anime) {
    return `
        <div id="komiAnimeBanner" style="height:clamp(90px,20vw,230px);overflow:hidden;border-radius:12px;background:#211923">
            <img src="${animeArtwork(anime)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center 30%"
                 data-komi-onerror="this.onerror=null;this.src='./anime-artwork.svg'">
        </div>
        <section id="komiAnimeRelations" style="margin:12px 0" aria-live="polite"></section>
    `;
}

async function renderAnimeExtras(anime, seasons = []) {
    const section = document.getElementById('komiAnimeRelations');
    const banner = document.querySelector('#komiAnimeBanner img');
    const heading = document.createElement('h3');
    heading.textContent = 'Порядок просмотра · части франшизы';
    section.append(heading);
    const sequenceHint = document.createElement('p');
    sequenceHint.style.cssText = 'color:#b9b9bf;font-size:12px;margin:6px 0';
    sequenceHint.textContent = 'Связанные аниме упорядочены по году выпуска. Это ориентир, не официальная сюжетная хронология.';
    section.append(sequenceHint);
    for (const season of seasons) {
        const button = document.createElement('button');
        button.className = 'season-tab-btn';
        button.textContent = 'Сезон ' + season;
        button.onclick = () => openWatchModal(anime.id, season, 0);
        section.append(button);
    }
    const status = document.createElement('p');
    status.textContent = 'Загружаем связанные части…';
    section.append(status);
    const id = Number(anime.shikimoriId || anime.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        status.textContent = seasons.length ? '' : 'Связанные части не указаны.';
        return;
    }
    if (!animeExtrasCache.has(id)) {
        const request = fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ variables: { id }, query: `query ($id:Int!) {
                Media(idMal:$id,type:ANIME) {
                    bannerImage coverImage { extraLarge }
                    relations { edges { relationType(version:2) node {
                        id idMal type format seasonYear title { native romaji }
                    } } }
                }
            }` }),
            signal: AbortSignal.timeout(9000)
        }).then(async response => {
            if (!response.ok) throw new Error('AniList HTTP ' + response.status);
            return (await response.json()).data?.Media;
        }).catch(error => {
            animeExtrasCache.delete(id);
            throw error;
        });
        animeExtrasCache.set(id, request);
    }
    try {
        const details = await animeExtrasCache.get(id);
        if (!section.isConnected) return;
        const artwork = komiSafeUrl(details?.bannerImage) || (!komiSafeUrl(anime.poster) && komiSafeUrl(details?.coverImage?.extraLarge));
        if (artwork) banner.src = typeof komiCachedPosterUrl === 'function' ? komiCachedPosterUrl(artwork) : artwork;
        const labels = { PREQUEL: 'Предыдущая часть', SEQUEL: 'Продолжение', SIDE_STORY: 'Ответвление',
            PARENT: 'Основная история', SUMMARY: 'Пересказ', ALTERNATIVE: 'Альтернативная версия',
            SPIN_OFF: 'Спин-офф', OTHER: 'Связанная часть' };
        const related = (details?.relations?.edges || [])
            .filter(edge => edge.node?.type === 'ANIME' && labels[edge.relationType]);
        const base = {
            node: { id: -id, idMal:id, title:{romaji:anime.title}, format:anime.type, seasonYear:Number(anime.year)||null },
            relationType: 'CURRENT'
        };
        const arranged = [base,...related].sort((a,b) =>
            (Number(a.node.seasonYear)||9999)-(Number(b.node.seasonYear)||9999)
            || ({PREQUEL:0,CURRENT:1,SEQUEL:2}[a.relationType]??3)-({PREQUEL:0,CURRENT:1,SEQUEL:2}[b.relationType]??3));
        status.textContent = related.length || seasons.length ? '' : 'Связанные части не найдены.';
        const seen = new Set();
        const statusMap = (typeof userAnimeStatuses !== 'undefined' && typeof currentUser !== 'undefined' && currentUser?.username)
            ? userAnimeStatuses[currentUser.username] || {} : {};
        for (const { node, relationType } of arranged) {
            const malId = Number(node.idMal);
            if (seen.has(malId) || !malId) continue;
            seen.add(malId);
            const local = animeList.find(item => Number(item.shikimoriId || item.id) === malId);
            const control = document.createElement(local ? 'button' : 'a');
            control.className = 'season-tab-btn';
            const watched = statusMap[String(local?.id ?? malId)] || statusMap[String(malId)];
            const partName = local?.title || node.title?.romaji || node.title?.native || ('Аниме #' + malId);
            const fmt = node.format === 'MOVIE' || /фильм/i.test(node.format||'') ? 'Фильм' : relationType === 'CURRENT' ? 'Текущая часть' : labels[relationType];
            control.textContent = (watched ? '✓ ' : '◇ ') + [partName,fmt,node.seasonYear,watched].filter(Boolean).join(' · ');
            control.title = watched ? ('В твоём списке: '+watched) : 'Добавь эту часть в свой список на странице аниме.';
            if (local) control.onclick = () => openWatchModal(local.id);
            else {
                control.href = 'https://anilist.co/anime/' + encodeURIComponent(node.id);
                control.target = '_blank';
                control.rel = 'noopener noreferrer';
            }
            section.append(control);
        }
    } catch {
        if (section.isConnected) status.textContent = 'Не удалось загрузить связанные части.';
    }
}
