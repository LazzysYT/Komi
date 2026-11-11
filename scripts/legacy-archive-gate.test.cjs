const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261111160803_close_legacy_archive_and_mark_notifications_read.sql'), 'utf8');

test('public browser client does not query the legacy animes table', () => {
  assert.doesNotMatch(html, /\.from\s*\(\s*['"`]animes['"`]\s*\)/i);
});

test('legacy archive migration verifies the preserved snapshot before revoking access', () => {
  assert.match(migration, /lock\s+table\s+public\.animes/i);
  assert.match(migration, /legacy_animes_snapshot_20261110/i);
  assert.match(migration, /archived\.content\s+is\s+distinct\s+from\s+live\.content/i);
  assert.match(migration, /raise\s+exception/i);
  assert.match(migration, /revoke\s+all\s+on\s+table\s+public\.animes\s+from\s+public,\s*anon,\s*authenticated/i);
  assert.doesNotMatch(migration, /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?animes\b/i);
});

test('notification write access is limited to the read timestamp', () => {
  assert.match(migration, /revoke\s+update\s+on\s+table\s+public\.komi_notifications\s+from\s+public,\s*anon,\s*authenticated/i);
  assert.match(migration, /grant\s+update\s*\(\s*read_at\s*\)\s+on\s+table\s+public\.komi_notifications\s+to\s+authenticated/i);
});
