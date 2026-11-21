/* Lazily loaded only after komi_is_admin RPC succeeds.
 * Server-side Supabase RLS remains mandatory for all writes. */
(function () {
    'use strict';
    const editorMarkup = "<div class=\"modal-overlay\" id=\"addModal\">\n        <div class=\"modal-content\" style=\"max-width: 650px;\">\n            <button class=\"modal-close\" data-komi-click=\"anime-close\">&times;</button>\n            <h2 id=\"modalTitleText\" style=\"margin-bottom: 12px; font-size: 18px;\">Добавить / Редактировать аниме</h2>\n            \n            <div style=\"margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px;\">\n                <div style=\"display: flex; gap: 6px;\">\n                    <input type=\"text\" id=\"apiSearchTitle\" class=\"form-control\" placeholder=\"Название для авто-заполнения (Shikimori)...\">\n                    <button type=\"button\" class=\"btn-secondary\" data-komi-click=\"anime-search\"> Найти</button>\n                    <button type=\"button\" class=\"btn-glow\" data-komi-click=\"anime-import\"> Топ</button>\n                </div>\n                <div id=\"apiSearchResultsList\" style=\"display: none; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; max-height: 150px; overflow-y: auto; padding: 4px;\"></div>\n            </div>\n\n            <form id=\"animeForm\" novalidate data-komi-submit=\"anime-submit\">\n                <input type=\"hidden\" id=\"editAnimeId\">\n                <div class=\"form-group\">\n                    <label for=\"animeShikimoriId\">Shikimori ID (числовой)</label>\n                    <input type=\"number\" class=\"form-control\" id=\"animeShikimoriId\" min=\"1\" max=\"999999999999\" step=\"1\" required placeholder=\"Например: 52991\">\n                </div>\n                <div class=\"form-group\">\n                    <label>Название</label>\n                    <input type=\"text\" class=\"form-control\" id=\"animeTitle\" required placeholder=\"Название аниме\">\n                </div>\n                <div class=\"form-group\">\n                    <label>Постер (URL)</label>\n                    <input type=\"url\" class=\"form-control\" id=\"animePoster\" required placeholder=\"https://...\">\n                </div>\n                <div class=\"form-group\">\n                    <label>Рейтинг Shikimori</label>\n                    <input type=\"text\" class=\"form-control\" id=\"animeShikiRating\" placeholder=\"9.0\">\n                </div>\n                <div class=\"form-group\">\n                    <label>Кадры (через запятую)</label>\n                    <input type=\"text\" class=\"form-control\" id=\"animeScreenshots\" placeholder=\"https://img1.jpg, https://img2.jpg...\">\n                </div>\n                <div class=\"form-group\">\n                    <label>Трейлер (YouTube embed)</label>\n                    <input type=\"url\" class=\"form-control\" id=\"animeTrailer\" placeholder=\"https://www.youtube.com/embed/...\">\n                </div>\n                <div class=\"form-group\">\n                    <label>Жанры</label>\n                    <div id=\"genresCheckboxList\" style=\"display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; background: var(--bg-input); padding: 8px; border-radius: 8px; border: 1px solid var(--border);\"></div>\n                </div>\n                <div class=\"form-group\">\n                    <label>Год / Тип</label>\n                    <div style=\"display: flex; gap: 6px;\">\n                        <input type=\"text\" class=\"form-control\" id=\"animeYear\" placeholder=\"2026\" style=\"flex:1;\">\n                        <input type=\"text\" class=\"form-control\" id=\"animeType\" placeholder=\"Фильм или Сериал\" style=\"flex:1;\">\n                    </div>\n                </div>\n                <div class=\"form-group\">\n                    <label>Описание</label>\n                    <textarea class=\"form-control\" id=\"animeDesc\" style=\"resize: none; min-height: 120px\" placeholder=\"Сюжет...\"></textarea>\n                </div>\n                <div class=\"form-group\">\n                    <label>Эпизоды</label>\n                    <div id=\"episodesList\" style=\"display:flex; flex-direction:column; gap:6px; margin-bottom:6px;\"></div>\n                    <button type=\"button\" class=\"btn-secondary\" data-komi-click=\"episode-add\">+ Добавить эпизод</button>\n                </div>\n                <button type=\"submit\" class=\"btn-glow\" style=\"width: 100%; margin-top: 6px; justify-content: center;\" data-komi-click=\"sound\">Сохранить</button>\n            </form>\n        </div>\n    </div>";
    window.komiMountAdminUI = function () {
        if (!document.getElementById('adminModal')) {
            const panel = document.createElement('div');
            panel.className = 'modal-overlay';
            panel.id = 'adminModal';
            panel.innerHTML = '<div class="modal-content" style="max-width:900px" id="adminModalContent"></div>';
            document.body.appendChild(panel);
        }
        if (!document.getElementById('addModal')) {
            const template = document.createElement('template');
            template.innerHTML = editorMarkup;
            document.body.appendChild(template.content.cloneNode(true));
        }
        return Boolean(document.getElementById('adminModal') && document.getElementById('animeForm'));
    };

    // Admin-only purchase attribution. All data and actions are additionally
    // protected by Supabase RPC membership checks (komi_admin_members).
    // Load the referral workspace only after the existing server admin check.
    let referralDashboardLoader = null;
    window.komiMountReferralAdmin = async function (root, supabase, back) {
        if (typeof window.komiReferralAdminUI !== 'function') {
            if (!referralDashboardLoader) {
                referralDashboardLoader = new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = '/komi-referral-admin.js?v=20261122-discounts';
                    script.async = true;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Не удалось загрузить панель рефералов'));
                    document.head.appendChild(script);
                });
            }
            try { await referralDashboardLoader; }
            catch (error) {
                referralDashboardLoader = null;
                root.textContent = error.message;
                return;
            }
        }
        if (typeof window.komiReferralAdminUI !== 'function') {
            root.textContent = 'Панель рефералов недоступна';
            return;
        }
        return window.komiReferralAdminUI(root, supabase, back);
    };
    let premiumLoader=null;
    window.komiMountPremiumAdmin=async function(root,db,back){
        if(typeof window.komiPremiumAdminUI!=='function'){
            if(!premiumLoader) premiumLoader=new Promise((resolve,reject)=>{
                const s=document.createElement('script');
                s.src='/komi-premium-admin.js?v=20261122a';
                s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Не удалось загрузить Premium-админку'));
                document.head.append(s);
            });
            try{await premiumLoader;}
            catch(e){premiumLoader=null;root.textContent=e.message;return;}
        }
        if(typeof window.komiPremiumAdminUI==='function')return window.komiPremiumAdminUI(root,db,back);
    };
})();
