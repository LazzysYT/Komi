/* Franchise viewing order. Main chain follows AniList sequel/prequel edges. */
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

function komiFranchiseDate(node) {
    const d=node.startDate||{};
    return (d.year||node.seasonYear||9999)*10000+(d.month||13)*100+(d.day||32);
}

function komiOrderFranchise(nodes, links) {
    const incoming=new Map([...nodes.keys()].map(id=>[id,0]));
    const outgoing=new Map([...nodes.keys()].map(id=>[id,new Set()]));
    for(const [from,to] of links) {
        if(from===to||!incoming.has(from)||!incoming.has(to)||outgoing.get(from).has(to)) continue;
        outgoing.get(from).add(to);
        incoming.set(to,incoming.get(to)+1);
    }
    const compare=(a,b)=>komiFranchiseDate(nodes.get(a))-komiFranchiseDate(nodes.get(b))||a-b;
    const ready=[...incoming.keys()].filter(id=>incoming.get(id)===0).sort(compare);
    const ordered=[];
    let ambiguous=false;
    while(ready.length) {
        if(ready.length>1) ambiguous=true;
        const id=ready.shift(); ordered.push(id);
        for(const next of outgoing.get(id)) {
            incoming.set(next,incoming.get(next)-1);
            if(incoming.get(next)===0) ready.push(next);
        }
        ready.sort(compare);
    }
    if(ordered.length<nodes.size) {
        ambiguous=true;
        ordered.push(...[...nodes.keys()].filter(id=>!ordered.includes(id)).sort(compare));
    }
    return {ordered:ordered.map(id=>nodes.get(id)),ambiguous};
}

function komiFranchiseConsume(media,state) {
    if(!media?.id) return;
    state.nodes.set(media.id,media);
    state.visited.add(media.id);
    const optionalTypes=new Set(['SIDE_STORY','PARENT','SUMMARY','ALTERNATIVE','SPIN_OFF','OTHER']);
    for(const edge of media.relations?.edges||[]) {
        const node=edge.node, type=edge.relationType;
        if(!node?.id||node.type!=='ANIME'||node.id===media.id) continue;
        if(type==='PREQUEL'||type==='SEQUEL') {
            if(!state.nodes.has(node.id)) state.nodes.set(node.id,node);
            state.links.push(type==='PREQUEL'?[node.id,media.id]:[media.id,node.id]);
        } else if(optionalTypes.has(type)&&!state.optional.has(node.id)) {
            state.optional.set(node.id,{node,type});
        }
    }
}

async function komiFetchFranchise(id, transport=globalThis.fetch) {
    const nodeFields='id idMal type format status seasonYear startDate { year month day } title { romaji native } coverImage { medium }';
    const fields=nodeFields+' bannerImage relations { edges { relationType(version:2) node { '+nodeFields+' } } }';
    async function query(q,variables) {
        const response=await transport('https://graphql.anilist.co',{
            method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
            body:JSON.stringify({query:q,variables}),signal:typeof AbortSignal!=='undefined'?AbortSignal.timeout(5000):undefined
        });
        if(!response.ok) throw Error('AniList HTTP '+response.status);
        const payload=await response.json();
        if(!payload.data||payload.errors?.length) throw Error('AniList returned incomplete data');
        return payload.data;
    }
    const {Media:base}=await query('query ($id:Int!) { Media(idMal:$id,type:ANIME) { '+fields+' } }',{id});
    if(!base?.id) throw Error('Anime not found');
    const state={nodes:new Map(),visited:new Set(),links:[],optional:new Map()};
    komiFranchiseConsume(base,state);
    let incomplete=false;
    const deadline=Date.now()+15000;
    // Expand only verified main-story relations, never unrelated alternatives.
    for(let round=0;round<12;round++) {
        const pending=[...state.nodes.keys()].filter(key=>!state.visited.has(key));
        if(!pending.length) break;
        if(state.nodes.size>96||Date.now()>deadline) {incomplete=true;break;}
        const ids=pending.slice(0,12);
        try {
            const aliases=ids.map((key,i)=>'m'+i+':Media(id:'+key+',type:ANIME) { '+fields+' }');
            const data=await query('query { '+aliases.join(' ')+' }',{});
            ids.forEach((key,i)=>{
                const item=data['m'+i];
                if(item?.id===key) komiFranchiseConsume(item,state);
                else incomplete=true;
            });
            if(incomplete) break;
        } catch {incomplete=true;break;}
    }
    if([...state.nodes.keys()].some(key=>!state.visited.has(key))) incomplete=true;
    const {ordered,ambiguous}=komiOrderFranchise(state.nodes,state.links);
    const extra=[...state.optional.values()].filter(x=>!state.nodes.has(x.node.id))
        .sort((a,b)=>komiFranchiseDate(a.node)-komiFranchiseDate(b.node)||a.node.id-b.node.id);
    return {base,ordered,extra,ambiguous,incomplete};
}

