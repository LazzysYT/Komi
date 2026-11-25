const animeExtrasCache = new Map();
const animeArtworkFallback = './anime-artwork.svg';

function animeArtwork(anime) {
    const original = komiSafeUrl(anime?.banner || anime?.poster) || animeArtworkFallback;
    const cached = typeof komiCachedPosterUrl === 'function' ? komiCachedPosterUrl(original, 1280) : original;
    return escapeFriendHtml(cached);
}

function animeDetailsMarkup(anime) {
    return `
        <div id="komiAnimeBanner" style="height:clamp(90px,20vw,230px);overflow:hidden;border-radius:12px;background:#211923">
            <img src="${animeArtwork(anime)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center 30%"
                 data-komi-onerror="this.onerror=null;this.src='./anime-artwork.svg'">
        </div>
        <section id="komiAnimeRelations" style="margin:12px 0" aria-live="polite"></section>
    `;
}

async function renderAnimeExtras(anime, seasons = []) {
    const section = document.getElementById('komiAnimeRelations');
    const banner = document.querySelector('#komiAnimeBanner img');
    if (!section) return;
    const stage = document.querySelector('#watchModalContent .komi-watch-stage');
    if (stage) stage.before(section);
    section.hidden = false;
    section.classList.add('komi-order-v2');
    section.style.cssText = '';
    section.setAttribute('aria-label','Порядок просмотра');
    section.removeAttribute('aria-live');
    if (!document.getElementById('komi-order-v2-style')) {
        const style = document.createElement('style');
        style.id = 'komi-order-v2-style';
        style.textContent = `
.komi-order-v2 { box-sizing:border-box; min-width:0; grid-column:1/-1; margin:0 0 16px; padding:14px; background:#131316; border:1px solid rgba(255,255,255,.10); border-radius:18px; color:#f5f5f5; }
.komi-order-v2[hidden],.komi-order-v2 [hidden] { display:none!important; }
.komi-order-v2 .kw-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 0 10px; }
.komi-order-v2 .kw-heading { font-size:16px; font-weight:750; line-height:1.25; margin:0; color:#fff; }
.komi-order-v2 .kw-toggle { display:inline-flex; align-items:center; justify-content:center; min-height:34px; padding:6px 12px; background:#242429; border:1px solid #37373c; border-radius:999px; color:#eee; font:inherit; font-size:12px; cursor:pointer; flex-shrink:0; }
.komi-order-v2 .kw-list { display:flex; flex-direction:column; gap:7px; max-height:clamp(184px,36vh,326px); overflow-y:auto; overflow-x:hidden; scrollbar-width:thin; scrollbar-color:#55555d transparent; padding:2px 5px 2px 2px; overscroll-behavior:contain; scroll-padding:4px; }
.komi-order-v2 .kw-card { box-sizing:border-box; position:relative; isolation:isolate; display:flex; align-items:center; width:100%; min-width:0; min-height:84px; flex:0 0 auto; overflow:hidden; padding:11px 42px 11px 14px; background:#1c1c21; border:1px solid #38383e; border-radius:13px; color:#fff; font:inherit; text-decoration:none; text-align:left; transition:border-color .18s,background .18s,transform .18s; }
.komi-order-v2 :is(a,button).kw-card { cursor:pointer; }
.komi-order-v2 :is(a,button).kw-card:hover { border-color:#a5a5aa; background:#252529; }
.komi-order-v2 :is(a,button).kw-card:active { transform:scale(.995); }
.komi-order-v2 :is(a,button,.kw-list):focus-visible { outline:2px solid white; outline-offset:2px; }
.komi-order-v2 .kw-art { position:absolute; z-index:-2; inset:0 0 0 auto; width:65%; height:100%; object-fit:cover; object-position:center 38%; opacity:.85; pointer-events:none; }
.komi-order-v2 .kw-shade { position:absolute; z-index:-1; inset:0; background:linear-gradient(90deg,#18181c 0%,rgba(24,24,28,.98) 24%,rgba(24,24,28,.9) 42%,rgba(20,20,24,.56) 70%,rgba(10,10,12,.44) 100%); pointer-events:none; }
.komi-order-v2 .kw-copy { display:grid; gap:3px; min-width:0; max-width:100%; }
.komi-order-v2 .kw-season { font-size:15px; font-weight:800; line-height:1.1; color:#fff; }
.komi-order-v2 .kw-name { font-size:12px; line-height:1.3; color:#e5e5e8; overflow-wrap:anywhere; }
.komi-order-v2 .kw-meta { font-size:11px; line-height:1.2; color:#bdbdc4; }
.komi-order-v2 .kw-arrow { position:absolute; right:12px; top:50%; transform:translateY(-50%); display:grid; place-items:center; width:26px; height:26px; border-radius:50%; border:1px solid rgba(255,255,255,.22); background:rgba(9,9,11,.64); color:white; font-size:17px; }
.komi-order-v2 .kw-card[aria-current] { border-color:#fff; box-shadow:inset 3px 0 #fff; }
.komi-order-v2 .kw-card[aria-current] .kw-season { color:#fff; }
.komi-order-v2 .kw-card[aria-current] .kw-arrow { background:#fff; color:#09090b; border-color:#fff; font-size:13px; }
.komi-order-v2 .kw-status { margin:8px 2px 0; font-size:11px; color:#aaaab1; line-height:1.4; }
.komi-order-v2 .kw-subheading { margin:12px 2px 6px; color:#bdbdc4; font-size:12px; font-weight:650; }
.komi-order-v2 details.kw-extra { margin-top:10px; }
.komi-order-v2 details.kw-extra > summary { padding:8px 2px; font-size:12px; color:#c8c8ce; cursor:pointer; }
.komi-order-v2 details.kw-extra[open] > summary { margin-bottom:5px; }
@media(max-width:640px) {
 .komi-order-v2 { padding:10px; border-radius:14px; margin-bottom:12px; }
 .komi-order-v2 .kw-list { max-height:236px; gap:6px; padding-right:3px; }
 .komi-order-v2 .kw-card { min-height:76px; padding:9px 36px 9px 10px; }
 .komi-order-v2 .kw-art { width:73%; }
 .komi-order-v2 .kw-season { font-size:14px; }
 .komi-order-v2 .kw-name { font-size:12px; }
 .komi-order-v2 .kw-arrow { width:23px; height:23px; right:8px; }
}
@media(prefers-reduced-motion:reduce) { .komi-order-v2 .kw-card { transition:none; } }
`;
        document.head.append(style);
    }
    const make = (tag,text='',cls='') => { const el=document.createElement(tag); el.textContent=text; if(cls)el.className=cls; return el; };
    const header = make('header','','kw-head');
    const heading = make('h3','Порядок просмотра','kw-heading');
    const toggle = make('button','Свернуть','kw-toggle');
    toggle.type='button'; toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-controls','komiOrderContent');
    const content=make('div');content.id='komiOrderContent';
    toggle.addEventListener('click',()=>{content.hidden=!content.hidden;toggle.textContent=content.hidden?'Развернуть':'Свернуть';toggle.setAttribute('aria-expanded',String(!content.hidden));});
    header.append(heading,toggle);
    function createList(label) { const list=make('div','','kw-list');list.tabIndex=0;list.setAttribute('role','group');list.setAttribute('aria-label',label);return list; }
    const row=createList('Основная последовательность');
    const status=make('p','','kw-status');status.setAttribute('role','status');
    content.append(row,status);section.replaceChildren(header,content);
    const id = Number(anime.shikimoriId || anime.id);
    const activeSeason = Number(window.komiActiveSeason);
    function add(parent,{label,name='',subtitle='',image='',action=null,href='',current=false,external=false}) {
        const el=make(current?'div':href?'a':action?'button':'div','','kw-card');
        if(current)el.setAttribute('aria-current','true');
        if(!current && href) { el.href=href; if(external){el.target='_blank';el.rel='noopener noreferrer';} }
        if(!current && action) {
            if(!href)el.type='button';
            el.addEventListener('click',event=>{
                if(href && (event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey))return;
                if(href)event.preventDefault();
                action();
            });
        }
        const raw=komiSafeUrl(image);
        if(raw){
            const img=make('img','','kw-art');img.alt='';img.loading='lazy';img.decoding='async';
            const cached=typeof komiCachedPosterUrl==='function'?komiCachedPosterUrl(raw,640):raw;
            img.addEventListener('error',()=>{if(img.getAttribute('src')!==raw){img.src=raw;}else{img.remove();}});
            img.src=cached||raw;el.append(img);
        }
        el.append(make('span','','kw-shade'));
        const copy=make('span','','kw-copy');
        copy.append(make('strong',label,'kw-season'));
        if(name)copy.append(make('span',name,'kw-name'));
        if(subtitle)copy.append(make('span',subtitle,'kw-meta'));
        el.append(copy);
        if(current||href||action) { const arrow=make('span',current?'✓':external?'↗':'›','kw-arrow');arrow.setAttribute('aria-hidden','true');el.append(arrow); }
        parent.append(el);
    }
    const localSeasons=seasons.length?seasons:[];
    function localCards(parent) {
        for(const season of localSeasons)add(parent,{label:season+' сезон',name:anime.title,subtitle:season===activeSeason?'Сейчас смотришь':'Перейти к сезону',image:anime.banner||anime.poster,action:()=>openWatchModal(anime.id,season,0),current:season===activeSeason});
    }
    localCards(row);
    if (!Number.isSafeInteger(id) || id < 1) { section.hidden=!localSeasons.length; return; }
    const fields = 'id idMal type format seasonYear title { native romaji } bannerImage coverImage { large extraLarge }';
    async function load(key, byMal=false) {
        const cacheKey=(byMal?'mal:':'ani:')+key;
        if (!animeExtrasCache.has(cacheKey)) {
            const request=fetch('https://graphql.anilist.co',{
                method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
                body:JSON.stringify({variables:{id:key},query:'query ($id:Int!) { Media('+(byMal?'idMal':'id')+':$id,type:ANIME) { '+fields+' relations { edges { relationType(version:2) node { '+fields+' } } } } }'}),
                signal:AbortSignal.timeout(9000)
            }).then(async response=>{if(!response.ok)throw Error('AniList '+response.status);const data=await response.json();if(!data.data?.Media)throw Error('No media');return data.data.Media;}).catch(error=>{animeExtrasCache.delete(cacheKey);throw error;});
            animeExtrasCache.set(cacheKey,request);
        }
        return animeExtrasCache.get(cacheKey);
    }
    status.textContent='Ищем связанные сезоны и фильмы…';
    try {
        const base=await load(id,true);
        if(!section.isConnected)return;
        const artwork=komiSafeUrl(base.bannerImage)||(!komiSafeUrl(anime.poster)&&komiSafeUrl(base.coverImage?.extraLarge));
        if(artwork&&banner)banner.src=typeof komiCachedPosterUrl==='function'?komiCachedPosterUrl(artwork,1280):artwork;
        const nodes=new Map([[base.id,base]]), links=new Map(), extras=new Map(), visited=new Set(), queue=[base];
        let incomplete=false;
        while(queue.length && visited.size<12 && section.isConnected){
            const item=queue.shift();if(visited.has(item.id))continue;visited.add(item.id);
            let detail;
            try {detail=item.id===base.id?base:await load(item.id);}catch{incomplete=true;continue;}
            nodes.set(detail.id,detail);
            for(const edge of detail.relations?.edges||[]){
                const n=edge.node;if(n?.type!=='ANIME')continue;
                if(['PREQUEL','SEQUEL'].includes(edge.relationType)){
                    nodes.set(n.id,n);
                    const from=edge.relationType==='PREQUEL'?n.id:detail.id;
                    const to=edge.relationType==='PREQUEL'?detail.id:n.id;
                    if(!links.has(from))links.set(from,new Set());links.get(from).add(to);
                    if(!visited.has(n.id)&&!queue.some(x=>x.id===n.id))queue.push(n);
                } else if(['SIDE_STORY','PARENT','SUMMARY','ALTERNATIVE','SPIN_OFF'].includes(edge.relationType)){
                    extras.set(n.id,{node:n,relation:edge.relationType});
                }
            }
        }
        if(!section.isConnected)return;
        if(queue.length)incomplete=true;
        const indegree=new Map([...nodes.keys()].map(k=>[k,0]));
        for(const targets of links.values())for(const t of targets)indegree.set(t,(indegree.get(t)||0)+1);
        const ordered=[];let ambiguous=false;
        const cmp=(a,b)=>(nodes.get(a).seasonYear||9999)-(nodes.get(b).seasonYear||9999)||a-b;
        const ready=[...indegree.keys()].filter(k=>indegree.get(k)===0).sort(cmp);
        while(ready.length){if(ready.length>1)ambiguous=true;const k=ready.shift();ordered.push(k);for(const t of links.get(k)||[]){indegree.set(t,indegree.get(t)-1);if(indegree.get(t)===0){ready.push(t);ready.sort(cmp);}}}
        if(ordered.length!==nodes.size){ambiguous=true;for(const k of nodes.keys())if(!ordered.includes(k))ordered.push(k);}
        const format={MOVIE:'Фильм',TV:'Сериал',TV_SHORT:'Короткий сериал',OVA:'OVA',ONA:'ONA',SPECIAL:'Спецвыпуск'};
        const seriesFormats=new Set(['TV','TV_SHORT','ONA']);
        const numbered=!ambiguous&&!incomplete;
        let seasonIndex=0;
        function part(parent,n,current=false,relation='',label=''){
            const malId=Number(n.idMal);
            const local=animeList.find(x=>Number(x.shikimoriId||x.id)===malId&&malId>0);
            const name=local?.title||n.title?.romaji||n.title?.native||'Связанное аниме';
            const title=label||format[n.format]||'Дополнительная часть';
            const subtitle=[n.seasonYear,relation,current?'Сейчас смотришь':local?'Смотреть': 'Нет в каталоге · информация'].filter(Boolean).join(' · ');
            const image=[local?.banner,n.bannerImage,local?.poster,n.coverImage?.extraLarge,n.coverImage?.large].find(x=>komiSafeUrl(x))||'';
            const href=local&&Number.isSafeInteger(malId)&&malId>0?'/anime/'+malId+'#player':!local&&Number.isSafeInteger(n.id)&&n.id>0?'https://anilist.co/anime/'+n.id:'';
            add(parent,{label:title,name,subtitle,image,href,external:!local&&!!href,current,action:local?()=>openWatchModal(local.id):null});
        }
        row.replaceChildren();
        for(const k of ordered){
            const n=nodes.get(k);
            const label=seriesFormats.has(n.format)&&numbered?(++seasonIndex)+' сезон':format[n.format]||'Часть';
            part(row,n,k===base.id,'',label);
        }
        if(localSeasons.length>1){
            const label=make('p','Сезоны текущего аниме','kw-subheading');
            const seasonRow=createList('Сезоны текущего аниме');content.insertBefore(label,status);content.insertBefore(seasonRow,status);localCards(seasonRow);
        }
        const optional=[...extras.values()].filter(x=>!nodes.has(x.node.id));
        if(optional.length){
            const labels={SIDE_STORY:'Доп. история',PARENT:'Основная история',SUMMARY:'Пересказ',ALTERNATIVE:'Альтернативная версия',SPIN_OFF:'Спин-офф'};
            const disclosure=make('details','','kw-extra');
            disclosure.append(make('summary','Дополнительные и альтернативные части · '+optional.length));
            const extraRow=createList('Дополнительные части');
            disclosure.append(extraRow);content.insertBefore(disclosure,status);
            for(const x of optional.sort((a,b)=>(a.node.seasonYear||9999)-(b.node.seasonYear||9999)))part(extraRow,x.node,false,labels[x.relation]);
        }
        status.textContent=incomplete||ambiguous?'Связи AniList: порядок может быть неполным или неоднозначным.':'По связям AniList. Номера сезонов обозначают порядок сериальных частей; официальное деление может отличаться.';
        if(nodes.size===1&&!optional.length&&localSeasons.length<=1)section.hidden=true;
    }catch{if(section.isConnected){status.textContent='Связанные части временно недоступны.';if(!localSeasons.length)section.hidden=true;}}
}
