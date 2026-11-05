-- Server-side friend request transitions. Requires a Supabase Auth session.
-- SECURITY DEFINER is intentional; no dynamic SQL, explicit auth.uid() ownership checks.
create or replace function public.komi_respond_friend_request(p_request_id bigint, p_accept boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_sender uuid; v_receiver uuid;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select sender_id,receiver_id into v_sender,v_receiver
  from public.komi_friend_requests
  where id=p_request_id and receiver_id=v_uid and status='pending' for update;
  if not found then return false; end if;
  update public.komi_friend_requests
  set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now()
  where id=p_request_id and receiver_id=v_uid and status='pending';
  if p_accept then
    insert into public.komi_friendships(user_a,user_b)
    values(least(v_sender,v_receiver),greatest(v_sender,v_receiver))
    on conflict(user_a,user_b) do nothing;
    insert into public.komi_notifications(recipient_id,actor_id,kind,message)
    values(v_sender,v_receiver,'friend_accepted','Ваш запрос в друзья принят');
  end if;
  return true;
end; $$;
revoke all on function public.komi_respond_friend_request(bigint,boolean) from public,anon;
grant execute on function public.komi_respond_friend_request(bigint,boolean) to authenticated;
create or replace function public.komi_cancel_friend_request(p_request_id bigint)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.komi_friend_requests set status='declined',responded_at=now()
  where id=p_request_id and sender_id=v_uid and status='pending';
  return found;
end; $$;
revoke all on function public.komi_cancel_friend_request(bigint) from public,anon;
grant execute on function public.komi_cancel_friend_request(bigint) to authenticated;
