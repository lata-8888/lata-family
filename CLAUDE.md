# Family – Projektkontext für Claude Code

Familien-App im gemeinsamen Supabase-Projekt

## Was die App kann (bewusst klein)
- **Login** mit Handynummer + PIN (Standard-PIN = letzte 6 Ziffern der Nummer). Keine Selbstregistrierung.
- **Events:** Liste (kommend/vergangen), Zusage «Dabei / Nicht dabei», Teilnehmerliste.
- **Admin:** Events anlegen/bearbeiten/löschen; Benutzer anlegen/bearbeiten/entfernen, Admin-Recht, PIN zurücksetzen.
- **Profil:** Name, Sprache (de/en), Hell/Dunkel/Automatisch, PIN ändern, App installieren, Abmelden. Banner, solange der Standard-PIN aktiv ist.
- **Rollen:** nur `User` und `Admin` (`profiles.is_admin`).
- **Default-Admin:** *System Administrator*, `+41 79 623 23 45`, Standard-PIN `232345`. Wird von `supabase/schema_lata.sql` bei jedem Lauf angelegt/als Admin sichergestellt, ist per Trigger geschützt (nicht absetz-, umnummer- oder entfernbar). **PIN beim ersten Login ändern!**

## Gemeinsames Supabase-Projekt (wichtig)
Diese App teilt sich das Projekt mit der Vorlage APP_TMPL_DEV: gleiche Logins (auth.users), aber **eigene Tabellen mit Präfix `lata-`** und **eigene Funktionen mit Präfix `lata_`** (siehe config.js: TABLE_PREFIX, FUNCTION_PREFIX). Neue Tabellen/Funktionen immer mit diesen Präfixen anlegen; die Tabellen der Vorlage nie anfassen. Eine Handynummer ändern geht nur in der App, in der die Person zuerst angelegt wurde (Fehler PHONE_SHARED).

## Stack
Vanilla-JS-PWA ohne Build, GitHub Pages + Supabase (Auth, Postgres, RLS, Realtime). Library: supabase-js 2.45.4 via `cdn.jsdelivr.net` (fixe Version).

## Dateien
`index.html` · `app.js` (alles in einer Datei, ~400 Zeilen) · `i18n.js` (de/en) · `styles.css` · `sw.js` · `manifest.webmanifest` · `config.js` (einzige Datei, die DEV/PRD unterscheidet) · `supabase/schema_lata.sql` · `tools/check.js` (Prüfung) · `tools/init.js` (Platzhalter ersetzen).

## Harte Regeln
1. **DEV vor PRD.** Vor jedem Deploy `config.js` prüfen: richtige Supabase-URL?
2. **Nie den `service_role`-Key** irgendwo ablegen (Code, Doku, Chat). Nur den Anon-Key; Schutz kommt von RLS.
3. **RLS auf jeder Tabelle.** Jede `security definer`-Funktion mit `set search_path`; Admin-RPCs prüfen serverseitig `is_admin()` und sind `revoke … from public, anon`. Client-Guards ersetzen das nie. `profiles`: Clients dürfen nur `name, language, theme, pin_changed` ändern.
4. **Keine Personendaten im Repo** (nur der Default-Admin steht bewusst im Schema). Das PRD-Repo ist öffentlich.
5. Alles Sichtbare durch `esc()`; Fehler in `catch` mit `console.error`; nie still schlucken.
6. **`EMAIL_DOMAIN`** steht in `config.js` **und** in `schema.sql` (`app_settings.email_domain`) – beide gleich, pro Umgebung verschieden, nachträglich nie ändern (Logins heissen `<ziffern>@<EMAIL_DOMAIN>`). `tools/check.js` prüft die Übereinstimmung.
7. Auth-Benutzer aus SQL: die 8 Token-Spalten in `auth.users` müssen `''` sein, nie `NULL` (`_create_user` macht das). Reparatur bestehender Benutzer: `update auth.users set confirmation_token = coalesce(confirmation_token,''), recovery_token = coalesce(recovery_token,''), email_change = coalesce(email_change,''), email_change_token_new = coalesce(email_change_token_new,''), email_change_token_current = coalesce(email_change_token_current,''), reauthentication_token = coalesce(reauthentication_token,''), phone_change = coalesce(phone_change,''), phone_change_token = coalesce(phone_change_token,'');`
8. Supabase → Authentication: **«Confirm email» aus** und **«Allow new users to sign up» aus** (Benutzer legt nur der Admin an).
9. Ein SQL-`UPDATE` hat nicht automatisch gewirkt – mit einer Abfrage verifizieren.

## Arbeitsweise
- Neuer Text ⇒ Schlüssel in `i18n.js` für **de und en**. Neue Tabelle ⇒ RLS + Policies + Realtime in `schema.sql` (idempotent bleiben).
- Nach jeder Änderung `node tools/check.js`. Vor jedem Deploy Skill **app-deploy** (SW-Version +1, Update-Anleitung).
- Neue Funktion zuerst in `app.js` einfach halten. Wird die Datei unübersichtlich (> ~800 Zeilen), erst dann aufteilen.

## Umgebungen (ausfüllen)
| | DEV | PRD |
|---|---|---|
| GitHub | lata-family | _TODO_ |
| Supabase | APP_TMPL_DEV (`eieeqwzekquvvngaauwp`), geteilt mit der Vorlage; Tabellen `lata-…`, Funktionen `lata_…` | _TODO_ |
| URL | _TODO_ | _TODO_ |
| EMAIL_DOMAIN | app-template-dev.example | _TODO (anders)_ |

## Auslieferung
Claude kann nicht direkt ins PRD-Repo schreiben ⇒ ZIP `<slug>-app_<ENV>_v<SW-Version>.zip` (Stammordner `<slug>-app/`) + Update-Anleitung (Format im Skill `app-deploy`). Nur geänderte Dateien ersetzen.
