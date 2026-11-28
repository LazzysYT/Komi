/* KomiAnime — admin-only referral dashboard.
 * Supabase RPCs enforce permissions; browser UI is not an authorization boundary. */
(function(){
'use strict';
window.komiReferralAdminUI=async function(root,db,back){
  if(!root||!db)return;
  if(!document.getElementById('komi-referral-admin-styles')){
    const sheet=document.createElement('link');
    sheet.id='komi-referral-admin-styles';sheet.rel='stylesheet';
    sheet.href='/komi-referral-admin.css?v=20261128-one-use-codes';document.head.append(sheet);
  }
  root.replaceChildren();
  const app=document.createElement('div');
  app.className='komi-ref-admin';
  app.innerHTML=[
    '<header class="ra-header"><div><div class="ra-eyebrow">KOMIANIME / АДМИНИСТРИРОВАНИЕ</div>',
    '<h2>Рефералы и партнёры</h2><p class="ra-subtitle">Создавайте коды, проверяйте статистику и отмечайте пользователей. Отметки выплат ведутся отдельно.</p></div>',
    '<div class="ra-header-actions"><button type="button" class="ra-button ra-quiet" id="ra-back">← Каталог</button>',
    '<button type="button" class="ra-button" id="ra-reload">↻ Обновить</button>',
    '<button type="button" class="ra-button ra-quiet" id="ra-close" aria-label="Закрыть админку">✕</button></div></header>',
    '<details class="ra-card ra-one-use" id="ra-one-use"><summary>Одноразовые промокоды AniCoin</summary>',
    '<p class="ra-muted">Код начисляет монеты одному аккаунту. Оплата и подписка не нужны.</p>',
    '<form id="ra-one-use-form"><label class="ra-field">Сколько AniCoin начислить<input id="ra-one-use-amount" type="number" min="1" max="10000" step="1" value="100" required inputmode="numeric"></label>',
    '<button class="ra-button ra-primary" id="ra-one-use-create" type="submit">Создать код</button></form>',
    '<div class="ra-one-use-new" id="ra-one-use-new" hidden><label class="ra-field">Новый код<input id="ra-one-use-code" type="text" readonly autocomplete="off" spellcheck="false"></label>',
    '<button class="ra-button" type="button" id="ra-one-use-copy">Скопировать</button><p class="ra-muted">Скопируй сейчас: полный код больше не показывается.</p></div>',
    '<div class="ra-one-use-history"><h4>Последние коды</h4><button class="ra-button ra-quiet" type="button" id="ra-one-use-refresh">Обновить список</button></div>',
    '<div id="ra-one-use-list"></div><p id="ra-one-use-msg" class="ra-message" role="status" aria-live="polite"></p></details>',
    '<div class="ra-stats" id="ra-stats" aria-live="polite"></div>',
    '<section class="ra-card"><div class="ra-card-head"><h3 id="ra-editor-title">Новый код</h3>',
    '<span class="ra-muted">Латиница, цифры, дефис и _</span></div>',
    '<div class="ra-mode" role="group" aria-label="Тип создаваемого кода">',
    '<button type="button" data-mode="referral" aria-pressed="true">Реферальный код</button>',
    '<button type="button" data-mode="promo" aria-pressed="false">Бонус при оплате</button>',
    '<button type="button" data-mode="discount" aria-pressed="false">Скидка на Premium</button></div>',
    '<form id="ra-form" novalidate><div class="ra-fields">',
    '<label class="ra-field">Код<input id="ra-code" autocomplete="off" maxlength="40" required placeholder="Например, ANIME15" spellcheck="false"></label>',
    '<label class="ra-field" id="ra-owner-field">Имя партнёра<input id="ra-owner" maxlength="120" required placeholder="Блогер или автор"></label>',
    '<label class="ra-field" id="ra-rate-field">Вознаграждение, %<input id="ra-rate" type="number" min="0" max="50" step="1" value="15"></label>',
    '<label class="ra-field" id="ra-bonus-field" hidden>Бонус AniCoin<input id="ra-bonus" type="number" min="0" max="10000" step="1" value="100"></label>',
    '<label class="ra-field" id="ra-discount-field" hidden>Скидка, % (1–99)<input id="ra-discount" type="number" min="1" max="99" step="1" value="15" inputmode="numeric"></label>',
    '<label class="ra-field" id="ra-max-field" hidden>Лимит оплат (необязательно)<input id="ra-max" type="number" min="1" max="100000" step="1"></label>',
    '</div><p id="ra-discount-help" class="ra-muted ra-discount-help" hidden>Код создаётся в KomiAnime. Для реальной скидки на подписку такой же код нужно отдельно настроить в Lava.top. Сама оплата пока не уменьшает цену автоматически.</p>',
    '<div class="ra-form-actions"><button class="ra-button ra-primary" type="submit" id="ra-save">+ Сохранить код</button>',
    '<button class="ra-button ra-quiet" type="button" id="ra-clear">Сбросить</button>',
    '<span id="ra-editor-msg" role="status" class="ra-message" aria-live="polite"></span></div></form></section>',
    '<div class="ra-tabs" role="tablist" aria-label="Управление рефералами">',
    '<button role="tab" data-tab="codes" aria-selected="true">Коды и статистика</button>',
    '<button role="tab" data-tab="people" aria-selected="false">Кто ввёл код</button>',
    '<button role="tab" data-tab="payments" aria-selected="false">Оплаты и отметки</button></div>',
    '<p id="ra-status" role="status" class="ra-message" aria-live="polite">Загружаем данные…</p>',
    '<section id="ra-panel-codes" role="tabpanel">',
    '<div class="ra-section-tools"><input class="ra-search" id="ra-code-search" type="search" placeholder="Поиск по коду или партнёру" aria-label="Найти реферальный код">',
    '<span class="ra-muted">«Проверили» = уникальные авторизованные пользователи, которым код подошёл</span></div>',
    '<div id="ra-codes" class="ra-code-grid"></div></section>',
    '<section id="ra-panel-people" role="tabpanel" hidden>',
    '<div class="ra-section-tools"><div class="ra-filter-group"><select class="ra-select" id="ra-people-code" aria-label="Фильтр по реферальному коду"></select>',
    '<select class="ra-select" id="ra-people-status" aria-label="Фильтр отметок">',
    '<option value="all">Все пользователи</option><option value="open">Неотмеченные</option><option value="done">Отмеченные</option></select></div>',
    '<input class="ra-search" type="search" id="ra-people-search" placeholder="Никнейм, email или код" aria-label="Найти пользователя"></div>',
    '<div id="ra-people"></div><p class="ra-muted">Отметка пользователя — это проверка записи, не подтверждение выплаты партнёру.</p></section>',
    '<section id="ra-panel-payments" role="tabpanel" hidden>',
    '<div class="ra-section-tools"><select class="ra-select" id="ra-payment-code" aria-label="Покупки по коду"></select>',
    '<select class="ra-select" id="ra-payment-status" aria-label="Фильтр покупок"><option value="all">Все счета</option>',
    '<option value="open">Оплачены, не отмечены</option><option value="done">Выплата отмечена</option></select></div>',
    '<div id="ra-payments"></div><p class="ra-muted">Здесь показываются только счета, созданные через отслеживаемую оплату KomiAnime. Отметка не отправляет деньги автоматически.</p></section>'
  ].join('');
  root.append(app);
  const $=id=>app.querySelector('#'+id);
  const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
  const button=(text,cls,fn)=>{const b=make('button',text,'ra-button '+(cls||''));b.type='button';b.addEventListener('click',fn);return b;};
  const fmtDate=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});};
  const count=value=>Number(value||0).toLocaleString('ru-RU');
  const money=(value,unit)=>Number(value||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(unit||'');
  const msg=(s,error=false)=>{$('ra-status').textContent=s;$('ra-status').dataset.error=error?'true':'false';};
  const editorMsg=(s,error=false)=>{$('ra-editor-msg').textContent=s;$('ra-editor-msg').dataset.error=error?'true':'false';};
  let report={codes:[],entries:[],orders:[]},discounts=[],tab='codes',mode='referral',edit=null,loading=false;
  function activateTab(name){
    tab=name;
    app.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
    for(const key of ['codes','people','payments'])$('ra-panel-'+key).hidden=key!==tab;
    paint();
  }
  function setMode(next){
    mode=next;
    app.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    $('ra-owner-field').hidden=mode!=='referral';
    $('ra-rate-field').hidden=mode!=='referral';
    $('ra-bonus-field').hidden=mode!=='promo';
    $('ra-max-field').hidden=mode!=='promo'&&mode!=='discount';
    $('ra-discount-field').hidden=mode!=='discount';
    $('ra-discount-help').hidden=mode!=='discount';
    $('ra-owner').required=mode==='referral';
  }
  function clearEditor(){
    edit=null;$('ra-editor-title').textContent='Новый код';$('ra-save').textContent='+ Сохранить код';
    $('ra-form').reset();setMode('referral');editorMsg('');
  }
  function startEdit(code){
    edit={code:code.code,active:code.is_active};
    setMode('referral');$('ra-code').value=code.code;$('ra-owner').value=code.owner_name;
    $('ra-rate').value=code.reward_percent;
    $('ra-editor-title').textContent='Редактировать '+code.code;
    $('ra-save').textContent='Сохранить изменения';editorMsg('');
    app.querySelector('#ra-editor-title').scrollIntoView({behavior:'smooth',block:'center'});
    $('ra-owner').focus();
  }
  function startDiscountEdit(item){
    edit={code:item.code,active:item.is_active,kind:'discount'};
    setMode('discount');$('ra-code').value=item.code;
    $('ra-discount').value=item.discount_percent;
    $('ra-max').value=item.max_uses??'';
    $('ra-editor-title').textContent='Редактировать скидку '+item.code;
    $('ra-save').textContent='Сохранить изменения';editorMsg('');
    $('ra-editor-title').scrollIntoView({behavior:'smooth',block:'center'});
    $('ra-discount').focus();
  }
  async function copy(value){
    try{
      await navigator.clipboard.writeText(value);
      msg('Скопировано: '+value);
    }catch{
      msg('Не удалось скопировать автоматически. Выделите и скопируйте код вручную.',true);
    }
  }
  async function saveReferral(data,active){
    const {error}=await db.rpc('admin_save_checkout_code',{
      p_kind:'referral',p_code:data.code,p_owner_name:data.owner_name,
      p_reward_percent:Number(data.reward_percent),p_is_active:active,
      p_bonus_anicoin:0,p_max_uses:null
    });
    if(error)throw new Error(error.message);
  }
  async function saveDiscount(item,active){
    const {error}=await db.rpc('admin_save_checkout_code',{
      p_kind:'discount',p_code:item.code,p_reward_percent:Number(item.discount_percent),
      p_is_active:active,p_bonus_anicoin:0,p_max_uses:item.max_uses??null,
      p_owner_name:null
    });
    if(error)throw new Error(error.message);
  }
  async function refresh(){
    if(loading)return;
    loading=true;$('ra-reload').disabled=true;msg('Обновляем данные из Supabase…');
    try{
      const [{data,error},{data:promoData,error:promoError}]=await Promise.all([
        db.rpc('admin_referral_report'),db.rpc('admin_discount_promo_report')
      ]);
      if(error||promoError)throw new Error(error?.message||promoError?.message);
      if(!app.isConnected)return;
      report={codes:Array.isArray(data?.codes)?data.codes:[],
        entries:Array.isArray(data?.entries)?data.entries:[],
        orders:Array.isArray(data?.orders)?data.orders:[]};
      discounts=Array.isArray(promoData)?promoData:[];
      syncCodeOptions();paint();
      msg('Обновлено. Подсчёт ведётся по зарегистрированным пользователям с успешной проверкой кода.');
    }catch(e){msg('Ошибка загрузки: '+(e?.message||'Неизвестная ошибка'),true);}
    finally{loading=false;$('ra-reload').disabled=false;}
  }
  function syncCodeOptions(){
    for(const target of ['ra-people-code','ra-payment-code']){
      const select=$(target),previous=select.value;
      select.replaceChildren();
      const all=make('option','Все коды');all.value='all';select.append(all);
      for(const c of report.codes){const o=make('option',c.code+' · '+c.owner_name);o.value=c.code;select.append(o);}
      select.value=Array.from(select.options).some(o=>o.value===previous)?previous:'all';
    }
  }
  function stats(){
    const totalChecked=report.codes.reduce((a,c)=>a+Number(c.checked||0),0);
    const totalPaid=report.codes.reduce((a,c)=>a+Number(c.paid||0),0);
    const missing=report.entries.filter(x=>!x.is_reviewed).length;
    const totals=[
      ['Реферальных кодов',report.codes.length,'Активны: '+report.codes.filter(c=>c.is_active).length],
      ['Скидочных кодов',discounts.length,'Активны: '+discounts.filter(c=>c.is_active).length],
      ['Код проверили',totalChecked,'Уникальные люди на каждый код'],
      ['Оплаченных счетов',totalPaid,'Только подтверждённые платежи'],
      ['Ждут отметки',missing,'В последних '+report.entries.length+' записях']
    ];
    $('ra-stats').replaceChildren();
    for(const [label,value,note] of totals){
      const box=make('div',undefined,'ra-stat');
      box.append(make('div',label,'ra-stat-label'),make('div',count(value),'ra-stat-value'),make('div',note,'ra-stat-note'));
      $('ra-stats').append(box);
    }
  }
  function paintCodes(){
    const list=$('ra-codes');list.replaceChildren();
    const search=$('ra-code-search').value.trim().toLowerCase();
    const codes=report.codes.filter(c=>!search||(c.code+' '+c.owner_name).toLowerCase().includes(search));
    const discountMatches=discounts.filter(c=>!search||c.code.toLowerCase().includes(search));
    if(!codes.length&&!discountMatches.length){list.append(make('div',report.codes.length||discounts.length?'Нет совпадений.':'Пока нет кодов. Создайте первый в форме выше.','ra-empty'));return;}
    for(const c of discountMatches){
      const card=make('article',undefined,'ra-code-card');
      const top=make('div',undefined,'ra-code-top'),left=make('div');
      left.append(make('div',c.code,'ra-code-name'),make('div','Скидка '+c.discount_percent+'% на Premium','ra-code-owner'));
      const status=make('span',c.is_active?'● Активен':'○ Отключён','ra-pill');
      status.dataset.active=String(Boolean(c.is_active));top.append(left,status);
      const metrics=make('div',undefined,'ra-code-metrics');
      for(const [label,val] of [['Скидка',c.discount_percent+'%'],['Использовано',c.uses_count],['Лимит',c.max_uses??'∞']]){
        const block=make('div');block.append(make('b',val),make('span',label));metrics.append(block);
      }
      const actions=make('div',undefined,'ra-code-actions');
      actions.append(button('Копировать','ra-small',()=>copy(c.code)),
        button('Изменить','ra-small',()=>startDiscountEdit(c)));
      const toggle=button(c.is_active?'Отключить':'Включить','ra-small '+(c.is_active?'ra-danger':''),async()=>{
        toggle.disabled=true;
        try{await saveDiscount(c,!c.is_active);await refresh();}
        catch(e){msg('Не удалось обновить скидку: '+e.message,true);toggle.disabled=false;}
      });
      actions.append(toggle);card.append(top,metrics,actions);list.append(card);
    }
    for(const c of codes){
      const card=make('article',undefined,'ra-code-card');
      const top=make('div',undefined,'ra-code-top'),left=make('div');
      left.append(make('div',c.code,'ra-code-name'),make('div',c.owner_name+' · '+c.reward_percent+'% партнёру','ra-code-owner'));
      const status=make('span',c.is_active?'● Активен':'○ Отключён','ra-pill');
      status.dataset.active=String(Boolean(c.is_active));top.append(left,status);
      const metrics=make('div',undefined,'ra-code-metrics');
      for(const [label,val] of [['Проверили',c.checked],['Создали счёт',c.entered],['Оплатили',c.paid]]){
        const block=make('div');block.append(make('b',count(val)),make('span',label));metrics.append(block);
      }
      const actions=make('div',undefined,'ra-code-actions');
      actions.append(
        button('Пользователи','ra-primary ra-small',()=>{
          $('ra-people-code').value=c.code;activateTab('people');
        }),
        button('Скопировать','ra-small',()=>copy(c.code)),
        button('Ссылка','ra-small',()=>copy(location.origin+'/premium.html?ref='+encodeURIComponent(c.code))),
        button('Изменить','ra-small',()=>startEdit(c))
      );
      const toggle=button(c.is_active?'Отключить':'Включить','ra-small '+(c.is_active?'ra-danger':''),async()=>{
        toggle.disabled=true;msg('Сохраняем статус '+c.code+'…');
        try{await saveReferral(c,!c.is_active);await refresh();}
        catch(e){msg('Не удалось обновить код: '+e.message,true);toggle.disabled=false;}
      });
      actions.append(toggle);card.append(top,metrics,actions);list.append(card);
    }
  }
  function makeTable(headers){
    const wrap=make('div',undefined,'ra-table-wrap'),table=make('table',undefined,'ra-table');
    const head=make('thead'),hrow=make('tr');
    for(const text of headers)hrow.append(make('th',text));
    head.append(hrow);const body=make('tbody');table.append(head,body);wrap.append(table);
    return {wrap,body};
  }
  function td(row,content){
    const cell=make('td');
    if(content instanceof Node)cell.append(content);else cell.textContent=content==null?'—':String(content);
    row.append(cell);return cell;
  }
  async function reviewEntry(entry,marked,note){
    try{
      msg('Сохраняем отметку пользователя…');
      const {data,error}=await db.rpc('admin_toggle_referral_entry_mark',{
        p_code:entry.code,p_user_id:entry.user_id,p_marked:marked,p_note:note
      });
      if(error||!data)throw new Error(error?.message||'Запись не найдена');
      await refresh();
    }catch(e){msg('Ошибка отметки: '+e.message,true);paintPeople();}
  }
  function paintPeople(){
    const target=$('ra-people');target.replaceChildren();
    const selected=$('ra-people-code').value,status=$('ra-people-status').value;
    const search=$('ra-people-search').value.trim().toLowerCase();
    const rows=report.entries.filter(x=>
      (selected==='all'||x.code===selected) &&
      (status==='all'||(status==='open'&&!x.is_reviewed)||(status==='done'&&x.is_reviewed)) &&
      (!search||(x.display_name+' '+(x.username||'')+' '+(x.email||'')+' '+x.code).toLowerCase().includes(search)));
    if(!rows.length){target.append(make('div','Никто не найден. Пользователь появится здесь после входа в аккаунт и успешной проверки реферального кода.','ra-empty'));return;}
    const {wrap,body}=makeTable(['Пользователь','Код','Впервые проверил','Оплата','Отметка','Заметка']);
    for(const p of rows){
      const tr=make('tr'),person=make('div');
      person.append(make('span',p.display_name,'ra-user-name'));
      if(p.email)person.append(make('span',p.email,'ra-user-email'));
      td(tr,person);td(tr,make('span',p.code,'ra-code-text'));td(tr,fmtDate(p.first_seen_at));
      td(tr,p.has_paid?'✓ Оплатил':'Не оплачено');
      const mark=button(p.is_reviewed?'✓ Отмечен':'Отметить','ra-small '+(p.is_reviewed?'':'ra-primary'),()=>reviewEntry(p,!p.is_reviewed,null));
      td(tr,mark);
      const actions=make('div',undefined,'ra-cell-actions');
      const note=make('input',undefined,'ra-inline-input');note.type='text';note.maxLength=240;
      note.value=p.admin_note||'';note.placeholder='Комментарий';
      note.setAttribute('aria-label','Заметка о '+p.display_name);
      const save=button('Сохранить','ra-small',()=>reviewEntry(p,p.is_reviewed,note.value));
      note.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save.click();}});
      actions.append(note,save);td(tr,actions);body.append(tr);
    }
    target.append(wrap);
    if(report.entries.length>=500)target.append(make('p','Показаны последние 500 проверок. Итоговые числа на карточках учитывают всю историю.','ra-muted'));
  }
  async function reviewPayment(p,mark,note){
    msg('Сохраняем отметку по платежу…');
    try{
      const {data,error}=await db.rpc('admin_toggle_referral_mark',{
        p_payment_id:p.id,p_marked:mark,p_note:note
      });
      if(error||!data)throw new Error(error?.message||'Платёж не найден или не оплачен');
      await refresh();
    }catch(e){msg('Не удалось сохранить: '+e.message,true);paintPayments();}
  }
  function paintPayments(){
    const target=$('ra-payments');target.replaceChildren();
    const selected=$('ra-payment-code').value,status=$('ra-payment-status').value;
    const orders=report.orders.filter(x=>
      (selected==='all'||x.referral_code===selected)&&
      (status==='all'||(status==='open'&&x.status==='paid'&&!x.is_referral_marked)||
        (status==='done'&&x.is_referral_marked)));
    if(!orders.length){target.append(make('div','Счетов для выбранных фильтров пока нет. Проверка кода и создание счёта — разные события.','ra-empty'));return;}
    const {wrap,body}=makeTable(['Дата / покупатель','Реф. код','Платёж','Начисление партнёру','Отметка о выплате','Заметка']);
    for(const p of orders){
      const tr=make('tr'),person=make('div');
      person.append(make('span',fmtDate(p.created_at),'ra-user-name'),make('span',p.buyer_email||'—','ra-user-email'));
      td(tr,person);td(tr,p.referral_code||'—');
      const bill=make('div');bill.append(make('span',money(p.final_amount,p.currency),'ra-user-name'),
        make('span',p.status==='paid'?'Оплачен':p.status,'ra-user-email'));td(tr,bill);
      td(tr,money(p.referrer_reward,p.currency));
      if(p.status==='paid'){
        const mark=button(p.is_referral_marked?'✓ Отмечена':'Отметить выплату','ra-small '+(p.is_referral_marked?'':'ra-primary'),
          ()=>reviewPayment(p,!p.is_referral_marked,null));td(tr,mark);
        const actions=make('div',undefined,'ra-cell-actions');
        const note=make('input',undefined,'ra-inline-input');note.type='text';note.value=p.admin_note||'';
        note.maxLength=240;note.placeholder='Комментарий';note.setAttribute('aria-label','Заметка о платеже');
        const save=button('Сохранить','ra-small',()=>reviewPayment(p,p.is_referral_marked,note.value));
        note.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save.click();}});
        actions.append(note,save);td(tr,actions);
      }else{td(tr,'Ожидает подтверждения');td(tr,'—');}
      body.append(tr);
    }
    target.append(wrap);
    if(report.orders.length>=300)target.append(make('p','Показаны последние 300 счетов.','ra-muted'));
  }
  function paint(){stats();if(tab==='codes')paintCodes();else if(tab==='people')paintPeople();else paintPayments();}
  $('ra-back').addEventListener('click',()=>{root.replaceChildren();back();});
  $('ra-close').addEventListener('click',()=>root.closest('.modal-overlay')?.classList.remove('active'));
  $('ra-reload').addEventListener('click',refresh);
  $('ra-clear').addEventListener('click',clearEditor);
  app.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(edit)clearEditor();setMode(b.dataset.mode);}));
  const coinPanel=$('ra-one-use'),coinList=$('ra-one-use-list');
  let giftBusy=false,giftLoading=false,giftLoaded=false,giftPending=null;
  const giftMsg=(text,error=false)=>{
    $('ra-one-use-msg').textContent=text;$('ra-one-use-msg').dataset.error=String(error);
  };
  function clearGeneratedCode(){
    $('ra-one-use-code').value='';$('ra-one-use-new').hidden=true;
  }
  async function readGiftCodes(){
    if(giftLoading||!app.isConnected)return;
    giftLoading=true;$('ra-one-use-refresh').disabled=true;
    if(!giftLoaded)coinList.textContent='Загружаем коды…';
    try{
      const {data,error}=await db.rpc('komi_admin_anicoin_code_list');
      if(!app.isConnected)return;
      if(error||!Array.isArray(data))throw new Error('unavailable');
      giftLoaded=true;paintGiftCodes(data);
    }catch{
      if(!app.isConnected)return;
      if(!giftLoaded)coinList.textContent='';
      giftMsg('Не удалось загрузить коды. Нажми «Обновить список».',true);
    }finally{giftLoading=false;$('ra-one-use-refresh').disabled=false;}
  }
  function paintGiftCodes(rows){
    coinList.replaceChildren();
    if(!rows.length){coinList.append(make('p','Одноразовых кодов пока нет.','ra-muted'));return;}
    const labels={active:'Не использован',redeemed:'Использован',revoked:'Отозван'};
    for(const item of rows){
      if(!item?.id||!Object.hasOwn(labels,item.status))continue;
      const row=make('div',undefined,'ra-one-use-row'),body=make('div');
      body.append(make('strong',String(item.hint||'—')+' · '+count(item.amount)+' AniCoin'),
        make('span',labels[item.status]+' · '+fmtDate(item.redeemed_at||item.created_at),'ra-muted'));
      row.append(body);
      if(item.status==='active'){
        const revoke=button('Отозвать','ra-quiet',()=>{
          if(giftBusy)return;
          if(giftPending&&giftPending!==revoke){
            giftPending.dataset.confirm='';giftPending.textContent='Отозвать';
          }
          if(revoke.dataset.confirm!=='yes'){
            giftPending=revoke;revoke.dataset.confirm='yes';revoke.textContent='Подтвердить отзыв';
            giftMsg('После отзыва код больше не начислит монеты.');return;
          }
          void revokeGiftCode(item.id,revoke);
        });
        row.append(revoke);
      }
      coinList.append(row);
    }
  }
  async function revokeGiftCode(id,control){
    if(giftBusy)return;
    giftBusy=true;control.disabled=true;$('ra-one-use-create').disabled=true;
    try{
      const {data,error}=await db.rpc('komi_admin_anicoin_code_revoke',{p_id:id});
      if(!app.isConnected)return;
      if(error||data?.status!=='revoked')throw new Error('unavailable');
      giftMsg('Код отозван.');await readGiftCodes();
    }catch{
      if(app.isConnected){giftMsg('Не удалось отозвать код. Обнови список и проверь статус.',true);await readGiftCodes();}
    }finally{
      giftPending=null;giftBusy=false;control.disabled=false;$('ra-one-use-create').disabled=false;
    }
  }
  coinPanel.addEventListener('toggle',()=>{
    if(coinPanel.open){if(!giftLoaded)void readGiftCodes();}
    else {clearGeneratedCode();if(giftPending){giftPending.dataset.confirm='';giftPending.textContent='Отозвать';giftPending=null;}}
  });
  for(const id of ['ra-close','ra-back'])$(id).addEventListener('click',()=>{coinPanel.open=false;clearGeneratedCode();},true);
  $('ra-one-use-refresh').addEventListener('click',()=>void readGiftCodes());
  $('ra-one-use-form').addEventListener('submit',async e=>{
    e.preventDefault();
    if(giftBusy)return;
    const amount=Number($('ra-one-use-amount').value);
    if(!Number.isSafeInteger(amount)||amount<1||amount>10000){
      giftMsg('Укажи целое число от 1 до 10 000.',true);return;
    }
    giftBusy=true;$('ra-one-use-create').disabled=true;giftMsg('Создаём код…');clearGeneratedCode();
    try{
      const {data,error}=await db.rpc('komi_admin_anicoin_code_create',{p_amount:amount});
      if(!app.isConnected)return;
      if(error||typeof data?.code!=='string'||!data.code)throw new Error('unavailable');
      if(coinPanel.open){
        $('ra-one-use-code').value=data.code;$('ra-one-use-new').hidden=false;$('ra-one-use-copy').focus();
        giftMsg('Код создан. Передай его только тому, кому предназначены монеты.');
      }else giftMsg('Код создан. Полный код скрыт, потому что раздел закрыли.');
      await readGiftCodes();
    }catch{
      if(app.isConnected)giftMsg('Не удалось подтвердить создание кода. Перед повтором проверь список.',true);
    }finally{giftBusy=false;$('ra-one-use-create').disabled=false;}
  });
  $('ra-one-use-copy').addEventListener('click',async ()=>{
    const input=$('ra-one-use-code'),code=input.value;
    if(!code)return;
    try{await navigator.clipboard.writeText(code);if(app.isConnected)giftMsg('Код скопирован.');}
    catch{input.focus();input.select();giftMsg('Скопируй выделенный код вручную.',true);}
  });

  app.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
  $('ra-code-search').addEventListener('input',paintCodes);
  for(const id of ['ra-people-code','ra-people-status'])$(id).addEventListener('change',paintPeople);
  $('ra-people-search').addEventListener('input',paintPeople);
  for(const id of ['ra-payment-code','ra-payment-status'])$(id).addEventListener('change',paintPayments);
  $('ra-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const code=$('ra-code').value.trim().toUpperCase();
    if(!/^[A-Z0-9_-]{3,40}$/.test(code)){
      editorMsg('Код: от 3 до 40 символов (A-Z, 0-9, _ или -).',true);return;
    }
    const args={p_kind:mode,p_code:code,p_is_active:edit?edit.active:true,
      p_owner_name:mode==='referral'?$('ra-owner').value.trim():null,
      p_reward_percent:mode==='referral'?Number($('ra-rate').value):mode==='discount'?Number($('ra-discount').value):15,
      p_bonus_anicoin:mode==='promo'?Number($('ra-bonus').value):0,
      p_max_uses:(mode==='promo'||mode==='discount')&&$('ra-max').value?Number($('ra-max').value):null};
    if(mode==='referral'&&(!args.p_owner_name||args.p_owner_name.length>120||
      !Number.isInteger(args.p_reward_percent)||args.p_reward_percent<0||args.p_reward_percent>50)){
      editorMsg('Введите имя партнёра и процент от 0 до 50.',true);return;
    }
    if(mode==='promo'&&(!Number.isInteger(args.p_bonus_anicoin)||args.p_bonus_anicoin<0||
      args.p_bonus_anicoin>10000||(args.p_max_uses!==null&&(!Number.isInteger(args.p_max_uses)||
      args.p_max_uses<1||args.p_max_uses>100000)))){
      editorMsg('Укажите корректный бонус и лимит использований.',true);return;
    }
    if(mode==='discount'&&(!Number.isInteger(args.p_reward_percent)||args.p_reward_percent<1||
       args.p_reward_percent>99||(args.p_max_uses!==null&&(!Number.isInteger(args.p_max_uses)||
       args.p_max_uses<1||args.p_max_uses>100000)))){
       editorMsg('Укажите скидку от 1% до 99% и корректный лимит.',true);return;
    }
    $('ra-save').disabled=true;editorMsg('Сохраняем код…');
    try{
      const {error}=await db.rpc('admin_save_checkout_code',args);
      if(error)throw new Error(error.message);
      clearEditor();editorMsg('✓ Код '+code+' успешно сохранён');
      await refresh();
    }catch(error){editorMsg('Не удалось сохранить: '+(error.message||'Ошибка'),true);}
    finally{$('ra-save').disabled=false;}
  });
  setMode('referral');
  await refresh();
};
})();
