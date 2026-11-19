const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20261119230000_fix_premium_identity_rls_expiry_check.sql'),
  'utf8'
);
const statements = migration.replace(/^\\s*--.*$/gm, '');
const initial = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20261119202000_premium_profile_identity.sql'),
  'utf8'
);

test('Premium identity RLS uses only public badge user_id, never private expiry column', () => {
  const policies = [
    'Active Premium identity visible to community',
    'Active Premium can create own identity',
    'Active Premium can edit own identity',
    'Active Premium cosmetics public display'
  ];
  for (const name of policies) {
    assert.ok(migration.includes('alter policy "' + name + '"'), 'Missing policy: ' + name);
  }
  assert.doesNotMatch(migration, /\bb\.active_until\b|\bselect\s+\*\s+from\s+public\.komi_premium_badges/i);
  assert.match(migration, /exists\s*\(\s*select 1 from public\.komi_premium_badges b/i);
  assert.match(migration, /user_id\s*=\s*\(select auth\.uid\(\)\)/i);
});

test('Expiry remains enforced by badge SELECT RLS, not by browser grants', () => {
  assert.match(initial, /b\.active_until\s*>\s*now\(\)/i);
  assert.doesNotMatch(migration, /\bgrant\s+(?:all|select|insert|update|delete)\b/i);
  assert.doesNotMatch(migration, /\b(?:drop policy|disable row level security)\b/i);
  assert.doesNotMatch(migration, /\b(?:komi_premium_events|komi_premium_contracts|lava|webhook|anicoin_wallets)\b/i);
});
