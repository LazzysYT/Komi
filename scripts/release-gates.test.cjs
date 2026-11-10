const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const expand = fs.readFileSync(path.join(root,
  'supabase/migrations/20261110105211_secure_presence_and_legacy_archive.sql'), 'utf8');
const restrict = fs.readFileSync(path.join(root,
  'supabase/manual-release/phase1-restrict.sql'), 'utf8');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('expansion can run while old production still uses legacy tables', () => {
  assert.match(expand, /create or replace function public\.komi_site_presence\(/i);
  assert.match(expand, /legacy_animes_snapshot_20261110/i);
  assert.doesNotMatch(expand, /alter table public\.(animes|online_users) enable row level security/i);
  assert.doesNotMatch(expand, /revoke all privileges on table public\.(animes|online_users)/i);
  assert.match(expand, /revoke all on schema komi_private from public, anon, authenticated/i);
});

test('legacy lockdown is a separate, explicitly gated release step', () => {
  assert.match(restrict, /APPLY ONLY AFTER/i);
  assert.match(restrict, /to_regprocedure\('public\.komi_site_presence\(uuid\)'\)/i);
  assert.match(restrict, /alter table public\.animes enable row level security/i);
  assert.match(restrict, /alter table public\.online_users enable row level security/i);
  assert.match(restrict, /revoke all privileges on table public\.animes from public, anon, authenticated/i);
  assert.match(restrict, /drop policy if exists "Komi public avatar uploads"/i);
});

test('the new client uses private presence RPC, not the old sessions table', () => {
  assert.match(page, /\.rpc\('komi_site_presence'/);
  assert.doesNotMatch(page, /\.from\('online_users'\)/);
  assert.match(page, /\.from\('animes'\)\.select\('id,content'\)\.in\('id', \[2, 4\]\)/);
});

test('the applied migration version has exactly one file in GitHub', () => {
  const filenames = fs.readdirSync(path.join(root, 'supabase/migrations'))
    .filter(name => name.endsWith('_secure_presence_and_legacy_archive.sql'));
  assert.deepEqual(filenames, ['20261110105211_secure_presence_and_legacy_archive.sql']);
});
