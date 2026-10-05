# Schulverzeichnis für das Fortbildungsportal aufbereiten

## Angaben für den Auftrag

- Schulamt: [Name des Schulamts einsetzen]
- Gebiet: [Landkreis / kreisfreie Stadt einsetzen]
- Schularten: [gewünschte Schularten einsetzen]
- Grundlage: [amtliches Schulverzeichnis als Datei oder Link beifügen]

## Arbeitsauftrag an die KI

Erstelle aus dem beigefügten amtlichen Schulverzeichnis eine importierbare
CSV-Datei für die oben genannten Schulen und das Gebiet. Verwende nur
nachprüfbare Angaben aus der Quelle. Erfinde keine Schulen, Schulnummern oder
Adressen. Wenn du einen Link nicht abrufen kannst, fordere die Quelldatei an.

Die Datei muss in UTF-8 gespeichert sein. Nutze Semikolon als Trennzeichen
und genau diese Kopfzeile, ohne weitere Spalten:

```csv
schulnummer;name;strasse;ort
```

- Eine Zeile pro Schule. Name und Ort müssen ausgefüllt sein.
- `schulnummer`: amtliche Schulnummer als Text, einschließlich führender
  Nullen. Keine Excel-Formel, kein vorangestelltes Apostroph. Wenn unbekannt,
  Feld leer lassen. Verschiedene Schulnummern nicht zusammenführen.
- `name`: vollständiger amtlicher Schulname (höchstens 150 Zeichen).
- `strasse`: Straße und Hausnummer, sofern bekannt (höchstens 150 Zeichen).
- `ort`: Ortsname ohne Postleitzahl (höchstens 100 Zeichen). Schreibweise
  innerhalb der Datei und gegenüber vorhandenen Daten konsistent halten.
- Keine Online-Veranstaltungsorte, Kontaktdaten oder Personennamen als eigene
  Datensätze. Keine Beispielschulen oder Platzhalterzeilen.
- Semikolons in Feldinhalten sind erlaubt, wenn das gesamte Feld in doppelte
  Anführungszeichen gesetzt ist. Anführungszeichen im Feld verdoppeln.
- Keine Zeilenumbrüche in einem Feld. Keine Markdown-Codeblöcke oder
  Erläuterungen in der fertigen Datei.
- Höchstens 500 Schulen und 128 KB pro Datei; größere Verzeichnisse in
  mehrere Dateien mit jeweils gleicher Kopfzeile aufteilen.

Prüfe vor der Ausgabe doppelte Schulnummern und doppelte Kombinationen aus
Name und Ort. Unklare Fälle nicht erraten: als Rückfrage außerhalb der CSV
auflisten. Quellen und Abrufdatum ebenfalls getrennt von der CSV nennen.

## Nach der Erstellung

Die Datei im Fortbildungsportal unter „Einrichtung“ oder „Orte“ auswählen
und „Vorschau erstellen“ aufrufen. Erst nach Prüfung der angezeigten
Änderungen „Geprüfte Schulen übernehmen“ wählen.

Der Import ordnet vorhandene Schulen zuerst anhand der Schulnummer zu,
sonst anhand von Name und Ort. Bei Umbenennungen daher möglichst die
Schulnummer mitliefern. Leere optionale Felder erhalten bestehende Angaben.
Nicht aufgeführte Schulen werden nicht entfernt. Stillgelegte Schulen werden
nicht automatisch aktiviert. Änderungen an vorhandenen Orten gelten auch
für bereits damit verknüpfte Veranstaltungen.
