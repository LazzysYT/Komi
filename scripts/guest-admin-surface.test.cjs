const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app-main.js'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'komi-admin-ui.js'), 'utf8');

test('guest HTML contains no admin editor or admin action buttons', () => {
  assert.doesNotMatch(html, /id="(?:animeForm|addAnimeBtn|adminPanelBtn|adminModal|addModal|komiAdminAnimeModalTemplate)"/);
  assert.match(html, /id="anime-grid"/);
  assert.match(html, /id="komiHomeQuickFiltersTitle"/);
});
test('admin controls and editor are mounted only behind the checked Supabase role', () => {
  assert.match(app, /_supabase\.rpc\('komi_is_admin'\)/);
  assert.match(app, /requireServerAdmin\(\)\) \|\| !\(await komiEnsureAdminUI\(\)/);
  assert.match(app, /script\.src = '\/komi-admin-ui\.js'/);
  assert.match(editor, /id=\\"animeForm\\"/);
  assert.match(app, /button\?\.remove\(\)/);
});
test('anonymous users do not see notification UI or misleading registration copy', () => {
  assert.match(html, /:not\(\.komi-authenticated\) #notifBellBtn/);
  assert.doesNotMatch(html, /Email для безопасной регистрации/);
});
