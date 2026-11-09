insert into public.komi_profiles (user_id, username, display_name, created_at)
select id, 'google_' || replace(id::text, '-', ''),
       left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), 'Пользователь Komi'), 40),
       created_at
from auth.users
where raw_app_meta_data->>'provider' = 'google'
on conflict do nothing;
