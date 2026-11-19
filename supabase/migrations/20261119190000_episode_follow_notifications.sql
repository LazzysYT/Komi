-- Opt-in notifications when the verified catalog grows by up to 3 actual episodes.
-- Additive: no modifications to existing notification rows, wallets or subscriptions.
create table if not exists public.komi_episode_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id bigint not null references public.anime_catalog(shikimori_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,anime_id)
);
create index if not exists komi_episode_follows_by_anime on public.komi_episode_follows(anime_id);
alter table public.komi_episode_follows enable row level security;
revoke all on public.komi_episode_follows from public,anon,authenticated;
grant select(user_id,anime_id,created_at) on public.komi_episode_follows to authenticated;
grant insert(user_id,anime_id) on public.komi_episode_follows to authenticated;
grant delete on public.komi_episode_follows to authenticated;
create policy "episode follow own select" on public.komi_episode_follows
 for select to authenticated using(user_id=(select auth.uid()));
create policy "episode follow own insert" on public.komi_episode_follows
 for insert to authenticated with check(user_id=(select auth.uid()));
create policy "episode follow own delete" on public.komi_episode_follows
 for delete to authenticated using(user_id=(select auth.uid()));

create or replace function komi_private.emit_followed_episode_notice()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare old_count integer; new_count integer; title_text text;
begin
  if new.data is not distinct from old.data then return new; end if;
  old_count := case when jsonb_typeof(old.data->'episodes')='array'
    then jsonb_array_length(old.data->'episodes') else 0 end;
  new_count := case when jsonb_typeof(new.data->'episodes')='array'
    then jsonb_array_length(new.data->'episodes') else 0 end;
  -- Ignore importing many historical episodes and incomplete cards.
  if old_count < 1 or new_count <= old_count or new_count > old_count+3 then return new; end if;
  if not exists (
    select 1 from jsonb_array_elements(new.data->'episodes') e
    where (e->>'url' is not null and length(e->>'url')>8)
       or (jsonb_typeof(e->'sources')='object' and e->'sources'<>'{}'::jsonb)
    offset old_count
  ) then return new; end if;
  title_text := left(coalesce(nullif(new.data->>'title',''),'Аниме'),90);
  insert into public.komi_notifications(recipient_id,actor_id,kind,message)
    select f.user_id, null, 'system',
      'В «'||title_text||'» добавлены новые серии (всего '||new_count::text||').'
    from public.komi_episode_follows f
    where f.anime_id=new.shikimori_id;
  return new;
end $$;
revoke all on function komi_private.emit_followed_episode_notice() from public,anon,authenticated;
drop trigger if exists trg_komi_followed_episode_notice on public.anime_catalog;
create trigger trg_komi_followed_episode_notice
 after update of data on public.anime_catalog
 for each row execute function komi_private.emit_followed_episode_notice();
