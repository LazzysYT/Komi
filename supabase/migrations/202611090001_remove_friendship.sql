begin;
create function public.komi_remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from public.komi_friendships
  where (user_a = caller_id and user_b = p_friend_id)
     or (user_b = caller_id and user_a = p_friend_id);
end;
$$;
revoke all on function public.komi_remove_friend(uuid) from public, anon;
grant execute on function public.komi_remove_friend(uuid) to authenticated;
commit;
