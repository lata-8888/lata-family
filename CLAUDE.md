# Family – Projektkontext für Claude Code

Familien-App (Events, Tasks, Einkauf) im eigenen Supabase-Projekt `lata-family` (Präfixe `lata-`/`lata_` bleiben; `APP_TMPL_DEV` wird nach Entscheid nachgezogen).

## Was die App kann
- **Login** mit Handynummer + PIN (Standard-PIN = letzte 6 Ziffern der Nummer). Keine Selbstregistrierung. Nummernfeld mit Länderauswahl **CH +41 / DE +49 / Andere**, Live-Formatierung. Gespeichert wird `+41791234567`.
- **Agenda** (Tabs **Liste | Woche | Monat**): Liste zeigt kommende Events (nach Monat gruppiert, Zeithorizont über «…», höchstens 1 Jahr voraus, Zeit/Ort eingeklappt). **Woche** ist wie der Monat aufgebaut (Wochentage oben, je Tag eine Spalte, etwa gleich hoch): gezeigt wird **6–24 Uhr ohne Zeitangaben** (Hilfslinien alle 3 Stunden), Termine als Blöcke an ihrer Uhrzeit (überlappende nebeneinander), ganztägige/mehrtägige Events als Chips oben in der Spalte, Linie für die aktuelle Uhrzeit, Kategorie-Farben mit Legende, Favoriten mit Stern; **Monat** ist das Monatsraster (markierte Event-Tage, kleiner Stern bei Favoriten). Darunter steht jeweils die **Liste der Termine des Zeitraums**; Antippen eines Tags zeigt nur dessen Termine. Jedes Event hat einen **Favoriten-Stern**: Favorit = Eintrag in `event_assignees` (Person, Event; jede Person setzt/entfernt nur den eigenen); bei Serien gilt der Stern ab diesem Termin für alle folgenden. Der **Filter** oben rechts zeigt nur meine Favoriten oder alles. Events haben eine **Kategorie** (feste Liste mit Farbe: Familie, Freunde, Sport, Schule, Arbeit, Freizeit, Geburtstag, Sonstiges; `events.category`): Farbe im Wochen-Stundenplan (mit Legende) und als Rand der Eventkarte, bei Serien für alle Termine. Events: Titel, Datum, optional Zeit/Ort/Kommentar, optional **Ende** (`ends_at`, `end_time_set`): **«Ganztägig»-Checkbox** (blendet Start- und Endzeit aus, `time_set = false`), mit Start- und Endzeit am selben Tag oder **mehrtägig** (Enddatum; erscheint in Woche/Monat an jedem Tag, in der Liste bis zum letzten Tag; Serien übernehmen die Dauer), Teilnahme nötig (`rsvp`, Standard aus; unabhängig vom Favoriten), **Stift-Icon** an jeder Eventkarte öffnet «Event bearbeiten»: Admin/Event Manager ändern alles (Zeilen «Von» und «Bis» je mit Datum und Zeit; **Anlegen und Bearbeiten sind gleich aufgebaut: Kategorie, «Favorit für», Teilnahme, Wiederholung (und «auch für folgende Termine») im eingeklappten Dropdown «Details»**; ein Einzeltermin kann beim Bearbeiten zur Serie werden, Labels links, ohne Ort/Kommentar im Dialog (Werte bleiben erhalten), «Favorit für» als Dropdown, «Löschen» unten), alle anderen sehen nur «Favorit für» (Personen hinzufügen, sich selbst abwählen; bei Serien ab diesem Termin). Wiederholung (Einheit | alle n | Wochentag, unbegrenzt, Serie wird bis 1 Jahr voraus erzeugt und beim Öffnen durch Admin/Event Manager verlängert). Bei Serien «diesen und alle weiteren».
- **Tasks:** gemeinsame Aufgaben mit dem Favoriten-Konzept wie im Einkauf: oben **Meine Aufgaben** (meine Favoriten), darunter **Weitere Aufgaben** («+» rechts daneben legt eine neue Aufgabe an). Favorit = Eintrag in `task_assignees` (Person, Task); ein Task kann **mehreren Personen** zugeteilt sein (Dropdown «Favorit für», 0–n). Stern pro Zeile (jede Person setzt/entfernt den eigenen); das Stift-Icon öffnet bei allen den Dialog: Ersteller/in und Admins ändern alles («Löschen» unten), alle anderen sehen nur «Favorit für» (Personen hinzufügen, sich selbst abwählen). Der **Termin ist optional** (ohne Termin stehen Tasks am Ende). «Erledigt» ist ein gemeinsamer Status (abhaken dürfen Zugeteilte, Ersteller/in, Admins). Tasks sind für alle sichtbar. Wiederkehrende Tasks (Admin) tragen die zugewiesene Person als Favorit ein.
- **Einkauf:** Tab **Wunschliste** mit den Bereichen **Meine Favoriten** (Kästchen = auf die Einkaufsliste) und **Weitere Produkte** (alle übrigen Produkte; «+» rechts daneben legt ein neues Produkt an). Jede Produktzeile hat rechts einen **Favoriten-Stern** (gefüllt = Favorit); das **Stift-Icon** öffnet direkt «Produkt bearbeiten» (Name für Ersteller/in und Admins, Notiz und Liste für den eigenen Favoriten, **«Favorit für»** = Dropdown mit 0–n Personen: Produkt bei anderen zu den Favoriten hinzufügen; entfernen kann es nur die Person selbst mit dem Stern); unten im Dialog «Produkt löschen» (Ersteller/in und Admins; löscht es für alle). Tab **Einkaufslisten** (nur angetickte Favoriten; Kästchen = gekauft, gekaufte unten gedimmt; Listen können privat sein; «Gekaufte zurück zu den Favoriten» – gekaufte Produkte werden **nie gelöscht**). **Jedes Produkt gibt es nur einmal** (`lata-products`, Name ohne Gross-/Kleinschreibung eindeutig, bleibt bis zum ausdrücklichen Löschen); ein Favorit ist ein Eintrag in `lata-wishes` (Person, Produkt, Notiz, Liste, `selected` = auf der Einkaufsliste, `checked` = gekauft, nur wenn angetickt). Favoriten entstehen nur über die RPC `lata_add_wish`. Alles ist alphabetisch; in einer geteilten Einkaufsliste erscheint ein Produkt einmal mit den Namen der Wünschenden, Abhaken gilt für alle.
- **Admin:** (alle Bereiche beim Öffnen zu) Agenda (alle Events), Personen (User/Gäste, Rollen, PIN zurücksetzen), wiederkehrende Tasks, Tasks (alle), Standard Design, Standard Sprache.
- **Profil:** Name und Handynummer direkt antippen, Sprache, Hell/Dunkel/Automatisch, **Design pro Person** (White, Blue, Petrol, Orange; Spalte `design` in `profiles`), PIN, App installieren, Abmelden.
- **Rollen:** `User`, `Gast`, `Admin`, `Event Manager`. **Designs:** `light` (White), `standard` (Blue), `petrol`, `holland` (Orange). **Sprachen:** de, en, nl.
- **Default-Admin:** *System Administrator*, `+41 79 623 23 45`, Standard-PIN `232345`. **PIN beim ersten Login ändern!**
## Gemeinsames Supabase-Projekt (wichtig)
Teilt sich das Projekt mit der Vorlage `APP_TMPL_DEV`: gleiche Logins (`auth.users`), aber **eigene Tabellen mit Präfix `lata-`** (`lata-profiles`, `lata-events`, `lata-tasks`, `lata-products`, `lata-wishes`, `lata-shop_lists`, `lata-recurring_tasks` …) und **eigene Funktionen mit Präfix `lata_`**. Das Präfix kommt aus `config.js` (`TABLE_PREFIX`, `FUNCTION_PREFIX`, `STORAGE_SUFFIX`); im Code immer `T('tabelle')` und `F('funktion')`. Neue Tabellen/Funktionen **immer** mit diesen Präfixen anlegen, die Vorlagen-Tabellen nie anfassen. Personen entfernen löscht den gemeinsamen Login nur, wenn keine andere App ihn braucht; eine Handynummer ändern geht nur in der App, in der die Person zuerst angelegt wurde (`PHONE_SHARED`).

