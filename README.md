# Einfaches App-Template (GitHub Pages + Supabase)

Login per Handynummer + PIN · Events mit Zu-/Absage · Admin (Events & Benutzer) · Profil (Sprache de/en, Theme, PIN, Installation) · Rollen User/Admin · Default-Admin *System Administrator*.

**Neue App:** Ordner kopieren, in Claude Code öffnen, `/new-app Name – Zweck`. Danach `docs/setup.md`.

| Pfad | Zweck |
|---|---|
| `CLAUDE.md` | Projektregeln für Claude Code |
| `.claude/skills/app-deploy` | Deployment-Checkliste · Commands: `/new-app`, `/deploy`, `/security-check` |
| `app.js`, `i18n.js`, `styles.css`, `sw.js`, `index.html`, `manifest.webmanifest`, `config.js` | die App |
| `supabase/schema_lata.sql` | Datenbank inkl. Default-Admin (idempotent) |
| `tools/` | `init.js`, `check.js` (`--template` im Template selbst), `make-icons.py` |
