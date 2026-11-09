/* Dialog and friends-drawer keyboard accessibility for the vanilla JS Komi app.
   No React lifecycle is required; this observes the existing .active/.open classes. */
(() => {
    'use strict';
    const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
    const state = new WeakMap();
    const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function visibleFocusables(root) {
        return Array.from(root.querySelectorAll(focusableSelector)).filter(node =>
            !node.closest('[hidden],[inert]') && node.getClientRects().length > 0);
    }
    function synchronizeModal(modal) {
        const active = modal.classList.contains('active');
        const previous = state.get(modal) || {active:false,returnTo:null};
        if (active && !previous.active) previous.returnTo = document.activeElement;
        if (!active && previous.active && modal.contains(document.activeElement)) {
            const returnTo = previous.returnTo;
            if (returnTo?.isConnected && typeof returnTo.focus === 'function') returnTo.focus({preventScroll:true});
            else document.body.focus({preventScroll:true});
        }
        modal.toggleAttribute('inert',!active);
        modal.setAttribute('aria-hidden',String(!active));
        const content = modal.querySelector('.modal-content');
        if (content) {
            content.setAttribute('role','dialog');
            content.setAttribute('aria-modal',String(active));
            if (!content.hasAttribute('aria-label') && !content.hasAttribute('aria-labelledby')) {
                content.setAttribute('aria-label', 'Окно Komi Anime');
            }
        }
        state.set(modal,{active,returnTo:previous.returnTo});
        if (active && !previous.active) {
            requestAnimationFrame(() => {
                if (!modal.classList.contains('active')) return;
                if (modal.contains(document.activeElement)) return;
                const focusables=visibleFocusables(modal);
                (focusables[0] || content)?.focus?.({preventScroll:true});
            });
        }
    }
    for (const modal of overlays) {
        synchronizeModal(modal);
        new MutationObserver(() => synchronizeModal(modal))
            .observe(modal,{attributes:true,attributeFilter:['class']});
    }
    const drawer = document.getElementById('komiFriendsDrawer');
    let drawerOpen = false;
    function synchronizeDrawer() {
        if (!drawer) return;
        const opened=drawer.classList.contains('open');
        if (!opened && drawerOpen && drawer.contains(document.activeElement)) {
            document.getElementById('sideFriendsBtn')?.focus({preventScroll:true});
        }
        drawer.toggleAttribute('inert',!opened);
        drawer.setAttribute('aria-hidden',String(!opened));
        if (opened && !drawerOpen) requestAnimationFrame(() => {
            if (drawer.classList.contains('open') && !drawer.contains(document.activeElement))
                drawer.querySelector('#komiFriendsSearch')?.focus({preventScroll:true});
        });
        drawerOpen=opened;
    }
    if (drawer) {
        synchronizeDrawer();
        new MutationObserver(synchronizeDrawer).observe(drawer,{attributes:true,attributeFilter:['class']});
    }
    function closeModal(modal) {
        switch (modal.id) {
            case 'watchModal': if (typeof closeWatchModal==='function') closeWatchModal(); return;
            case 'watchPartyModal': if (typeof leaveWatchPartyRoom==='function') leaveWatchPartyRoom(); return;
            case 'authModal': if (typeof closeAuthModal==='function') closeAuthModal(); return;
            case 'addModal': if (typeof closeAddModal==='function') closeAddModal(); return;
        }
        const close = modal.querySelector('.modal-close');
        if (close) close.click();
        else modal.classList.remove('active');
    }
    document.addEventListener('keydown',event => {
        if (event.key === 'Escape') {
            const top = overlays.filter(x=>x.classList.contains('active')).at(-1);
            if (top) {event.preventDefault();closeModal(top);return}
            if (drawer?.classList.contains('open') && typeof closeFriendsDrawer==='function') {
                event.preventDefault();closeFriendsDrawer();
            }
            return;
        }
        if (event.key !== 'Tab') return;
        const top = overlays.filter(x=>x.classList.contains('active')).at(-1);
        const layer=top || (drawer?.classList.contains('open')?drawer:null);
        if (!layer) return;
        const items=visibleFocusables(layer);
        if (!items.length) {event.preventDefault();return}
        const first=items[0],last=items.at(-1);
        if (event.shiftKey && (document.activeElement===first || !layer.contains(document.activeElement))) {
            event.preventDefault();last.focus();
        } else if (!event.shiftKey && (document.activeElement===last || !layer.contains(document.activeElement))) {
            event.preventDefault();first.focus();
        }
    });
})();
