/* Social AniCoin shop controls. No client-side grants; all purchases use authenticated RPCs. */
(function(root){
 'use strict';
 const state={owner:'',friends:[],received:[],sent:[],booster:null,loading:false,loaded:false,status:'',store:null};
 const $=id=>document.getElementById(id);
 const safeUser=()=>typeof currentUser==='undefined'?'':(currentUser?.authUserId||'');
 const api=()=>typeof _supabase==='undefined'?null:_supabase;
 const catalog=()=>root.KomiShopCatalog?.items||[];
 const item=id=>root.KomiShopCatalog?.find(id);
 const date=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';};
 const create=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e;};
 const productLabel=id=>item(id)?.label||'Предмет Komi';
 const currentSection=()=>document.querySelector('#mainContainer > #shop.anicoin-shop');
 const currentProps=()=>({userId:safeUser(),products:catalog(),store:typeof aniCoinShopWallet!=='undefined'?aniCoinShopWallet:null});
 function showStatus(text){state.status=text;const el=$('komiShopSocialStatus');if(el)el.textContent=text;}
 async function load(owner){
   if(!owner||!api()||state.loading)return;
   state.loading=true;
   try{
     const [friendResult,gifts,boost]=await Promise.all([
       api().from('komi_friendships').select('user_a,user_b').or('user_a.eq.'+owner+',user_b.eq.'+owner).limit(1000),
       api().rpc('komi_shop_gifts',{p_action:'read'}),
       api().rpc('komi_shop_booster',{p_action:'read'})
     ]);
     if(safeUser()!==owner)return;
     if(gifts.error)throw gifts.error;
     if(boost.error)throw boost.error;
     state.received=Array.isArray(gifts.data?.received)?gifts.data.received:[];
     state.sent=Array.isArray(gifts.data?.sent)?gifts.data.sent:[];
     state.booster=boost.data||null;
     state.friends=[];
     if(!friendResult.error){
       const friends=[...new Set((friendResult.data||[]).map(f=>f.user_a===owner?f.user_b:f.user_b===owner?f.user_a:null).filter(Boolean))].slice(0,100);
       if(friends.length){
         const profiles=await api().from('komi_profiles').select('user_id,username,display_name').in('user_id',friends);
         if(!profiles.error&&safeUser()===owner)
           state.friends=(profiles.data||[]).map(p=>({id:p.user_id,name:String(p.display_name||p.username||'Участник Komi').slice(0,50)}));
       }
     }
     state.loaded=true;
   }catch(error){state.status=error?.message||'Не удалось загрузить дополнительные возможности магазина.';}
   finally{state.loading=false;renderArea();refreshGiftButtons();}
 }
 function featured(){
   const list=catalog().filter(p=>['frame','title','banner','overlay'].includes(p.type));
   const day=Math.floor(Date.now()/86400000);
   const week=Math.floor((day+3)/7);
   return [0,1,2].map((_,i)=>list[(week*7+i*13+5)%list.length]).filter(Boolean);
 }
 function renderArea(){
   const section=currentSection();if(!section)return;
   let area=$('komiShopSocialArea');
   if(!area){area=create('section','komi-shop-social');area.id='komiShopSocialArea';
     const grid=section.querySelector('.komi-coin-grid');
     if(grid)grid.before(area);else section.append(area);
   }
   area.replaceChildren();
   if(!section.classList.contains('komi-shop-v3')){
     const title=create('h2','','Подборка недели');
     area.append(title,create('p','komi-shop-muted','Три выбранных оформления. Ассортимент не исчезает после обновления подборки.'));
     const picks=create('div','komi-shop-featured-list');
     for(const product of featured()){
       const button=create('button','komi-shop-featured',product.label+' · '+product.cost+' ◈');
       button.type='button';button.dataset.komiShopFeatured=product.id;picks.append(button);
     }
     area.append(picks);
   }
   const user=safeUser();
   const extra=create('div','komi-shop-extra-grid');
   const boosters=create('section','komi-shop-extra-card');
   boosters.append(create('h3','','×2 XP для заданий на 24 часа'));
   boosters.append(create('p','komi-shop-muted','Только XP новых подтверждённых ежедневных заданий. Уже заработанный опыт не меняется; с Premium множители не складываются.'));
   const active=Boolean(state.booster?.active&&Date.parse(state.booster.active_until)>Date.now());
   boosters.append(create('p','komi-shop-muted',active?'Активен до '+date(state.booster.active_until):'Цена · 110 AniCoin'));
   const purchase=create('button','komi-shop-primary',!user?'Войти, чтобы активировать':active?'Усилитель активен':'Активировать за 110 ◈');
   purchase.type='button';purchase.dataset.komiShopBoost='';purchase.disabled=active||state.loading;
   boosters.append(purchase);extra.append(boosters);
   const highlight=create('section','komi-shop-extra-card');
   highlight.append(create('h3','','Выделение комментария на 24 часа'));
   highlight.append(create('p','komi-shop-muted','12 AniCoin. Для собственного комментария под аниме: рамка и честная пометка «Выделено за AniCoin». Максимум два в день. Оценки не изменяются.'));
   highlight.append(create('p','komi-shop-muted','Открой свои комментарии под аниме и нажми «Выделить».'));
   extra.append(highlight);
   area.append(extra);
   const gifting=create('section','komi-shop-gifts-panel');
   gifting.append(create('h3','','Подарки друзьям'));
   gifting.append(create('p','komi-shop-muted',!user?'Войди в аккаунт, чтобы дарить выбранные товары друзьям.':state.friends.length?'Выбери кнопку подарка на карточке товара. Можно отправить до трёх подарков в сутки.':'Доступно после добавления взаимных друзей. У каждого товара есть кнопка подарка.'));
   if(user){
     const list=create('div','komi-shop-gift-lists');
     const received=create('div','','');
     received.append(create('h4','','Получено'));
     for(const gift of state.received.slice(0,10)){
       const itemRow=create('div','komi-shop-gift-entry');
       itemRow.append(create('strong','',productLabel(gift.item)),create('small','',gift.from+' · '+date(gift.date)));
       if(gift.note)itemRow.append(create('p','',gift.note));
       received.append(itemRow);
     }
     if(!state.received.length)received.append(create('p','komi-shop-muted','Подарков пока нет.'));
     const sent=create('div','','');
     sent.append(create('h4','','Отправлено'));
     for(const gift of state.sent.slice(0,10)){
       sent.append(create('p','komi-shop-muted',productLabel(gift.item)+' → '+gift.to+' · '+date(gift.date)));
     }
     if(!state.sent.length)sent.append(create('p','komi-shop-muted','Подарков пока нет.'));
     list.append(received,sent);gifting.append(list);
   }
   area.append(gifting);
   const status=create('p','komi-shop-social-status',state.status);status.id='komiShopSocialStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');area.append(status);
   const dialog=create('dialog','komi-shop-dialog komi-shop-gift-dialog');
   dialog.id='komiShopGiftDialog';
   const form=create('form','komi-shop-dialog-inner');form.method='dialog';form.id='komiShopGiftForm';
   form.append(create('h2','','Подарить другу'));
   const productName=create('p','');productName.id='komiShopGiftLabel';form.append(productName);
   const friendLabel=create('label','','Получатель');
   const friendSelect=create('select','');friendSelect.id='komiShopGiftRecipient';friendSelect.required=true;friendSelect.name='recipient';
   for(const friend of state.friends){const option=create('option','',friend.name);option.value=friend.id;friendSelect.append(option);}
   friendLabel.append(friendSelect);form.append(friendLabel);
   const noteLabel=create('label','','Открытка (необязательно)');
   const note=create('textarea','');note.id='komiShopGiftMessage';note.maxLength=120;note.rows=3;note.placeholder='Приятного просмотра!';noteLabel.append(note);form.append(noteLabel);
   const controls=create('div','komi-shop-gift-controls');
   const cancel=create('button','','Отмена');cancel.type='button';cancel.dataset.komiShopGiftClose='';
   const confirm=create('button','komi-shop-primary','Отправить подарок');confirm.type='submit';confirm.disabled=!state.friends.length;
   controls.append(cancel,confirm);form.append(controls);
   dialog.append(form);area.append(dialog);
 }
 function refreshGiftButtons(){
   const section=currentSection();if(!section)return;
   for(const card of section.querySelectorAll('.komi-coin-card')){
     const actions=card.querySelector('.komi-coin-actions');
     const original=actions?.querySelector('[data-shop-item-action]');
     if(!actions||!original||actions.querySelector('[data-komi-shop-gift]'))continue;
     const button=create('button','komi-shop-gift-button','');button.type='button';button.innerHTML=root.KomiShopIcons?.solid?.('gift',19)||root.KomiShopIcons?.svg('gift',19)||'✧';
     button.dataset.komiShopGift=original.dataset.shopItemAction;
     button.setAttribute('aria-label','Подарить '+productLabel(button.dataset.komiShopGift));
     actions.append(button);
   }
 }
 function mount(container,props){
   if(!container?.querySelector('#shop.anicoin-shop'))return;
   const owner=props?.userId||'';
   if(state.owner!==owner){
     state.owner=owner;state.friends=[];state.received=[];state.sent=[];
     state.booster=null;state.loaded=false;state.loading=false;state.status='';
   }
   state.store=props?.store||null;
   renderArea();refreshGiftButtons();
   if(owner&&!state.loaded&&!state.loading)void load(owner);
 }
 async function update(){
   if(!safeUser())return;
   state.loaded=false;state.status='';
   await load(safeUser());
 }
 root.KomiShopSocial={mount,refresh:update};
 document.addEventListener('click',async event=>{
   const featuredButton=event.target.closest?.('[data-komi-shop-featured]');
   if(featuredButton&&currentSection()){
     document.querySelector('[data-shop-category="all"]')?.click();
     document.querySelector('[data-shop-preview="'+featuredButton.dataset.komiShopFeatured+'"]')?.click();
     return;
   }
   if(event.target.closest?.('[data-komi-shop-gift-close]')){
     $('komiShopGiftDialog')?.close();return;
   }
   const gift=event.target.closest?.('[data-komi-shop-gift]');
   if(gift&&currentSection()){
     if(!safeUser()){if(typeof openAuthModal==='function')openAuthModal('login');return;}
     if(!state.loaded){showStatus('Загружаем список друзей…');void update();return;}
     if(!state.friends.length){showStatus('Для подарков нужны подтверждённые друзья.');return;}
     const product=item(gift.dataset.komiShopGift);if(!product)return;
     const dialog=$('komiShopGiftDialog');
     if(!dialog)return;
     dialog.dataset.item=product.id;
     $('komiShopGiftLabel').textContent=product.label+' · '+product.cost+' AniCoin. Подарок не подлежит возврату.';
     $('komiShopGiftMessage').value='';
     dialog.showModal();
     return;
   }
   const booster=event.target.closest?.('[data-komi-shop-boost]');
   if(booster&&currentSection()&&!booster.disabled){
     const user=safeUser();
     if(!user){if(typeof openAuthModal==='function')openAuthModal('login');return;}
     if(!root.confirm('Активировать ×2 XP для новых ежедневных заданий на 24 часа за 110 AniCoin?'))return;
     booster.disabled=true;showStatus('Проверяем баланс и активируем усилитель…');
     try{
       const auth=await api().auth.getUser();
       if(auth.error||auth.data?.user?.id!==user)throw Error('Повтори вход в аккаунт.');
       const {data,error}=await api().rpc('komi_shop_booster',{p_action:'buy'});
       if(error)throw error;
       if(safeUser()===user){
         state.booster=data;showStatus('Усилитель включён. Действует до '+date(data.active_until));
         if(typeof root.komiShopReloadStore==='function')void root.komiShopReloadStore();
         renderArea();
       }
     }catch(error){showStatus(error?.message||'Не удалось активировать усилитель.');}
     finally{if(currentSection())renderArea();}
   }
 });
 document.addEventListener('submit',async event=>{
   if(event.target?.id!=='komiShopGiftForm')return;
   event.preventDefault();
   const dialog=$('komiShopGiftDialog');const product=item(dialog?.dataset.item);
   const owner=safeUser();const recipient=$('komiShopGiftRecipient')?.value;
   const note=$('komiShopGiftMessage')?.value||'';
   if(!owner||!product||!recipient||!state.friends.some(friend=>friend.id===recipient))return;
   const confirm=event.target.querySelector('[type="submit"]');confirm.disabled=true;
   if(!root.confirm('Подарить «'+product.label+'» за '+product.cost+' AniCoin?')){confirm.disabled=false;return;}
   showStatus('Отправляем подарок…');
   try{
     const auth=await api().auth.getUser();
     if(auth.error||auth.data?.user?.id!==owner)throw Error('Повтори вход в аккаунт.');
     const {data,error}=await api().rpc('komi_shop_gifts',{
       p_action:'send',p_item:product.id,p_recipient:recipient,p_message:note
     });
     if(error)throw error;
     if(safeUser()===owner){
       state.received=data?.received||state.received;
       state.sent=data?.sent||state.sent;
       state.loaded=true;
       dialog.close();
       state.status='Подарок отправлен. Получатель увидит его в магазине.';
       if(typeof root.komiShopReloadStore==='function')void root.komiShopReloadStore();
       renderArea();refreshGiftButtons();
     }
   }catch(error){showStatus(error?.message||'Подарок не отправлен. Монеты не списаны.');}
   finally{confirm.disabled=false;}
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{
   if(currentSection())mount(document.getElementById('mainContainer'),currentProps());
 },{once:true});
 else if(currentSection())mount(document.getElementById('mainContainer'),currentProps());
})(window);
