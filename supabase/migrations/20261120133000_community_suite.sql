-- KomiAnime community suite. Additive schema; existing playback, billing and XP unchanged.
-- All writes enforce Supabase Auth ownership through RLS or an audited RPC.

alter table public.komi_anime_lists add column if not exists score smallint check(score between 0 and 10);
grant select(score), insert(score), update(score) on public.komi_anime_lists to authenticated;

create table if not exists public.komi_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(btrim(title)) between 3 and 90),
  description text not null default '' check(length(description)<=800),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists komi_collections_recent on public.komi_collections(created_at desc);
create table if not exists public.komi_collection_items (
  collection_id uuid not null references public.komi_collections(id) on delete cascade,
  anime_id bigint not null references public.anime_catalog(shikimori_id) on delete cascade,
  position smallint not null default 0 check(position between 0 and 99),
  primary key(collection_id,anime_id)
);
create table if not exists public.komi_collection_likes (
  collection_id uuid not null references public.komi_collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(collection_id,user_id)
);
create index if not exists komi_collection_items_anime on public.komi_collection_items(anime_id);
create index if not exists komi_collection_likes_user on public.komi_collection_likes(user_id);
alter table public.komi_collections enable row level security;
alter table public.komi_collection_items enable row level security;
alter table public.komi_collection_likes enable row level security;
revoke all on public.komi_collections,public.komi_collection_items,public.komi_collection_likes from public,anon,authenticated;
grant select on public.komi_collections,public.komi_collection_items,public.komi_collection_likes to anon,authenticated;
grant insert,update,delete on public.komi_collections,public.komi_collection_items to authenticated;
grant insert,delete on public.komi_collection_likes to authenticated;
create policy "collection visible" on public.komi_collections for select to anon,authenticated
  using(is_public or owner_id=(select auth.uid()));
create policy "collection create owner" on public.komi_collections for insert to authenticated
  with check(owner_id=(select auth.uid()));
create policy "collection update owner" on public.komi_collections for update to authenticated
  using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "collection delete owner" on public.komi_collections for delete to authenticated
  using(owner_id=(select auth.uid()));
create policy "collection item visible" on public.komi_collection_items for select to anon,authenticated
  using(exists(select 1 from public.komi_collections c where c.id=collection_id and (c.is_public or c.owner_id=(select auth.uid()))));
create policy "collection item create owner" on public.komi_collection_items for insert to authenticated
  with check(exists(select 1 from public.komi_collections c where c.id=collection_id and c.owner_id=(select auth.uid())));
create policy "collection item update owner" on public.komi_collection_items for update to authenticated
  using(exists(select 1 from public.komi_collections c where c.id=collection_id and c.owner_id=(select auth.uid())))
  with check(exists(select 1 from public.komi_collections c where c.id=collection_id and c.owner_id=(select auth.uid())));
create policy "collection item delete owner" on public.komi_collection_items for delete to authenticated
  using(exists(select 1 from public.komi_collections c where c.id=collection_id and c.owner_id=(select auth.uid())));
create policy "collection likes visible" on public.komi_collection_likes for select to anon,authenticated
  using(exists(select 1 from public.komi_collections c where c.id=collection_id and c.is_public));
create policy "collection like own" on public.komi_collection_likes for insert to authenticated
  with check(user_id=(select auth.uid()) and exists(select 1 from public.komi_collections c where c.id=collection_id and c.is_public));
create policy "collection unlike own" on public.komi_collection_likes for delete to authenticated
  using(user_id=(select auth.uid()));

