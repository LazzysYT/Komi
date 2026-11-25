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
    section.style.cssText = 'margin:0 0 14px;min-width:0;grid-column:1/-1;position:relative;background:#131316;border:1px solid #29292e;border-radius:16px;padding:12px';
    section.setAttribute('aria-label','Порядок просмотра');
    const make = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
    const heading = make('h3','Порядок просмотра');
    heading.style.cssText = 'font-size:15px;margin:0 0 8px;color:#fff';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:thin;align-items:stretch';
    const status = make('p','');
    status.style.cssText = 'font-size:12px;color:#aaa;margin:4px 0 0';
    section.replaceChildren(heading,row,status);
    const id = Number(anime.shikimoriId || anime.id);
    const activeSeason = Number(window.komiActiveSeason);
    function add(parent,label,subtitle,action,current=false) {
        const el = make(action ? 'button' : 'span','');
        if (action) { el.type='button'; el.onclick=action; }
        el.style.cssText = 'flex:0 0 auto;max-width:240px;min-width:90px;text-align:left;white-space:normal;padding:9px 12px;border-radius:12px;border:1px solid '+(current?'#fff':'#303036')+';background:'+(current?'#fff':'#1c1c21')+';color:'+(current?'#09090b':'#eee')+';font:inherit;'+(action?'cursor:pointer;':'');
        if(current) el.setAttribute('aria-current','true');
        const title=make('strong',label);title.style.cssText='display:block;font-size:13px;line-height:1.3';
        const sub=make('small',subtitle);sub.style.cssText='display:block;font-size:11px;margin-top:4px;opacity:.75';
        el.append(title,sub);parent.append(el);
    }
    const localSeasons = seasons.length ? seasons : [];
    function localCards(parent) {
        for (const season of localSeasons) add(parent,'Сезон '+season,season===activeSeason?'Сейчас смотришь':'Перейти к сезону',()=>openWatchModal(anime.id,season,0),season===activeSeason);
    }
    localCards(row);
    if (!Number.isSafeInteger(id) || id < 1) { section.hidden=!localSeasons.length; return; }
    const fields = 'id idMal type format seasonYear title { native romaji }';
    async function load(key, byMal=false) {
        const cacheKey=(byMal?'mal:':'ani:')+key;
        if (!animeExtrasCache.has(cacheKey)) {
            const request=fetch('https://graphql.anilist.co',{
                method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},
                body:JSON.stringify({variables:{id:key},query:'query ($id:Int!) { Media('+(byMal?'idMal':'id')+':$id,type:ANIME) { '+fields+' bannerImage coverImage { extraLarge } relations { edges { relationType(version:2) node { '+fields+' } } } } }'}),
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
        function part(parent,n,current=false,relation=''){
            const local=animeList.find(x=>Number(x.shikimoriId||x.id)===Number(n.idMal)&&Number(n.idMal)>0);
            const label=local?.title||n.title?.romaji||n.title?.native||'Связанное аниме';
            const sub=[format[n.format]||'Часть',n.seasonYear,relation,current?'Сейчас смотришь':local?'На KomiAnime':'Нет в каталоге'].filter(Boolean).join(' · ');
            add(parent,label,sub,current?null:local?()=>openWatchModal(local.id):null,current);
        }
        row.replaceChildren();
        for(const k of ordered)part(row,nodes.get(k),k===base.id);
        if(localSeasons.length>1){
            const label=make('p','Сезоны текущего аниме');label.style.cssText='font-size:12px;color:#aaa;margin:8px 0 4px';
            const seasonRow=row.cloneNode(false);section.insertBefore(label,status);section.insertBefore(seasonRow,status);localCards(seasonRow);
        }
        const optional=[...extras.values()].filter(x=>!nodes.has(x.node.id));
        if(optional.length){
            const labels={SIDE_STORY:'Доп. история',PARENT:'Основная история',SUMMARY:'Пересказ',ALTERNATIVE:'Альтернативная версия',SPIN_OFF:'Спин-офф'};
            const title=make('p','Дополнительные и альтернативные части');title.style.cssText='font-size:12px;color:#aaa;margin:8px 0 4px';
            const extraRow=row.cloneNode(false);section.insertBefore(title,status);section.insertBefore(extraRow,status);
            for(const x of optional.sort((a,b)=>(a.node.seasonYear||9999)-(b.node.seasonYear||9999)))part(extraRow,x.node,false,labels[x.relation]);
        }
        status.textContent=incomplete||ambiguous?'Связи AniList: порядок может быть неполным или неоднозначным.':'Порядок по связям предысторий и продолжений AniList; не сюжетная хронология.';
        if(nodes.size===1&&!optional.length&&localSeasons.length<=1)section.hidden=true;
    }catch{if(section.isConnected){status.textContent='Связанные части временно недоступны.';if(!localSeasons.length)section.hidden=true;}}
}
