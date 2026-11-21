-- Gifts use Premium contracts so paid webhook reconciliation remains intact.
create table if not exists public.komi_admin_premium_grants (
 contract_id text primary key references public.komi_premium_contracts(contract_id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 granted_by uuid not null references auth.users(id),
 valid_days integer not null check(valid_days between 1 and 3650),
 note text check(note is null or char_length(note)<=160),
 granted_at timestamptz not null default now(),
 revoked_by uuid references auth.users(id),
 revoked_at timestamptz,
 legacy_until timestamptz,
 constraint komi_admin_premium_revoke_pair check ((revoked_by is null)=(revoked_at is null))
);
create index if not exists komi_admin_premium_grants_user_idx on public.komi_admin_premium_grants(user_id,granted_at desc);
alter table public.komi_admin_premium_grants enable row level security;
revoke all on public.komi_admin_premium_grants from public,anon,authenticated;
grant all on public.komi_admin_premium_grants to service_role;

CREATE OR REPLACE FUNCTION public.komi_admin_premium_grant(p_user_id uuid, p_days integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=auth.uid(); v_email text; v_until timestamptz;
        v_contract text; v_legacy_until timestamptz; v_note text:=nullif(btrim(p_note),'');
begin
 if v_actor is null or not exists(
   select 1 from public.komi_admin_members where user_id=v_actor
 ) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_user_id is null or p_days is null or p_days not in (7,30,90,365,3650)
   or length(coalesce(v_note,''))>160
 then raise exception 'Invalid Premium grant' using errcode='22023'; end if;
 select u.email into v_email from auth.users u
   where u.id=p_user_id and u.deleted_at is null and u.is_anonymous is not true;
 if not found then raise exception 'Registered user not found' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text));
 select greatest(now(),coalesce(max(c.paid_until),now())) + make_interval(days=>p_days)
   into v_until from public.komi_premium_contracts c
   where c.user_id=p_user_id and c.revoked_at is null and c.paid_until>now();
 select b.active_until into v_legacy_until from public.komi_premium_badges b
   where b.user_id=p_user_id and b.active_until>now() and not exists(
    select 1 from public.komi_premium_contracts c
    where c.user_id=p_user_id and c.revoked_at is null and c.paid_until>now());
 v_contract:='admin-'||gen_random_uuid()::text;
 insert into public.komi_premium_contracts
   (contract_id,user_id,buyer_email,offer_id,paid_until,last_event_at)
 values(v_contract,p_user_id,coalesce(nullif(lower(v_email),''),'admin-issued@komianime.invalid'),
   'komi-admin-gift',v_until,now());
 insert into public.komi_admin_premium_grants(contract_id,user_id,granted_by,valid_days,note,legacy_until)
   values(v_contract,p_user_id,v_actor,p_days,v_note,v_legacy_until);
 insert into public.komi_premium_badges(user_id,active_until)
   values(p_user_id,v_until)
   on conflict(user_id) do update set
     active_until=greatest(public.komi_premium_badges.active_until,excluded.active_until),
     updated_at=now();
 return jsonb_build_object('contract_id',v_contract,'user_id',p_user_id,'active_until',v_until);
