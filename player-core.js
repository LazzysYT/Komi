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
    const api = {source, finite, createWriter};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KomiPlayerCore = api;
})(globalThis);
