/* Quick list selection from catalog cards. No inline handlers or new database writes. */
(function () {
    'use strict';
    const allowed = new Set(['Смотрю', 'В планах', 'Просмотрено']);
    function closeMenus(except) {
        document.querySelectorAll('.komi-card-quick.is-open').forEach(host => {
            if (host === except) return;
            host.classList.remove('is-open');
            host.querySelector('[data-komi-quick-open]')?.setAttribute('aria-expanded', 'false');
        });
    }
    document.addEventListener('click', event => {
        const host = event.target.closest?.('.komi-card-quick');
        if (!host) { closeMenus(); return; }
        // Cards already have a delegated click-to-watch handler.
        event.preventDefault();
        event.stopPropagation();
        const open = event.target.closest('[data-komi-quick-open]');
        if (open) {
            const shouldOpen = !host.classList.contains('is-open');
            closeMenus();
            host.classList.toggle('is-open', shouldOpen);
            open.setAttribute('aria-expanded', String(shouldOpen));
            if (shouldOpen) host.querySelector('[data-komi-quick-status]')?.focus({preventScroll:true});
            return;
        }
        const choice = event.target.closest('[data-komi-quick-status]');
        if (!choice) return;
        const animeId = String(host.dataset.komiQuickId || '');
        const status = choice.dataset.komiQuickStatus;
        closeMenus();
        if (!/^[1-9][0-9]{0,14}$/.test(animeId) || !allowed.has(status)) return;
        host.querySelector('[data-komi-quick-open]')?.focus({preventScroll:true});
        if (typeof setAnimeStatus === 'function') void setAnimeStatus(animeId, status);
    }, true);
    document.addEventListener('keydown', event => {
        const host = event.target.closest?.('.komi-card-quick');
        if (!host) return;
        // Prevent the parent card's Enter/Space shortcut from opening the player.
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
        if (event.key === 'Escape') {
            closeMenus();
            event.stopPropagation();
            host.querySelector('[data-komi-quick-open]')?.focus({preventScroll:true});
        }
    }, true);
})();