create table if not exists public.komi_reviews (
  id bigint generated always as identity primary key,
  anime_id bigint not null references public.anime_catalog(shikimori_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(btrim(body)) between 40 and 3000),
  tags text[] not null default '{}'::text[] check(tags <@ array['Сильный сюжет','Красивая рисовка','Слитая концовка','Отличный саундтрек','Любимые герои']::text[] and cardinality(tags)<=3),
  created_at timestamptz not null default now(),
  unique(anime_id,user_id)
);
create table if not exists public.komi_review_votes (
  review_id bigint not null references public.komi_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(review_id,user_id)
);
create index if not exists komi_reviews_anime_created on public.komi_reviews(anime_id,created_at desc);
alter table public.komi_reviews enable row level security;
alter table public.komi_review_votes enable row level security;
revoke all on public.komi_reviews,public.komi_review_votes from public,anon,authenticated;
grant select on public.komi_reviews,public.komi_review_votes to anon,authenticated;
grant insert,update,delete on public.komi_reviews to authenticated;
grant insert,delete on public.komi_review_votes to authenticated;
grant usage,select on sequence public.komi_reviews_id_seq to authenticated;
create policy "reviews public read" on public.komi_reviews for select to anon,authenticated using(true);
create policy "reviews own insert" on public.komi_reviews for insert to authenticated with check(user_id=(select auth.uid()));
create policy "reviews own update" on public.komi_reviews for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "reviews own delete" on public.komi_reviews for delete to authenticated using(user_id=(select auth.uid()));
create policy "review votes visible" on public.komi_review_votes for select to anon,authenticated using(true);
create policy "review vote own insert" on public.komi_review_votes for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.komi_reviews r where r.id=review_id and r.user_id<>user_id));
create policy "review vote own delete" on public.komi_review_votes for delete to authenticated using(user_id=(select auth.uid()));

create table if not exists public.komi_voice_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id bigint not null references public.anime_catalog(shikimori_id) on delete cascade,
  studio text not null check(length(btrim(studio)) between 2 and 72),
  created_at timestamptz not null default now(),
  primary key(user_id,anime_id,studio)
);
create index if not exists komi_voice_follows_anime on public.komi_voice_follows(anime_id);
alter table public.komi_voice_follows enable row level security;
revoke all on public.komi_voice_follows from public,anon,authenticated;
grant select,insert,delete on public.komi_voice_follows to authenticated;
create policy "voice own read" on public.komi_voice_follows for select to authenticated using(user_id=(select auth.uid()));
create policy "voice own insert" on public.komi_voice_follows for insert to authenticated with check(user_id=(select auth.uid()));
create policy "voice own delete" on public.komi_voice_follows for delete to authenticated using(user_id=(select auth.uid()));
create or replace function komi_private.notify_new_voice()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare old_count integer; new_count integer; title_text text;
begin
 if new.data is not distinct from old.data then return new; end if;
 old_count:=case when jsonb_typeof(old.data->'episodes')='array' then jsonb_array_length(old.data->'episodes') else 0 end;
 new_count:=case when jsonb_typeof(new.data->'episodes')='array' then jsonb_array_length(new.data->'episodes') else 0 end;
 if old_count<1 or new_count<old_count or new_count>old_count+3 then return new; end if;
 title_text:=left(coalesce(nullif(new.data->>'title',''),'Аниме'),90);
 insert into public.komi_notifications(recipient_id,actor_id,kind,message)
 select f.user_id,null,'system','Новая серия «'||title_text||'» в озвучке '||left(f.studio,72)||'.'
 from public.komi_voice_follows f
 where f.anime_id=new.shikimori_id
   and exists(
     select 1
     from jsonb_array_elements(new.data->'episodes') with ordinality as ep(value,ordinal)
     cross join lateral jsonb_object_keys(
       case when jsonb_typeof(ep.value->'sources')='object' then ep.value->'sources' else '{}'::jsonb end
     ) as src(key)
     where lower(split_part(regexp_replace(src.key,'^Озвучка[[:space:]]+','','i'),' (',1))=lower(btrim(f.studio))
       and nullif(ep.value->'sources'->>src.key,'') is not null
       and not coalesce((
         case when jsonb_typeof(old.data->'episodes'->(ep.ordinal-1)->'sources')='object'
              then old.data->'episodes'->(ep.ordinal-1)->'sources' else '{}'::jsonb end
       ) ? src.key,false)
   );
 return new;
end $fn$;
revoke all on function komi_private.notify_new_voice() from public,anon,authenticated;
create trigger trg_komi_new_voice_follow after update of data on public.anime_catalog
 for each row execute function komi_private.notify_new_voice();