## Stack
Vanilla-JS-PWA ohne Build, GitHub Pages + Supabase (Auth, Postgres, RLS, Realtime). Library: supabase-js 2.45.4 via `cdn.jsdelivr.net` (fixe Version). Schriften über Google Fonts (Barlow, Fredoka, Nunito, Inter).

## Dateien
`index.html` · `app.js` (alles in einer Datei, > 1500 Zeilen) · `i18n.js` (de/en/nl) · `styles.css` (Tokens + Designs über `data-design`) · `sw.js` · `manifest.webmanifest` · `config.js` (einzige Datei, die DEV/PRD unterscheidet) · `supabase/schema_lata.sql` · `tools/check.js` (Prüfung) · `tools/init.js`.

## Harte Regeln
1. **DEV vor PRD.** Vor jedem Deploy `config.js` prüfen: richtige Supabase-URL?
2. **Nie den `service_role`-Key** irgendwo ablegen (Code, Doku, Chat). Nur den Anon-Key; Schutz kommt von RLS.
3. **RLS auf jeder Tabelle.** Jede `security definer`-Funktion mit `set search_path`; Admin-RPCs prüfen serverseitig `lata_is_admin()` und sind `revoke … from public, anon`. Client-Guards ersetzen das nie. `lata-profiles`: Clients dürfen nur `name, language, theme, pin_changed` ändern; Rollen nur per RPC.
4. **Keine Personendaten im Repo** (nur der Default-Admin steht bewusst im Schema). Die Repos sind öffentlich.
5. Alles Sichtbare durch `esc()`; Fehler in `catch` mit `console.error`; nie still schlucken.
6. **`EMAIL_DOMAIN`** steht in `config.js` **und** in `lata-app_settings` (`email_domain`) – gleich, nachträglich nie ändern (Logins heissen `<ziffern>@<EMAIL_DOMAIN>`).
7. Auth-Benutzer aus SQL: die 8 Token-Spalten in `auth.users` müssen `''` sein, nie `NULL` (`lata__create_user` macht das).
8. Supabase → Authentication: **«Confirm email» aus** und **«Allow new users to sign up» aus**.
9. Ein SQL-`UPDATE` hat nicht automatisch gewirkt – mit einer Abfrage verifizieren.
10. **Texte immer in allen drei Sprachen** (`de`, `en`, `nl`) mit gleichen Schlüsseln; kein Text fest im Code.
11. **Service Worker:** nur Antworten mit Status 200 zwischenspeichern; bei jeder Änderung einer SHELL-Datei `CACHE` um 1 erhöhen (`lata-family-vN`).
12. Der Webschutz mancher VPNs/Virenscanner (z. B. NordVPN «Blocker für schädliche Websites») kann Skripte neuer Seiten blockieren (leere Seite am Desktop, Status 204) – nicht ein App-Fehler.

