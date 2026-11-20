/* Per-title audio choice plus an optional browser-local global favorite.
 * Source names are labels only; no playback URLs, tokens or account data stored. */
(function (root) {
    'use strict';
    const COUNTS_KEY = 'komi_source_picks_v1';
    const MAX_CHOICES = 80;
    function validName(value) {
        return typeof value === 'string' && value.trim().length > 0 &&
            value.length <= 120 && !/[<>\u0000-\u001f]/.test(value);
    }
    function validAnimeId(id) {
        return /^[1-9][0-9]{0,14}$/.test(String(id)) && Number.isSafeInteger(Number(id));
    }
    function readCounts() {
        let data;
        try { data = JSON.parse(root.localStorage?.getItem(COUNTS_KEY) || '{}'); }
        catch { return {}; }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
        return Object.fromEntries(Object.entries(data).slice(0, MAX_CHOICES).filter(([name, count]) =>
            validName(name) && Number.isSafeInteger(count) && count > 0 && count <= 100000));
    }
    function globalFavorite(available) {
        const choices = new Set(Array.isArray(available) ? available.filter(validName) : []);
        const entries = Object.entries(readCounts()).filter(([name]) => choices.has(name));
        entries.sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0],'ru'));
        return entries[0]?.[0] || '';
    }
    function preferredFor(animeId, available) {
        if (!validAnimeId(animeId)) return {name:'',kind:'none'};
        const options = new Set(Array.isArray(available) ? available.filter(validName) : []);
        let stored = '';
        try { stored = root.localStorage?.getItem('komi_source_' + animeId) || ''; }
        catch {}
        if (validName(stored) && options.has(stored)) return {name:stored,kind:'title'};
        const global = globalFavorite([...options]);
        return global ? {name:global,kind:'global'} : {name:'',kind:'none'};
    }
    function recordChoice(animeId, name) {
        if (!validAnimeId(animeId) || !validName(name)) return false;
        try {
            root.localStorage?.setItem('komi_source_' + animeId, name);
            const counts = readCounts();
            counts[name] = Math.min(100000, (counts[name] || 0) + 1);
            const entries = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, MAX_CHOICES);
            root.localStorage?.setItem(COUNTS_KEY, JSON.stringify(Object.fromEntries(entries)));
            return true;
        } catch { return false; }
    }
    const api = {preferredFor,recordChoice,globalFavorite,readCounts};
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.KomiSourcePrefs = api;
})(globalThis);
