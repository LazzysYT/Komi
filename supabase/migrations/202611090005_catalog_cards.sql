-- Additive, read-only card projection. Full episodes and source URLs remain only in anime_catalog.
create or replace view public.komi_catalog_cards
with (security_invoker = true)
as
select
  shikimori_id,
  (
    data - 'episodes' - 'screenshots' - 'desc' - 'trailer' - 'ratings'
  ) || jsonb_build_object(
    'episodeCount',
    case when jsonb_typeof(data->'episodes') = 'array'
      then jsonb_array_length(data->'episodes')
      else 0 end,
    'syncStatus', sync_status
  ) as data,
  updated_at
from public.anime_catalog;

revoke all on public.komi_catalog_cards from public, anon, authenticated;
grant select on public.komi_catalog_cards to anon, authenticated;
