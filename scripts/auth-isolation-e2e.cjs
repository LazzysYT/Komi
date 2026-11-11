// Run with two dedicated, disposable Supabase Auth accounts.
// KOMI_TEST_EMAIL_A / KOMI_TEST_PASSWORD_A / KOMI_TEST_EMAIL_B / KOMI_TEST_PASSWORD_B
// This test never creates users or migrates legacy accounts.
const { chromium } = require('playwright');
const BASE = process.env.KOMI_TEST_URL || 'https://komi-six.vercel.app/';
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
    if (visibility.readError || visibility.updateError || visibility.progressError)
      throw Error('Could not verify cross-account RLS: '+JSON.stringify(visibility));
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
    // Notifications must never be readable across confirmed Auth identities.
    const notificationIsolation = await Promise.all([
      a.page.evaluate(async () => {
        const {data,error} = await _supabase.from('komi_notifications')
          .select('id').eq('recipient_id', currentUser.authUserId).limit(2);
        await loadAccountNotifications();
        return {error:error?.message || null, count:data?.length, owner:accountNotifications.owner};
      }),
      b.page.evaluate(async uid => {
        const {data,error} = await _supabase.from('komi_notifications')
          .select('id').eq('recipient_id',uid).limit(2);
        return {error:error?.message || null, count:data?.length};
      }, a.uid)
    ]);
    if (notificationIsolation[0].error || notificationIsolation[0].owner !== a.uid ||
        notificationIsolation[1].count !== 0 || notificationIsolation[1].error) {
      throw Error('Notification Auth isolation failed: '+JSON.stringify(notificationIsolation));
    }

    // Exercise the site's actual logout and email login form in the same browser context.
    // Account A remains signed in in the other browser, so cleanup is never lost.
    const afterLogout = await b.page.evaluate(async () => {
      await logoutUser();
      const {data:{session}} = await _supabase.auth.getSession();
      return {uid:currentUser?.authUserId ?? null, session:session?.user?.id ?? null,
        notificationOwner:accountNotifications.owner};
    });
    if (afterLogout.uid || afterLogout.session || afterLogout.notificationOwner) {
      throw Error('Logout retained previous account state: '+JSON.stringify(afterLogout));
    }
    await b.page.evaluate(() => openAuthModal('login'));
    await b.page.locator('#loginUsername').fill(process.env.KOMI_TEST_EMAIL_A);
    await b.page.locator('#loginPassword').fill(process.env.KOMI_TEST_PASSWORD_A);
    b.page.on('dialog', dialog => dialog.dismiss());
    await b.page.locator('#loginFormContainer').evaluate(form => form.requestSubmit());
    await b.page.waitForFunction(expected => currentUser?.authUserId === expected, a.uid,
      {timeout:30000});
    const switchedAccount = await b.page.evaluate(async () => {
      await loadAccountNotifications();
      return {uid:currentUser?.authUserId, notificationOwner:accountNotifications.owner,
        visibleProfile:currentUser?.username};
    });
    if (switchedAccount.uid !== a.uid || switchedAccount.notificationOwner !== a.uid) {
      throw Error('Email sign-in after logout mixed account state: '+JSON.stringify(switchedAccount));
    }
    results.push('PASS real email login/logout/switch, notification isolation, owner-only RLS, and saved progress after reload');
  } finally {
    if (contexts[0]) {
      const page = contexts[0].pages()[0];
      if (page && !page.isClosed()) {
        const cleanup = await page.evaluate(async id => {
          const { data: { user }, error: authError } = await _supabase.auth.getUser();
          if (authError || !user?.id) return authError?.message || 'Test owner session unavailable';
          const progress = await _supabase.from('komi_watch_progress')
            .delete().eq('anime_id',id).eq('user_id',user.id);
          const { error } = await _supabase.from('komi_anime_lists')
            .delete().eq('anime_id',id).eq('user_id',user.id);
          if (progress.error || error) return progress.error?.message || error.message;
          const [remainingProgress, remainingList] = await Promise.all([
            _supabase.from('komi_watch_progress').select('anime_id').eq('anime_id',id).eq('user_id',user.id),
            _supabase.from('komi_anime_lists').select('anime_id').eq('anime_id',id).eq('user_id',user.id)
          ]);
          if (remainingProgress.error || remainingList.error)
            return remainingProgress.error?.message || remainingList.error?.message;
          if (remainingProgress.data?.length || remainingList.data?.length)
            return 'Test records remain after cleanup';
          return null;
        }, animeId).catch(e=>e.message);
        if (cleanup) {
          console.error('Test record cleanup failed:',cleanup);
          process.exitCode = 1;
        }
      }
    }
    await browser.close();
  }
  if (!process.exitCode) console.log(results.join('\n'));
})().catch(e => {console.error(e.message);process.exitCode=1;});
