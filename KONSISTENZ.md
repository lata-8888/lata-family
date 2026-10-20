# Konsistenz-Prüfung Fenster und Dialoge

Stand: App v74, geprüft anhand von Bildschirmfotos aller Dialoge und Hauptansichten sowie des Quelltexts.
Dies ist eine **Bestandsaufnahme ohne Änderungen**. Jeder Punkt nennt, was heute unterschiedlich ist, und einen Vorschlag für den einheitlichen Zustand.

Geprüft: Agenda (Liste, Woche, Monat), Tasks, Einkauf (Wunschliste, Einkaufslisten), Admin, Profil und diese Dialoge: Event neu/bearbeiten/Serie, Zeithorizont, Task neu/bearbeiten, Produkt neu/bearbeiten, Einkaufsliste neu/Menü, Admin-Event neu, Person hinzufügen/Menü/bearbeiten, Wiederkehrender Task neu/bearbeiten, Profil Name/Handynummer, Bestätigungen.

## A. Dialoge: Aufbau und Aussehen

| # | Was | Heute | Vorschlag |
|---|---|---|---|
| A1 | **Beschriftung der Felder** | Links neben dem Feld: Event, Task, Produkt. **Über dem Feld**: Einkaufsliste neu/umbenennen, Wiederkehrender Task (alle Felder), Profil Name und Handynummer, Person hinzufügen/bearbeiten, Zeithorizont, Event löschen (Serie) | Überall links neben dem Feld (`inline`), ausser bei Feldern mit mehreren Zeilen (Handynummer-Gruppe, Auswahlfelder) |
| A2 | **Kompakte Darstellung** | Nur der Event-Dialog ist kompakt (kleine Überschrift, kleine Abstände). Task, Produkt und alle anderen haben grosse Abstände und eine grössere Überschrift | `compact` für alle Formular-Dialoge |
| A3 | **Reihenfolge «Privat» und «Favorit für»** | Event: «Favorit für», dann «Privat». Task und Produkt: «Privat», dann «Favorit für» | Eine Reihenfolge für alle, z. B. «Favorit für» vor «Privat» |
| A4 | **Wortlaut «Privat»** | Event, Task, Produkt: «Privat (nur für mich sichtbar)». Einkaufsliste: «Privat (nur ich sehe diese Liste)». Liste im Menü: «Für alle sichtbar» / «Privat machen» | Ein Satz überall, z. B. «Privat (nur für mich sichtbar)» |
| A5 | **Löschen-Knopf** | Unten im Dialog bei Event, Task, Produkt. **Nicht** im Dialog bei Wiederkehrender Task (Knopf in der Liste), Person (Menü «…»), Einkaufsliste (Menü «…») | Bei allen bearbeitbaren Dingen «Löschen» unten im Bearbeiten-Dialog; Menüs behalten höchstens Abkürzungen |
| A6 | **Beschriftung des Löschen-Knopfs** | Event und Task: «Löschen». Produkt: «Produkt löschen». Person: «Entfernen». Einkaufsliste: «Löschen» | Immer «Löschen» (der Dialogtitel nennt das Objekt) bzw. bei Personen bewusst «Entfernen» festlegen |
| A7 | **Speichern-Knopf** | Meist «Speichern». «Person hinzufügen» im Personen-Dialog, «Löschen» im Serien-Lösch-Dialog, «Bestätigen» in allen Rückfragen | «Speichern» für Formulare, bei Rückfragen die Aktion nennen («Löschen», «Zurücksetzen») |
| A8 | **Rückfragen** | Löschen mit Rückfrage (Titel + Text + «Abbrechen/Bestätigen») für Task, Produkt, Person, Liste, Wiederkehrender Task, Event. Bei Event-Serien stattdessen ein Formular mit Auswahlliste | Gleiche Rückfrage überall; für Serien die Auswahl «nur dieser / ab diesem / alle» als gleich gestaltete Kacheln wie bei «Favorit für» |
| A9 | **Titel der Dialoge** | «Event hinzufügen», «Task hinzufügen», «Produkt hinzufügen», «Person hinzufügen» – aber «Neue Einkaufsliste», «Name», «Handynummer», «Zeithorizont», «Bearbeiten» (Person) | Schema «X hinzufügen» / «X bearbeiten», auch für Einkaufsliste («Einkaufsliste hinzufügen / bearbeiten»), Person («Person bearbeiten»), Profil («Name ändern», «Handynummer ändern») |
| A10 | **Menü-Fenster** (Person «…», Einkaufsliste «…») | Reihe breiter Knöpfe mit «Abbrechen» ganz unten, anderes Muster als die Formulare | Beibehalten ist möglich; wenn A5 umgesetzt ist, bleibt nur wenig im Menü (Rolle ändern, PIN zurücksetzen) |
| A11 | **Auswahl-Felder** | «Favorit für» und «Einkaufslisten» sind farbige Kacheln. Alle anderen Auswahlen (Zuweisen an, Wiederholung, Wochentag, Zeithorizont, Serien-Umfang) sind native Auswahllisten in anderer Optik | Für Auswahlen mit wenigen Werten (Wiederholung, Serien-Umfang, Zeithorizont) dieselben Kacheln wie bei «Favorit für» |

## B. Begriffe und Beschriftungen

