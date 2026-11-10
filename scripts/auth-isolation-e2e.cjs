// Run with two dedicated, disposable Supabase Auth accounts.
// KOMI_TEST_EMAIL_A / KOMI_TEST_PASSWORD_A / KOMI_TEST_EMAIL_B / KOMI_TEST_PASSWORD_B
// This test never creates users or migrates legacy accounts.
const { chromium } = require('playwright');
const {validateE2EUrl}=require('./auth-e2e-target.cjs');
let BASE;
try { BASE=validateE2EUrl(process.env.KOMI_TEST_URL); }
catch(error) { console.error(error.message); process.exit(2); }
const required = ['KOMI_TEST_EMAIL_A','KOMI_TEST_PASSWORD_A','KOMI_TEST_EMAIL_B','KOMI_TEST_PASSWORD_B'];
for (const key of required) {
  if (!process.env[key]) { console.error('Missing test secret:', key); process.exit(2); }
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const contexts = [];
  // Reserve an anime ID that must not appear in the real catalog.
  const animeId = 9223372036854770000n.toString();
  const results = [];
  async function openAccount(suffix) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(BASE, {waitUntil:'domcontentloaded',timeout:60000});
    if (!response?.ok()) throw Error('Site HTTP status ' + response?.status());
    await page.waitForFunction(() => typeof _supabase !== 'undefined' && !!_supabase, {timeout:20000});
    const auth = await page.evaluate(async ({email,password}) => {
      const {data,error} = await _supabase.auth.signInWithPassword({email,password});
      if (error) return {error:error.message};
      await restoreGoogleSession();
      return {uid:data.user.id,profile:currentUser?.username};
    }, {email:process.env['KOMI_TEST_EMAIL_'+suffix],password:process.env['KOMI_TEST_PASSWORD_'+suffix]});
    if (auth.error || !auth.uid || !auth.profile) throw Error('Auth '+suffix+': '+JSON.stringify(auth));
    if (errors.length) throw Error('Browser errors: '+errors.join('; '));
    return {page,uid:auth.uid};
  }
  try {
    const a = await openAccount('A');
    const b = await openAccount('B');
    if (a.uid === b.uid) throw Error('Two test accounts must have distinct Supabase IDs');
    // Check owner-only RLS without changing real users' records.
    const owner = await a.page.evaluate(async id => {
      const {error} = await _supabase.from('komi_anime_lists').insert({
        user_id:currentUser.authUserId, anime_id:id, status:'В планах'
      });
      return {error:error?.message || null};
    }, animeId);
    if (owner.error) throw Error('Owner insert failed: '+owner.error);
    const progressInsert = await a.page.evaluate(async id => {
      const {error} = await _supabase.from('komi_watch_progress').insert({
        user_id:currentUser.authUserId,anime_id:id,season:1,episode_index:3,
        position_seconds:45,duration_seconds:1400
      });
      return error?.message || null;
    }, animeId);
    if (progressInsert) throw Error('Progress insert failed: '+progressInsert);
    const visibility = await b.page.evaluate(async ({id,uid}) => {
      const read = await _supabase.from('komi_anime_lists').select('status')
        .eq('user_id',uid).eq('anime_id',id);
      const update = await _supabase.from('komi_anime_lists')
        .update({status:'Просмотрено'}).eq('user_id',uid).eq('anime_id',id).select();
      const progress = await _supabase.from('komi_watch_progress').select('position_seconds')
        .eq('user_id',uid).eq('anime_id',id);
      return {readCount:read.data?.length,readError:read.error?.message,
        updatedCount:update.data?.length,updateError:update.error?.message,
        progressCount:progress.data?.length,progressError:progress.error?.message};
    }, {id:animeId,uid:a.uid});
    if (visibility.readCount !== 0 || visibility.updatedCount !== 0 || visibility.progressCount !== 0)
      throw Error('Cross-account data access detected: '+JSON.stringify(visibility));
    await a.page.reload({waitUntil:'domcontentloaded'});
    await a.page.waitForFunction(() => typeof _supabase !== 'undefined' && !!_supabase);
    const restored = await a.page.evaluate(async id => {
      const {data,error} = await _supabase.from('komi_anime_lists')
        .select('status').eq('anime_id',id).single();
      return {status:data?.status,error:error?.message};
    }, animeId);
    if (restored.status !== 'В планах') throw Error('List did not survive reload: '+JSON.stringify(restored));
    const progressRestored = await a.page.evaluate(async id => {
      const {data,error} = await _supabase.from('komi_watch_progress')
        .select('episode_index,position_seconds').eq('anime_id',id).single();
      return {data,error:error?.message};
    }, animeId);
    if (progressRestored.data?.episode_index !== 3 || Number(progressRestored.data?.position_seconds) !== 45)
      throw Error('Progress did not survive reload: '+JSON.stringify(progressRestored));
    results.push('PASS two real email sessions, list/progress cross-account RLS, persistence after reload');
    console.log(results.join('\n'));
  } finally {
    if (contexts[0]) {
      const page = contexts[0].pages()[0];
      if (page && !page.isClosed()) {
        const cleanup = await page.evaluate(async id => {
          const uid = (await _supabase.auth.getUser()).data.user?.id;
          const progress = await _supabase.from('komi_watch_progress').delete().eq('anime_id',id).eq('user_id',uid);
          const {error} = await _supabase.from('komi_anime_lists')
            .delete().eq('anime_id',id).eq('user_id',(await _supabase.auth.getUser()).data.user?.id);
          return progress.error?.message || error?.message || null;
        }, animeId).catch(e=>e.message);
        if (cleanup) console.error('Test record cleanup failed:',cleanup);
      }
    }
    await browser.close();
  }
})().catch(e => {console.error(e.message);process.exitCode=1;});
