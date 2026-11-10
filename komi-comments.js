/* Public anime comments backed by Supabase RLS. Never trust client-supplied author names. */
(function () {
    'use strict';
    const cache = new Map();
    const MAX_TEXT = 1000;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function legacyComments(animeId) {
        const entries = (typeof animeComments !== 'undefined' && animeComments)
            ? animeComments[String(animeId)] : null;
        if (!Array.isArray(entries)) return [];
        return entries.slice(-30).reverse().map((entry, index) => ({
            id: 'legacy-' + index,
            user_id: null,
            author_name: String(entry.username || entry.author || 'Участник Komi'),
            body: String(entry.text || entry.comment || '').slice(0, MAX_TEXT),
            created_at: entry.created_at || null
        })).filter(entry => entry.body.trim());
    }

    function formatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function statusMessage(section, message) {
        const status = section.querySelector('.komi-comments-status');
        if (status) status.textContent = message;
    }

    function redraw(animeId) {
        const section = document.getElementById('komiAnimeComments');
        if (!section || section.dataset.animeId !== String(animeId)) return;
        const list = section.querySelector('.komi-comments-list');
        if (!list) return;
        list.replaceChildren();
        const records = cache.get(String(animeId))?.rows || [];
        const all = records.concat(legacyComments(animeId));
        section.querySelector('.komi-comments-count').textContent =
            all.length ? String(all.length) + (records.length >= 50 ? '+' : '') : '0';
        if (!all.length) {
            list.append(element('p', 'komi-comments-empty', 'Пока нет комментариев. Начни обсуждение!'));
            return;
        }
        const viewerId = (typeof currentUser !== 'undefined' && currentUser?.authUserId) || '';
        for (const item of all) {
            const card = element('article', 'komi-comment');
            const head = element('div', 'komi-comment-header');
            const name = element('strong', 'komi-comment-name', String(item.author_name || 'Участник Komi').slice(0, 60));
            const date = element('time', 'komi-comment-date', formatDate(item.created_at));
            if (item.created_at) date.dateTime = item.created_at;
            head.append(name, date);
            if (viewerId && String(item.user_id) === String(viewerId)) {
                const button = element('button', 'komi-comment-delete', 'Удалить');
                button.type = 'button';
                button.addEventListener('click', () => removeComment(animeId, item.id, button));
                head.append(button);
            }
            const body = element('p', 'komi-comment-body', item.body);
            card.append(head, body);
            list.append(card);
        }
    }

    async function refresh(animeId, force) {
        const key = String(animeId);
        if (typeof _supabase === 'undefined' || !_supabase) {
            const section = document.getElementById('komiAnimeComments');
            if (section?.dataset.animeId === key) statusMessage(section, 'Сервис комментариев временно недоступен.');
            return;
        }
        const existing = cache.get(key);
        if (!force && existing?.loadedAt && Date.now() - existing.loadedAt < 60000) {
            redraw(key);
            return;
        }
        const { data, error } = await _supabase.from('komi_comments')
            .select('id,anime_id,user_id,author_name,body,created_at')
            .eq('anime_id', Number(key)).order('created_at', { ascending: false }).limit(50);
        const section = document.getElementById('komiAnimeComments');
        if (error) {
            console.warn('Komi comments:', error.message);
            if (section?.dataset.animeId === key) statusMessage(section, 'Не удалось загрузить комментарии.');
            return;
        }
        cache.set(key, { rows: Array.isArray(data) ? data : [], loadedAt: Date.now() });
        if (section?.dataset.animeId === key) {
            statusMessage(section, '');
            redraw(key);
        }
    }

    async function addComment(event, animeId) {
        event.preventDefault();
        const section = document.getElementById('komiAnimeComments');
        if (!section || section.dataset.animeId !== String(animeId)) return;
        if (typeof currentUser === 'undefined' || !currentUser?.authUserId || typeof _supabase === 'undefined' || !_supabase) {
            if (typeof openAuthModal === 'function') openAuthModal('login');
            statusMessage(section, 'Для комментариев войди через Google или email.');
            return;
        }
        const form = section.querySelector('.komi-comments-form');
        const field = form?.querySelector('textarea');
        const button = form?.querySelector('button[type="submit"]');
        const message = field?.value.trim() || '';
        if (!message || message.length > MAX_TEXT) return;
        button.disabled = true;
        statusMessage(section, 'Отправляем комментарий…');
        try {
            const { error } = await _supabase.from('komi_comments')
                .insert({ anime_id: Number(animeId), user_id: currentUser.authUserId, body: message });
            if (error) throw error;
            if (field) field.value = '';
            await refresh(animeId, true);
            statusMessage(section, 'Комментарий опубликован.');
        } catch (error) {
            console.error('Komi comment post:', error);
            statusMessage(section, 'Не удалось отправить комментарий. Попробуй снова.');
        } finally {
            button.disabled = false;
        }
    }

    async function removeComment(animeId, id, button) {
        if (!currentUser?.authUserId || !_supabase || !Number.isSafeInteger(Number(id))) return;
        button.disabled = true;
        const { error } = await _supabase.from('komi_comments')
            .delete().eq('id', Number(id)).eq('user_id', currentUser.authUserId);
        if (error) {
            button.disabled = false;
            const section = document.getElementById('komiAnimeComments');
            if (section?.dataset.animeId === String(animeId)) statusMessage(section, 'Не удалось удалить комментарий.');
            return;
        }
        await refresh(animeId, true);
    }

    function mount(animeId) {
        const container = document.getElementById('watchModalContent');
        if (!container) return;
        container.querySelector('#komiAnimeComments')?.remove();
        const section = element('section', 'komi-comments');
        section.id = 'komiAnimeComments';
        section.dataset.animeId = String(animeId);
        section.setAttribute('aria-labelledby', 'komiCommentsHeading');

        const heading = element('div', 'komi-comments-heading');
        heading.append(element('h2', '', 'Комментарии'));
        heading.querySelector('h2').id = 'komiCommentsHeading';
        heading.append(element('span', 'komi-comments-count', '0'));
        section.append(heading);

        const form = element('form', 'komi-comments-form');
        const input = element('textarea', 'komi-comments-input');
        input.name = 'body';
        input.maxLength = MAX_TEXT;
        input.rows = 3;
        input.required = true;
        input.placeholder = 'Поделись впечатлениями об аниме…';
        input.setAttribute('aria-label', 'Текст комментария');
        const actions = element('div', 'komi-comments-actions');
        const note = element('small', '', currentUser?.authUserId ? 'Имя берётся из твоего профиля Komi.' : 'Для публикации нужен вход через Google или email.');
        const send = element('button', '', 'Отправить');
        send.type = 'submit';
        actions.append(note, send);
        form.append(input, actions);
        form.addEventListener('submit', event => addComment(event, animeId));
        section.append(form);
        const status = element('p', 'komi-comments-status');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        section.append(status);
        section.append(element('div', 'komi-comments-list'));
        container.append(section);
        redraw(animeId);
        refresh(animeId, false);
    }

    window.KomiComments = { mount, refresh };
})();