end $function$
;
revoke all on function public.komi_admin_premium_grant(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.komi_admin_premium_grant(uuid,integer,text) to authenticated;

CREATE OR REPLACE FUNCTION public.komi_admin_premium_history()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists(
  select 1 from public.komi_admin_members a where a.user_id=auth.uid()
 ) then raise exception 'Access denied' using errcode='42501'; end if;
 return coalesce((
  select jsonb_agg(to_jsonb(x) order by x.granted_at desc) from (
    select g.contract_id,g.user_id,g.valid_days,g.note,g.granted_at,g.revoked_at,
      c.paid_until as granted_until,
      coalesce(nullif(p.username,''),split_part(coalesce(u.email,''),'@',1),'Без ника') as username,
      coalesce(nullif(p.display_name,''),nullif(p.username,''),'Пользователь') as display_name,
      m.paid_until as premium_until,
      g.granted_by, g.revoked_by
    from public.komi_admin_premium_grants g
    join public.komi_premium_contracts c on c.contract_id=g.contract_id
    left join public.komi_profiles p on p.user_id=g.user_id
    left join auth.users u on u.id=g.user_id
    left join lateral (
      select max(cc.paid_until) as paid_until
      from public.komi_premium_contracts cc
      where cc.user_id=g.user_id and cc.revoked_at is null and cc.paid_until>now()
    ) m on true
    order by g.granted_at desc limit 150
  ) x
 ),'[]'::jsonb);
end $function$
;
revoke all on function public.komi_admin_premium_history() from public,anon,authenticated;
grant execute on function public.komi_admin_premium_history() to authenticated;

CREATE OR REPLACE FUNCTION public.komi_admin_premium_revoke(p_contract_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=auth.uid(); v_user uuid; v_revoked timestamptz;
        v_until timestamptz;
begin
 if v_actor is null or not exists(
   select 1 from public.komi_admin_members where user_id=v_actor
 ) then raise exception 'Access denied' using errcode='42501'; end if;
 select g.user_id,g.revoked_at into v_user,v_revoked
 from public.komi_admin_premium_grants g
 where g.contract_id=p_contract_id for update;
 if not found then raise exception 'Gift not found' using errcode='22023'; end if;
 if v_revoked is not null then raise exception 'Already revoked' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text));
 update public.komi_admin_premium_grants set revoked_at=now(),revoked_by=v_actor
   where contract_id=p_contract_id;
 update public.komi_premium_contracts set revoked_at=now(),paid_until=least(paid_until,now())
   where contract_id=p_contract_id and offer_id='komi-admin-gift';
 select greatest(
   (select max(c.paid_until) from public.komi_premium_contracts c
     where c.user_id=v_user and c.revoked_at is null and c.paid_until>now()),
   (select max(g.legacy_until) from public.komi_admin_premium_grants g
     where g.user_id=v_user and g.legacy_until>now())
 ) into v_until;
 if v_until is null then
   delete from public.komi_premium_badges where user_id=v_user;
 else
   insert into public.komi_premium_badges(user_id,active_until)
     values(v_user,v_until) on conflict(user_id) do update
     set active_until=excluded.active_until,updated_at=now();
 end if;
 return jsonb_build_object('user_id',v_user,'active_until',v_until);
end $function$
;
revoke all on function public.komi_admin_premium_revoke(text) from public,anon,authenticated;
grant execute on function public.komi_admin_premium_revoke(text) to authenticated;

CREATE OR REPLACE FUNCTION public.komi_admin_premium_search(p_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_q text := lower(btrim(coalesce(p_query,'')));
begin
 if auth.uid() is null or not exists(
  select 1 from public.komi_admin_members a where a.user_id=auth.uid()
 ) then raise exception 'Access denied' using errcode='42501'; end if;
 if length(v_q)<2 then return '[]'::jsonb; end if;
 return coalesce((
  select jsonb_agg(to_jsonb(x) order by x.rank,x.username)
  from (
   select u.id as user_id,
     coalesce(nullif(p.username,''),split_part(coalesce(u.email,''),'@',1),'Без ника') as username,
     coalesce(nullif(p.display_name,''),nullif(p.username,''),'Пользователь') as display_name,
     u.email,
     m.paid_until as premium_until,
     case when m.paid_until>now() then true else false end as is_premium,
     case when lower(coalesce(p.username,''))=v_q then 0
          when lower(coalesce(u.email,''))=v_q then 1 else 2 end as rank
   from auth.users u
   left join public.komi_profiles p on p.user_id=u.id
   left join lateral (
     select max(c.paid_until) as paid_until
     from public.komi_premium_contracts c
     where c.user_id=u.id and c.revoked_at is null and c.paid_until>now()
   ) m on true
   where u.deleted_at is null and u.is_anonymous is not true
     and (strpos(lower(coalesce(p.username,'')),v_q)>0
       or strpos(lower(coalesce(p.display_name,'')),v_q)>0
       or strpos(lower(coalesce(u.email,'')),v_q)>0
       or u.id::text=v_q)
   order by rank,username,u.id
   limit 30
  ) x
 ),'[]'::jsonb);
end $function$
;
revoke all on function public.komi_admin_premium_search(text) from public,anon,authenticated;
grant execute on function public.komi_admin_premium_search(text) to authenticated;