## Arbeitsweise
- Neue Tabelle ⇒ RLS + Policies + Realtime in `schema_lata.sql` (idempotent) und auf **`lata-family`** per Migration anwenden. **`APP_TMPL_DEV` wird nie angefasst** (weder Migration noch Daten schreiben, auch nicht «nachziehen» oder abgleichen), ausser der Benutzer sagt es ausdrücklich. Lesen nur, wenn ausdrücklich verlangt.
- Nach jeder Änderung Klammerprüfung/Syntaxtest; wenn `node` verfügbar: `node tools/check.js`. Vor jedem Deploy Skill **app-deploy**.
- Hochladen per GitHub-Web-Upload ins Repo-Root (keine Unterordner möglich: `favicon-48.png` liegt deshalb im Root).

## Umgebungen
| | Arbeitsprojekt | APP_TMPL_DEV |
|---|---|---|
| Supabase | `lata-family` (`yiynvyqvkbkwamxopemj`), eigenes Projekt nur für diese App | `APP_TMPL_DEV` (`eieeqwzekquvvngaauwp`), geteilt mit der Vorlage |
| Stand | Schema `supabase/schema_lata.sql` angewendet; startet nur mit dem Default-Admin | enthält die bisherigen Familiendaten; wird **nach Entscheid** nachgezogen |
| `config.js` | zeigt hierher (GitHub Pages: https://lata-8888.github.io/lata-family/) | zeigt nicht mehr hierher |
| EMAIL_DOMAIN | app-template-dev.example | app-template-dev.example |

- **Datenbank-Arbeiten laufen gegen `lata-family`.** Was nach `APP_TMPL_DEV` kommt, wird von Fall zu Fall entschieden. Keine PRD ohne ausdrücklichen Auftrag.
- Tabellen-/Funktionspräfixe `lata-`/`lata_` gelten unverändert (Schema ist für beide Projekte gleich).
- Supabase-MCP: Befehle mit `drop`/`delete`/`update ohne where` lösen eine Bestätigung aus und laufen sonst ins Zeitlimit – solche Befehle im SQL-Editor ausführen.

## Auslieferung
Geänderte Dateien ins Repo hochladen (Commit direkt auf `main`), danach Pages-Deploy abwarten (3–4 Min.) und Seite hart neu laden bzw. App am Handy schliessen und neu öffnen. Bei DB-Änderungen zuerst die Migration, dann die App.
