# WORKING Fortbildungsportal-Bausatz

**Zweck:** bereinigter, öffentlich teilbarer Stand des Fortbildungsportals zur
Rückmeldung durch andere Entwickler. Keine Echtdaten, keine Zugangsdaten,
kein alter Verlauf.

**Quelle:** privates Arbeits-Repository (Zweig `aic`, harter Fork von
FortbildungenUAMM). Der Bausatz ist ein einziger Commit aus `git archive HEAD`.

**Stand:** 2026-10-05 abends, Quelle auf Commit-Stand vom 05.10.2026 (mit öffentlichem Referentenbereich).

## Was entfernt oder neutralisiert wurde
- **Entfernt:** Archiv-Daten und -Import, interne Berichte der Randfalltests, Prototypen, Claude-Konfiguration, interne Doku
- **Neutralisiert:** Hosts, Pfade und Mailadressen in Skripten, Compose-Dateien, Mailstandards und Beispieltexten (Platzhalter `example.org`)
- **Ersetzt:** Zugangsdaten in Skripten durch Umgebungsvariablen

## Neu erzeugen
1. Quelle auf den gewünschten Stand bringen und committen
2. Neuen Ordner anlegen, `git -C <quelle> archive HEAD | tar -x -C <ziel>`
3. Entfernen und Ersetzen wie oben, Suchlauf nach Hosts, Mails, Namen, Geheimnissen
4. `npx tsc --noEmit` mit verlinktem `node_modules` (Link danach löschen)
5. `git init -b main`, ein Commit

## Entwickler-Hinweise
- Konventionen für Mitarbeit stehen in `AGENTS.md`
- Der Bausatz ist keine Arbeitskopie: Änderungen entstehen in der Quelle und werden neu exportiert