create table if not exists komi_private.referral_codes (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check(length(code) between 12 and 40),
  created_at timestamptz not null default now()
);
create table if not exists komi_private.referrals (
  invitee_id uuid primary key references auth.users(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check(invitee_id<>inviter_id)
);
create index if not exists komi_referrals_inviter on komi_private.referrals(inviter_id);
alter table komi_private.referral_codes enable row level security;
alter table komi_private.referrals enable row level security;
revoke all on komi_private.referral_codes,komi_private.referrals from public,anon,authenticated;
alter table public.komi_anicoin_ledger drop constraint if exists komi_anicoin_ledger_reason_check;
alter table public.komi_anicoin_ledger add constraint komi_anicoin_ledger_reason_check
 check(reason in ('watch','premium_welcome','quest_daily','referral'));
create or replace function public.komi_referral(p_action text default 'status',p_code text default null)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare actor uuid:=auth.uid(); own_code text; inviter uuid; v_ref komi_private.referrals%rowtype;
 ep_count integer; watch_pulses integer; just_rewarded boolean:=false;
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor and u.deleted_at is null and u.is_anonymous is not true)
 then raise exception 'Verified account required' using errcode='42501'; end if;
 if p_action not in ('status','claim','verify') then raise exception 'Invalid action' using errcode='22023'; end if;
 insert into komi_private.referral_codes(owner_id,code)
 values(actor,replace(gen_random_uuid()::text,'-','')) on conflict(owner_id) do nothing;
 select c.code into own_code from komi_private.referral_codes c where c.owner_id=actor;
 if p_action='claim' then
   if not (p_code ~ '^[a-f0-9]{32}$') then raise exception 'Invalid referral code' using errcode='22023'; end if;
   select c.owner_id into inviter from komi_private.referral_codes c where c.code=p_code;
   if inviter is null or inviter=actor then raise exception 'Invalid referral' using errcode='22023'; end if;
   if not exists(select 1 from auth.users u where u.id=actor and u.created_at>=timestamptz '2026-11-20 00:00:00+00' and u.created_at>=now()-interval '24 hours')
   then raise exception 'Only new accounts may use an invitation' using errcode='22023'; end if;
   insert into komi_private.referrals(invitee_id,inviter_id) values(actor,inviter) on conflict(invitee_id) do nothing;
 end if;
 select * into v_ref from komi_private.referrals where invitee_id=actor for update;
 if p_action='verify' and v_ref.invitee_id is not null and v_ref.rewarded_at is null then
   select count(distinct (anime_id,season,episode_index))::integer into ep_count
   from public.komi_watched_episodes where user_id=actor and watched_at>=v_ref.joined_at;
   select count(*)::integer into watch_pulses from public.komi_anicoin_ledger
   where user_id=actor and reason='watch' and created_at>=v_ref.joined_at;
   if ep_count>=3 and watch_pulses>=3 then
     update komi_private.referrals set rewarded_at=now() where invitee_id=actor and rewarded_at is null;
     if found then
       insert into public.komi_anicoin_wallets(user_id,balance)
          select member,50 from (values(actor),(v_ref.inviter_id)) as members(member)
          on conflict(user_id) do update set balance=public.komi_anicoin_wallets.balance+excluded.balance;
       insert into public.komi_anicoin_ledger(user_id,delta,reason)
          values(actor,50,'referral'),(v_ref.inviter_id,50,'referral');
       just_rewarded:=true;
     end if;
   end if;
 end if;
 select * into v_ref from komi_private.referrals where invitee_id=actor;
 return jsonb_build_object(
   'code',own_code,'invited',v_ref.invitee_id is not null,
   'rewarded',v_ref.rewarded_at is not null,'awarded_now',just_rewarded,
   'invite_count',(select count(*) from komi_private.referrals r where r.inviter_id=actor and r.rewarded_at is not null),
   'required_episodes',3,'required_watch_pulses',3
 );
end $fn$;
revoke all on function public.komi_referral(text,text) from public,anon,authenticated;
grant execute on function public.komi_referral(text,text) to authenticated;

-- Curated audio tracks must be owned or explicitly licensed before enabling quiz playback.
create table if not exists public.komi_opening_tracks (
  id bigint generated always as identity primary key,
  anime_id bigint not null references public.anime_catalog(shikimori_id) on delete cascade,
  title text not null check(length(title) between 2 and 100),
  audio_url text not null check(audio_url ~ '^https://'),
  license_note text not null check(length(license_note) between 10 and 500),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.komi_opening_tracks enable row level security;
revoke all on public.komi_opening_tracks from public,anon,authenticated;
grant select on public.komi_opening_tracks to authenticated;
create policy "licensed quiz tracks read" on public.komi_opening_tracks
 for select to authenticated using(enabled and length(license_note)>=10);
comment on table public.komi_opening_tracks is 'No tracks added by the migration; curator must verify the audio license and publish explicitly.';