function komiCachedFranchise(id) {
    const existing=animeExtrasCache.get(id);
    if(existing&&existing.until>Date.now()) return existing.promise;
    const record={until:Date.now()+60000,promise:null};
    record.promise=komiFetchFranchise(id).then(result=>{
        record.until=Date.now()+(result.incomplete?30000:600000);
        if(!result.incomplete) for(const node of result.ordered) {
            const key=Number(node.idMal);
            if(Number.isSafeInteger(key)&&key>0&&!animeExtrasCache.has(key))
                animeExtrasCache.set(key,{until:record.until,promise:Promise.resolve({...result,base:node})});
        }
        while(animeExtrasCache.size>160) animeExtrasCache.delete(animeExtrasCache.keys().next().value);
        return result;
    }).catch(error=>{
        if(animeExtrasCache.get(id)===record) animeExtrasCache.delete(id);
        throw error;
    });
    animeExtrasCache.set(id,record);
    return record.promise;
}

async function renderAnimeExtras(anime,seasons=[]) {
    const section=document.getElementById('komiAnimeRelations');
    if(!section) return;
    const content=document.getElementById('watchModalContent');
    const stage=content?.querySelector('.komi-watch-stage');
    const banner=content?.querySelector('#komiAnimeBanner img');
    if(stage) stage.before(section);
    section.hidden=false;
    section.className='komi-franchise-order';
    section.setAttribute('aria-label','Порядок просмотра');
    section.removeAttribute('aria-live');
    const el=(tag,cls,label)=>{
        const node=document.createElement(tag);
        if(cls) node.className=cls;
        if(label) node.textContent=label;
        return node;
    };
    const title=el('strong','komi-franchise-title','Порядок просмотра');
    const head=el('div','komi-franchise-head');
    const note=el('span','komi-franchise-note');
    note.setAttribute('role','status');
    head.append(title,note);
    const seasonRow=el('div','komi-franchise-row');
    const main=el('div','komi-franchise-row');
    main.setAttribute('role','group');
    main.setAttribute('aria-label','Основные части');
    const activeSeason=Number(globalThis.komiActiveSeason);
    const orderedSeasons=[...new Set(seasons.map(Number).filter(n=>Number.isSafeInteger(n)&&n>0))].sort((a,b)=>a-b);
    const id=Number(anime.shikimoriId||anime.id);
    const labelFor={TV:'Сериал',TV_SHORT:'Короткий сериал',MOVIE:'Фильм',OVA:'OVA',ONA:'ONA',SPECIAL:'Спецвыпуск',MUSIC:'Музыкальный выпуск'};
    const relationLabels={SIDE_STORY:'Дополнение',PARENT:'Основная история',SUMMARY:'Пересказ',ALTERNATIVE:'Альтернативная версия',SPIN_OFF:'Спин-офф',OTHER:'Связанная часть'};
    function card(node,number,relatedType) {
        const malId=Number(node.idMal);
        const active=malId===id;
        const local=active?anime:animeList.find(a=>Number(a.shikimoriId||a.id)===malId);
        const upcoming=node.status==='NOT_YET_RELEASED';
        const cancelled=node.status==='CANCELLED';
        const control=el(active?'span':local&&!upcoming&&!cancelled?'button':'a','komi-franchise-card');
        if(control.tagName==='BUTTON') {
            control.type='button';
            control.addEventListener('click',()=>openWatchModal(local.id));
        } else if(control.tagName==='A') {
            control.href=local?'/anime/'+encodeURIComponent(local.id):'https://anilist.co/anime/'+encodeURIComponent(node.id);
            if(!local) {control.target='_blank';control.rel='noopener noreferrer';}
        }
        if(active) {control.classList.add('is-current');control.setAttribute('aria-current','true');}
        const label=local?.title||node.title?.romaji||node.title?.native||'Аниме';
        if(number) control.append(el('span','komi-franchise-num',String(number).padStart(2,'0')));
        const body=el('span','komi-franchise-text');
        const name=el('span','komi-franchise-name',label);
        name.title=label;
        const meta=[labelFor[node.format]||'Аниме',node.startDate?.year||node.seasonYear,relationLabels[relatedType],
            active?'Текущая часть':cancelled?'Отменено':upcoming?'Скоро':!local?'Вне каталога':''].filter(Boolean);
        body.append(name,el('span','komi-franchise-meta',meta.join(' · ')));
        control.append(body);
        return control;
    }
    if(orderedSeasons.length>1) {
        seasonRow.setAttribute('role','group');
        seasonRow.setAttribute('aria-label','Сезоны текущего аниме');
        seasonRow.append(el('span','komi-franchise-row-label','Сезоны:'));
        for(const season of orderedSeasons) {
            const button=el('button','komi-franchise-season','Сезон '+season);
            button.type='button';
            const current=activeSeason===season;
            button.setAttribute('aria-pressed',String(current));
            button.classList.toggle('is-current',current);
            button.addEventListener('click',()=>{if(!current)openWatchModal(anime.id,season,0);});
            seasonRow.append(button);
        }
    }
    section.replaceChildren(head,main);
    if(orderedSeasons.length>1) section.append(seasonRow);
    if(!Number.isSafeInteger(id)||id<1) {section.hidden=orderedSeasons.length<2;return;}
    note.textContent='Загружаем связанные части…';
    const retry=()=>{
        const button=el('button','komi-franchise-season','Повторить');
        button.type='button';
        button.addEventListener('click',()=>{animeExtrasCache.delete(id);void renderAnimeExtras(anime,seasons);},{once:true});
        head.append(button);
    };
    try {
        const result=await komiCachedFranchise(id);
        if(!section.isConnected) return;
        const artwork=komiSafeUrl(result.base?.bannerImage)||(!komiSafeUrl(anime.poster)&&komiSafeUrl(result.base?.coverImage?.medium));
        if(banner&&artwork) banner.src=typeof komiCachedPosterUrl==='function'?komiCachedPosterUrl(artwork,1280):artwork;
        if(result.ordered.length===1&&!result.extra.length&&!result.incomplete&&orderedSeasons.length<2) {
            section.hidden=true;return;
        }
        const numbered=!result.ambiguous&&!result.incomplete;
        note.textContent=result.incomplete?'Загружена часть связей':result.ambiguous?'Есть несколько веток истории':'По связям между частями';
        for(const [index,node] of result.ordered.entries()) main.append(card(node,numbered?index+1:0));
        if(result.extra.length) {
            const extra=el('details','komi-franchise-extra');
            extra.append(el('summary','','Дополнительные и альтернативные части ('+result.extra.length+')'));
            const row=el('div','komi-franchise-row');
            for(const item of result.extra) row.append(card(item.node,0,item.type));
            extra.append(row);section.append(extra);
        }
        if(result.incomplete)retry();
        const current=main.querySelector('[aria-current="true"]');
        if(current) requestAnimationFrame(()=>{
            if(!current.isConnected)return;
            main.scrollLeft=Math.max(0,current.offsetLeft-(main.clientWidth-current.offsetWidth)/2);
        });
    } catch {
        if(!section.isConnected)return;
        note.textContent='Не удалось загрузить порядок просмотра';
        retry();
    }
}
