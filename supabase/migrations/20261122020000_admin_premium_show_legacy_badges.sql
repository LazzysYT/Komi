-- Include legacy owner-issued badges in the admin Premium search status.
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
     greatest(m.paid_until,b.active_until) as premium_until,
     case when greatest(m.paid_until,b.active_until)>now() then true else false end as is_premium,
     case when lower(coalesce(p.username,''))=v_q then 0
          when lower(coalesce(u.email,''))=v_q then 1 else 2 end as rank
   from auth.users u
   left join public.komi_profiles p on p.user_id=u.id
   left join public.komi_premium_badges b on b.user_id=u.id and b.active_until>now()
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
