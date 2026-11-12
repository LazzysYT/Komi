const animeExtrasCache = new Map();
const animeArtworkFallback = './anime-artwork.svg';

function animeArtwork(anime) {
    return escapeFriendHtml(komiSafeUrl(anime?.banner || anime?.poster) || animeArtworkFallback);
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
    heading.textContent = 'Сезоны, фильмы и другие части';
    section.append(heading);
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
        if (artwork) banner.src = artwork;
        const labels = { PREQUEL: 'Предыдущая часть', SEQUEL: 'Продолжение', SIDE_STORY: 'Ответвление',
            PARENT: 'Основная история', SUMMARY: 'Пересказ', ALTERNATIVE: 'Альтернативная версия',
            SPIN_OFF: 'Спин-офф', OTHER: 'Связанная часть' };
        const related = (details?.relations?.edges || []).filter(edge => edge.node?.type === 'ANIME' && labels[edge.relationType]);
        related.sort((a, b) => (a.node.seasonYear || Infinity) - (b.node.seasonYear || Infinity));
        status.textContent = related.length || seasons.length ? '' : 'Связанные части не найдены.';
        const seen = new Set();
        for (const { node, relationType } of related) {
            if (seen.has(node.id)) continue;
            seen.add(node.id);
            const local = animeList.find(item => Number(item.shikimoriId || item.id) === node.idMal);
            const link = document.createElement(local ? 'button' : 'a');
            link.className = 'season-tab-btn';
            link.textContent = [local?.title || node.title?.romaji || node.title?.native,
                node.format === 'MOVIE' ? 'Фильм' : labels[relationType], node.seasonYear].filter(Boolean).join(' · ');
            if (local) link.onclick = () => openWatchModal(local.id);
            else {
                link.href = 'https://anilist.co/anime/' + encodeURIComponent(node.id);
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
            section.append(link);
        }
    } catch {
        if (section.isConnected) status.textContent = 'Не удалось загрузить связанные части.';
    }
}
