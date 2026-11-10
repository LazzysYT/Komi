// Local history is a user-selected copy, never proof of server account ownership.
function komiFolderNameAllowed(name) {
    if (typeof name !== 'string' || name.length < 1 || name.length > 40 ||
        name !== name.trim() || /[\u0000-\u001f\u007f]/.test(name)) return false;
    const reserved = ['__proto__','constructor','prototype','смотрю','в планах','просмотрено','отложено','брошено','любимые'];
    return !reserved.includes(name.toLocaleLowerCase());
}
function komiLegacyImportRows(archive, name, owner) {
    const allowed = new Set(['Просмотрено','В планах','Смотрю','Отложено','Брошено']);
    const validId = id => /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id)>0;
    const progressPrefix = name + '_';
    const progress = Object.entries(archive.progress || {})
        .filter(([key,record]) => key.startsWith(progressPrefix) &&
            validId(key.slice(progressPrefix.length)) && record && typeof record === 'object' && !Array.isArray(record))
        .flatMap(([key,record]) => {
            const season = Number(record.season);
            const episodeIndex = Number(record.index);
            const position = Number(record.time);
            const duration = Number(record.duration);
            if (!Number.isSafeInteger(season) || season < 1 || season > 1000 ||
                !Number.isSafeInteger(episodeIndex) || episodeIndex < 0 || episodeIndex > 10000 ||
                !Number.isFinite(position) || position < 0 || position > 604800 ||
                !Number.isFinite(duration) || duration < 0 || duration > 604800) return [];
            return [{user_id:owner, anime_id:Number(key.slice(progressPrefix.length)),
                season, episode_index:episodeIndex,
                position_seconds:Math.floor(position),duration_seconds:Math.floor(duration)}];
        });
    const sourceFolders = archive.folders?.[name] || {};
    const folderNames = Object.keys(sourceFolders).filter(komiFolderNameAllowed)
        .filter(folder => Array.isArray(sourceFolders[folder]));
    const folders = folderNames.map(folder => ({user_id:owner,name:folder}));
    const folderItems = folderNames.flatMap(folder =>
        [...new Set(sourceFolders[folder].map(String).filter(validId))].map(id => ({
            user_id:owner, folder_name:folder, anime_id:Number(id)
        })));
    return {
        folders,
        folderItems,
        lists: Object.entries(archive.statuses?.[name] || {}).filter(([id,status])=>validId(id)&&allowed.has(status))
            .map(([id,status])=>({user_id:owner,anime_id:Number(id),status})),
        favorites: Object.entries(archive.favorites?.[name] || {}).filter(([id,category])=>validId(id)&&typeof category==='string'&&category.length<=80)
            .map(([id,category])=>({user_id:owner,anime_id:Number(id),category})),
        progress
    };
}
// Each table has its own unique key. A shared onConflict would break folder imports.
function komiLegacyImportBatches(rows) {
    return [
        {table:'komi_anime_lists', records:rows.lists, onConflict:'user_id,anime_id'},
        {table:'komi_favorites', records:rows.favorites, onConflict:'user_id,anime_id'},
        {table:'komi_watch_progress', records:rows.progress, onConflict:'user_id,anime_id'},
        {table:'komi_custom_folders', records:rows.folders, onConflict:'user_id,name'},
        {table:'komi_folder_items', records:rows.folderItems, onConflict:'user_id,folder_name,anime_id'}
    ];
}
function openLegacyImport() {
    if (!currentUser?.authUserId) return openAuthModal('login');
    const owner=currentUser.authUserId;
    const archive=safeParse(localStorage.getItem('komi_legacy_archive_v1'),{});
    const names=[...new Set([
        ...Object.keys(archive.statuses||{}),...Object.keys(archive.favorites||{}),...Object.keys(archive.folders||{}),
        ...Object.keys(archive.progress||{}).filter(key=>/^.+_\d+$/.test(key)).map(key=>key.replace(/_\d+$/,''))
    ])];
    const old=document.getElementById('legacyImportModal'); if(old)old.remove();
    const modal=document.createElement('div');modal.id='legacyImportModal';modal.className='modal-overlay';
    modal.innerHTML='<div class="modal-content" style="max-width:480px"><button type="button" class="modal-close" aria-label="Закрыть">×</button><h2>Перенос списков</h2><p>Скопируйте списки из этого браузера в текущий аккаунт. Существующие записи и исходный архив сохранятся. Профили, друзья, пароли и права не переносятся.</p><label for="legacyImportName">Локальный список</label><select id="legacyImportName" class="form-control"></select><p role="status" aria-live="polite"></p><button type="button" class="btn-glow" data-import>Скопировать в мой аккаунт</button></div>';
    const select=modal.querySelector('select'), status=modal.querySelector('[role=status]'),button=modal.querySelector('[data-import]');
    for(const name of names){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}
    const preview=()=>{const rows=komiLegacyImportRows(archive,select.value,owner);status.textContent=names.length?`${rows.lists.length} статусов, ${rows.favorites.length} записей избранного и ${rows.progress.length} записей прогресса, ${rows.folders.length} папок и ${rows.folderItems.length} записей в папках. Уже сохранённые записи не заменяются.`:'В этом браузере нет старых списков.';button.disabled=!rows.lists.length&&!rows.favorites.length&&!rows.progress.length&&!rows.folders.length&&!rows.folderItems.length;};
    select.addEventListener('change',preview);preview();
    modal.querySelector('.modal-close').onclick=()=>modal.classList.remove('active');
    button.onclick=async()=>{
        button.disabled=true;select.disabled=true;let processed=0;
        try{
            const rows=komiLegacyImportRows(archive,select.value,owner);
            for(const {table, records, onConflict} of komiLegacyImportBatches(rows)){
                for(let i=0;i<records.length;i+=100){
                    if(currentUser?.authUserId!==owner)throw Error('Аккаунт изменился.');
                    const {data,error}=await _supabase.auth.getUser();
                    if(error||data?.user?.id!==owner)throw Error('Войдите в аккаунт ещё раз.');
                    const result=await _supabase.from(table).upsert(records.slice(i,i+100),{onConflict,ignoreDuplicates:true});
                    if(result.error)throw result.error;
                    processed+=Math.min(100,records.length-i);
                }
            }
            if(currentUser?.authUserId!==owner)return;
            await loadAuthenticatedAnimeData();render();
            status.textContent='Перенос завершён. Исходные списки сохранены.';
        }catch(error){status.textContent=`Не удалось завершить перенос (${processed} записей обработано). Повтор безопасен: существующие записи сохранятся. ${error.message}`;button.disabled=false;select.disabled=false;}
    };
    document.body.append(modal);modal.classList.add('active');
}
