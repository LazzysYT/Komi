/* KomiAnime mobile bottom sheets. Existing player, list and filtering handlers remain authoritative. */
(function (root) {
    'use strict';
    if (typeof document === 'undefined') return;
    const mobile = root.matchMedia('(max-width: 767px)');
    let opened = null;
    let pendingHomeFilter = false;

    function button(label, className) {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = label;
        if (className) element.className = className;
        return element;
    }
    function createLayer() {
        let layer = document.getElementById('komiMobileSheet');
        if (layer) return layer;
        layer = document.createElement('div');
        layer.id = 'komiMobileSheet';
        layer.className = 'komi-mobile-sheet-layer';
        layer.hidden = true;
        const backdrop = button('', 'komi-mobile-sheet-backdrop');
        backdrop.setAttribute('aria-label','Закрыть шторку');
        backdrop.addEventListener('click', () => close());
        const panel = document.createElement('section');
        panel.className = 'komi-mobile-sheet-panel';
        panel.setAttribute('role','dialog');
        panel.setAttribute('aria-modal','true');
        panel.setAttribute('aria-labelledby','komiMobileSheetTitle');
        const grab = document.createElement('div');
        grab.className = 'komi-mobile-sheet-grab';
        grab.setAttribute('aria-hidden','true');
        const bar = document.createElement('div');
        bar.className = 'komi-mobile-sheet-header';
        const title = document.createElement('h2');
        title.id = 'komiMobileSheetTitle';
        const closeButton = button('×', 'komi-mobile-sheet-close');
        closeButton.setAttribute('aria-label','Закрыть');
        closeButton.addEventListener('click', () => close());
        bar.append(title,closeButton);
        const body = document.createElement('div');
        body.className = 'komi-mobile-sheet-body';
        const footer = document.createElement('div');
        footer.className = 'komi-mobile-sheet-footer';
        panel.append(grab,bar,body,footer);
        layer.append(backdrop,panel);
        // Restrict swipe-dismiss to the grab/header, not the scrollable episode list.
        let touchStart = null;
        for (const target of [grab,bar]) {
            target.addEventListener('touchstart', event => {
                if (event.touches.length !== 1) { touchStart = null; return; }
                touchStart = {x:event.touches[0].clientX,y:event.touches[0].clientY};
            }, {passive:true});
            target.addEventListener('touchend', event => {
                if (!touchStart || event.changedTouches.length !== 1) return;
                const dy = event.changedTouches[0].clientY - touchStart.y;
                const dx = event.changedTouches[0].clientX - touchStart.x;
                touchStart = null;
                if (dy > 70 && Math.abs(dx) < 65) close();
            }, {passive:true});
            target.addEventListener('touchcancel', () => {touchStart=null;}, {passive:true});
        }
        return layer;
    }
    function close(restoreFocus = true) {
        if (!opened) return;
        const state = opened;
        opened = null;
        if (state.moved?.node && state.moved.placeholder?.parentNode) {
            state.moved.placeholder.replaceWith(state.moved.node);
        } else state.moved?.placeholder?.remove();
        state.layer.hidden = true;
        state.layer.classList.remove('is-open');
        state.layer.querySelector('.komi-mobile-sheet-body').replaceChildren();
        state.layer.querySelector('.komi-mobile-sheet-footer').replaceChildren();
        if (state.bodyOverflow === null) document.body.style.removeProperty('overflow');
        else document.body.style.overflow = state.bodyOverflow;
        if (restoreFocus && state.origin?.isConnected && !state.origin.disabled) {
            state.origin.focus({preventScroll:true});
        }
    }
    function focusable(panel) {
        return [...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')]
            .filter(element => !element.hidden && element.getClientRects().length);
    }
    function open(kind, label, origin, scope) {
        if (!mobile.matches) return null;
        close(false);
        const layer = createLayer();
        const parent = scope === 'watch' ? document.getElementById('watchModal') : document.body;
        if (!parent || (scope === 'watch' && !parent.classList.contains('active'))) return null;
        parent.append(layer);
        layer.querySelector('#komiMobileSheetTitle').textContent = label;
        const state = {kind,origin,layer,bodyOverflow:document.body.style.overflow || null,moved:null};
        opened = state;
        layer.hidden = false;
        layer.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        return {
            state,
            body:layer.querySelector('.komi-mobile-sheet-body'),
            footer:layer.querySelector('.komi-mobile-sheet-footer'),
            focus() {
                requestAnimationFrame(() => {
                    if (opened === state) {
                        const first = focusable(layer.querySelector('.komi-mobile-sheet-panel'))[0];
                        (first || layer.querySelector('.komi-mobile-sheet-close'))?.focus({preventScroll:true});
                    }
                });
            }
        };
    }

    function watchReady() {
        return mobile.matches && document.getElementById('watchModal')?.classList.contains('active');
    }
    async function leaveFullscreen() {
        if (!document.fullscreenElement || typeof document.exitFullscreen !== 'function') return;
        try { await document.exitFullscreen(); } catch {}
    }
    async function openSource(origin) {
        if (!watchReady()) return;
        const select = document.getElementById('komiWatchSourceSelect');
        if (!select) return;
        await leaveFullscreen();
        if (!watchReady() || !select.isConnected) return;
        const view = open('source', 'Озвучка и источник', origin, 'watch');
        if (!view) return;
        const list = document.createElement('div');
        list.className = 'komi-mobile-sheet-options';
        for (const option of select.options) {
            if (option.disabled || option.value === 'Недоступно') continue;
            const item = button(option.textContent, 'komi-mobile-sheet-option');
            item.setAttribute('aria-pressed', String(option.value === select.value));
            item.addEventListener('click', () => {
                const changed = option.value !== select.value;
                close(false);
                if (changed && select.isConnected) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change',{bubbles:true}));
                }
            });
            list.append(item);
        }
        if (!list.children.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Доступных источников пока нет.';
            view.body.append(empty);
        } else view.body.append(list);
        const originalAdFree = document.getElementById('komiAdFreeOnlyToggle');
        if (originalAdFree) {
            const strict = button(originalAdFree.textContent.trim(), 'komi-mobile-sheet-strict');
            strict.setAttribute('aria-pressed', String(originalAdFree.getAttribute('aria-pressed') === 'true'));
            strict.addEventListener('click', () => {
                close(false);
                if (originalAdFree.isConnected) originalAdFree.click();
            });
            view.footer.append(strict);
        }
        view.focus();
    }
    async function openEpisodes(origin) {
        if (!watchReady()) return;
        const sidebar = document.querySelector('#watchModalContent .komi-watch-sidebar');
        if (!sidebar) return;
        await leaveFullscreen();
        if (!watchReady() || !sidebar.isConnected) return;
        const view = open('episodes', 'Список серий', origin, 'watch');
        if (!view) return;
        const placeholder = document.createComment('Komi mobile episodes restore point');
        sidebar.before(placeholder);
        view.state.moved = {node:sidebar,placeholder};
        view.body.append(sidebar);
        const activeEpisode = sidebar.querySelector('.komi-episode-number.active');
        requestAnimationFrame(() => {
            if (opened !== view.state) return;
            activeEpisode?.scrollIntoView({block:'nearest',behavior:'instant'});
        });
        view.focus();
    }

    function filterInput(id, label) {
        const source = document.getElementById(id);
        if (!source) return null;
        const row = document.createElement('label');
        row.className = 'komi-mobile-sheet-field';
        const caption = document.createElement('span');
        caption.textContent = label;
        const select = document.createElement('select');
        select.className = 'komi-mobile-sheet-select';
        select.setAttribute('aria-label',label);
        for (const option of source.options) select.add(new Option(option.textContent,option.value));
        select.value = source.value;
        row.append(caption,select);
        return {row,select};
    }
    function openFilters(origin) {
        if (!mobile.matches || !document.getElementById('komiCatalogGrid')) return false;
        const fieldSpec = [
            ['genre','komiCatalogGenre','Жанр'],
            ['year','komiCatalogYear','Год'],
            ['type','komiCatalogType','Тип'],
            ['sort','komiCatalogSort','Сортировка']
        ];
        const fields = Object.create(null);
        for (const [key,id,label] of fieldSpec) {
            const field = filterInput(id,label);
            if (!field) return false;
            fields[key] = field;
        }
        const view = open('filters', 'Фильтры каталога', origin, 'catalog');
        if (!view) return false;
        const form = document.createElement('form');
        form.className = 'komi-mobile-sheet-filters';
        for (const [key] of fieldSpec) form.append(fields[key].row);
        const switchRow = document.createElement('label');
        switchRow.className = 'komi-mobile-sheet-hide';
        const hide = document.createElement('input');
        hide.type = 'checkbox';
        hide.checked = !!document.getElementById('komiHideWatched')?.checked;
        const switchText = document.createElement('span');
        switchText.textContent = 'Скрыть просмотренное и брошенное';
        switchRow.append(hide,switchText);
        form.append(switchRow);
        const reset = button('Сбросить', 'komi-mobile-sheet-reset');
        reset.addEventListener('click', () => {
            fields.genre.select.value='Все';
            fields.year.select.value='Все';
            fields.type.select.value='Все';
            fields.sort.select.value='popular';
            hide.checked=false;
        });
        const apply = button('Применить', 'komi-mobile-sheet-apply');
        apply.type='submit';
        form.addEventListener('submit', event => {
            event.preventDefault();
            const snapshot = {
                genre:fields.genre.select.value, year:fields.year.select.value,
                type:fields.type.select.value, sort:fields.sort.select.value,
                hide:hide.checked
            };
            const applied = typeof root.komiApplyMobileFilters === 'function' &&
                root.komiApplyMobileFilters(snapshot);
            if (applied) close(false);
        });
        view.body.append(form);
        view.footer.append(reset,apply);
        // Submit is associated with the form even though actions sit in the fixed footer.
        apply.addEventListener('click', () => form.requestSubmit());
        apply.type='button';
        view.focus();
        return true;
    }

    function tryPendingFilters() {
        if (pendingHomeFilter && openFilters(document.querySelector('.komi-mobile-filter-trigger'))) {
            pendingHomeFilter = false;
        }
    }
    document.addEventListener('click', event => {
        if (!mobile.matches) return;
        const trigger = event.target.closest?.('.komi-mobile-filter-trigger');
        if (trigger) { event.preventDefault(); openFilters(trigger); return; }
        const quick = event.target.closest?.('#komiHomeQuickFilters > .section-see-all');
        if (quick && typeof root.navigate === 'function') {
            event.preventDefault();
            event.stopImmediatePropagation();
            pendingHomeFilter = true;
            root.navigate('catalog');
            tryPendingFilters();
            return;
        }
        const sourceTrigger = event.target.closest?.('#watchModal :is(.komi-v4-source-trigger,#komiWatchSourceSelect)');
        if (sourceTrigger && watchReady()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void openSource(sourceTrigger);
            return;
        }
        const episodeTrigger = event.target.closest?.('#watchModal :is(.komi-v4-drawer,.komi-episodes-toggle)');
        if (episodeTrigger && watchReady()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void openEpisodes(episodeTrigger);
        }
    }, true);
    document.addEventListener('keydown', event => {
        if (!opened) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            close();
            return;
        }
        if (event.key !== 'Tab') return;
        const items = focusable(opened.layer.querySelector('.komi-mobile-sheet-panel'));
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !opened.layer.contains(document.activeElement))) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !opened.layer.contains(document.activeElement))) {
            event.preventDefault(); first.focus();
        }
    }, true);
    mobile.addEventListener?.('change', () => {
        if (!mobile.matches) { pendingHomeFilter=false; close(false); }
    });
    root.addEventListener('pagehide', () => close(false));

    // Compose with the already installed V3/V4/monochrome mount chain.
    if (typeof root.KomiPlayerUX?.mount === 'function') {
        const existingMount = root.KomiPlayerUX.mount;
        root.KomiPlayerUX.mount = function mobileSheetMount(settings = {}) {
            const context = existingMount(settings);
            const controls = context?.content?.querySelector('.komi-watch-controls');
            const sidebar = context?.content?.querySelector('.komi-watch-sidebar');
            const source = context?.content?.querySelector('#komiWatchSourceSelect');
            if (!controls || !sidebar || !source) return context;
            const dock = document.createElement('div');
            dock.className = 'komi-mobile-watch-actions';
            const dub = button('♫ Озвучка', 'komi-mobile-watch-source');
            dub.setAttribute('aria-haspopup','dialog');
            dub.setAttribute('aria-controls','komiMobileSheet');
            dub.addEventListener('click', () => void openSource(dub));
            const episodes = button('☷ Серии', 'komi-mobile-watch-episodes');
            episodes.setAttribute('aria-haspopup','dialog');
            episodes.setAttribute('aria-controls','komiMobileSheet');
            episodes.addEventListener('click', () => void openEpisodes(episodes));
            dock.append(dub,episodes);
            controls.prepend(dock);
            return context;
        };
    }
    const main = document.getElementById('mainContainer');
    if (main) new MutationObserver(tryPendingFilters).observe(main,{childList:true});
    root.KomiMobileSheets = {openFilters,openSource,openEpisodes,close};
})(globalThis);
