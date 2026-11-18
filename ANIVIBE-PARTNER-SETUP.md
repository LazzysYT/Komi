# AniVibe Partner API — KomiAnime server-side integration

Verified 18 November 2026: \`ANIVIBE_API_KEY\` exists as a **sensitive Production** Vercel variable. Its plaintext value must never appear in GitHub, client JS, logs or chats.

## Current status

- \`GET /api/anivibe?check=1\` is a bounded diagnostic: calls the partner profile endpoint and looks up Shikimori ID 52991 on the Vercel server. It returns only normalized states; no account data, credentials or video links.
- \`POST /api/anivibe\` is **OFF by default** and requires an additional \`ANIVIBE_PARTNER_EMBED_ENABLED=true\` Production environment variable. Do not set it until the partner confirms that embedded playback on komianime.online is permitted and whether guest embeds show pre-rolls, overlays or other advertisements. The normal ad-free-only player mode does not treat AniVibe as certified.
- The handler never accepts external upstream hosts. Embeds require an exact matching Origin and official AniVibe HTTPS URL, plus basic per-instance throttling.
- Existing KomiAnime episodes, source labels, saved watch states and Supabase tables are not changed.
- The API gives partners **temporary signed iframe URLs**, not direct HLS/MP4 links, per https://anivibe.pro/developers. Therefore it cannot be inserted as a permanent \`episodes[].sources\` value by the background bot.
- Partner limits: 20 token requests/minute, 1000/day per public docs. A production launch should add a shared durable per-user limiter (e.g. Supabase RLS-backed quota or provider-mediated quota) and fetch tokens only on viewer actions. Per-instance throttling is not a distributed quota.

## Production readiness checklist

1. Confirm the partner origin is \`https://komianime.online\` in https://anivibe.pro/partner?tab=account.
2. Verify Vercel \`ANIVIBE_API_KEY\` is set only to server Production.
3. Use read-only \`GET /api/anivibe?check=1\` once to verify auth and a sample known anime.
4. Get written confirmation from AniVibe about partner embed advertising, Russian audio, rights and country restrictions.
5. Only after confirmation, add a server-validated metadata matcher, auditable episode availability checks and a single optional iframe player option; never assert that unverified content is ad-free.
6. Set \`ANIVIBE_PARTNER_EMBED_ENABLED=true\` only after separate security/rate-limit review and production smoke tests.

AniVibe has publicly stated that signed-in users receive ad-free playback **except Kodik**, while some public anime pages still show «Реклама перед серией». That is not a guarantee that anonymous partner embeds are ad-free.
