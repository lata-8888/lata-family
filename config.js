// Konfiguration dieser Umgebung. Nur der ANON-Key gehört hierher (er ist öffentlich vorgesehen,
// der Schutz kommt von RLS). NIEMALS den service_role-Key eintragen!
// DEV und PRD haben je eine eigene config.js (anderes Supabase-Projekt, andere EMAIL_DOMAIN).
window.APP_CONFIG = {
  APP_NAME: 'Family',
  SUPABASE_URL: 'https://eieeqwzekquvvngaauwp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_MlOLy5BzHQOk5oOddYZFbg_PR6DiBQ4',
  EMAIL_DOMAIN: 'app-template-dev.example',   // muss EXAKT zu app_settings.email_domain in schema.sql passen; DEV ≠ PRD; nie nachträglich ändern
  TABLE_PREFIX: 'lata-',               // Tabellen dieser App im gemeinsamen Supabase-Projekt: lata-profiles, lata-events ...
  FUNCTION_PREFIX: 'lata_',            // Funktionen: lata_set_admin ... (siehe supabase/schema_lata.sql)
  STORAGE_SUFFIX: '-lata',             // lokale Einstellungen getrennt von der Vorlage
  DEFAULT_COUNTRY_CODE: '41'          // für Nummern, die mit 0 beginnen
};
