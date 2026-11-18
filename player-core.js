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
            const kind = /\.(mp4|webm|ogg)$/i.test(url.pathname) ? 'video'
                : /\.m3u8$/i.test(url.pathname) ? 'hls' : 'embed';
            return {url: url.href, kind};
        } catch { return {url: '', kind: 'missing'}; }
    }
    function finite(value) { return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0; }
    function episodeSeason(episode) { return Number(episode?.season) || 1; }
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
        return merged;
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
    const api = {source, finite, episodeSeason, seasonEpisodes, createWriter};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KomiPlayerCore = api;
})(globalThis);
