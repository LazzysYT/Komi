/*
 * Accessible Watch Party rooms from verified friends only.
 * This is NOT passive viewing surveillance: rooms are already visible through
 * the existing authenticated komi_party('list') RPC, which enforces private
 * room invitations on the server. A friend viewing outside a room stays private.
 */
(function (root) {
    'use strict';
    let requestNumber = 0;

    function friendRoomCards(rooms, idsByName, catalog) {
        if (!Array.isArray(rooms) || !(idsByName instanceof Map)) return [];
        const namesById = new Map([...idsByName].map(([name,id])=>[String(id),String(name)]));
        const animeById = new Map((Array.isArray(catalog)?catalog:[]).map(a=>[String(a.id),a]));
        const seen = new Set();
        return rooms.flatMap(room => {
            if (!room || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(room.id || ''))) return [];
            const name=namesById.get(String(room.host));
            if (!name || seen.has(room.id)) return [];
            seen.add(room.id);
            const anime=animeById.get(String(room.anime_id));
            const numericEpisode=Number(room.episode);
            const episodeLabel=Number.isInteger(numericEpisode)&&numericEpisode>=0&&numericEpisode<9999
                ? ' · Серия '+(numericEpisode+1) : '';
            return [{id:String(room.id),friendName:name,animeTitle:String(anime?.title||'Аниме'),episodeLabel}];
        }).slice(0,12);
    }

    function clearRooms() {
        const section=document.getElementById('komiFriendRoomsSection');
        const list=document.getElementById('komiFriendRoomsList');
        if (list) list.replaceChildren();
        if (section) section.hidden=true;
    }

    async function refresh() {
        const token=++requestNumber;
        if (typeof document==='undefined') return;
        const drawer=document.getElementById('komiFriendsDrawer');
        const section=document.getElementById('komiFriendRoomsSection');
        const list=document.getElementById('komiFriendRoomsList');
        if (!drawer?.classList.contains('open') || !section || !list) {
            clearRooms();
            return;
        }
        const owner=typeof currentUser!=='undefined'?currentUser?.authUserId:null;
        const friends=typeof protectedFriendList!=='undefined'?protectedFriendList:null;
        if (!owner || friends?.owner!==owner || !(friends.idsByName instanceof Map) ||
            !friends.idsByName.size || typeof partyCall!=='function') {
            clearRooms();
            return;
        }
        section.hidden=false;
        list.replaceChildren();
        const status=document.createElement('p');
        status.className='komi-friend-rooms-muted';
        status.textContent='Проверяем доступные комнаты друзей…';
        list.append(status);
        try {
            // Intentionally use the server-filtered list, not a public room
            // table SELECT. The RPC knows which private invites this user has.
            const rooms=await partyCall('list');
            if(token!==requestNumber || currentUser?.authUserId!==owner ||
               !drawer.classList.contains('open')) return;
            const cards=friendRoomCards(rooms,protectedFriendList.idsByName,animeList);
            list.replaceChildren();
            if(!cards.length){
                status.textContent='У друзей пока нет комнат, доступных тебе.';
                list.append(status);
                return;
            }
            for(const room of cards){
                const row=document.createElement('div');
                row.className='komi-friend-room-row';
                const dot=document.createElement('span');
                dot.className='komi-friend-room-live';
                dot.setAttribute('aria-label','Активная комната');
                const description=document.createElement('span');
                description.className='komi-friend-room-description';
                const friend=document.createElement('strong');
                friend.textContent=room.friendName;
                const anime=document.createElement('small');
                anime.textContent=room.animeTitle+room.episodeLabel;
                description.append(friend,anime);
                const join=document.createElement('button');
                join.type='button';
                join.className='komi-friend-room-join';
                join.textContent='Присоединиться';
                join.setAttribute('aria-label','Присоединиться к комнате '+room.friendName);
                join.addEventListener('click',()=>{
                    // Joining still calls the RPC read and checks invite state.
                    closeFriendsDrawer();
                    joinWatchPartyRoom(room.id);
                });
                row.append(dot,description,join);
                list.append(row);
            }
        } catch (error) {
            if(token!==requestNumber || currentUser?.authUserId!==owner) return;
            list.replaceChildren();
            status.textContent='Не удалось получить доступные комнаты. Повтори попытку.';
            list.append(status);
            console.warn('Комнаты друзей:',error?.message||'network error');
        }
    }

    function initialize() {
        const drawer=document.getElementById('komiFriendsDrawer');
        document.getElementById('komiFriendRoomsRefresh')?.addEventListener('click',refresh);
        if (!drawer) return;
        new MutationObserver(()=>refresh()).observe(drawer,{attributes:true,attributeFilter:['class']});
        // Only query while a user is actually viewing the friends panel.
        setInterval(()=>{
            if(!document.hidden && drawer.classList.contains('open')) refresh();
        },30000);
    }
    if (typeof document!=='undefined') {
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
        else initialize();
    }
    const api={refresh,friendRoomCards};
    if(typeof module==='object' && module.exports) module.exports=api;
    else root.KomiFriendRooms=api;
})(globalThis);
