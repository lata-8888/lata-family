/* App Template – Vanilla-JS-PWA (kein Build-Schritt). Login per Handynummer + PIN, Events, Admin, Profil. de/en. */
(function () {
  'use strict';

  /* ---------- Konfiguration & Supabase ---------- */
  var cfg = window.APP_CONFIG || {};
  // Mehrere Apps im selben Supabase-Projekt: Tabellen und Funktionen tragen einen Präfix aus config.js (TABLE_PREFIX z. B. 'lata-', FUNCTION_PREFIX z. B. 'lata_')
  var SFX = cfg.STORAGE_SUFFIX || '';   // trennt die lokalen Einstellungen (Sprache, Design) pro App
  var T = function (n) { return (cfg.TABLE_PREFIX || '') + n; }, F = function (n) { return (cfg.FUNCTION_PREFIX || '') + n; };
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_URL.indexOf('DEIN-PROJEKT') === -1);
  var sb = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  /* ---------- Sprachen (de, en, nl) ---------- */
  var LANGS = ['de', 'en', 'nl'], LANG_NAMES = { de: 'Deutsch', en: 'English', nl: 'Nederlands' }, LOCALE = { de: 'de-CH', en: 'en-GB', nl: 'nl-NL' };
  var DICT = window.APP_DICT || {}, lang = 'de';
  function L(key, p) {
    var s = (DICT[lang] && DICT[lang][key]) || (DICT.de && DICT.de[key]) || key;
    if (p) Object.keys(p).forEach(function (k) { s = s.split('{' + k + '}').join(p[k]); });
    return s;
  }
  function setLang(l) {
    if (LANGS.indexOf(l) < 0) return;
    lang = l; document.documentElement.lang = l;
    try { localStorage.setItem('app-lang' + SFX, l); } catch (e) { /* ignorieren */ }
  }
  (function () {
    var l = null;
    try { l = localStorage.getItem('app-lang' + SFX); } catch (e) { /* ignorieren */ }
    // Reihenfolge: eigene Wahl → Standardsprache der App (zuletzt bekannt) → Gerätesprache
    if (LANGS.indexOf(l) < 0) { try { l = localStorage.getItem('app-default-lang' + SFX); } catch (e) { /* ignorieren */ } }
    if (LANGS.indexOf(l) < 0) l = (navigator.language || 'de').slice(0, 2);
    setLang(LANGS.indexOf(l) > -1 ? l : 'de');
  })();

  /* ---------- Darstellung: Hell / Dunkel / Automatisch ('' = automatisch) ---------- */
  var theme = '';
  try { var t0 = localStorage.getItem('app-theme' + SFX); if (t0 === 'light' || t0 === 'dark') theme = t0; } catch (e) { /* ignorieren */ }
  function applyTheme() { if (theme) document.documentElement.setAttribute('data-theme', theme); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme();
  function setTheme(t) {
    theme = (t === 'light' || t === 'dark') ? t : '';
    try { if (theme) localStorage.setItem('app-theme' + SFX, theme); else localStorage.removeItem('app-theme' + SFX); } catch (e) { /* ignorieren */ }
    applyTheme();
  }

  /* ---------- Design (vom Admin für alle gewählt; in app_settings gespeichert, lokal zwischengespeichert) ---------- */
  var DESIGNS = [
    { id: 'light', colors: ['#4A5568', '#EDEFF2', '#FBFBFC'] },
    { id: 'standard', colors: ['#307CC0', '#E3EFF9', '#F3F4F0'] },
    { id: 'petrol', colors: ['#0E5F6F', '#2BAFC4', '#EAF4F6'] },
    { id: 'holland', colors: ['#EA580C', '#F97316', '#FFF7ED'] }
  ];
  var design = 'standard';        // wirksames Design (eigene Wahl, sonst Standard des Admins)
  var adminDesign = 'standard';   // Standard-Design der App (vom Admin)
  function applyDesign(d) {
    if (!DESIGNS.some(function (x) { return x.id === d; })) d = 'standard';
    design = d; document.documentElement.setAttribute('data-design', d);
    try { localStorage.setItem('app-design' + SFX, d); } catch (e) { /* ignorieren */ }
  }
  try { applyDesign(localStorage.getItem('app-design' + SFX)); } catch (e) { applyDesign('standard'); }

  /* ---------- Telefon & PIN ---------- */
  // Akzeptiert 079 123 45 67, +41 79 …, 0041 79 …; gespeichert wird +41791234567.
  /* Handynummer-Eingabe (wie in der FBRO-App): Länderauswahl (CH/DE/Andere) + Nummer ohne führende Null.
     Gespeichert wird das internationale Format (+41791234567). */
  var PHONE_CC = [{ c: '41', l: 'CH +41', ph: '79 123 45 67' }, { c: '49', l: 'DE +49', ph: '176 12345678' }];
  function ccInfo(c) { return PHONE_CC.filter(function (x) { return x.c === c; })[0] || null; }
  function fmtNational(cc, n) {
    n = String(n).replace(/\D/g, '');
    if (cc === '41') return [n.slice(0, 2), n.slice(2, 5), n.slice(5, 7), n.slice(7, 9)].filter(Boolean).join(' ');
    if (cc === '49') return [n.slice(0, 3), n.slice(3)].filter(Boolean).join(' ');
    return n;
  }
  // '+41796232345' → { cc: '41', nat: '79 623 23 45' }; unbekanntes Land → { cc: '', nat: '+43…' }
  function phoneParts(intl) {
    var raw = String(intl || '');
    var d = raw.replace(/\D/g, '');
    if (/^\+\d/.test(raw.replace(/\s/g, ''))) {
      for (var i = 0; i < PHONE_CC.length; i++) {
        if (d.indexOf(PHONE_CC[i].c) === 0) return { cc: PHONE_CC[i].c, nat: fmtNational(PHONE_CC[i].c, d.slice(PHONE_CC[i].c.length)) };
      }
      return { cc: '', nat: raw.replace(/\s/g, '') };
    }
    return { cc: '41', nat: fmtNational('41', d.replace(/^0+/, '')) };
  }
  // Länderwahl + Eingabe → Nummer für normPhone(). Eine vollständig internationale Eingabe (+… / 00…) gilt immer.
  function composePhone(cc, raw) {
    raw = String(raw || '').trim();
    if (/^(\+|00)/.test(raw.replace(/\s/g, ''))) return raw;
    if (!cc) return raw;
    var d = raw.replace(/\(0\)/g, '').replace(/\D/g, '');
    if (cc === '41' && d.length === 11 && d.indexOf('41') === 0) d = d.slice(2);   // «41 79 …» ohne +
    d = d.replace(/^0+/, '');
    return d ? '+' + cc + d : '';
  }
  function phoneField(intl, autoc) {
    var pp = phoneParts(intl), info = ccInfo(pp.cc);
    return '<div class="phonerow">' +
      '<select class="phonecc" name="phonecc" aria-label="' + esc(L('phoneCountry')) + '">' +
      PHONE_CC.map(function (x) { return '<option value="' + x.c + '"' + (pp.cc === x.c ? ' selected' : '') + '>' + x.l + '</option>'; }).join('') +
      '<option value=""' + (pp.cc === '' ? ' selected' : '') + '>' + esc(L('phoneOther')) + '</option></select>' +
      '<input name="phone" type="tel" inputmode="tel" autocomplete="' + (autoc || 'off') + '" placeholder="' + esc(info ? info.ph : '+43 …') + '" value="' + esc(pp.nat) + '"></div>';
  }
  function normPhone(raw, cc) {
    var d = String(raw).replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
    if (d.indexOf('00') === 0) d = '+' + d.slice(2);
    else if (d.indexOf('0') === 0) d = '+' + (cc || cfg.DEFAULT_COUNTRY_CODE || '41') + d.slice(1);
    else if (d.indexOf('+') !== 0) d = '+' + d;
    return /^\+\d{9,15}$/.test(d) ? d : null;
  }
  // Anzeige: Schweizer Nummern immer als 079 123 45 67
  function fmtPhone(p) {
    if (/^\+41\d{9}$/.test(p)) return '0' + p.slice(3, 5) + ' ' + p.slice(5, 8) + ' ' + p.slice(8, 10) + ' ' + p.slice(10);
    if (/^\+49\d{10,11}$/.test(p)) return '+49 ' + p.slice(3, 6) + ' ' + p.slice(6);
    return p;
  }
  function defaultPin(p) { return String(p).replace(/\D/g, '').slice(-6); }
  function pinWeak(pin, phone) {
    if (!/^\d{6}$/.test(pin)) return false;
    if (/^(\d)\1{5}$/.test(pin)) return true;
    var d = pin.split('').map(Number), up = true, down = true;
    for (var i = 1; i < 6; i++) { if (d[i] !== d[i - 1] + 1) up = false; if (d[i] !== d[i - 1] - 1) down = false; }
    return up || down || (!!phone && pin === defaultPin(phone));
  }
  // EMAIL_DOMAIN steht in config.js UND in app_settings (schema.sql) – beide müssen übereinstimmen.
  function phoneToEmail(p) { return p.replace('+', '') + '@' + (cfg.EMAIL_DOMAIN || 'phone-login.app'); }

  /* ---------- Zustand ---------- */
  var S = { step: 'login', err: '', busy: false, session: null, me: null, members: [], events: [], resp: [], tasks: [], lists: [], products: [], wishes: [], rules: [], shopView: 'need', tab: 'events', sec: { 'need-others': false, 'need-catalog': false, 'task-more': false }, open: {}, phone: '' };
  // Admin: alle Teilbereiche sind beim Öffnen eingeklappt
  var ADMIN_KEYS = ['events', 'members', 'recur', 'design', 'lang', 'a-tasks', 'g-user', 'g-guest'];
  ADMIN_KEYS.forEach(function (k) { S.sec[k] = false; });
  S.assign = [];   // Zuteilung von Events an Personen: { event_id, user_id }
  S.taskAssign = [];   // Favoriten von Tasks: { task_id, user_id }
  var installEvt = null;
  var isAdmin = function () { return !!(S.me && S.me.is_admin); };
  var canManageEvents = function () { return !!(S.me && (S.me.is_admin || S.me.is_event_manager)); };   // Admin oder Event Manager
  var roleLabels = function (m) {
    var r = [m.is_guest ? L('roleGuest') : L('roleUser')];
    if (m.is_admin) r.push(L('roleAdmin'));
    if (m.is_event_manager) r.push(L('roleEM'));
    return r;
  };

  /* ---------- UI-Bausteine ---------- */
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }
  // Bottom-Sheet mit Formular → Promise(Werte | null)
  function askForm(title, fields, okLabel, intro, extra) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div'); wrap.className = 'ccsheet-bg';
      wrap.innerHTML = '<form class="ccsheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' +
        (intro ? '<p class="muted">' + esc(intro) + '</p>' : '') +
        fields.map(function (f, i) {
          var html;
          if (f.type === 'checkbox') html = '<label class="check"><input type="checkbox" name="' + f.name + '"' + (f.value ? ' checked' : '') + '><span>' + esc(f.label) + '</span></label>';
          else if (f.type === 'recurrence') html = recurrenceBlock();
          else if (f.type === 'cat') html = '<div class="fld"><span>' + esc(f.label) + '</span><div class="catpick">' + f.options.map(function (o) {
            return '<label class="catopt" style="--c:' + o.c + '"><input type="radio" name="' + f.name + '" value="' + esc(o.v) + '"' + (o.v === (f.value || '') ? ' checked' : '') + '><i></i><em>' + esc(o.l) + '</em></label>';
          }).join('') + '</div></div>';
          else if (f.type === 'textarea') html = '<label class="fld' + (f.inline ? ' inl' : '') + '"><span>' + esc(f.label) + '</span><textarea name="' + f.name + '" rows="' + (f.inline ? 2 : 3) + '">' + esc(f.value || '') + '</textarea></label>';
          else if (f.type === 'multi') {
            var boxes = '<div class="chklist">' + f.options.map(function (o) {
              return '<label class="check"><input type="checkbox" name="' + f.name + '" value="' + esc(o.v) + '"' + ((f.value || []).indexOf(o.v) > -1 || o.lock ? ' checked' : '') + (o.lock ? ' disabled' : '') + '><span>' + esc(o.l) + '</span></label>';
            }).join('') + '</div>';
            // dropdown: Zeile «Label | Auswahl», die Auswahl klappt als Liste auf (0 bis n Einträge)
            html = f.dropdown ? '<div class="fld inl"><span>' + esc(f.label) + '</span><details class="msel" data-for="' + f.name + '"><summary></summary>' + boxes + '</details></div>'
              : '<div class="fld"><span>' + esc(f.label) + '</span>' + boxes + '</div>';
          }
          else if (f.type === 'note') html = '<p class="muted small recinfo">' + esc(f.text) + '</p>';
          else if (f.type === 'phone') html = '<div class="fld"><span>' + esc(f.label) + '</span>' + phoneField(f.value) + '</div>';
          else if (f.type === 'select') html = '<label class="fld' + (f.inline ? ' inl' : '') + '"><span>' + esc(f.label) + '</span><select name="' + f.name + '">' + f.options.map(function (o) {
            return '<option value="' + esc(o.v) + '"' + (o.v === f.value ? ' selected' : '') + '>' + esc(o.l) + '</option>';
          }).join('') + '</select></label>';
          else html = '<label class="fld' + (f.inline ? ' inl' : '') + (f.label === '' ? ' nolbl' : '') + '"><span>' + esc(f.label) + '</span><input name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value || '') + '" autocomplete="off"></label>' + (f.suggest ? '<div class="suggbox" data-for="' + f.name + '"></div>' : '');
          // aufeinanderfolgende Felder mit half:true stehen nebeneinander (z. B. Datum | Zeit)
          var prev = fields[i - 1], next = fields[i + 1];
          if (f.half && !(prev && prev.half)) html = '<div class="grid2">' + html;
          if (f.half && !(next && next.half)) html += '</div>';
          // pair:true: zwei Felder in einer Zeile (Label links, z. B. «Bis | Datum | Zeit»)
          if (f.pair && !(prev && prev.pair)) html = '<div class="dtrow">' + html;
          if (f.pair && !(next && next.pair)) html += '</div>';
          return html;
        }).join('') +
        (extra ? '<button type="button" class="btn danger" data-x="extra">' + esc(extra) + '</button>' : '') + '<div class="row"><button type="button" class="btn ghost" data-x="cancel">' + esc(L('cancel')) + '</button><button class="btn" type="submit">' + esc(okLabel || L('save')) + '</button></div></form>';
      document.body.appendChild(wrap);
      var form = wrap.querySelector('form'), close = function (v) { wrap.remove(); resolve(v); };
      wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.dataset.x === 'cancel') close(null); else if (e.target.dataset.x === 'extra') close({ __extra: true }); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var out = {};
        fields.forEach(function (f) {
          if (f.type === 'note') return;
          if (f.type === 'multi') { out[f.name] = Array.prototype.map.call(form.querySelectorAll('input[name="' + f.name + '"]:checked'), function (i) { return i.value; }); return; }
          if (f.type === 'recurrence') {
            out.every = parseInt(form.elements.every.value, 10) || 1;
            out.unit = form.elements.unit.value;
            out.wd = form.elements.wd.value ? [parseInt(form.elements.wd.value, 10)] : [];
            return;
          }
          var el = form.elements[f.name];
          out[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'phone' ? composePhone(form.elements.phonecc ? form.elements.phonecc.value : '', el.value) : el.value.trim();
        });
        close(out);
      });
      // Wiederholungs-Block nur zeigen, wenn «Wiederkehrend» angehakt ist; Wochentage nur bei «Woche»
      var recBlock = form.querySelector('[data-dep]');
      if (recBlock) {
        var refresh = function () {
          var src = form.elements[recBlock.dataset.dep];
          recBlock.hidden = !(src && src.checked);
          var wk = recBlock.querySelector('[data-unit]');
          if (wk) wk.hidden = form.elements.unit.value !== wk.dataset.unit;
        };
        form.addEventListener('change', refresh); refresh();
      }
      // Vorschlagsliste: zeigt alle bekannten Einträge und reduziert sie beim Tippen (Volltextsuche, alle Wörter müssen vorkommen)
      fields.forEach(function (f) {
        if (!f.suggest) return;
        var inp = form.elements[f.name], box = form.querySelector('.suggbox[data-for="' + f.name + '"]');
        var paint = function () {
          var words = inp.value.toLowerCase().split(/\s+/).filter(Boolean);
          var hits = !words.length ? [] : f.suggest.filter(function (x) { var l = x.n.toLowerCase(); return words.every(function (w) { return l.indexOf(w) > -1; }); });
          box.innerHTML = hits.map(function (x) { return '<button type="button" class="sugg' + (x.on ? ' on' : '') + '" data-sg="' + esc(x.n) + '"><b>' + esc(x.n) + '</b>' + (x.on ? '<span>' + esc(f.suggestOn) + '</span>' : '') + '</button>'; }).join('');
          box.hidden = !hits.length;
        };
        inp.addEventListener('input', paint);
        box.addEventListener('click', function (e) { var b = e.target.closest('[data-sg]'); if (b) { inp.value = b.dataset.sg; paint(); inp.focus(); } });
        paint();
      });
      // Checkbox mit hides: [...] blendet die genannten Felder aus (und leert sie), z. B. «Ganztägig» die Zeitfelder
      fields.forEach(function (f) {
        if (f.type !== 'checkbox' || !f.hides) return;
        var cb = form.elements[f.name];
        var apply = function () { f.hides.forEach(function (n) { var el = form.elements[n], box = el && el.closest('.fld'); if (box) { box.hidden = cb.checked; if (cb.checked) el.value = ''; } }); };
        cb.addEventListener('change', apply); apply();
      });
      // Dropdown-Mehrfachauswahl: Kopfzeile zeigt die gewählten Namen
      fields.forEach(function (f) {
        if (f.type !== 'multi' || !f.dropdown) return;
        var det = form.querySelector('details.msel[data-for="' + f.name + '"]'), sum = det.querySelector('summary');
        var paintSel = function () {
          var names = Array.prototype.map.call(det.querySelectorAll('input:checked'), function (i) { return i.parentNode.querySelector('span').textContent; });
          sum.textContent = names.length ? names.join(', ') : L('shNobody');
        };
        det.addEventListener('change', paintSel); paintSel();
      });
      var first = form.querySelector('input'); if (first) first.focus();
    });
  }
  function askConfirm(title, message, danger) {
    return new Promise(function (resolve) {
      var wrap = document.createElement('div'); wrap.className = 'ccsheet-bg';
      wrap.innerHTML = '<div class="ccsheet" role="alertdialog" aria-modal="true"><h3>' + esc(title) + '</h3><p>' + esc(message) + '</p>' +
        '<div class="row"><button class="btn ghost" data-v="0">' + esc(L('cancel')) + '</button><button class="btn' + (danger ? ' danger' : '') + '" data-v="1">' + esc(L('confirm')) + '</button></div></div>';
      document.body.appendChild(wrap);
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap) { wrap.remove(); resolve(false); }
        else if (e.target.dataset.v) { wrap.remove(); resolve(e.target.dataset.v === '1'); }
      });
    });
  }
  function errText(e) {
    var m = (e && e.message) || '';
    if (/lata-products_name_key/.test(m)) return L('shNameTaken');
    if (/NEED_FORBIDDEN/.test(m)) return L('needForbidden');
    if (/PHONE_TAKEN|duplicate key/i.test(m)) return L('phoneTaken');
    if (/DEFAULT_ADMIN_PROTECTED/.test(m)) return L('protectedAdmin');
    if (/GUEST_NOT_ALLOWED/.test(m)) return L('guestNoAdmin');
    if (/TASK_FORBIDDEN/.test(m)) return L('taskForbidden');
    if (/PHONE_SHARED/.test(m)) return L('phoneShared');
    return m ? L('error') + ': ' + m : L('error');
  }
  // Aktion → Toast → neu laden → neu zeichnen. Fehler werden angezeigt, nie verschluckt.
  async function act(fn, okMsg) {
    try { await fn(); if (okMsg) toast(okMsg); await loadAll(); render(); return true; }
    catch (e) { console.error(e); toast(errText(e)); return false; }
  }
  var ICON = {
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>',
    guest: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M2 21c0-4 3.5-7 8-7M17 14v6M14 17h6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 4.3c.4-1.8 2.9-1.8 3.4 0a1.7 1.7 0 0 0 2.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 0 0 1 2.5c1.8.4 1.8 2.9 0 3.4a1.7 1.7 0 0 0-1 2.6c.9 1.5-.8 3.3-2.4 2.4a1.7 1.7 0 0 0-2.6 1c-.4 1.8-2.9 1.8-3.4 0a1.7 1.7 0 0 0-2.6-1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 0 0-1-2.6c-1.8-.4-1.8-2.9 0-3.4a1.7 1.7 0 0 0 1-2.5c-.9-1.6.8-3.3 2.4-2.4c1 .6 2.3 0 2.6-1.1z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 10.5h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/></svg>',
    filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* ---------- Daten laden & Live-Aktualisierung ---------- */
  var lastRecurring = 0;
  async function loadAll() {
    var uid = S.session.user.id;
    if (Date.now() - lastRecurring > 30 * 60000) { lastRecurring = Date.now(); try { await sb.rpc(F('run_recurring')); } catch (e) { /* ignorieren */ } }
    var pTA = Promise.resolve(sb.from(T('task_assignees')).select('*'));
    var pEA = Promise.resolve(sb.from(T('event_assignees')).select('*'));   // parallel zu den übrigen Abfragen
    var r = await Promise.all([
      sb.from(T('profiles')).select('*').order('name'),
      sb.from(T('events')).select('*').order('starts_at'),
      sb.from(T('event_responses')).select('*'),
      sb.rpc(F('app_design')),
      sb.rpc(F('app_language')),
      sb.from(T('tasks')).select('*').order('due_date', { nullsFirst: false }),
      sb.from(T('shop_lists')).select('*').order('created_at'),
      sb.from(T('products')).select('*').order('name'),
      sb.from(T('recurring_tasks')).select('*').order('created_at'),
      sb.from(T('wishes')).select('*')
    ]);
    r.forEach(function (x) { if (x.error) throw x.error; });
    var rt = await pTA; if (rt.error) throw rt.error;
    S.taskAssign = rt.data || [];
    var ra = await pEA; if (ra.error) throw ra.error;
    S.assign = ra.data || [];
    S.members = r[0].data; S.events = r[1].data; S.resp = r[2].data; S.tasks = r[5].data; S.lists = r[6].data; S.products = r[7].data; S.rules = r[8].data; S.wishes = r[9].data || [];
    adminDesign = DESIGNS.some(function (x) { return x.id === r[3].data; }) ? r[3].data : 'standard';
    S.defaultLang = LANGS.indexOf(r[4].data) > -1 ? r[4].data : 'de';
    try { localStorage.setItem('app-default-lang' + SFX, S.defaultLang); } catch (e) { /* ignorieren */ }
    S.me = S.members.filter(function (m) { return m.id === uid; })[0] || null;
    // jede Person kann ihr Design selbst wählen; ohne eigene Wahl gilt das Standard-Design des Admins
    applyDesign(S.me && DESIGNS.some(function (x) { return x.id === S.me.design; }) ? S.me.design : adminDesign);
    // Sprache: eigene Wahl im Profil, sonst die Standardsprache der App
    if (S.me) setLang(LANGS.indexOf(S.me.language) > -1 ? S.me.language : S.defaultLang);
  }
  var reloadTimer, channel;
  function scheduleReload() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(function () {
      if (S.step === 'app' && !document.querySelector('.ccsheet-bg')) loadAll().then(render, function (e) { console.error(e); });
    }, 400);
  }
  function subscribe() { if (!channel) channel = sb.channel('app-data').on('postgres_changes', { event: '*', schema: 'public' }, scheduleReload).subscribe(); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.step === 'app') scheduleReload(); });

  /* ---------- Anmeldung ---------- */
  async function handleLogin(g) {
    var phone = normPhone(g('phone'));
    S.phone = g('phone');
    if (!phone) { S.err = L('phoneInvalid'); return render(); }
    var custom = g('pin');
    if (custom && !/^\d{6}$/.test(custom)) { S.err = L('pinExact'); return render(); }
    S.busy = true; S.err = ''; render();
    try {
      var res = await sb.auth.signInWithPassword({ email: phoneToEmail(phone), password: custom || defaultPin(phone) });
      if (res.error) throw res.error;
      S.busy = false; await enter(res.data.session);
    } catch (e) {
      console.error(e); S.busy = false; S.step = 'login';
      S.err = /invalid login|credentials/i.test(e.message || '') ? L('authFail') : errText(e);
      render();
    }
  }
  async function enter(session) {
    S.session = session; S.step = 'loading'; render();
    try {
      await loadAll();
      if (!S.me) throw new Error(L('noProfile'));
      if (S.me.language && LANGS.indexOf(S.me.language) > -1) setLang(S.me.language);
      if (S.me.theme) setTheme(S.me.theme);
      S.tab = 'events'; S.step = 'app'; S.err = ''; subscribe(); render(); window.scrollTo(0, 0);
      extendSeries().then(function () { render(); }, function (e2) { console.error(e2); });
    } catch (e) { console.error(e); S.step = 'login'; S.err = errText(e); try { await sb.auth.signOut(); } catch (e2) { /* ignorieren */ } render(); }
  }
  async function logout() {
    try { if (channel) { sb.removeChannel(channel); channel = null; } await sb.auth.signOut(); } catch (e) { console.error(e); }
    S.session = null; S.me = null; S.step = 'login'; render();
  }

  /* ---------- Ansichten ---------- */
  function fld(label, name, type, val, extra) {
    return '<label class="fld"><span>' + esc(label) + '</span><input name="' + name + '" type="' + type + '" value="' + esc(val || '') + '" ' + (extra || '') + ' autocomplete="off"></label>';
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleString(LOCALE[lang], { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function toLocalInput(iso) {
    var d = new Date(iso), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function nameOf(id) { var m = S.members.filter(function (x) { return x.id === id; })[0]; return m ? m.name : '?'; }

  function viewLogin() {
    return '<main class="authwrap"><div class="authcard"><h1>' + esc(cfg.APP_NAME || 'App') + '</h1><p class="muted">' + esc(L('loginHint')) + '</p>' +
      '<form data-form="login"><div class="fld"><span>' + esc(L('phone')) + '</span>' + phoneField(S.phone, 'tel') + '</div>' +
      fld(L('pinOptional'), 'pin', 'password', '', 'inputmode="numeric" maxlength="6"') +
      (S.err ? '<p class="err" role="alert">' + esc(S.err) + '</p>' : '') +
      '<button class="btn" type="submit"' + (S.busy ? ' disabled' : '') + '>' + esc(L('login')) + '</button></form></div></main>';
  }

  function eventCard(e) {
    var rs = S.resp.filter(function (r) { return r.event_id === e.id; });
    var yes = rs.filter(function (r) { return r.answer === 'yes'; }), no = rs.filter(function (r) { return r.answer === 'no'; });
    var mine = rs.filter(function (r) { return r.user_id === S.me.id; })[0];
    var open = !!S.open['ev:' + e.id];
    // Namen als Pillen; Gäste mit Rand, die eigene Person fett – wie in der FBRO-App
    var pills = function (a) {
      return a.length ? a.map(function (r) {
        var m = S.members.filter(function (x) { return x.id === r.user_id; })[0] || {}, me = r.user_id === S.me.id;
        return '<span class="ccp' + (m.is_guest ? ' g' : '') + (me ? ' me' : '') + '">' + esc(m.name || '?') + (me ? ' ' + esc(L('you')) : '') + '</span>';
      }).join('') : '<span class="small muted">' + esc(L('evNobody')) + '</span>';
    };
    var btn = function (v, cls, label) { return '<button type="button" class="resp ' + cls + '" data-act="answer" data-id="' + e.id + '" data-val="' + v + '" aria-pressed="' + !!(mine && mine.answer === v) + '">' + esc(label) + '</button>'; };
    var info = !!S.open['evc:' + e.id];
    var asg = S.assign.filter(function (x) { return x.event_id === e.id; });   // Zeit und Ort: standardmässig eingeklappt
    var infoHtml = info ? '<div class="evline"><span class="muted small">' + esc(evTimeText(e)) + (e.place ? ' · ' + esc(e.place) : '') + '</span>' +
      (asg.length ? '<span class="chips">' + pills(asg) + '</span>' : '') + '</div>' +
      (e.comment ? '<p class="evcomment">' + esc(e.comment) + '</p>' : '') : '';    // Antwort-Knöpfe nur, wenn für das Event eine Teilnahme nötig ist (rsvp)
    var rsvpHtml = e.rsvp === false ? '' :
      '<div class="actrow">' + btn('yes', 'yes', L('evYes')) + btn('no', 'no', L('evNo')) +
      '<button type="button" class="resp cntbtn' + (open ? ' is-open' : '') + '" data-act="who" data-id="' + e.id + '" aria-expanded="' + open + '"><b>' + yes.length + '</b>' + ICON.chev + '</button></div>' +
      (open ? '<div class="who"><div><h4>' + esc(L('evParticipants', { n: yes.length })) + '</h4><div class="chips">' + pills(yes) + '</div></div>' +
        '<div><h4>' + esc(L('evDeclined', { n: no.length })) + '</h4><div class="chips">' + pills(no) + '</div></div></div>' : '');
    return '<article class="ccel' + (catOf(e) ? ' hascat' : '') + '"' + (catOf(e) ? ' style="--c:' + catColor(e) + '"' : '') + '><div class="cceh"><b>' + esc(evDayText(e)) + ' – ' + esc(e.title) + (e.series_id ? ' <span class="small muted" title="' + esc(L('evRepeat')) + '">&#8635;</span>' : '') + '</b>' +
      '<button type="button" class="hico" data-act="ev-edit" data-id="' + e.id + '" aria-label="' + esc(L('edit')) + '" title="' + esc(L('edit')) + '">' + ICON.edit + '</button>' +
      '<button type="button" class="hico star' + (isFavEvent(e.id) ? ' on' : '') + '" data-act="ev-fav" data-id="' + e.id + '" aria-pressed="' + isFavEvent(e.id) + '" aria-label="' + esc(L(isFavEvent(e.id) ? 'evUnfav' : 'evFav')) + '" title="' + esc(L(isFavEvent(e.id) ? 'evUnfav' : 'evFav')) + '">' + ICON.star + '</button>' +
      '<button type="button" class="accfold' + (info ? ' open' : '') + '" data-act="ev-card" data-id="' + e.id + '" aria-expanded="' + info + '" aria-label="' + esc(L('evInfo')) + '" title="' + esc(L('evInfo')) + '">' + ICON.chev + '</button></div>' +
      (infoHtml || rsvpHtml ? '<div class="ccbody">' + infoHtml + rsvpHtml + '</div>' : '') + '</article>';
  }
  function fmtDay(iso) { return new Date(iso).toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  // Kategorien der Events: feste Liste, je eine Farbe (events.category = id; leer = keine Kategorie)
  var EVCATS = [
    { id: 'family', c: '#307CC0' }, { id: 'friends', c: '#8E5BD0' }, { id: 'sport', c: '#1E9E6A' }, { id: 'school', c: '#E07B00' },
    { id: 'work', c: '#5A6B7B' }, { id: 'leisure', c: '#1AA3B8' }, { id: 'birthday', c: '#D6477E' }, { id: 'other', c: '#A0764A' }
  ];
  function catOf(e) { return EVCATS.filter(function (x) { return x.id === e.category; })[0] || null; }
  function catColor(e) { var c = catOf(e); return c ? c.c : ''; }
  function fmtDayShort(iso) { return new Date(iso).toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short' }); }
  // Zeitraum eines Events: ends_at ist optional (Datum, Endzeit nur wenn end_time_set); ohne Ende gilt der Starttag
  function evLastDay(e) { return isoDate(new Date(e.ends_at || e.starts_at)); }
  function evMultiDay(e) { return evLastDay(e) !== isoDate(new Date(e.starts_at)); }
  function evDays(e) {   // alle Tage (YYYY-MM-DD), an denen das Event stattfindet
    var out = [], d = new Date(e.starts_at), end = new Date(e.ends_at || e.starts_at);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate()); end = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    for (var n = 0; d <= end && n < 400; n++) { out.push(isoDate(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
    return out;
  }
  function evEndMs(e) {   // bis wann das Event «noch aktuell» ist
    var s = new Date(e.starts_at).getTime();
    if (!e.ends_at) return s + (e.time_set === false ? 86400000 : 0);
    var en = new Date(e.ends_at);
    return e.end_time_set ? en.getTime() : new Date(en.getFullYear(), en.getMonth(), en.getDate() + 1).getTime();
  }
  function evDayText(e) { return evMultiDay(e) ? fmtDayShort(e.starts_at) + ' – ' + fmtDay(e.ends_at) : fmtDay(e.starts_at); }
  function evTimeText(e) {
    if (e.time_set === false) return L('evNoTime');
    var st = fmtTime(e.starts_at), multi = evMultiDay(e);
    if (!e.ends_at || !e.end_time_set) return multi ? L('evFromTime', { t: st }) : st;
    return multi ? L('evFromTime', { t: st }) + ' · ' + L('evUntilTime', { t: fmtTime(e.ends_at) }) : st + ' – ' + fmtTime(e.ends_at);
  }
  // Ende für einen anderen Starttermin (Serien): gleiche Anzahl Tage und gleiche Endzeit wie die Vorlage
  function shiftEnd(refStartIso, refEndIso, newStartIso) {
    if (!refEndIso) return null;
    var rs = new Date(refStartIso), re = new Date(refEndIso), ns = new Date(newStartIso);
    var span = Math.round((new Date(re.getFullYear(), re.getMonth(), re.getDate()) - new Date(rs.getFullYear(), rs.getMonth(), rs.getDate())) / 86400000);
    return new Date(ns.getFullYear(), ns.getMonth(), ns.getDate() + span, re.getHours(), re.getMinutes()).toISOString();
  }
  function fmtTime(iso) { return new Date(iso).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }); }
  // Zeithorizont in Monaten (persönlich, nur auf diesem Gerät gespeichert); 0 = alle Events zeigen
  function evHorizon() {
    var v = null;
    try { v = localStorage.getItem('app-ev-horizon' + SFX); } catch (e) { /* ignorieren */ }
    var n = parseInt(v, 10);
    return isNaN(n) ? 3 : n;
  }
  // Favorit eines Events = Eintrag in event_assignees (Person, Event). Filter oben rechts: nur meine Favoriten oder alles (nur auf diesem Gerät gespeichert)
  function isFavEvent(id) { return S.assign.some(function (x) { return x.event_id === id && x.user_id === S.me.id; }); }
  function evFilterOn() {
    try { return localStorage.getItem('app-ev-filter' + SFX) === '1'; } catch (e) { return false; }
  }
  function agendaEvents() {
    return evFilterOn() ? S.events.filter(function (e) { return isFavEvent(e.id); }) : S.events;
  }
  function monthLabel(iso) { return new Date(iso).toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' }); }
  // Events mit Monatsüberschrift gruppiert (wie in der FBRO-App)
  function monthList(events) {
    var html = '', last = '';
    events.forEach(function (e) {
      var label = monthLabel(e.starts_at);
      if (label !== last) { html += '<h2 class="week">' + esc(label) + '</h2>'; last = label; }
      html += eventCard(e);
    });
    return html;
  }
  // Woche und Monat: Raster oben, darunter die Liste der Termine des Zeitraums (Tippen auf einen Tag zeigt nur dessen Termine)
  function weekStart(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - n);
    return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
  }
  function calCell(key, dn, evs, sel, todayKey) {
    var cls = 'calday' + (evs.length ? ' has' : '') + (key === todayKey ? ' today' : '') + (key === sel ? ' sel' : '');
    if (!evs.length) return '<span class="' + cls + '"><span class="dn">' + dn + '</span></span>';
    var fav = evs.some(function (e) { return isFavEvent(e.id); });
    return '<button type="button" class="' + cls + '" data-act="cal-day" data-val="' + key + '" aria-pressed="' + (key === sel) + '"><span class="dn">' + dn + '</span>' + ICON.cal +
      (evs.length > 1 ? '<span class="cn">' + evs.length + '</span>' : '') + (fav ? '<span class="cfav" aria-hidden="true">' + ICON.star + '</span>' : '') + '</button>';
  }
  // Wochenansicht: wie der Monat aufgebaut (Wochentage oben, je Tag eine Spalte), gezeigt wird 6–24 Uhr ohne Zeitangaben;
  // Termine als Blöcke an ihrer Uhrzeit, ganztägige/mehrtägige Events als Chips oben in der Spalte; Hilfslinien alle 3 Stunden
  function weekTimetable(from, byDay, sel, todayKey) {
    var H0 = 6, H1 = 24, HP = 14, days = [], segs = {}, allday = {};   // 6–24 Uhr; Linien alle 3 Stunden (CSS)
    for (var c = 0; c < 7; c++) {
      var d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + c), k = isoDate(d);
      var ds = d.getTime(), de = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      days.push({ d: d, k: k }); segs[k] = []; allday[k] = [];
      (byDay[k] || []).forEach(function (e) {
        if (e.time_set === false) { allday[k].push(e); return; }
        var st = new Date(e.starts_at).getTime(), en = e.ends_at ? evEndMs(e) : st + 3600000;   // ohne Ende: eine Stunde
        var sm = Math.round((Math.max(st, ds) - ds) / 60000), em = Math.min(1440, Math.max(Math.round((Math.min(en, de) - ds) / 60000), sm + 30));
        sm = Math.min(Math.max(sm, H0 * 60), H1 * 60 - 45); em = Math.max(Math.min(em, H1 * 60), sm + 45);   // in den sichtbaren Bereich legen
        segs[k].push({ e: e, s: sm, en: Math.min(em, H1 * 60) });
      });
    }
    days.forEach(function (dy) {   // überlappende Termine nebeneinander
      var list = segs[dy.k].sort(function (x, y) { return x.s - y.s || x.en - y.en; }), laneEnd = [];
      list.forEach(function (sg) { var l = 0; while (laneEnd[l] > sg.s) l++; laneEnd[l] = sg.en; sg.lane = l; });
      dy.lanes = Math.max(1, laneEnd.length);
    });
    var anyAll = days.some(function (dy) { return allday[dy.k].length; });
    var now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    var html = '<div class="calgrid calwd">' + days.map(function (dy) { return '<span>' + esc(dy.d.toLocaleDateString(LOCALE[lang], { weekday: 'short' })) + '</span>'; }).join('') + '</div>';
    html += '<div class="wkgrid">' + days.map(function (dy) {
      var chips = allday[dy.k].slice(0, 2).map(function (e) {
        return '<button type="button" class="wkchip' + (isFavEvent(e.id) ? ' fav' : '') + '" data-act="cal-day" data-val="' + dy.k + '"' + (catOf(e) ? ' style="--c:' + catColor(e) + '"' : '') + ' title="' + esc(e.title) + '">' + esc(e.title) + '</button>';
      }).join('') + (allday[dy.k].length > 2 ? '<i>+' + (allday[dy.k].length - 2) + '</i>' : '');
      var blocks = segs[dy.k].map(function (sg) {
        var top = (sg.s - H0 * 60) / 60 * HP, hgt = Math.max(14, (sg.en - sg.s) / 60 * HP - 1), w = 100 / dy.lanes;
        return '<button type="button" class="wkb' + (isFavEvent(sg.e.id) ? ' fav' : '') + '" data-act="cal-day" data-val="' + dy.k + '" style="' + (catOf(sg.e) ? '--c:' + catColor(sg.e) + ';' : '') + 'top:' + top + 'px;height:' + hgt + 'px;left:' + sg.lane * w + '%;width:calc(' + w + '% - 1px)" title="' + esc(sg.e.title) + '">' + esc(sg.e.title) + '</button>';
      }).join('');
      var nowLine = dy.k === todayKey && nowMin >= H0 * 60 && nowMin <= H1 * 60 ? '<div class="wknow" style="top:' + (nowMin - H0 * 60) / 60 * HP + 'px"></div>' : '';
      return '<div class="wkcol' + (dy.k === todayKey ? ' today' : '') + (dy.k === sel ? ' sel' : '') + '">' +
        '<button type="button" class="wkday" data-act="cal-day" data-val="' + dy.k + '" aria-pressed="' + (dy.k === sel) + '">' + dy.d.getDate() + '</button>' +
        (anyAll ? '<div class="wkad">' + chips + '</div>' : '') +
        '<div class="wkbody" style="height:' + (H1 - H0) * HP + 'px;--hp:' + HP + 'px">' + blocks + nowLine + '</div></div>';
    }).join('') + '</div>';
    // Legende: Kategorien, die in dieser Woche vorkommen
    var used = {}; days.forEach(function (dy) { (byDay[dy.k] || []).forEach(function (e) { if (catOf(e)) used[e.category] = true; }); });
    var leg = EVCATS.filter(function (x) { return used[x.id]; });
    if (leg.length) html += '<div class="ttleg">' + leg.map(function (x) { return '<span style="--c:' + x.c + '"><i></i>' + esc(L('cat_' + x.id)) + '</span>'; }).join('') + '</div>';
    return html;
  }
  function viewCalendar(mode) {
    var now = new Date(), todayKey = isoDate(now), week = mode === 'week';
    var byDay = {};
    agendaEvents().forEach(function (e) { evDays(e).forEach(function (k) { (byDay[k] = byDay[k] || []).push(e); }); });   // mehrtägige Events an jedem Tag
    var from, to, label, canNext, cells = '';
    var lastOk = new Date(now.getFullYear(), now.getMonth() + 12, 1);
    if (week) {
      from = S.calWeek ? new Date(S.calWeek) : weekStart(now);
      to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
      var last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
      label = L('evWeekLabel', { n: isoWeek(from) }) + ' · ' + from.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short' }) + ' – ' + last.toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'short', year: 'numeric' });
      canNext = to <= lastOk;
    } else {
      var base = S.calMonth ? new Date(S.calMonth) : new Date(now.getFullYear(), now.getMonth(), 1);
      from = new Date(base.getFullYear(), base.getMonth(), 1); to = new Date(base.getFullYear(), base.getMonth() + 1, 1);
      label = base.toLocaleDateString(LOCALE[lang], { month: 'long', year: 'numeric' });
      canNext = to <= lastOk;
    }
    var sel = S.calDay && S.calDay >= isoDate(from) && S.calDay < isoDate(to) ? S.calDay : '';
    var html = '<div class="calnav"><button type="button" class="hico" data-act="cal-prev" aria-label="' + esc(L(week ? 'evPrevWeek' : 'evPrevMonth')) + '">' + ICON.chev + '</button>' +
      '<b>' + esc(label) + '</b>' +
      '<button type="button" class="hico" data-act="cal-next" aria-label="' + esc(L(week ? 'evNextWeek' : 'evNextMonth')) + '"' + (canNext ? '' : ' disabled') + '>' + ICON.chev + '</button></div>';
    if (week) {
      html += weekTimetable(from, byDay, sel, todayKey);
    } else {
      html += '<div class="calgrid calwd">' + [1, 2, 3, 4, 5, 6, 7].map(function (d) { return '<span>' + esc(new Date(2024, 0, d).toLocaleDateString(LOCALE[lang], { weekday: 'short' })) + '</span>'; }).join('') + '</div>';
      var y = from.getFullYear(), m = from.getMonth(), lead = (from.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate(), weeks = Math.ceil((lead + dim) / 7);
      for (var c2 = 0; c2 < weeks * 7; c2++) {
        var dn = c2 - lead + 1;
        if (dn < 1 || dn > dim) { cells += '<span class="calday out"></span>'; continue; }
        var key = isoDate(new Date(y, m, dn)); cells += calCell(key, dn, byDay[key] || [], sel, todayKey);
      }
    }
    if (!week) html += '<div class="calgrid">' + cells + '</div>';
    // Liste darunter: Termine des Zeitraums, oder nur des gewählten Tages
    var f = sel || isoDate(from), t = sel ? null : isoDate(to);
    var list = agendaEvents().filter(function (e) { var ds = evDays(e); return sel ? ds.indexOf(sel) > -1 : ds.some(function (k) { return k >= f && k < t; }); }).sort(function (x, y) { return new Date(x.starts_at) - new Date(y.starts_at); });
    html += '<p class="muted small calhint">' + esc(L('evCalHint')) + '</p>';
    html += list.length ? '<div class="calsel">' + list.map(eventCard).join('') + '</div>' : '<div class="empty"><p>' + esc(L('evNoneInPeriod')) + '</p></div>';
    return html;
  }
  function viewEvents() {
    var limit = Date.now() - 3 * 3600e3;
    var yc = new Date(); yc.setFullYear(yc.getFullYear() + 1); var yearCut = yc.getTime();   // Agenda zeigt höchstens ein Jahr voraus
    var evs0 = agendaEvents();
    // aktuell bis zum Ende (mehrtägige Events bis zum letzten Tag; ohne Uhrzeit bis Tagesende)
    var up = evs0.filter(function (e) { return evEndMs(e) >= limit && new Date(e.starts_at).getTime() < yearCut; });
    var past = evs0.filter(function (e) { return evEndMs(e) < limit; }).reverse();
    var hz = evHorizon(), cut = null;
    if (hz > 0) { var c = new Date(); c.setMonth(c.getMonth() + hz); cut = c.getTime(); }
    var near = cut === null ? up : up.filter(function (e) { return new Date(e.starts_at).getTime() < cut; });
    var far = cut === null ? [] : up.filter(function (e) { return new Date(e.starts_at).getTime() >= cut; });
    // «…» stellt den Zeithorizont ein (alle), «+» legt Events an (Admins und Event Manager)
    var html = '<div class="top"><div><h1 class="pagetitle">' + esc(L('navEvents')) + '</h1></div>' +
      '<button type="button" class="hico addbtn" data-act="ev-horizon" aria-label="' + esc(L('evHorizonTitle')) + '" title="' + esc(L('evHorizonTitle')) + '">' + ICON.dots + '</button>' +
      '<button type="button" class="hico addbtn' + (evFilterOn() ? ' on' : '') + '" data-act="ev-filter" aria-pressed="' + evFilterOn() + '" aria-label="' + esc(L('evFilter')) + '" title="' + esc(L(evFilterOn() ? 'evFilterOnTip' : 'evFilter')) + '">' + ICON.filter + '</button>' +
      (canManageEvents() ? '<button type="button" class="hico addbtn" data-act="ev-new" aria-label="' + esc(L('evNew')) + '" title="' + esc(L('evNew')) + '">' + ICON.plus + '</button>' : '') + '</div>';
    // drei Register: Liste | Woche | Monat (Woche und Monat zeigen die Liste des Zeitraums unten)
    var evv = S.evView === 'week' ? 'week' : (S.evView === 'month' || S.evView === 'cal') ? 'month' : 'list';
    var etab = function (v, label) { var on = v === evv; return '<button type="button" role="tab" class="subtab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-act="ev-view" data-val="' + v + '">' + esc(label) + '</button>'; };
    html += '<div class="subtabs" role="tablist">' + etab('list', L('evTabList')) + etab('week', L('evTabWeek')) + etab('month', L('evTabMonth')) + '</div>';
    if (evv !== 'list') return html + viewCalendar(evv);
    if (near.length) html += monthList(near);
    else html += '<div class="empty"><p>' + esc(far.length ? L('evNoneInHorizon', { n: hz }) : L('evEmpty')) + '</p></div>';
    if (far.length) {
      var more = !!S.open.evmore;
      html += '<button type="button" class="morebtn" data-act="ev-more" aria-expanded="' + more + '"><span>' + esc(L('evMore', { n: far.length })) + '</span>' + ICON.chev + '</button>';
      if (more) html += monthList(far);
    }
    return html;
  }

  // «Favorit für» (Dropdown, 0–n Personen) für Events und Tasks: Verwalter (Ersteller/in, Admins, Event Manager) ändern alle;
  // alle anderen können Personen hinzufügen und sich selbst abwählen – wer schon Favorit ist, bleibt gesperrt (ausser ich selbst)
  function favPeopleField(have, canManage) {
    return { name: 'users', label: L('shFavFor'), type: 'multi', dropdown: true,
      value: canManage ? have : (have.indexOf(S.me.id) > -1 ? [S.me.id] : []),
      options: memberOptions().map(function (o) { return { v: o.v, l: o.l, lock: !canManage && have.indexOf(o.v) > -1 && o.v !== S.me.id }; }) };
  }
  /* ---------- Tasks: gemeinsame Aufgaben; Favorit = zugeteilte Person (lata-task_assignees); Termin optional ---------- */
  function today() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function fmtDue(d) { return new Date(d + 'T12:00:00').toLocaleDateString(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function isFavTask(id) { return S.taskAssign.some(function (x) { return x.task_id === id && x.user_id === S.me.id; }); }
  function taskWho(id) { return S.taskAssign.filter(function (x) { return x.task_id === id; }).map(function (x) { return x.user_id; }); }
  function canEditTask(t) { return t.created_by === S.me.id || isAdmin(); }
  // offene zuerst, nach Termin; ohne Termin am Ende; erledigte ganz unten
  function taskSort(a, b) {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date || b.due_date) return a.due_date ? -1 : 1;
    return a.title.localeCompare(b.title, LOCALE[lang]);
  }
  function taskRow(t) {
    var fav = isFavTask(t.id), canEdit = canEditTask(t), canDone = fav || canEdit;   // erledigen: Zugeteilte, Ersteller/in, Admins
    var over = !t.done && t.due_date && t.due_date < today();
    var who = taskWho(t.id).map(function (u) { return u === S.me.id ? L('you') : nameOf(u); });
    var favLbl = fav ? L('shFavRemove') : L('shFavAdd');
    return '<li class="trow' + (t.done ? ' tdone' : '') + '">' +
      (canDone ? '<button type="button" role="checkbox" class="tchk' + (t.done ? ' on' : '') + '" data-act="task-done" data-id="' + t.id + '" aria-checked="' + t.done + '" aria-label="' + esc(t.done ? L('taskReopen') : L('taskDone')) + '" title="' + esc(t.done ? L('taskReopen') : L('taskDone')) + '">' + ICON.check + '</button>' : '<span class="tspace" aria-hidden="true"></span>') +
      '<div class="l"><b>' + esc(t.title) + '</b>' +
      (who.length ? '<span>' + esc(L('shFor', { names: who.join(', ') })) + '</span>' : '') +
      (t.due_date ? '<span class="' + (over ? 'tover' : '') + '">' + esc(L('taskDueOn', { date: fmtDue(t.due_date) })) + (over ? ' · ' + esc(L('taskOverdue')) : '') + '</span>' : '') +
      (t.note ? '<span class="tnote">' + esc(t.note) + '</span>' : '') + '</div>' +
      '<div class="btnrow">' +
      '<button type="button" class="hico" data-act="task-edit" data-id="' + t.id + '" aria-label="' + esc(L('edit')) + '" title="' + esc(L('edit')) + '">' + ICON.edit + '</button>' +
      '<button type="button" class="hico star' + (fav ? ' on' : '') + '" data-act="task-fav" data-id="' + t.id + '" aria-pressed="' + fav + '" aria-label="' + esc(favLbl) + '" title="' + esc(favLbl) + '">' + ICON.star + '</button></div></li>';
  }
  function viewTasks() {
    var favs = S.tasks.filter(function (t) { return isFavTask(t.id); }).sort(taskSort);
    var more = S.tasks.filter(function (t) { return !isFavTask(t.id); }).sort(taskSort);
    var open = function (a) { return a.filter(function (t) { return !t.done; }).length; };
    var list = function (a) { return a.length ? '<ul class="list">' + a.map(taskRow).join('') + '</ul>' : '<p class="muted">' + esc(L('taskEmpty')) + '</p>'; };
    // wie im Einkauf: oben meine Favoriten, darunter alle weiteren Aufgaben; «+» legt eine neue Aufgabe an
    return '<div class="top"><div><h1 class="pagetitle">' + esc(L('navTasks')) + '</h1></div></div>' +
      accordion('task-favs', L('taskMine'), open(favs), list(favs)) +
      accordion('task-more', L('taskMore'), open(more), list(more), 'task-new', L('taskNew'));
  }
  async function taskForm(t) {
    // Ersteller/in und Admins ändern die Aufgabe; alle anderen sehen nur «Favorit für» (Personen hinzufügen, sich selbst abwählen)
    var manage = !t || canEditTask(t), have = t ? taskWho(t.id) : [S.me.id];
    var fields = manage ? [
      { name: 'title', label: L('taskTitle'), value: t && t.title, inline: true },
      { name: 'due_date', label: L('taskDue'), type: 'date', value: t ? t.due_date : '', inline: true },
      { name: 'note', label: L('taskNote'), value: t && t.note, inline: true },
      favPeopleField(have, true)
    ] : [favPeopleField(have, false)];
    var f = await askForm(t ? L('taskEdit') : L('taskNew'), fields, null, null, t && manage ? L('del') : null);   // «Löschen» unten im Dialog
    if (!f) return;
    if (f.__extra) {
      if (await askConfirm(L('del'), L('taskDeleteAsk', { title: t.title }), true))
        return act(async function () { var r = await sb.from(T('tasks')).delete().eq('id', t.id); if (r.error) throw r.error; }, L('removed'));
      return;
    }
    if (manage && !f.title) return toast(L('taskMissing'));
    return act(async function () {
      var row = { title: f.title, due_date: f.due_date || null, note: f.note || null }, id = t ? t.id : null;
      if (manage) {
        if (t) { var ru = await sb.from(T('tasks')).update(row).eq('id', id); if (ru.error) throw ru.error; }
        else { row.created_by = S.me.id; var ri = await sb.from(T('tasks')).insert(row).select('id'); if (ri.error) throw ri.error; id = ri.data[0].id; }
      }
      var sel = f.users || [], had = t ? taskWho(id) : [];
      var add = sel.filter(function (u) { return had.indexOf(u) < 0; }), rem = had.filter(function (u) { return sel.indexOf(u) < 0; });
      if (add.length) { var ra = await sb.from(T('task_assignees')).insert(add.map(function (u) { return { task_id: id, user_id: u }; })); if (ra.error) throw ra.error; }
      if (rem.length) { var rr = await sb.from(T('task_assignees')).delete().eq('task_id', id).in('user_id', rem); if (rr.error) throw rr.error; }
    }, L('saved'));
  }

  /* ---------- Einkauf: Produktkatalog (jedes Produkt genau einmal) und Wünsche pro Person ---------- */
  // lata-products: ein Eintrag je Produkt. lata-wishes: eine Person führt ein Produkt auf ihrer Wunschliste (Notiz, Liste, ausgewählt, abgehakt).
  // Eine Zeile in der Oberfläche heisst «Item»: { p: Produkt, w: mein Wunsch oder null, ws: Wünsche der Zeile, listId }
  function listById(id) { return S.lists.filter(function (x) { return x.id === id; })[0] || null; }
  function byName(a, b) { return a.name.localeCompare(b.name, LOCALE[lang]); }
  function byItem(a, b) { return byName(a.p, b.p); }
  function sortedLists() { return S.lists.slice().sort(byName); }   // Listen immer alphabetisch
  function listOptions(withNone) {
    var o = withNone ? [{ v: '', l: L('shNoList') }] : [];
    return o.concat(sortedLists().map(function (l) { return { v: l.id, l: l.name + (l.is_private ? ' (' + L('shPrivTag').toLowerCase() + ')' : '') }; }));
  }
  function lockIcon(l) { return l && l.is_private ? '<span class="lock" title="' + esc(L('shPrivTag')) + '">' + ICON.lock + '</span>' : ''; }
  function productById(id) { return S.products.filter(function (x) { return x.id === id; })[0] || null; }
  function myWish(pid) { return S.wishes.filter(function (w) { return w.product_id === pid && w.user_id === S.me.id; })[0] || null; }
  function wishersOf(pid) { return S.wishes.filter(function (w) { return w.product_id === pid; }); }
  function canRename(p) { return p.created_by === S.me.id || isAdmin(); }
  // Wünsche nach Produkt gruppieren → Items, alphabetisch
  function groupItems(ws, listId) {
    var g = {}, order = [];
    ws.forEach(function (w) { if (!g[w.product_id]) { g[w.product_id] = []; order.push(w.product_id); } g[w.product_id].push(w); });
    return order.map(function (pid) {
      return { p: productById(pid), w: g[pid].filter(function (x) { return x.user_id === S.me.id; })[0] || null, ws: g[pid], listId: listId || '' };
    }).filter(function (it) { return it.p; }).sort(byItem);
  }
  function needMeta(it, mode) {
    var parts = [], notes = [];
    if (mode !== 'more') it.ws.forEach(function (x) { if (x.note && notes.indexOf(x.note) < 0) notes.push(x.note); });
    notes.forEach(function (n) { parts.push(esc(n)); });
    // wer das Produkt sonst noch als Favorit führt (Weitere Produkte) bzw. wer es in der Einkaufsliste braucht
    if ((mode === 'more' && it.ws.length) || ((mode === 'list' || mode === 'none') && (it.ws.length > 1 || !it.w))) {
      parts.push(esc(L('shFor', { names: it.ws.map(function (x) { return x.user_id === S.me.id ? L('you') : nameOf(x.user_id); }).join(', ') })));
    }
    if (mode === 'fav') { var l = listById(it.w.list_id); parts.push(l ? lockIcon(l) + esc(l.name) : esc(L('shNoList'))); }
    return parts.join(' · ');
  }
  // Zeile eines Produkts; mode: fav (meine Favoriten) | more (weitere Produkte) | list (in einer Einkaufsliste) | none (Favorit ohne Liste)
  // Rechts: «…», Stern (gefüllt = Favorit) und Kästchen. Favoriten: Kästchen = «auf die Einkaufsliste» (selected).
  // Einkaufsliste: Kästchen = gekauft (checked) für alle Wünschenden der Zeile, gedimmt unten.
  function needRow(it, mode) {
    var fav = mode === 'fav', shop = mode === 'list' || mode === 'none';
    var bought = it.ws.length > 0 && it.ws.every(function (x) { return x.checked; });
    var on = fav ? !!it.w.selected : bought;
    var lbl = fav ? L('shSelect') : L('shBought');
    var check = (fav || shop)
      ? '<button type="button" role="checkbox" class="tchk' + (on ? ' on' : '') + '" data-act="' + (fav ? 'need-sel' : 'need-check') + '" data-id="' + it.p.id + '" data-val="' + (fav ? (on ? '0' : '1') : (on ? '0' : '1') + ':' + it.listId) + '" aria-checked="' + on + '" aria-label="' + esc(lbl) + '" title="' + esc(lbl) + '">' + ICON.check + '</button>' : '';
    var isFav = !!it.w, favLbl = isFav ? L('shFavRemove') : L('shFavAdd');
    var star = '<button type="button" class="hico star' + (isFav ? ' on' : '') + '" data-act="' + (isFav ? 'need-unwish' : 'need-wish') + '" data-id="' + it.p.id + '" aria-pressed="' + isFav + '" aria-label="' + esc(favLbl) + '" title="' + esc(favLbl) + '">' + ICON.star + '</button>';
    var menu = '<button type="button" class="hico" data-act="need-edit" data-id="' + it.p.id + '" aria-label="' + esc(L('edit')) + '" title="' + esc(L('edit')) + '">' + ICON.edit + '</button>';
    return '<li class="trow shopi' + ((fav ? it.w.checked : shop && bought) ? ' chk' : '') + '">' +
      '<div class="l"><b>' + esc(it.p.name) + '</b><span>' + needMeta(it, mode) + '</span></div>' +
      '<div class="btnrow">' + menu + star + '</div>' + (check || '<span class="tspace" aria-hidden="true"></span>') + '</li>';
  }
  function ulOf(rows, emptyKey) { return rows.length ? '<ul class="list">' + rows.join('') + '</ul>' : '<p class="muted">' + esc(L(emptyKey)) + '</p>'; }
  function viewShop() {
    var needView = S.shopView !== 'lists';
    var html = '<div class="top"><div><h1 class="pagetitle">' + esc(L('navShop')) + '</h1></div>' +
      (needView ? '' : '<button type="button" class="hico addbtn" data-act="list-new" aria-label="' + esc(L('shNewList')) + '" title="' + esc(L('shNewList')) + '">' + ICON.plus + '</button>') + '</div>';
    // zwei Register (Tabs) statt Knöpfe
    var tab = function (v, label) { var on = (v === 'need') === needView; return '<button type="button" role="tab" class="subtab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-act="shop-view" data-val="' + v + '">' + esc(label) + '</button>'; };
    html += '<div class="subtabs" role="tablist">' + tab('need', L('shNeed')) + tab('lists', L('shLists')) + '</div>';
    return html + (needView ? viewNeeds() : viewLists());
  }
  function viewNeeds() {
    var uid = S.me.id;
    // Meine Favoriten: meine Wünsche, alphabetisch; das Kästchen setzt ein Produkt auf die Einkaufsliste
    var favs = S.wishes.filter(function (w) { return w.user_id === uid; }).map(function (w) { return { p: productById(w.product_id), w: w, ws: [w], listId: w.list_id || '' }; })
      .filter(function (it) { return it.p; }).sort(byItem);
    // Weitere Produkte: alle übrigen Produkte (auch ohne Wünsche); «+» legt ein neues Produkt an
    var mine = {}; favs.forEach(function (it) { mine[it.p.id] = true; });
    var more = S.products.filter(function (p) { return !mine[p.id]; }).map(function (p) { return { p: p, w: null, ws: S.wishes.filter(function (w) { return w.product_id === p.id; }), listId: '' }; }).sort(byItem);
    return accordion('need-open', L('shFavs'), favs.length, ulOf(favs.map(function (it) { return needRow(it, 'fav'); }), 'shEmpty')) +
      accordion('need-others', L('shMore'), more.length, ulOf(more.map(function (it) { return needRow(it, 'more'); }), 'shMoreEmpty'), 'need-new', L('shAdd'));
  }  function viewLists() {
    var sel = S.wishes.filter(function (w) { return w.selected; });   // nur auf der Wunschliste gewählte Produkte
    var none = groupItems(sel.filter(function (w) { return !w.list_id && w.user_id === S.me.id; }));   // ohne Liste: nur meine
    var html = accordion('lst-none', L('shNoList'), none.length, ulOf(none.map(function (it) { return needRow(it, 'none'); }), 'shEmpty'));
    if (!S.lists.length) html += '<div class="empty"><p>' + esc(L('shNoLists')) + '</p></div>';
    sortedLists().forEach(function (l) {
      var items = groupItems(sel.filter(function (w) { return w.list_id === l.id; }), l.id);   // jedes Produkt einmal, mit den Namen der Wünschenden
      var isDone = function (it) { return it.ws.every(function (x) { return x.checked; }); };
      var itemsOpen = items.filter(function (it) { return !isDone(it); }), itemsDone = items.filter(isDone);
      var dots = l.owner_id === S.me.id ? '<button type="button" class="hico" data-act="list-menu" data-id="' + l.id + '" aria-label="' + esc(L('shManage')) + '" title="' + esc(L('shManage')) + '">' + ICON.dots + '</button>' : '';
      var open = S.sec['lst-' + l.id] !== false;
      html += '<section class="acc' + (l.is_private ? ' privlist' : '') + '"><div class="acch">' +
        '<button type="button" class="acct" data-act="sec" data-id="lst-' + l.id + '" aria-expanded="' + open + '">' + lockIcon(l) + esc(l.name) + ' <span class="cnt">(' + itemsOpen.length + ')</span>' +
        (l.is_private ? '<span class="privtag">' + esc(L('shPrivTag')) + '</span>' : '') + '</button>' +
        dots + '<button type="button" class="hico" data-act="list-update" data-id="' + l.id + '" aria-label="' + esc(L('shUpdate')) + '" title="' + esc(L('shUpdate')) + '">' + ICON.refresh + '</button>' +
        '<button type="button" class="accfold' + (open ? ' open' : '') + '" data-act="sec" data-id="lst-' + l.id + '" aria-hidden="true" tabindex="-1">' + ICON.chev + '</button></div>' +
        (open ? '<div class="accbody">' + (itemsOpen.length || !itemsDone.length ? ulOf(itemsOpen.map(function (it) { return needRow(it, 'list'); }), 'shEmpty') : '') +
          (itemsDone.length ? '<ul class="list">' + itemsDone.map(function (it) { return needRow(it, 'list'); }).join('') + '</ul>' : '') + '</div>' : '') + '</section>';
    });
    return html;
  }
  function memberOptions() {
    return S.members.slice().sort(function (a, b) { return a.name.localeCompare(b.name, LOCALE[lang]); }).map(function (m) { return { v: m.id, l: m.name + (m.id === S.me.id ? ' (' + L('you') + ')' : '') }; });
  }
  // Neues Produkt: der Server legt es nur an, wenn es noch nicht existiert (Name ohne Gross-/Kleinschreibung eindeutig), und macht es zu meinem Favoriten
  async function needAdd(name, extra) {
    extra = extra || {};
    name = String(name || '').trim();
    if (!name) return toast(L('shMissing'));
    var low = name.toLowerCase(), users = extra.users || [];
    var prod = S.products.filter(function (p) { return p.name.trim().toLowerCase() === low; })[0];
    // gibt es das Produkt schon und niemand Neues wird Favorit, ist nichts zu tun
    if (prod && !users.some(function (u) { return !S.wishes.some(function (w) { return w.product_id === prod.id && w.user_id === u; }); })) return toast(L('shAlready'));
    return act(async function () {
      var r = await sb.rpc(F('add_wish'), { p_name: name, p_note: extra.note || null, p_list: extra.list_id || null, p_users: users });
      if (r.error) throw r.error;
    });
  }
  // Produkt bearbeiten: Name (wer es angelegt hat, und Admins), Notiz und Liste gehören zu meinem Favoriten
  // «Favorit für»: andere Personen können hier dazukommen; wer das Produkt schon führt, kann nur selbst abwählen (Stern) – ausser mir
  function favForField(p, users) {
    var have = {}; if (p) wishersOf(p.id).forEach(function (w) { have[w.user_id] = true; });
    return { name: 'users', label: L('shFavFor'), type: 'multi', dropdown: true, value: users,
      options: memberOptions().map(function (o) { return { v: o.v, l: o.l, lock: !!have[o.v] && o.v !== S.me.id }; }) };
  }
  function needEditForm(p) {
    var w = myWish(p.id), fields = [];
    if (canRename(p)) fields.push({ name: 'name', label: L('shName'), value: p.name, inline: true });
    // Notiz und Liste gehören zum Favoriten; ist das Produkt noch kein Favorit, gelten sie für die neu gewählten Personen
    fields.push({ name: 'note', label: L('shNote'), value: w ? w.note : '', inline: true });
    fields.push({ name: 'list_id', label: L('shList'), type: 'select', value: (w && w.list_id) || '', options: listOptions(true), inline: true });
    fields.push(favForField(p, w ? [S.me.id] : []));
    return askForm(L('shEditNeed'), fields, null, null, canRename(p) ? L('shProdDel') : null);   // «Produkt löschen» unten im Dialog
  }

  function viewProfile() {
    var opt = function (v, l) { return '<button type="button" class="segbtn' + (theme === v ? ' on' : '') + '" data-act="set-theme" data-val="' + v + '" aria-pressed="' + (theme === v) + '">' + esc(l) + '</button>'; };
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var install = standalone ? '<p class="muted">' + esc(L('installDone')) + '</p>'
      : installEvt ? '<p class="muted">' + esc(L('installHint')) + '</p><button class="btn" data-act="install">' + esc(L('installBtn')) + '</button>'
      : '<p class="muted">' + esc(ios ? L('installIos') : L('installHint')) + '</p>';
    return '<div class="top"><div><h1 class="pagetitle">' + esc(L('navProfile')) + '</h1></div></div>' +
      '<section class="card"><h2>' + esc(L('myAccount')) + '</h2>' +
      '<button type="button" class="profrow" data-act="edit-name"><span class="muted">' + esc(L('fullName')) + '</span><b>' + esc(S.me.name) + '</b>' + ICON.edit + '</button>' +
      '<button type="button" class="profrow" data-act="edit-phone"><span class="muted">' + esc(L('phone')) + '</span><b>' + esc(fmtPhone(S.me.phone)) + '</b>' + ICON.edit + '</button>' +
      '<div class="profile-row"><span class="muted">' + esc(L('roles')) + '</span><span class="chips">' + roleLabels(S.me).map(function (r) { return '<span class="ccp">' + esc(r) + '</span>'; }).join('') + '</span></div></section>' +
      '<section class="card"><h2>' + esc(L('language')) + '</h2><div class="segctl">' + LANGS.map(function (l) {
        return '<button type="button" class="segbtn' + (l === lang ? ' on' : '') + '" data-act="set-lang" data-val="' + l + '" aria-pressed="' + (l === lang) + '">' + esc(LANG_NAMES[l]) + '</button>';
      }).join('') + '</div></section>' +
      '<section class="card"><h2>' + esc(L('theme')) + '</h2><div class="segctl">' + opt('light', L('themeLight')) + opt('dark', L('themeDark')) + opt('', L('themeAuto')) + '</div></section>' +
      '<section class="card"><h2>' + esc(L('designTitle')) + '</h2><div class="segctl">' + DESIGNS.map(function (d) { return '<button type="button" class="segbtn' + (design === d.id ? ' on' : '') + '" data-act="set-design" data-val="' + d.id + '" aria-pressed="' + (design === d.id) + '">' + esc(L('design_' + d.id)) + '</button>'; }).join('') + '</div></section>' +
      '<section class="card"><h2>' + esc(L('pin')) + '</h2><form data-form="pin">' + fld(L('newPin'), 'pin', 'password', '', 'inputmode="numeric" maxlength="6"') +
      '<button class="btn" type="submit">' + esc(L('changePin')) + '</button></form></section>' +
      '<section class="card"><h2>' + esc(L('installTitle')) + '</h2>' + install + '</section>' +
      '<section class="card"><button class="btn ghost" data-act="logout">' + esc(L('logout')) + '</button></section>';
  }

  /* ---------- Wiederkehrende Tasks (nur Admin): werden beim Öffnen der App automatisch als Task erzeugt ---------- */
  function weekdayName(n, style) { return new Date(2024, 0, n).toLocaleDateString(LOCALE[lang], { weekday: style || 'long' }); }   // 1.1.2024 war ein Montag
  function recurText(r) {
    if (r.freq === 'daily') return L('recDaily');
    if (r.freq === 'weekly') return L('recEveryWeekly', { day: weekdayName(r.weekday || 1) });
    return L('recEveryMonthly', { day: r.month_day || 1 });
  }
  async function recurForm(r) {
    var days = [1, 2, 3, 4, 5, 6, 7].map(function (n) { return { v: String(n), l: weekdayName(n) }; });
    var f = await askForm(r ? L('recurEdit') : L('recurNew'), [
      { name: 'title', label: L('taskTitle'), value: r && r.title },
      { name: 'assigned_to', label: L('taskAssignee'), type: 'select', value: r ? r.assigned_to : S.me.id, options: S.members.map(function (m) { return { v: m.id, l: m.name + (m.id === S.me.id ? ' (' + L('you') + ')' : '') }; }) },
      { name: 'freq', label: L('recFreq'), type: 'select', value: r ? r.freq : 'weekly', options: [{ v: 'daily', l: L('recDaily') }, { v: 'weekly', l: L('recWeekly') }, { v: 'monthly', l: L('recMonthly') }] },
      { name: 'weekday', label: L('recWeekday'), type: 'select', value: String((r && r.weekday) || 1), options: days },
      { name: 'month_day', label: L('recMonthDay'), type: 'number', value: String((r && r.month_day) || 1) },
      { name: 'start_date', label: L('recStart'), type: 'date', value: r ? r.start_date : today() },
      { name: 'note', label: L('taskNote'), value: r && r.note }
    ]);
    if (!f) return;
    var md = Math.min(28, Math.max(1, parseInt(f.month_day, 10) || 1));
    if (!f.title || !f.assigned_to || !f.start_date) return toast(L('recMissing'));
    var row = { title: f.title, note: f.note || null, assigned_to: f.assigned_to, freq: f.freq,
      weekday: f.freq === 'weekly' ? parseInt(f.weekday, 10) : null, month_day: f.freq === 'monthly' ? md : null, start_date: f.start_date };
    if (!r) row.created_by = S.me.id;
    return act(async function () {
      var q = r ? await sb.from(T('recurring_tasks')).update(row).eq('id', r.id) : await sb.from(T('recurring_tasks')).insert(row);
      if (q.error) throw q.error;
    }, L('saved'));
  }
  function recurBody() {
    var rows = S.rules.map(function (r) {
      return '<li class="trow' + (r.active ? '' : ' tdone') + '"><div class="l"><b>' + esc(r.title) + '</b>' +
        '<span>' + esc(recurText(r)) + ' · ' + esc(nameOf(r.assigned_to)) + '</span>' +
        '<span class="tnote">' + esc(r.active ? L('recNext', { date: fmtDue(r.next_due) }) : L('recPaused')) + '</span></div>' +
        '<div class="btnrow"><button type="button" class="mini" data-act="rec-toggle" data-id="' + r.id + '">' + esc(r.active ? L('recPause') : L('recResume')) + '</button>' +
        '<button type="button" class="mini" data-act="rec-edit" data-id="' + r.id + '">' + esc(L('edit')) + '</button>' +
        '<button type="button" class="mini del" data-act="rec-del" data-id="' + r.id + '">' + esc(L('del')) + '</button></div></li>';
    });
    return '<p class="muted small" style="margin-bottom:8px">' + esc(L('recHint')) + '</p>' + ulOf(rows, 'recEmpty');
  }

  function viewAdmin() {
    // Aufbau wie in der FBRO-App: Titelzeile, Abschnitte als Akkordeon mit «+», Zeilen mit «Bearbeiten/Löschen» bzw. «…»-Menü
    var html = '<div class="top"><div><h1 class="pagetitle">' + esc(L('navAdmin')) + '</h1></div></div>';
    // Chronologisch: frühestes Event zuerst
    var evs = S.events.slice().sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
    var evBody = evs.length ? '<ul class="list">' + evs.map(function (e) {
      return '<li><div class="l"><b>' + esc(e.title) + (e.series_id ? ' <span class="small muted">&#8635;</span>' : '') + '</b><span>' + esc(evDayText(e) + (e.time_set === false ? '' : ' · ' + evTimeText(e))) + (e.place ? ' · ' + esc(e.place) : '') + '</span></div>' +
        '<div class="btnrow"><button type="button" class="mini" data-act="ev-edit" data-id="' + e.id + '">' + esc(L('edit')) + '</button>' +
        '<button type="button" class="mini del" data-act="ev-del" data-id="' + e.id + '">' + esc(L('del')) + '</button></div></li>';
    }).join('') + '</ul>' : '<p class="muted">' + esc(L('evAdminEmpty')) + '</p>';
    html += accordion('events', L('adminEvents'), evs.length, evBody, 'ev-new', L('evNew'));
    if (!isAdmin()) return html;   // Event Manager sehen nur die Events
    var tag = function (cls, label, icon) { return '<span class="mbic ' + cls + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + icon + '</span>'; };
    var mbRow = function (m) {
      var self = m.id === S.me.id, lamp = m.pin_changed ? L('pinLampOk') : L('pinLampNo');
      return '<li class="mbrow"><div class="l"><b>' + esc(m.name) + ' <span class="pinlamp ' + (m.pin_changed ? 'ok' : 'no') + '" title="' + esc(lamp) + '" aria-label="' + esc(lamp) + '"></span>' +
        (self ? ' <span class="mbyou">' + esc(L('you')) + '</span>' : '') + '</b><span>' + esc(fmtPhone(m.phone)) + '</span></div>' +
        '<span class="mbicons">' + (m.is_admin ? tag('adm', L('roleAdmin'), ICON.gear) : '') + (m.is_event_manager ? tag('em', L('roleEM'), ICON.star) : '') + '</span>' +
        '<button type="button" class="hico" data-act="mb-menu" data-id="' + esc(m.id) + '" aria-label="' + esc(L('actions') + ': ' + m.name) + '" title="' + esc(L('actions')) + '">' + ICON.dots + '</button></li>';
    };
    // Zwei Gruppen: User und Gäste (klappbar wie die Gruppen in der FBRO-App)
    var group = function (key, label, list, icon) {
      var open = S.sec[key] !== false;
      return '<div class="mbgrp"><button type="button" class="mbgh" data-act="sec" data-id="' + key + '" aria-expanded="' + open + '">' +
        '<span class="mbcrown">' + icon + '</span><span>' + esc(label) + ' <span class="cnt">(' + list.length + ')</span></span><span class="sp"></span>' +
        '<span class="accfold' + (open ? ' open' : '') + '">' + ICON.chev + '</span></button>' +
        (open ? (list.length ? '<ul class="list">' + list.map(mbRow).join('') + '</ul>' : '<p class="muted small" style="padding:6px 0 10px">' + esc(L('nobody')) + '</p>') : '') + '</div>';
    };
    var users = S.members.filter(function (m) { return !m.is_guest; }), guests = S.members.filter(function (m) { return m.is_guest; });
    var mbBody = group('g-user', L('grpUsers'), users, ICON.user) + group('g-guest', L('grpGuests'), guests, ICON.guest);
    html += accordion('members', L('secMembers'), S.members.length, mbBody, 'add-user', L('addUser'));
    html += accordion('recur', L('recurTitle'), S.rules.length, recurBody(), 'rec-new', L('recurNew'));
    // Alle Tasks (Admin): bearbeiten, erledigen, löschen
    var allT = S.tasks.slice().sort(taskSort);
    html += accordion('a-tasks', L('adminTasks'), allT.length, (allT.length ? '<ul class="list">' + allT.map(taskRow).join('') + '</ul>' : '<p class="muted">' + esc(L('taskEmpty')) + '</p>'), 'task-new', L('taskNew'));
    // Design der ganzen App (nur Admins)
    var dsg = DESIGNS.map(function (d) {
      var on = d.id === adminDesign;
      return '<button type="button" class="dsgrow' + (on ? ' on' : '') + '" data-act="design" data-val="' + d.id + '" aria-pressed="' + on + '">' +
        '<span class="sw">' + d.colors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' +
        '<span class="nm"><b>' + esc(L('design_' + d.id)) + '</b><span>' + esc(L('design_' + d.id + '_d')) + '</span></span>' +
        (on ? '<span class="ok">' + ICON.check + '</span>' : '') + '</button>';
    }).join('');
    html += accordion('design', L('designDefault'), null, dsg);
    // Standardsprache der App (nur Admins); Personen können sie im Profil überschreiben
    var lng = '<p class="muted small" style="margin-bottom:10px">' + esc(L('langHint')) + '</p>' + LANGS.map(function (l) {
      var on = l === S.defaultLang;
      return '<button type="button" class="dsgrow' + (on ? ' on' : '') + '" data-act="applang" data-val="' + l + '" aria-pressed="' + on + '">' +
        '<span class="nm"><b>' + esc(LANG_NAMES[l]) + '</b></span>' + (on ? '<span class="ok">' + ICON.check + '</span>' : '') + '</button>';
    }).join('');
    html += accordion('lang', L('langTitle'), null, lng);
    return html;
  }

  // Abschnitt mit Titel (klappt auf/zu), «+»-Knopf und Pfeil ganz rechts – wie in der FBRO-App
  function accordion(id, title, count, body, addAct, addLabel) {
    var open = S.sec[id] !== false;   // standardmässig offen
    return '<section class="acc"><div class="acch">' +
      '<button type="button" class="acct" data-act="sec" data-id="' + id + '" aria-expanded="' + open + '">' + esc(title) + (count == null ? '' : ' <span class="cnt">(' + count + ')</span>') + '</button>' +
      (addAct ? '<button type="button" class="hico" data-act="' + addAct + '" aria-label="' + esc(addLabel) + '" title="' + esc(addLabel) + '">' + ICON.plus + '</button>' : '') +
      '<button type="button" class="accfold' + (open ? ' open' : '') + '" data-act="sec" data-id="' + id + '" aria-hidden="true" tabindex="-1">' + ICON.chev + '</button>' +
      '</div>' + (open ? '<div class="accbody">' + body + '</div>' : '') + '</section>';
  }

  // «…»-Menü einer Person: die Knöpfe tragen data-act und werden vom globalen Klick-Handler ausgeführt
  function memberMenu(m) {
    var self = m.id === S.me.id, wrap = document.createElement('div'); wrap.className = 'ccsheet-bg';
    var b = function (act, label, cls, val) {
      return '<button type="button" class="btn ' + cls + '" data-act="' + act + '" data-id="' + esc(m.id) + '"' + (val != null ? ' data-val="' + val + '"' : '') + '>' + esc(label) + '</button>';
    };
    wrap.innerHTML = '<div class="ccsheet" role="dialog" aria-modal="true" aria-label="' + esc(m.name) + '"><h3>' + esc(m.name) + '</h3><div class="menu">' +
      (!self ? b('admin', m.is_admin ? L('revokeAdmin') : L('makeAdmin'), 'ghost', !m.is_admin) : '') +
      b('em', m.is_event_manager ? L('revokeEM') : L('makeEM'), 'ghost', !m.is_event_manager) +
      b('guest', m.is_guest ? L('makeUser') : L('makeGuest'), 'ghost', !m.is_guest) +
      b('edit-user', L('edit'), 'ghost') + b('reset-pin', L('resetPin'), 'ghost') +
      (!self ? b('remove', L('remove'), 'danger') : '') +
      '<button type="button" class="btn ghost" data-x="cancel">' + esc(L('cancel')) + '</button></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('button')) wrap.remove(); });
  }

  // «…»-Menü einer Liste: Umbenennen, privat/gemeinsam, Löschen (data-act wird vom globalen Klick-Handler ausgeführt)
  function listMenu(l) {
    var wrap = document.createElement('div'); wrap.className = 'ccsheet-bg';
    var b = function (act, label, cls) { return '<button type="button" class="btn ' + cls + '" data-act="' + act + '" data-id="' + esc(l.id) + '">' + esc(label) + '</button>'; };
    var own = l.owner_id === S.me.id;
    wrap.innerHTML = '<div class="ccsheet" role="dialog" aria-modal="true" aria-label="' + esc(l.name) + '"><h3>' + esc(l.name) + '</h3><div class="menu">' +
      (own ? b('list-rename', L('shRename'), 'ghost') + b('list-priv', l.is_private ? L('shMakeShared') : L('shMakePrivate'), 'ghost') + b('list-del', L('del'), 'danger') : '') +
      '<button type="button" class="btn ghost" data-x="cancel">' + esc(L('cancel')) + '</button></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('button')) wrap.remove(); });
  }
  function render() {
    var app = document.getElementById('app'), nav = document.getElementById('nav');
    if (!configured) { app.innerHTML = '<main class="authwrap"><div class="authcard"><h1>' + esc(L('setupTitle')) + '</h1><p>' + esc(L('notConfigured')) + '</p></div></main>'; nav.hidden = true; return; }
    if (S.step === 'loading') { app.innerHTML = '<main class="authwrap"><p class="muted">…</p></main>'; nav.hidden = true; return; }
    if (S.step === 'login') { app.innerHTML = viewLogin(); nav.hidden = true; return; }
    // Reihenfolge wie in der FBRO-App: Profil steht ganz rechts
    var tabs = [{ id: 'events', label: L('navEvents'), icon: ICON.cal }, { id: 'tasks', label: L('navTasks'), icon: ICON.tasks }, { id: 'shop', label: L('navShop'), icon: ICON.cart }];
    if (canManageEvents()) tabs.push({ id: 'admin', label: L('navAdmin'), icon: ICON.gear });
    tabs.push({ id: 'profile', label: L('navProfile'), icon: ICON.user });
    if (!tabs.some(function (t) { return t.id === S.tab; })) S.tab = 'events';
    var open = Array.prototype.map.call(document.querySelectorAll('details.ccel[open]'), function (d) { return d.dataset.k; });
    var banner = S.me.pin_changed ? '' : '<div class="pinbanner" role="status">' + esc(L('pinBanner')) + ' <button class="chip" data-act="goto" data-val="profile">' + esc(L('changePin')) + '</button></div>';
    var body = S.tab === 'profile' ? viewProfile() : S.tab === 'admin' ? viewAdmin() : S.tab === 'tasks' ? viewTasks() : S.tab === 'shop' ? viewShop() : viewEvents();
    app.innerHTML = banner + '<div class="shell">' + body + '</div>';
    nav.hidden = false;
    nav.innerHTML = tabs.map(function (t) {
      return '<button class="tab' + (t.id === S.tab ? ' on' : '') + '" data-act="goto" data-val="' + t.id + '" aria-current="' + (t.id === S.tab) + '">' + t.icon + '<span>' + esc(t.label) + '</span></button>';
    }).join('');
    open.forEach(function (k) { var d = document.querySelector('details.ccel[data-k="' + k + '"]'); if (d) d.open = true; });
  }

  /* ---------- Ereignisse ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    var g = function (n) {
      if (n === 'phone' && f.elements.phonecc) return composePhone(f.elements.phonecc.value, f.elements.phone.value);
      return f.elements[n] ? f.elements[n].value.trim() : '';
    }, kind = f.dataset.form;
    if (kind === 'login') return handleLogin(g);
    if (kind === 'pin') {
      if (!/^\d{6}$/.test(g('pin'))) return toast(L('pinExact'));
      if (pinWeak(g('pin'), S.me.phone)) return toast(L('pinWeak'));
      return act(async function () {
        var r = await sb.auth.updateUser({ password: g('pin') }); if (r.error) throw r.error;
        r = await sb.from(T('profiles')).update({ pin_changed: true }).eq('id', S.me.id); if (r.error) throw r.error;
      }, L('pinChanged'));
    }
  });

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (S.step === 'app') render(); });

  // Datum-Helfer und automatische Verlängerung unbegrenzter Serien
  function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function oneYear() { var d = new Date(); d.setFullYear(d.getFullYear() + 1); return isoDate(d); }
  // unbegrenzte Serien laufend bis ein Jahr voraus ergänzen (nur Admin/Event Manager, beim Öffnen)
  async function extendSeries() {
    if (!canManageEvents()) return;
    var bySid = {}, changed = false;
    S.events.forEach(function (e) { if (e.series_id && e.series_open && e.series_rule) (bySid[e.series_id] = bySid[e.series_id] || []).push(e); });
    var sids = Object.keys(bySid);
    for (var si = 0; si < sids.length; si++) {
      var sid = sids[si], list = bySid[sid].sort(function (x, y) { return new Date(x.starts_at) - new Date(y.starts_at); });
      var lastEv = list[list.length - 1], r = lastEv.series_rule, last = new Date(lastEv.starts_at).getTime(), rows = [];
      genOccurrences(r.start, r.time, r.every, r.unit, r.wd, oneYear(), today()).forEach(function (iso) {
        if (new Date(iso).getTime() > last) rows.push({ title: lastEv.title, place: lastEv.place, comment: lastEv.comment || null, rsvp: lastEv.rsvp, time_set: lastEv.time_set, starts_at: iso, ends_at: shiftEnd(lastEv.starts_at, lastEv.ends_at, iso), end_time_set: !!lastEv.end_time_set, category: lastEv.category || null, series_id: sid, series_open: true, series_rule: r });
      });
      if (!rows.length) continue;
      var res = await sb.from(T('events')).insert(rows).select('id');
      if (res.error) { console.error(res.error); continue; }
      var users = S.assign.filter(function (x) { return x.event_id === lastEv.id; }).map(function (x) { return x.user_id; }), ar = [];
      res.data.forEach(function (nw) { users.forEach(function (u) { ar.push({ event_id: nw.id, user_id: u }); }); });
      if (ar.length) { var ra2 = await sb.from(T('event_assignees')).insert(ar); if (ra2.error) console.error(ra2.error); }
      changed = true;
    }
    if (changed) await loadAll();
  }  function recurrenceBlock() {
    var sel = function (name, label, opts, val, extra) {
      return '<label class="fld"' + (extra || '') + '><span>' + esc(label) + '</span><select name="' + name + '">' + opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select></label>';
    };
    var units = [['day', L('evUnitDay')], ['week', L('evUnitWeek')], ['month', L('evUnitMonth')], ['year', L('evUnitYear')]];
    var nums = []; for (var k = 1; k <= 30; k++) nums.push([k, String(k)]);
    var days = [['', L('evSameDay')]].concat([1, 2, 3, 4, 5, 6, 7].map(function (d) { return [d, new Date(2024, 0, d).toLocaleDateString(LOCALE[lang], { weekday: 'long' })]; }));   // 1.1.2024 war ein Montag
    // eine Zeile, von links nach rechts: Einheit | Wiederholen alle | Wochentag (nur bei «Woche»)
    return '<div class="recblock recrow" data-dep="repeat" hidden>' + sel('unit', L('evUnit'), units, 'week') + sel('every', L('evEvery'), nums, 1) +
      sel('wd', L('evWeekdays'), days, '', ' data-unit="week"') + '</div>';
  }
  // erzeugt die Startzeitpunkte einer Serie (lokale Zeit): ab «from» (Standard: Startdatum) bis «until», höchstens 400
  function genOccurrences(date, time, every, unit, wd, until, from) {
    var out = [], max = 400, p = date.split('-').map(Number), tp = time.split(':').map(Number);
    var start = new Date(p[0], p[1] - 1, p[2]), end = new Date(until + 'T23:59:59');
    var lo = from && new Date(from + 'T00:00:00') > start ? new Date(from + 'T00:00:00') : start;
    var add = function (d) { if (d >= lo && out.length < max) out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), tp[0], tp[1]).toISOString()); };
    var k, d;
    if (unit === 'day') {
      for (d = new Date(start); d <= end && out.length < max; d.setDate(d.getDate() + every)) add(d);
    } else if (unit === 'week') {
      var days = (wd && wd.length ? wd : [((start.getDay() + 6) % 7) + 1]).slice().sort();
      var monday = new Date(start); monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      for (var w = new Date(monday); w <= end && out.length < max; w.setDate(w.getDate() + 7 * every)) {
        days.forEach(function (n) {
          var x = new Date(w); x.setDate(w.getDate() + (n - 1));
          if (x >= start && x <= end) add(x);
        });
      }
    } else if (unit === 'month') {
      for (k = 0; out.length < max; k += every) {
        var m = start.getMonth() + k, dim = new Date(start.getFullYear(), m + 1, 0).getDate();
        d = new Date(start.getFullYear(), m, Math.min(start.getDate(), dim));
        if (d > end) break;
        add(d);
      }
    } else {
      for (k = 0; out.length < max; k += every) {
        d = new Date(start.getFullYear() + k, start.getMonth(), start.getDate());
        if (d > end) break;
        add(d);
      }
    }
    return out;
  }  function newSeriesId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }

  async function deleteEvent(ev) {
    if (!canManageEvents() || !ev) return;
    var inSeries = ev.series_id && S.events.filter(function (x) { return x.series_id === ev.series_id; }).length > 1;
    var scope = 'one';
    if (inSeries) {
      var sf = await askForm(L('del'), [{ name: 'scope', label: L('evDelScope'), type: 'select', value: 'future', options: [
        { v: 'future', l: L('evDelFuture') }, { v: 'one', l: L('evDelOne') }, { v: 'all', l: L('evDelAll') }] }], L('del'), L('evDeleteAsk', { name: ev.title }));
      if (!sf) return;
      scope = sf.scope;
    } else if (!(await askConfirm(L('del'), L('evDeleteAsk', { name: ev.title }), true))) return;
    return act(async function () {
      if (scope === 'future' && ev.series_open) { var u = await sb.from(T('events')).update({ series_open: false }).eq('series_id', ev.series_id); if (u.error) throw u.error; }
      var q = sb.from(T('events')).delete();
      q = scope === 'one' ? q.eq('id', ev.id) : scope === 'future' ? q.eq('series_id', ev.series_id).gte('starts_at', ev.starts_at) : q.eq('series_id', ev.series_id);
      var r = await q; if (r.error) throw r.error;
    }, L('removed'));
  }
  // Personen ohne Verwalterrechte (kein Admin/Event Manager) sehen nur «Favorit für»: Personen hinzufügen, sich selbst abwählen (bei Serien ab diesem Termin)
  async function eventFavForm(ev, have) {
    var f = await askForm(L('evEdit'), [favPeopleField(have, false)]);
    if (!f) return;
    var sel = f.users || [], add = sel.filter(function (u) { return have.indexOf(u) < 0; });
    var dropMe = have.indexOf(S.me.id) > -1 && sel.indexOf(S.me.id) < 0;
    if (!add.length && !dropMe) return;
    var t0 = new Date(ev.starts_at).getTime();
    var ids = ev.series_id ? S.events.filter(function (x) { return x.series_id === ev.series_id && new Date(x.starts_at).getTime() >= t0; }).map(function (x) { return x.id; }) : [ev.id];
    return act(async function () {
      var rows = []; ids.forEach(function (id) { add.forEach(function (u) { rows.push({ event_id: id, user_id: u }); }); });
      for (var i = 0; i < rows.length; i += 200) {
        var r = await sb.from(T('event_assignees')).upsert(rows.slice(i, i + 200), { onConflict: 'event_id,user_id', ignoreDuplicates: true }); if (r.error) throw r.error;
      }
      for (var k = 0; k < ids.length && dropMe; k += 100) {
        var rd = await sb.from(T('event_assignees')).delete().in('event_id', ids.slice(k, k + 100)).eq('user_id', S.me.id); if (rd.error) throw rd.error;
      }
    }, L('saved'));
  }
  async function eventForm(ev) {
    var haveEv = ev ? S.assign.filter(function (x) { return x.event_id === ev.id; }).map(function (x) { return x.user_id; }) : [];
    if (ev && !canManageEvents()) return eventFavForm(ev, haveEv);
    // Wie in der FBRO-App: Titel, Datum und Uhrzeit getrennt (Datum | Zeit nebeneinander), Ort; Labels links
    var local = ev ? toLocalInput(ev.starts_at).split('T') : ['', ''];
    var endLocal = ev && ev.ends_at ? toLocalInput(ev.ends_at).split('T') : ['', ''];
    var fields = [
      { name: 'title', label: L('evTitle'), value: ev && ev.title, inline: true },
      { name: 'allday', label: L('evAllDay'), type: 'checkbox', value: !!ev && ev.time_set === false, hides: ['time', 'end_time'] },
      { name: 'date', label: L('evDate'), type: 'date', value: local[0], inline: true },
      { name: 'time', label: L('evTime'), type: 'time', value: ev && ev.time_set === false ? '' : local[1], inline: true },   // ganztägig: keine Zeit vorbelegen
      { name: 'end_date', label: L('evEndDate'), type: 'date', value: endLocal[0], inline: true, pair: true },
      { name: 'end_time', label: '', type: 'time', value: ev && ev.end_time_set ? endLocal[1] : '', inline: true, pair: true },
      { name: 'place', label: L('evPlace'), value: ev && ev.place, inline: true },
      { name: 'comment', label: L('evComment'), type: 'textarea', value: ev && ev.comment, inline: true },
      { name: 'category', label: L('evCategory'), type: 'cat', value: (ev && ev.category) || '', options: [{ v: '', c: 'var(--muted)', l: L('catNone') }].concat(EVCATS.map(function (x) { return { v: x.id, c: x.c, l: L('cat_' + x.id) }; })) },
      favPeopleField(haveEv, true),
      { name: 'rsvp', label: L('evRsvp'), type: 'checkbox', value: ev ? ev.rsvp !== false : false }
    ];
    // Änderungen optional auch für die folgenden Termine einer Serie übernehmen
    if (ev && ev.series_id && S.events.filter(function (x) { return x.series_id === ev.series_id; }).length > 1) fields.push({ name: 'follow', label: L('evFollow'), type: 'checkbox', value: true });
    // Bestehende Serie: Wiederholungsregel als Information anzeigen
    if (ev && ev.series_id) {
      var cnt = S.events.filter(function (x) { return x.series_id === ev.series_id; }).length, r0 = ev.series_rule;
      var unitKey = r0 ? { day: 'evUnitDay', week: 'evUnitWeek', month: 'evUnitMonth', year: 'evUnitYear' }[r0.unit] : '';
      var dayTxt = r0 && r0.unit === 'week' ? ', ' + new Date(2024, 0, (r0.wd && r0.wd.length ? r0.wd[0] : ((new Date(r0.start + 'T12:00:00').getDay() + 6) % 7) + 1)).toLocaleDateString(LOCALE[lang], { weekday: 'long' }) : '';
      fields.push({ type: 'note', text: r0 && unitKey
        ? L('evSeriesInfo', { n: r0.every, unit: L(unitKey), day: dayTxt, count: cnt }) + (ev.series_open ? ' · ' + L('evSeriesOpen') : '')
        : L('evSeriesPlain', { count: cnt }) });
    }
    // Wiederholung nur beim Anlegen eines neuen Events
    if (!ev) { fields.push({ name: 'repeat', label: L('evRepeat'), type: 'checkbox', value: false }); fields.push({ name: 'rec', type: 'recurrence' }); }
    var f = await askForm(ev ? L('evEdit') : L('evNew'), fields, null, null, ev ? L('del') : null);
    if (!f) return;
    if (f.__extra) return deleteEvent(ev);
    if (!f.title || !f.date) return toast(L('evMissing'));
    if (f.allday) { f.time = ''; f.end_time = ''; }   // ganztägig: ohne Start- und Endzeit
    var hasTime = !!f.time, tm = f.time || '00:00';
    // Ende: leer = gleicher Tag. Nur Enddatum = mehrtägig; Endzeit braucht eine Startzeit.
    if (f.end_time && !hasTime) return toast(L('evEndNeedsStart'));
    var endDate = f.end_date || (f.end_time ? f.date : '');
    if (endDate && (endDate < f.date || (endDate === f.date && f.end_time && f.end_time < tm))) return toast(L('evEndBefore'));
    if (endDate === f.date && !f.end_time) endDate = '';
    var endsIso = endDate ? new Date(endDate + 'T' + (f.end_time || '00:00')).toISOString() : null;
    var row = { title: f.title, place: f.place || null, comment: f.comment || null, starts_at: new Date(f.date + 'T' + tm).toISOString(), ends_at: endsIso, end_time_set: !!(endsIso && f.end_time), category: f.category || null, rsvp: !!f.rsvp, time_set: hasTime };
    var users = f.users || [];
    // ersetzt die Zuteilung der angegebenen Events durch die gewählten Personen
    var setAssignees = async function (ids) {
      if (!ids.length) return;
      var d = await sb.from(T('event_assignees')).delete().in('event_id', ids); if (d.error) throw d.error;
      var ar = []; ids.forEach(function (id) { users.forEach(function (u) { ar.push({ event_id: id, user_id: u }); }); });
      if (ar.length) { var i2 = await sb.from(T('event_assignees')).insert(ar); if (i2.error) throw i2.error; }
    };
    if (!ev && f.repeat) {
      // keine Einschränkungen: Serie läuft unbegrenzt; angelegt werden die nächsten Termine ab heute bis ein Jahr voraus
      var rule = { start: f.date, time: tm, every: Math.max(1, f.every || 1), unit: f.unit, wd: f.wd || [] };
      var occ = genOccurrences(rule.start, rule.time, rule.every, rule.unit, rule.wd, oneYear(), today());
      if (!occ.length) return toast(L('evNoOcc'));
      var sid = newSeriesId();
      var rows = occ.map(function (iso) { return { title: row.title, place: row.place, comment: row.comment, rsvp: row.rsvp, time_set: hasTime, starts_at: iso, ends_at: shiftEnd(row.starts_at, row.ends_at, iso), end_time_set: row.end_time_set, category: row.category, series_id: sid, series_open: true, series_rule: rule }; });
      return act(async function () {
        var r = await sb.from(T('events')).insert(rows).select('id'); if (r.error) throw r.error;
        await setAssignees(r.data.map(function (x) { return x.id; }));
      }, L('evSeriesAdded', { n: rows.length }));
    }
    return act(async function () {
      if (ev) {
        var r = await sb.from(T('events')).update(row).eq('id', ev.id); if (r.error) throw r.error;
        var ids = [ev.id];
        if (f.follow && ev.series_id) {
          // Tagesverschiebung des bearbeiteten Termins auch auf die folgenden anwenden; Uhrzeit, Titel, Ort etc. übernehmen
          var dayDelta = Math.round((new Date(f.date + 'T00:00') - new Date(isoDate(new Date(ev.starts_at)) + 'T00:00')) / 86400000);
          var fol = S.events.filter(function (x) { return x.series_id === ev.series_id && x.id !== ev.id && new Date(x.starts_at) > new Date(ev.starts_at); });
          var ups = await Promise.all(fol.map(function (x) {
            var nd = new Date(x.starts_at); nd.setDate(nd.getDate() + dayDelta);
            var nsIso = new Date(isoDate(nd) + 'T' + tm).toISOString();
            return sb.from(T('events')).update({ title: row.title, place: row.place, comment: row.comment, rsvp: row.rsvp, time_set: hasTime, starts_at: nsIso, ends_at: shiftEnd(row.starts_at, row.ends_at, nsIso), end_time_set: row.end_time_set, category: row.category }).eq('id', x.id);
          }));
          ups.forEach(function (u) { if (u.error) throw u.error; });
          ids = ids.concat(fol.map(function (x) { return x.id; }));
          // Regel der Serie anpassen, damit die automatische Verlängerung dazu passt
          if (ev.series_rule) {
            var rl = Object.assign({}, ev.series_rule), st = new Date(rl.start + 'T12:00:00'); st.setDate(st.getDate() + dayDelta);
            rl.start = isoDate(st); rl.time = tm;
            rl.wd = (rl.wd || []).map(function (w) { return ((w - 1 + dayDelta) % 7 + 7) % 7 + 1; });
            var ru = await sb.from(T('events')).update({ series_rule: rl }).eq('series_id', ev.series_id); if (ru.error) throw ru.error;
          }
        }        await setAssignees(ids);
      } else {
        var r3 = await sb.from(T('events')).insert(row).select('id'); if (r3.error) throw r3.error;
        await setAssignees(r3.data.map(function (x) { return x.id; }));
      }
    }, L('saved'));
  }
  // Live-Formatierung der Nummer; +49… / 0041… wählt das Land automatisch (wie in der FBRO-App)
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || (t.name !== 'phone' && t.name !== 'phonecc')) return;
    var row = t.closest('.phonerow');
    if (!row) return;
    var sel = row.querySelector('select'), inp = row.querySelector('input');
    var pos = inp.selectionStart, atEnd = pos === inp.value.length;
    var before = inp.value.slice(0, pos).replace(/\D/g, '').length;
    var v = inp.value;
    var m = v.replace(/\s/g, '').match(/^(?:\+|00)(\d+)/);
    if (m) {
      var hit = PHONE_CC.filter(function (x) { return m[1].indexOf(x.c) === 0; })[0];
      if (hit) { sel.value = hit.c; v = fmtNational(hit.c, m[1].slice(hit.c.length)); atEnd = true; }
      else { sel.value = ''; v = '+' + m[1]; }
    } else if (sel.value) {
      v = fmtNational(sel.value, v.replace(/\D/g, '').replace(/^0+/, ''));
    }
    var info = ccInfo(sel.value);
    inp.placeholder = info ? info.ph : '+43 …';
    if (v === inp.value) return;
    inp.value = v;
    if (atEnd) pos = v.length;
    else { var c = 0; pos = 0; while (pos < v.length && c < before) { if (/\d/.test(v.charAt(pos))) c++; pos++; } }
    try { inp.setSelectionRange(pos, pos); } catch (x) { /* ignorieren */ }
  });

  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.dataset.act, id = el.dataset.id, v = el.dataset.val;
    var member = S.members.filter(function (m) { return m.id === id; })[0];
    var ev = S.events.filter(function (x) { return x.id === id; })[0];
    var rpc = function (fn, args, msg) { return act(async function () { var r = await sb.rpc(F(fn), args); if (r.error) throw r.error; }, msg); };
    switch (a) {
      case 'goto': if (v === 'admin') ADMIN_KEYS.forEach(function (k) { S.sec[k] = false; }); S.tab = v; render(); return window.scrollTo(0, 0);
      case 'sec': S.sec[id] = !(S.sec[id] !== false); return render();
      case 'who': S.open['ev:' + id] = !S.open['ev:' + id]; return render();
      case 'shop-view': S.shopView = v; return render();
      case 'list-menu': { var lm = listById(id); if (lm) listMenu(lm); return; }
      case 'need-new': {
        // neues Produkt; die Vorschläge zeigen den ganzen Katalog, «in deinen Favoriten» = ich führe es bereits
        var known = S.products.slice().sort(byName).map(function (p) { return { n: p.name, on: !!myWish(p.id) }; });
        var nf = await askForm(L('shAdd'), [
          { name: 'name', label: L('shName'), suggest: known, suggestOn: L('shOnList'), inline: true },
          { name: 'note', label: L('shNote'), inline: true },
          { name: 'list_id', label: L('shList'), type: 'select', value: '', options: listOptions(true), inline: true },
          favForField(null, [S.me.id])
        ]);
        if (!nf) return;
        return needAdd(nf.name, { note: nf.note, list_id: nf.list_id, users: nf.users });
      }
      case 'ev-view': S.evView = v; return render();
      case 'ev-card': S.open['evc:' + id] = !S.open['evc:' + id]; return render();
      case 'cal-day': S.calDay = S.calDay === v ? '' : v; return render();
      case 'cal-prev': case 'cal-next': {
        var dirn = a === 'cal-next' ? 1 : -1, nowd = new Date();
        if (S.evView === 'week') { var wb = S.calWeek ? new Date(S.calWeek) : weekStart(nowd); S.calWeek = new Date(wb.getFullYear(), wb.getMonth(), wb.getDate() + 7 * dirn).getTime(); }
        else { var cb = S.calMonth ? new Date(S.calMonth) : new Date(nowd.getFullYear(), nowd.getMonth(), 1); S.calMonth = new Date(cb.getFullYear(), cb.getMonth() + dirn, 1).getTime(); }
        S.calDay = '';
        return render();
      }
      case 'ev-fav': {
        // Stern: Favorit setzen/entfernen; bei Serien ab diesem Termin für alle folgenden
        if (!ev) return;
        var wasFav = isFavEvent(ev.id), t0 = new Date(ev.starts_at).getTime();
        var favIds = ev.series_id ? S.events.filter(function (x) { return x.series_id === ev.series_id && new Date(x.starts_at).getTime() >= t0; }).map(function (x) { return x.id; }) : [ev.id];
        return act(async function () {
          for (var i = 0; i < favIds.length; i += 100) {
            var part = favIds.slice(i, i + 100), r;
            r = wasFav ? await sb.from(T('event_assignees')).delete().in('event_id', part).eq('user_id', S.me.id)
              : await sb.from(T('event_assignees')).upsert(part.map(function (eid) { return { event_id: eid, user_id: S.me.id }; }), { onConflict: 'event_id,user_id', ignoreDuplicates: true });
            if (r.error) throw r.error;
          }
        });
      }
      case 'need-check': {
        // abhaken gilt für alle Wünschenden dieses Produkts in dieser Liste (ohne Liste: nur mein Wunsch)
        var cp = String(v).split(':'), cval = cp[0] === '1', clist = cp[1] || '';
        return act(async function () {
          var q = sb.from(T('wishes')).update({ checked: cval }).eq('product_id', id).eq('selected', true);
          q = clist ? q.eq('list_id', clist) : q.is('list_id', null).eq('user_id', S.me.id);
          var r = await q; if (r.error) throw r.error;
        });
      }
      case 'list-update': {
        // Gekaufte (abgehakte) Produkte dieser Liste gehen zurück zu den Favoriten (werden nie gelöscht)
        var nBought = S.wishes.filter(function (w) { return w.list_id === id && w.selected && w.checked; }).length;
        if (!nBought) return toast(L('shNothingChecked'));
        return act(async function () { var r = await sb.rpc(F('list_update'), { p_list: id }); if (r.error) throw r.error; }, L('shUpdated', { n: nBought }));
      }
      case 'need-wish': {
        var wp = productById(id); if (!wp) return;
        return act(async function () { var r = await sb.rpc(F('add_wish'), { p_name: wp.name, p_note: null, p_list: null, p_users: [S.me.id] }); if (r.error) throw r.error; }, L('saved'));
      }
      case 'need-unwish':
        return act(async function () { var r = await sb.from(T('wishes')).delete().eq('product_id', id).eq('user_id', S.me.id); if (r.error) throw r.error; }, L('saved'));
      case 'need-sel':
        return act(async function () { var r = await sb.from(T('wishes')).update({ selected: v === '1', checked: false }).eq('product_id', id).eq('user_id', S.me.id); if (r.error) throw r.error; });
      case 'need-edit': {
        var ne = productById(id); if (!ne) return;
        var nfe = await needEditForm(ne);
        if (!nfe) return;
        if (nfe.__extra) {   // «Produkt löschen» (unten im Dialog): für alle, nur nach Rückfrage
          if (await askConfirm(L('shProdDel'), L('shProdDelAsk', { name: ne.name }), true))
            return act(async function () { var r = await sb.from(T('products')).delete().eq('id', id); if (r.error) throw r.error; }, L('removed'));
          return;
        }
        return act(async function () {
          var newName = String(nfe.name == null ? ne.name : nfe.name).trim();
          if (!newName) throw new Error(L('shMissing'));
          if (newName !== ne.name) { var rn = await sb.from(T('products')).update({ name: newName }).eq('id', id); if (rn.error) throw rn.error; }
          var had = {}; wishersOf(id).forEach(function (w) { had[w.user_id] = true; });
          var sel = nfe.users || [], addU = sel.filter(function (u) { return !had[u]; });
          // Notiz/Liste angegeben, aber niemand gewählt und noch kein eigener Favorit: der Favorit wird für mich angelegt
          if (!had[S.me.id] && !addU.length && (nfe.note || nfe.list_id)) addU = [S.me.id];
          if (addU.length) { var ra = await sb.rpc(F('add_wish'), { p_name: newName, p_note: nfe.note || null, p_list: nfe.list_id || null, p_users: addU }); if (ra.error) throw ra.error; }
          if (had[S.me.id] && sel.indexOf(S.me.id) < 0) {   // mich abgewählt: mein Favorit entfällt
            var rd = await sb.from(T('wishes')).delete().eq('product_id', id).eq('user_id', S.me.id); if (rd.error) throw rd.error;
          } else if (had[S.me.id]) {
            var r = await sb.from(T('wishes')).update({ note: nfe.note || null, list_id: nfe.list_id || null }).eq('product_id', id).eq('user_id', S.me.id); if (r.error) throw r.error;
          }
        }, L('saved'));
      }
      case 'list-new': {
        var lf = await askForm(L('shNewList'), [
          { name: 'name', label: L('shListName') },
          { name: 'is_private', label: L('shPrivate'), type: 'checkbox', value: false }
        ]);
        if (!lf || !lf.name) return;
        return act(async function () {
          var r = await sb.from(T('shop_lists')).insert({ name: lf.name, owner_id: S.me.id, is_private: !!lf.is_private });
          if (r.error) throw r.error;
        }, L('saved'));
      }
      case 'list-rename': {
        var rl = listById(id); if (!rl) return;
        var rn = await askForm(L('shRename'), [{ name: 'name', label: L('shListName'), value: rl.name }]);
        if (!rn || !rn.name) return;
        return act(async function () { var r = await sb.from(T('shop_lists')).update({ name: rn.name }).eq('id', id); if (r.error) throw r.error; }, L('saved'));
      }
      case 'list-priv': {
        var pl = listById(id); if (!pl) return;
        return act(async function () { var r = await sb.from(T('shop_lists')).update({ is_private: !pl.is_private }).eq('id', id); if (r.error) throw r.error; }, L('saved'));
      }
      case 'list-del': {
        var dl = listById(id);
        if (dl && await askConfirm(L('del'), L('shDeleteListAsk', { name: dl.name }), true))
          return act(async function () { var r = await sb.from(T('shop_lists')).delete().eq('id', id); if (r.error) throw r.error; }, L('removed'));
        return;
      }
      case 'rec-new': return recurForm(null);
      case 'rec-edit': return recurForm(S.rules.filter(function (x) { return x.id === id; })[0]);
      case 'rec-toggle': {
        var rr = S.rules.filter(function (x) { return x.id === id; })[0]; if (!rr) return;
        return act(async function () { var r = await sb.from(T('recurring_tasks')).update({ active: !rr.active }).eq('id', id); if (r.error) throw r.error; });
      }
      case 'rec-del': {
        var rd2 = S.rules.filter(function (x) { return x.id === id; })[0];
        if (rd2 && await askConfirm(L('del'), L('recDeleteAsk', { title: rd2.title }), true))
          return act(async function () { var r = await sb.from(T('recurring_tasks')).delete().eq('id', id); if (r.error) throw r.error; }, L('removed'));
        return;
      }
      case 'task-new': return taskForm(null);
      case 'task-edit': return taskForm(S.tasks.filter(function (x) { return x.id === id; })[0]);
      case 'task-done': {
        var tk = S.tasks.filter(function (x) { return x.id === id; })[0]; if (!tk) return;
        return act(async function () { var r = await sb.from(T('tasks')).update({ done: !tk.done }).eq('id', id); if (r.error) throw r.error; });
      }
      case 'task-fav': {
        // Stern: Favorit setzen/entfernen (nur der eigene Eintrag)
        var wasTf = isFavTask(id);
        return act(async function () {
          var r = wasTf ? await sb.from(T('task_assignees')).delete().eq('task_id', id).eq('user_id', S.me.id)
            : await sb.from(T('task_assignees')).upsert({ task_id: id, user_id: S.me.id }, { onConflict: 'task_id,user_id', ignoreDuplicates: true });
          if (r.error) throw r.error;
        });
      }
      case 'applang': if (isAdmin() && v !== S.defaultLang) return rpc('set_app_language', { p_lang: v }, L('langSaved')); return;
      case 'design': if (isAdmin() && v !== adminDesign) return rpc('set_app_design', { p_design: v }, L('designSaved')); return;
      case 'em': return rpc('set_event_manager', { target: id, flag: v === 'true' }, L('saved'));
      case 'guest': return rpc('set_guest', { target: id, flag: v === 'true' }, L('saved'));
      case 'mb-menu': if (isAdmin() && member) memberMenu(member); return;
      case 'logout': return logout();
      case 'install': if (installEvt) { installEvt.prompt(); installEvt = null; render(); } return;
      case 'set-design':
        if (!DESIGNS.some(function (x) { return x.id === v; })) return;
        S.me.design = v; applyDesign(v); render();
        sb.from(T('profiles')).update({ design: v }).eq('id', S.me.id).then(function () {}, function (e2) { console.error(e2); });
        return;
      case 'edit-name': {
        var nameF = await askForm(L('fullName'), [{ name: 'name', label: L('fullName'), value: S.me.name }]);
        if (!nameF || !nameF.name || nameF.name === S.me.name) return;
        return act(async function () { var r = await sb.from(T('profiles')).update({ name: nameF.name }).eq('id', S.me.id); if (r.error) throw r.error; }, L('saved'));
      }
      case 'edit-phone': {
        var phoneF = await askForm(L('phone'), [{ name: 'phone', label: L('phone'), type: 'phone', value: S.me.phone }], null, L('editPhonePin'));
        if (!phoneF) return;
        var ph3 = normPhone(phoneF.phone); if (!ph3) return toast(L('phoneInvalid'));
        if (ph3 === S.me.phone) return;
        return rpc('update_own_phone', { new_phone: ph3 }, L('phoneChangedPin'));
      }
      case 'set-lang':
        setLang(v); S.me.language = v; render();
        sb.from(T('profiles')).update({ language: v }).eq('id', S.me.id).then(function () {}, function (e2) { console.error(e2); });
        return;
      case 'set-theme':
        setTheme(v); render();
        sb.from(T('profiles')).update({ theme: v || null }).eq('id', S.me.id).then(function () {}, function () {});
        return;
      case 'answer': {
        var mine = S.resp.filter(function (r) { return r.event_id === id && r.user_id === S.me.id; })[0];
        return act(async function () {
          var r = mine && mine.answer === v ? await sb.from(T('event_responses')).delete().eq('event_id', id).eq('user_id', S.me.id)
            : await sb.from(T('event_responses')).upsert({ event_id: id, user_id: S.me.id, answer: v });
          if (r.error) throw r.error;
        });
      }
      case 'ev-more': S.open.evmore = !S.open.evmore; return render();
      case 'ev-horizon': {
        var hopts = [1, 2, 3, 4, 6, 9, 12].map(function (n) { return { v: String(n), l: n === 1 ? L('evMonthOne') : L('evMonthsN', { n: n }) }; });
        hopts.push({ v: '0', l: L('evAllMonths') });
        var hf = await askForm(L('evHorizonTitle'), [{ name: 'months', label: L('evHorizonLbl'), type: 'select', value: String(evHorizon()), options: hopts }]);
        if (!hf) return;
        try { localStorage.setItem('app-ev-horizon' + SFX, hf.months); } catch (e2) { /* ignorieren */ }
        return render();
      }
      case 'ev-filter':
        try { localStorage.setItem('app-ev-filter' + SFX, evFilterOn() ? '0' : '1'); } catch (e3) { /* ignorieren */ }
        return render();
      case 'ev-new': return eventForm(null);
      case 'ev-edit': return eventForm(ev);
      case 'ev-del': return deleteEvent(ev);
      case 'admin': return rpc('set_admin', { target: id, make_admin: v === 'true' }, L('saved'));
      case 'reset-pin':
        if (await askConfirm(L('resetPin'), L('resetPinAsk', { name: member.name }))) return rpc('reset_pin', { target: id }, L('pinReset'));
        return;
      case 'remove':
        if (await askConfirm(L('remove'), L('removeAsk', { name: member.name }), true)) return rpc('remove_member', { target: id }, L('removed'));
        return;
      case 'edit-user': {
        var r = await askForm(L('edit'), [{ name: 'name', label: L('fullName'), value: member.name }, { name: 'phone', label: L('phone'), value: member.phone, type: 'phone' }], null, L('editPhoneNote'));
        if (!r) return;
        var ph = normPhone(r.phone); if (!ph) return toast(L('phoneInvalid'));
        return rpc('admin_update_member', { target: id, new_name: r.name, new_phone: ph }, L('saved'));
      }
      case 'add-user': {
        var f = await askForm(L('addUser'), [{ name: 'name', label: L('fullName') }, { name: 'phone', label: L('phone'), type: 'phone' }, { name: 'guest', label: L('guestCheck'), type: 'checkbox' }], L('addUser'), L('addUserNote'));
        if (!f) return;
        var p2 = normPhone(f.phone); if (!f.name || !p2) return toast(L('phoneInvalid'));
        return rpc('admin_create_user', { p_name: f.name, p_phone: p2, p_guest: !!f.guest }, L('userAdded'));
      }
    }
  });

  /* ---------- Start ---------- */
  async function start() {
    render();
    if (!configured) return;
    try {
      var s = await sb.auth.getSession();
      if (s.data && s.data.session) await enter(s.data.session); else { S.step = 'login'; render(); }
    } catch (e) { console.error(e); S.step = 'login'; render(); }
  }
  document.addEventListener('DOMContentLoaded', start);
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
