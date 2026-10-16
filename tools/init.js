#!/usr/bin/env node
// Einrichtungs-Check für eine neue Umgebung: node tools/init.js
// Prüft config.js und gibt aus, was in Supabase noch zu tun ist. Verbindet sich nicht und schreibt nichts.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const win = {}; vm.runInNewContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), { window: win });
const c = win.APP_CONFIG || {};
const problems = [];
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(c.SUPABASE_URL || '')) problems.push('SUPABASE_URL fehlt oder ist ungültig');
if (!c.SUPABASE_ANON_KEY) problems.push('SUPABASE_ANON_KEY fehlt (nur den Anon-/Publishable-Key, nie service_role!)');
if (!c.EMAIL_DOMAIN) problems.push('EMAIL_DOMAIN fehlt');
if (c.TABLE_PREFIX !== 'lata-' || c.FUNCTION_PREFIX !== 'lata_') problems.push("Präfixe müssen 'lata-' und 'lata_' sein");
if (problems.length) { problems.forEach((p) => console.error('FEHLER  ' + p)); process.exit(1); }

console.log(`Umgebung: ${c.SUPABASE_URL}\nEMAIL_DOMAIN: ${c.EMAIL_DOMAIN}\n`);
console.log('Einrichtung in dieser Reihenfolge:');
console.log('  1. Supabase → Authentication: «Confirm email» aus, «Allow new users to sign up» aus.');
console.log('  2. supabase/schema_lata.sql im SQL-Editor ausführen (idempotent).');
console.log(`  3. Prüfen, dass lata-app_settings.email_domain = '${c.EMAIL_DOMAIN}' ist:`);
console.log(`       select value from public."lata-app_settings" where key = 'email_domain';`);
console.log('  4. Login testen: Default-Admin +41 79 623 23 45, PIN 232345 – PIN sofort ändern.');
console.log('  5. node tools/check.js, dann hochladen (sw.js: CACHE um 1 erhöhen).');
