// Only run credential-bearing E2E against an explicit, reviewed Komi URL.
function validateE2EUrl(input) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) throw new Error('KOMI_TEST_URL is required. Set repository variable to the reviewed Preview URL.');
  let target;
  try { target = new URL(value); }
  catch { throw new Error('KOMI_TEST_URL must be a valid absolute HTTPS URL.'); }
  const knownOrigin = target.hostname === 'komianime.online' ||
    /^komi-[a-z0-9]+-ukiyo6\.vercel\.app$/.test(target.hostname);
  if (target.protocol !== 'https:' || !knownOrigin || target.username || target.password ||
      target.port || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('KOMI_TEST_URL must be exactly the trusted production or reviewed Ukiyo Komi Preview origin.');
  }
  return target.origin + '/';
}
module.exports={validateE2EUrl};
