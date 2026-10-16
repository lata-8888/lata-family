#!/usr/bin/env node
// Prüfung vor jedem Deploy: node tools/check.js
// Syntax, Übersetzungs-Schlüssel (de/en/nl), Service-Worker, Präfixe, Schema-Abgleich, verbotene Schlüssel.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let errors = 0, warns = 0;
const fail = (m) => { errors++; console.error('FEHLER  ' + m); };
const warn = (m) => { warns++; console.warn('Hinweis ' + m); };
const ok = (m) => console.log('ok      ' + m);

// 1) Syntax
for (const f of ['app.js', 'i18n.js', 'sw.js', 'config.js']) {
  try { new vm.Script(read(f), { filename: f }); ok('Syntax ' + f); } catch (e) { fail('Syntax ' + f + ': ' + e.message); }
}

// 2) Übersetzungen
const win = {}; try { vm.runInNewContext(read('i18n.js'), { window: win }); } catch (e) { fail('i18n.js nicht ausführbar: ' + e.message); }
const dict = win.APP_DICT || {};
const langs = ['de', 'en', 'nl'];
for (const l of langs) if (!dict[l]) fail('Sprache fehlt: ' + l);
if (langs.every((l) => dict[l])) {
  const all = new Set(langs.flatMap((l) => Object.keys(dict[l])));
  let missing = 0;
  for (const k of all) for (const l of langs) if (!(k in dict[l])) { fail(`Schlüssel «${k}» fehlt in ${l}`); missing++; }
  if (!missing) ok(`Übersetzungen: ${all.size} Schlüssel in de/en/nl`);
  const app = read('app.js') + read('index.html');
  const used = new Set([...app.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map((m) => m[1]));
  for (const k of used) if (!all.has(k)) fail(`t('${k}') in app.js/index.html, aber nicht in i18n.js`);
}

// 3) Service Worker
const sw = read('sw.js');
const shell = (sw.match(/const SHELL = \[([\s\S]*?)\];/) || [])[1];
if (!/const CACHE = 'lata-family-v\d+'/.test(sw)) fail("sw.js: CACHE muss 'lata-family-vN' heissen");
if (!/status === 200/.test(sw)) fail('sw.js: nur Antworten mit Status 200 zwischenspeichern');
if (shell) for (const f of [...shell.matchAll(/'([^']+)'/g)].map((m) => m[1])) {
  if (f !== './' && !fs.existsSync(path.join(root, f))) fail('SHELL-Datei fehlt: ' + f);
}

// 4) Config und Präfixe
const cfgWin = {}; try { vm.runInNewContext(read('config.js'), { window: cfgWin }); } catch (e) { /* oben gemeldet */ }
const cfg = cfgWin.APP_CONFIG || {};
if (cfg.TABLE_PREFIX !== 'lata-') fail("TABLE_PREFIX muss 'lata-' sein");
if (cfg.FUNCTION_PREFIX !== 'lata_') fail("FUNCTION_PREFIX muss 'lata_' sein");
if (!/^sb_publishable_|^eyJ/.test(cfg.SUPABASE_ANON_KEY || '')) warn('SUPABASE_ANON_KEY sieht ungewöhnlich aus');
console.log('        Supabase-URL: ' + cfg.SUPABASE_URL + '  (DEV vor PRD prüfen!)');

// 5) Schema-Abgleich
let schema = ''; try { schema = read('supabase/schema_lata.sql'); } catch (e) { fail('supabase/schema_lata.sql fehlt'); }
if (schema) {
  const app = read('app.js');
  for (const m of new Set([...app.matchAll(/\bT\('([a-z_]+)'\)/g)].map((x) => x[1])))
    if (!schema.includes(`public."lata-${m}"`)) fail(`Tabelle lata-${m} (app.js) fehlt im Schema`);
  for (const m of new Set([...app.matchAll(/\bF\('([a-z_]+)'\)/g)].map((x) => x[1])))
    if (!new RegExp(`function public\\.lata_${m}\\b`).test(schema)) fail(`Funktion lata_${m} (app.js) fehlt im Schema`);
  const domain = (schema.match(/'email_domain', '([^']+)'/) || [])[1];
  if (domain && cfg.EMAIL_DOMAIN && domain !== cfg.EMAIL_DOMAIN) warn(`EMAIL_DOMAIN: config.js=${cfg.EMAIL_DOMAIN}, Schema=${domain} (bei PRD beide gleich setzen)`);
  const tables = [...schema.matchAll(/create table if not exists public\."(lata-[a-z_]+)"/g)].map((m) => m[1]);
  for (const t of tables) if (!new RegExp(`alter table public\\."${t}"\\s+enable row level security`).test(schema)) fail(`RLS fehlt für ${t}`);
  for (const m of schema.matchAll(/create or replace function public\.(\w+)[\s\S]*?\$\$;?/g)) {
    if (/security definer/.test(m[0]) && !/set search_path/.test(m[0])) fail(`security definer ohne search_path: ${m[1]}`);
    if (!m[1].startsWith('lata')) fail('Funktion ohne lata-Präfix: ' + m[1]);
  }
  if (!errors) ok(`Schema: ${tables.length} Tabellen mit RLS`);
}

// 6) Verbotenes
for (const f of ['app.js', 'config.js', 'index.html', 'README.md', 'CLAUDE.md', 'supabase/schema_lata.sql']) {
  let s = ''; try { s = read(f); } catch (e) { continue; }
  if (/service_role\s*['"]?\s*[:=]\s*['"]?eyJ|"role"\s*:\s*"service_role"/.test(s) || /eyJ[\w-]{20,}\.[\w-]{20,}\.[\w-]{20,}/.test(s) && /service_role/.test(s)) fail('Möglicher service_role-Key in ' + f);
}

console.log(`\n${errors ? 'FEHLGESCHLAGEN' : 'Bestanden'}: ${errors} Fehler, ${warns} Hinweise`);
process.exit(errors ? 1 : 0);
