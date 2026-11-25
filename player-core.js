/* Shared source parsing and ordered, coalesced persistence. Also used by tests. */
(function (root) {
    'use strict';
    function source(raw) {
        if (typeof raw !== 'string') return {url: '', kind: 'missing'};
        let value = raw.trim();
        const iframe = /^<iframe\b/i.test(value);
        if (iframe) {
            value = value.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || '';
            value = value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'");
        }
        if (value.startsWith('//')) value = 'https:' + value;
        try {
            const url = new URL(value);
            if (url.protocol !== 'https:' || url.username || url.password) throw Error('Invalid source');
            // Public demo clips are not episodes. Refuse even stale cached links.
            if (['commondatastorage.googleapis.com', 'storage.googleapis.com'].includes(url.hostname.toLowerCase()) &&
                url.pathname.startsWith('/gtv-videos-bucket/sample/')) throw Error('Not anime media');
            const kind = /\.(mp4|webm|ogg)$/i.test(url.pathname) ? 'video'
                : /\.m3u8$/i.test(url.pathname) ? 'hls' : 'embed';
            return {url: url.href, kind};
        } catch { return {url: '', kind: 'missing'}; }
    }
    function finite(value) { return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0; }
    function episodeSeason(episode) { return Number(episode?.season) || 1; }
    function episodeNumber(episode) {
        const raw = String(episode?.number ?? '').trim();
        const legacy = String(episode?.title ?? '').trim().match(/^(?:Эпизод|Серия|Episode)\s+(\d{1,6})$/iu)?.[1];
        const value = /^\d{1,6}(?:\.0+)?$/.test(raw) && Number(raw) > 0 ? Number(raw) : Number(legacy);
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    }

    function seasonEpisodes(episodes, season) {
        const records = episodes.map((episode, index) => ({episode, index}))
            .filter(({episode}) => episode && episodeSeason(episode) === season)
            .sort((a, b) => (Number(a.episode.number) || 0) - (Number(b.episode.number) || 0));
        const byNumber = new Map();
        const merged = [];
        records.forEach(({episode, index}, slot) => {
            const number = String(episode.number ?? '').trim();
            const key = /^\d+$/.test(number) ? Number(number) : null;
            let item = key === null ? null : byNumber.get(key);
            if (!item) {
                item = {...episode, originalIdx: index, slots: [], sources: Object.create(null), origins: Object.create(null)};
                merged.push(item);
                if (key !== null) byNumber.set(key, item);
            }
            item.slots.push(slot);
            for (const field of ['preview', 'thumbnail', 'screenshot', 'duration', 'durationSeconds']) {
                if (!item[field] && episode[field]) item[field] = episode[field];
            }
            const declared = Object.entries(episode.sources || {})
                .map(([name, raw]) => [name, source(raw).url]).filter(([, url]) => url);
            const entries = declared.length ? declared : [['Default', source(episode.url).url]];
            for (const [name, url] of entries) {
                if (!url) continue;
                let label = name;
                let suffix = 2;
                while (item.sources[label] && item.sources[label] !== url) label = name + ' (' + suffix++ + ')';
                if (item.sources[label]) continue;
                item.sources[label] = url;
                item.origins[label] = {index, name: declared.length ? name : 'Основной источник'};
            }
        });
        // A licensed, verified ad-free stream should be the first playback option
        // even when duplicate legacy episode rows were coalesced above.
        for (const item of merged) {
            const ranked = Object.entries(item.sources).sort(([a], [b]) =>
                Number(b.startsWith('Без рекламы · ')) - Number(a.startsWith('Без рекламы · ')));
            const preferred = Object.create(null);
            for (const [label, url] of ranked) preferred[label] = url;
            item.sources = preferred;
        }
        return merged;
    }
    // The licensed partner bot is the only intended producer of this label.
    // Never infer "ad-free" from an arbitrary direct MP4/HLS link.
    function verifiedAdFree(name, raw) {
        const item = source(raw);
        return typeof name === 'string' && name.startsWith('Без рекламы · ') &&
            ['video', 'hls'].includes(item.kind);
    }
    function selectPlaybackSource(sources, options = {}) {
        const entries = Object.entries(sources && typeof sources === 'object' ? sources : {})
            .map(([name, raw]) => ({name, ...source(raw)}))
            .filter(item => item.url);
        const approved = entries.filter(item => verifiedAdFree(item.name, item.url));
        const eligible = options.adFreeOnly ? approved : entries;
        let chosen;
        // A conscious source choice wins when the strict filter allows it.
        if (options.requestedSource != null) {
            chosen = eligible.find(item => item.name === options.requestedSource);
        }
        // Otherwise always prefer a licensed ad-free option, even over a
        // previously saved external iframe or non-approved direct file.
        if (!chosen && approved.length) chosen = approved[0];
        if (!chosen && options.preferredSource != null) {
            chosen = eligible.find(item => item.name === options.preferredSource &&
                (['video','hls'].includes(item.kind) ||
                 !eligible.some(other => ['video','hls'].includes(other.kind))));
        }
        // A temporary partner iframe is an ordinary external player: not a
        // certified ad-free direct stream. Prefer it only in normal mode.
        if (!chosen && !options.adFreeOnly && options.partnerPreferred) {
            chosen = eligible.find(item => item.name === options.partnerPreferred &&
                item.kind === 'embed' && (() => {
                    try {
                        const host=new URL(item.url).hostname.toLowerCase();
                        return host === 'anivibe.pro' || host.endsWith('.anivibe.pro');
                    } catch { return false; }
                })());
        }
        if (!chosen) chosen = eligible.find(item => ['video','hls'].includes(item.kind)) || eligible[0];
        return {
            name: chosen?.name || '',
            url: chosen?.url || '',
            availableNames: eligible.map(item => item.name),
            approvedCount: approved.length,
            strictBlocked: Boolean(options.adFreeOnly && !approved.length)
        };
    }
    // This precise embed displayed «Данного сезона не существует» in Kodik.
    // Keep the catalog, dub names and original episode/Party indices untouched;
    // a corrected URL, a neighboring episode or a different title stays eligible.
    function watchEpisodeSources(sources, {animeId, season, number} = {}) {
        const selected = {...sources};
        if (String(animeId) !== '5114' || Number(season) !== 1 || Number(number) !== 2) return selected;
        for (const [name, raw] of Object.entries(selected)) {
            const parsed = source(raw);
            if (!parsed.url) continue;
            const url = new URL(parsed.url);
            if (url.origin === 'https://kodikplayer.com' &&
                url.pathname === '/serial/7884/d5bb968fd3ac83b29b02a5c955166563/720p' &&
                url.searchParams.get('season') === '1' &&
                url.searchParams.get('only_episode') === 'true' &&
                url.searchParams.get('episode') === '2') delete selected[name];
        }
        return selected;
    }
    function createWriter(write, onError = () => {}) {
        const entries = new Map();
        return {
            enqueue(key, value) {
                let entry = entries.get(key);
                if (entry) { entry.next = value; return entry.promise; }
                entry = { next: value };
                entries.set(key, entry);
                entry.promise = Promise.resolve().then(async () => {
                    while (entry.next) {
                        const next = entry.next;
                        entry.next = null;
                        try { await write(next); }
                        catch (error) { onError(error, next); }
                    }
                }).finally(() => entries.delete(key));
                return entry.promise;
            },
            flush() { return Promise.all([...entries.values()].map(entry => entry.promise)); }
        };
    }
    const api = {source, finite, episodeSeason, episodeNumber, seasonEpisodes, verifiedAdFree, selectPlaybackSource, watchEpisodeSources, createWriter};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KomiPlayerCore = api;
})(globalThis);
