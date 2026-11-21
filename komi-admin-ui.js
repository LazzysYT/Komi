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
    window.komiMountReferralAdmin = async function (root, supabase, back) {
        root.replaceChildren();
        const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n;};
        const h=el('h2','Реферальные покупки');h.style.cssText='font-size:22px;margin:0 0 14px';
        const toolbar=el('div');toolbar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px';
        const exit=el('button','← Каталог','btn-secondary');exit.onclick=back;toolbar.append(exit);
        const refresh=el('button','Обновить','btn-secondary');toolbar.append(refresh);
        // Create codes without granting direct table writes to the browser.
        const editor=el('section');editor.style.cssText='padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#121215;display:grid;gap:9px;margin:12px 0';
        const edTitle=el('strong','Создать промокод или партнёрский код');edTitle.style.cssText='font-size:14px';
        const formRow=el('div');formRow.style.cssText='display:flex;flex-wrap:wrap;gap:9px;align-items:center';
        const kind=el('select');kind.setAttribute('aria-label','Вид кода');
        for(const [value,label] of [['promo','Промокод (AniCoin)'],['referral','Реферальный код']]){
            const o=el('option',label);o.value=value;kind.append(o);
        }
        const codeInput=el('input');codeInput.type='text';codeInput.placeholder='КОД';codeInput.maxLength=40;
        codeInput.autocomplete='off';codeInput.setAttribute('aria-label','Код');
        const owner=el('input');owner.type='text';owner.placeholder='Имя партнёра';owner.maxLength=120;
        owner.setAttribute('aria-label','Партнёр');
        const reward=el('input');reward.type='number';reward.min='0';reward.max='50';reward.value='15';reward.placeholder='% партнёра';
        reward.setAttribute('aria-label','Вознаграждение партнёра, процент');
        const bonus=el('input');bonus.type='number';bonus.min='0';bonus.max='10000';bonus.value='100';bonus.placeholder='Бонус AniCoin';
        bonus.setAttribute('aria-label','Бонус AniCoin после оплаты');
        const max=el('input');max.type='number';max.min='1';max.max='100000';max.placeholder='Лимит использований (необязательно)';
        max.setAttribute('aria-label','Максимум оплат');
        for(const n of [kind,codeInput,owner,reward,bonus,max]){
           n.style.cssText='background:#1a1a1d;color:#fff;border:1px solid #343438;border-radius:9px;padding:9px 11px;max-width:210px;min-width:110px';
           formRow.append(n);
        }
        const saveCode=el('button','Сохранить код','btn-glow');saveCode.type='button';
        const editorStatus=el('span','');editorStatus.setAttribute('role','status');
        function updateFields(){
          const isPromo=kind.value==='promo';
          owner.hidden=isPromo;reward.hidden=isPromo;bonus.hidden=!isPromo;max.hidden=!isPromo;
        }
        kind.onchange=updateFields;updateFields();
        saveCode.onclick=async()=>{
          const name=codeInput.value.trim().toUpperCase();
          if(!/^[A-Z0-9_-]{3,40}$/.test(name)){
            editorStatus.textContent='Введите 3–40 символов A-Z, 0-9, _ или -';return;
          }
          saveCode.disabled=true;editorStatus.textContent='Сохраняем…';
          try{
            const {data,error}=await supabase.rpc('admin_save_checkout_code',{
              p_kind:kind.value,p_code:name,
              p_bonus_anicoin:kind.value==='promo'?Number(bonus.value):0,
              p_max_uses:kind.value==='promo'&&max.value?Number(max.value):null,
              p_owner_name:kind.value==='referral'?owner.value.trim():null,
              p_reward_percent:kind.value==='referral'?Number(reward.value):15,
              p_is_active:true
            });
            if(error)throw Error(error.message);
            editorStatus.textContent='✓ Код '+(data?.code||name)+' сохранён';
            await load();
          }catch(e){editorStatus.textContent='Ошибка: '+(e?.message||'Неизвестная ошибка');}
          finally{saveCode.disabled=false;}
        };
        editor.append(edTitle,formRow,saveCode,editorStatus);
        const summary=el('div');summary.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:14px 0';
        const filters=el('div');filters.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:16px 0';
        const log=el('div');log.style.cssText='overflow:auto;max-height:56vh';
        const status=el('p','Загружаем подтверждённые покупки…');status.setAttribute('role','status');
        root.append(h,toolbar,editor,summary,filters,status,log);
        let report={codes:[],orders:[]},selected='all';
        const money=(value,currency)=>Number(value||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(currency||'');
        const button=(text,action,klass='btn-secondary')=>{const b=el('button',text,klass);b.type='button';b.onclick=action;return b;};
        function paint(){
            summary.replaceChildren();
            for(const code of report.codes||[]){
                const tile=el('article');tile.style.cssText='border:1px solid rgba(255,255,255,.14);background:#131316;border-radius:12px;padding:13px';
                const name=el('strong',code.code+' · '+code.owner_name);
                const values=el('p','Ввели: '+code.entered+' · Оплачено: '+code.paid+'\nОборот: '+money(code.turnover)+'\nК выплате: '+money(code.unpaid));
                values.style.cssText='white-space:pre-line;line-height:1.8;color:#c9c9ce;font-size:12px';
                tile.append(name,values);summary.append(tile);
            }
            if(!report.codes?.length)summary.append(el('p','Реферальные коды пока не созданы.'));
            filters.replaceChildren();
            const open=(report.orders||[]).filter(x=>x.status==='paid'&&!x.is_referral_marked).length;
            for(const [id,label] of [['all','Все'],['open','Неотмеченные ('+open+')'],['done','Отмеченные']]){
                const b=button(label,()=>{selected=id;paint();},selected===id?'btn-glow':'btn-secondary');
                filters.append(b);
            }
            log.replaceChildren();
            const orders=(report.orders||[]).filter(x=>selected==='all'||
              (selected==='open'&&x.status==='paid'&&!x.is_referral_marked)||
              (selected==='done'&&x.is_referral_marked));
            if(!orders.length){log.append(el('p','Покупок для выбранного фильтра пока нет.'));return;}
            const table=el('table');table.style.cssText='min-width:760px;width:100%;border-collapse:collapse;font-size:12px';
            const header=el('tr');
            for(const v of ['Дата','Покупатель','Тариф и сумма','Реф. код','Промокод','Статус','Действие']){
                const th=el('th',v);th.style.cssText='padding:9px;text-align:left;border-bottom:1px solid #444;color:#aaa';header.append(th);
            }
            const head=el('thead');head.append(header);table.append(head);
            const tbody=el('tbody');
            for(const p of orders){
                const tr=el('tr'),date=p.created_at?new Date(p.created_at).toLocaleDateString('ru-RU'):'—';
                for(const value of [date,p.buyer_email,p.tariff_id+' · '+money(p.final_amount,p.currency),p.referral_code||'—',p.promo_code||'—',p.status]){
                    const td=el('td',value||'—');td.style.cssText='padding:10px 9px;border-bottom:1px solid #333;vertical-align:top';tr.append(td);
                }
                const actions=el('td');actions.style.cssText='padding:9px;border-bottom:1px solid #333;min-width:125px';
                if(p.status==='paid'){
                    const mark=button(p.is_referral_marked?'✓ Отмечено'+(p.marked_at?' ('+new Date(p.marked_at).toLocaleDateString('ru-RU')+')':''):'Отметить',async()=>{
                        mark.disabled=true;
                        const {data,error}=await supabase.rpc('admin_toggle_referral_mark',{
                            p_payment_id:p.id,p_marked:!p.is_referral_marked,p_note:null
                        });
                        if(error||!data)status.textContent='Не получилось обновить отметку: '+(error?.message||'нет доступа');
                        else await load();
                        mark.disabled=false;
                    });
                    actions.append(mark);
                    const note=el('input');note.type='text';note.placeholder='Заметка';note.maxLength=240;note.value=p.admin_note||'';
                    note.setAttribute('aria-label','Комментарий к оплате');
                    note.style.cssText='display:block;width:115px;margin-top:6px;background:#18181c;border:1px solid #555;border-radius:6px;color:white;padding:5px';
                    note.onkeydown=async e=>{
                        if(e.key!=='Enter')return;
                        e.preventDefault();
                        const {error}=await supabase.rpc('admin_toggle_referral_mark',{
                            p_payment_id:p.id,p_marked:p.is_referral_marked,p_note:note.value
                        });
                        status.textContent=error?'Ошибка сохранения заметки':'Заметка сохранена';if(!error)await load();
                    };
                    actions.append(note);
                }else actions.textContent='Ожидает оплаты';
                tr.append(actions);tbody.append(tr);
            }
            table.append(tbody);log.append(table);
        }
        async function load(){
            status.textContent='Обновляем журнал…';
            const {data,error}=await supabase.rpc('admin_referral_report');
            if(error){status.textContent='Не удалось получить журнал: '+error.message;return;}
            report=data||{codes:[],orders:[]};status.textContent='Данные из Supabase · оплаченные счета подтверждены webhook';paint();
        }
        refresh.onclick=load;
        await load();
    };
})();