| # | Was | Heute | Vorschlag |
|---|---|---|---|
| B1 | **Task / Aufgabe** | Reiter «Tasks», Dialog «Task hinzufügen», Feld «Aufgabe», Abschnitte «Meine Aufgaben» / «Weitere Aufgaben», Admin «Wiederkehrende Tasks», «Tasks (alle)» | Einen Begriff wählen (Vorschlag «Aufgaben») und überall verwenden |
| B2 | **Datum eines Tasks** | Dialog «Termin», Anzeige in der Liste «Wunschtermin: …», wiederkehrend «Beginn» | «Termin» im Dialog und in der Liste; Anzeige z. B. «Fällig: …» |
| B3 | **Datumsfelder Event und Task** | Event: «Von» / «Bis» mit Datum und Zeit. Task: «Termin» nur mit Datum | Bewusst so lassen, aber Label-Breite und Eingabegrösse gleich halten |
| B4 | **Notiz / Kommentar** | Task und Produkt haben «Notiz». Der Event-Dialog hat weder Notiz noch Kommentar (Wert ist im Datensatz vorhanden und wird in der `.ics`-Datei benutzt) | Entscheiden: Notiz für Events wieder anbieten oder Feld ganz entfernen |
| B5 | **Listen-Ansicht Einkauf** | Reiter «Einkaufslisten», Abschnitt «(noch in keiner Liste)», Auswahl «Leer» | Dasselbe Wort für «keine Liste» überall («Leer») |
| B6 | **Wunschliste / Favoriten** | Reiter «Wunschliste», Abschnitt «Meine Favoriten», «Favorit für» | Begriffe vereinheitlichen (entweder «Wunschliste» oder «Favoriten») |

## C. Hauptansichten

| # | Was | Heute | Vorschlag |
|---|---|---|---|
| C1 | **Wo steht das «+»** | Agenda: oben rechts. Einkauf-Einkaufslisten: oben rechts. Tasks: im Abschnitt «Weitere Aufgaben». Einkauf-Wunschliste: im Abschnitt «Weitere Produkte». Admin: in jedem Abschnitt | Eine Regel: «+» im Abschnitt, in dem das Neue landet, oder immer oben rechts |
| C2 | **Zeilenaktionen in Listen** | Agenda, Tasks, Einkauf: Stift + Stern. Admin-Agenda: Textknöpfe «Bearbeiten» / «Löschen». Admin-Wiederkehrende Tasks: drei Textknöpfe übereinander (Pausieren, Bearbeiten, Löschen). Admin-Personen: «…»-Menü. Admin-Tasks (alle): Stift + Stern | Admin-Events wie die Agenda (Stift + Stern oder nur Stift); Wiederkehrende Tasks mit Stift (+ Pausieren-Schalter) statt drei Textknöpfen |
| C3 | **Bedeutung des Sterns** | In Agenda, Tasks, Einkauf = «Favorit». In der Personen-Liste (Admin) zeigt ein Stern die Rolle «Event Manager» | Für die Rolle ein anderes Symbol |
| C4 | **Kennzeichnung «privat»** | Einkaufslisten: Schloss, Schild «Privat», gestrichelter Rand. Events, Tasks, Produkte: nur Schloss | Einheitlich: Schloss vor dem Titel; das Schild «Privat» nur, wenn es nötig ist |
| C5 | **Position des Schlosses** | Vor dem Titel bei Event, Task, Produkt. In der Unterzeile bei Produkten einer privaten Liste («🔒 Apotheke») | Einheitlich vor dem Namen |
| C6 | **Auf-/Zuklappen** | Agenda: Pfeil pro Karte. Tasks, Einkauf, Admin: Abschnitte mit Pfeil. Admin-Personen: Gruppen mit Symbol | Einheitliche Pfeile und Zustände (alle Abschnitte beim Öffnen zu oder offen) |
| C7 | **Löschen-Rückfrage vs. Löschen-Knopf in Liste** | Admin-Listen löschen mit Textknopf, Haupt-Ansichten ohne direkten Löschen-Knopf (nur im Dialog) | Siehe A5 / C2 |
| C8 | **Kopfzeile der Seiten** | Agenda hat drei Knöpfe («…», Filter, «+»), Tasks keinen, Einkauf einen («+» nur im Reiter «Einkaufslisten»), Profil keinen | Pro Seite gleicher Platz für Aktionen, auch wenn nur eine da ist |

## D. Kleinere Beobachtungen

* Zeit- und Datumsfelder erscheinen im Test-Browser im US-Format (mm/dd/yyyy, 12 Stunden). Auf dem iPhone richtet sich das nach der Systemeinstellung. Die Breite der Zeitfelder ist auf 12-Stunden-Anzeige knapp.
* Die Überschrift in den Dialogen hat zwei Grössen (Event: klein, alle anderen gross), siehe A2.
* «Zeithorizont» (Agenda «…») nutzt als Feldbeschriftung einen ganzen Satz («Events anzeigen für die nächsten …»), die anderen Dialoge ein einzelnes Wort.
* In «Person bearbeiten» steht nur «Bearbeiten» als Titel, der Name der Person fehlt.
* Die Rückfragen heissen alle «Bestätigen», auch bei harmlosen Aktionen wie «PIN zurücksetzen».
* Nicht im Bild geprüft: die eingeschränkten Dialoge für Personen ohne Bearbeitungsrecht (nur «Favorit für») bei Event, Task und Produkt; sie zeigen im Code kein Feld mit dem Namen des Objekts.

## Vorschlag zur Reihenfolge der Bereinigung

1. **A1, A2, A3, A4** (reine Optik und Wortlaut, geringes Risiko).
2. **A5, A6, A7, B1, B2** (Wortlaut und Löschen-Knopf).
3. **C2, C3, C4, C5** (Admin-Listen und Symbole).
4. **A8, A9, A11, C1, C8** (grössere Eingriffe, nach Entscheid).
