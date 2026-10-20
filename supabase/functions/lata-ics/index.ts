// lata-ics: liefert einen einzelnen Kalendereintrag als .ics (text/calendar), damit iPhone/iPad «Zum Kalender hinzufügen» anbietet.
// Ohne Login erreichbar (verify_jwt aus), liest nichts aus der Datenbank: alles steht in der Adresse.
// Parameter: t Titel, s Start, e Ende (je YYYYMMDD für ganztägig, sonst YYYYMMDDTHHMMSSZ), l Ort, d Kommentar, u UID
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const enc = new TextEncoder();
// Zeilen auf höchstens 75 Bytes kürzen (Fortsetzung mit Leerzeichen), Zeichen nicht zerschneiden
function fold(line: string): string {
  const out: string[] = []; let cur = '', bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const DATE = /^\d{8}$/, UTC = /^\d{8}T\d{6}Z$/;
Deno.serve((req: Request) => {
  const q = new URL(req.url).searchParams;
  const t = (q.get('t') || '').slice(0, 200), s = q.get('s') || '', e = q.get('e') || '';
  const l = (q.get('l') || '').slice(0, 200), d = (q.get('d') || '').slice(0, 2000), u = (q.get('u') || '').replace(/[^\w.@-]/g, '').slice(0, 80);
  const okS = DATE.test(s) || UTC.test(s), okE = DATE.test(e) || UTC.test(e);
  if (!t || !okS || !okE || DATE.test(s) !== DATE.test(e)) return new Response('Bad request', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dt = (k: string, v: string) => DATE.test(v) ? `${k};VALUE=DATE:${v}` : `${k}:${v}`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lata-family//Family//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${u || crypto.randomUUID()}@lata-family`, `DTSTAMP:${now}`, dt('DTSTART', s), dt('DTEND', e), `SUMMARY:${esc(t)}`];
  if (l) lines.push(`LOCATION:${esc(l)}`);
  if (d) lines.push(`DESCRIPTION:${esc(d)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="event.ics"', 'Cache-Control': 'no-store' },
  });
});
