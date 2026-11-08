# Rotwelsch lernen

Statisches Offline-Lernmodul für den Lesezeichen-Hub. Die Startseite öffnet den
Lernplatz mit Karteikarten und Lehrgang, keine Einrichtungs-Platzhalterseite.

## Funktionen

- Wörterbuch mit 849 Quellenbedeutungen, 825 Hauptformen und 108 belegten
  Nebenformen; Suche in beide Richtungen und Filter für Thema, Quelle, Gebrauch,
  Favoriten, Lernsammlung und pausierte Wörter.
- Zwölf thematische Lektionen mit Einführung, Quellenkarten und Abschlussprüfung.
- FSRS-Wiederholungen in beide Richtungen, Tageslimit neuer Karten, fortsetzbare
  Sitzungen und Rücknahme der letzten eigenen Bewertung.
- Bedeutungswahl, Eingabe, Lücken in Originalbelegen und Zuordnungsspiele.
  Freiwillige Zeit-Challenge bei Einzelaufgaben; Spielpunkte ersetzen keine
  Kartenbewertung.
- Sechzehn Textlektüren beziehungsweise Übungen, davon sieben Originalauszüge;
  anklickbare Wörter, Quellenbilder, Verständnishilfen und gespeicherte eigene
  Antworten mit Musterantworten zur Selbstkontrolle.
- Lokale Lernplätze, Notizen, eigene gekennzeichnete Ausdrücke, Lernstatistik,
  Hell-/Dunkelansicht, optionale lokale deutsche Vorlesestimme und Druckansichten.
- JSON-Sicherung aller Lernplätze, validierter Import mit Zusammenführen oder
  Ersetzen, sowie CSV-Vokabelexport mit Formelschutz.

## Öffnen

Im Hub den bestehenden lokalen Modulordner öffnen. Alle Browserdateien sind
bereits lokal gebaut; Node.js ist für den normalen Hub-Betrieb nicht erforderlich.
Bei einer noch sichtbaren alten Seite einmal vollständig neu laden (Strg+F5).
Eine weitere Modulregistrierung oder eine Änderung des Hub-Codes ist nicht nötig.

Eigenständige Vorschau mit installiertem Node.js:

```powershell
npm install
npm start
```

Der Server lauscht nur auf `127.0.0.1` und wählt standardmäßig einen freien Port.
Die tatsächliche Adresse steht in der Ausgabe. `PORT` kann für eine feste Adresse
gesetzt werden; wechselnde Ports haben getrennte Lernspeicher.

Der Offline-Cache vergleicht keine Datei-Prüfsummen. Unterschiede zwischen
Windows-/Unix-Zeilenenden oder Anpassungen an der Startseite verhindern die
Offline-Einrichtung nicht. Archivierte Quellen behalten über die Git-Attribute
ihre originalen Bytes für die gesonderte Provenienzprüfung in der Entwicklung.

## Offline und Lernstand

Die Anzeige **Offline bereit** erscheint erst bei einem aktiven Service Worker
nach vollständigem Vorabcache. Alle benötigten Dateien müssen erfolgreich
geladen werden; die vier Lern-Inhaltsdateien müssen lesbares JSON mit gültiger
Grundstruktur enthalten. Wörterbuch, Schriften, Icons,
Übungen, Quellenbilder und OCR-Archiv werden lokal gecacht. Danach ist ein
Neustart über die direkte Moduladresse auch ohne laufenden Server möglich.
Für die Einrichtung sind HTTPS oder HTTP auf localhost/127.0.0.1 nötig;
`file://` ist kein unterstützter Startweg. Die Hub-Verwaltungsseite selbst wird
von diesem Modul nicht offlinefähig gemacht.

Updates werden erst per **Aktualisierung laden** übernommen, nicht während einer
laufenden Kartenlernsitzung. Fehlende Dateien, defekte Downloads oder ungültige Inhaltsdaten
verwerfen den neuen Cache; eine bereits funktionierende Version bleibt bestehen.
Fremde Hub-Modulcaches werden nicht gelöscht.

Kurzzeitige Downloadfehler werden bis zu dreimal versucht. Dauerhafte Fehler
zeigen die betroffene Datei beziehungsweise den Versions- oder Speicherfehler.
**Erneut versuchen** startet die Offline-Einrichtung neu, ohne den Lernstand
zu löschen. Bei einem Versionskonflikt müssen die Dateien aus einem vollständig
abgeschlossenen Build stammen. Eine bloße Änderung von Datei-Bytes führt dagegen
nicht mehr zum Abbruch.

Der Lernstand wird getrennt vom Inhaltscache in IndexedDB gespeichert. Host,
Port, Modulpfad und Browserprofil bestimmen den Speicher. `localhost` und
`127.0.0.1` sind unterschiedliche Orte. Die Hub-Sicherung enthält diesen
Browserlernstand nicht. Vor Umzug, Browserdatenlöschung oder Pfadwechsel eine
JSON-Sicherung exportieren. Importierte Kartenstände bleiben lernbar; ihre alten
Bewertungen sind nicht rücknehmbar und unvollständige Sitzungen werden verworfen.
Beim Zusammenführen gewinnt je Karte der spätere letzte Wiederholungszeitpunkt;
Sammlungen und Verlaufs-IDs werden vereint, Notizkonflikte nach dem neueren
Profilzeitpunkt aufgelöst.

Vorlesen nutzt nur eine vorhandene lokale deutsche Stimme. Eine solche Stimme
muss gegebenenfalls im Betriebssystem installiert sein. Sie ist weder eine
authentische historische Aussprache noch eine Voraussetzung für das Lernen.

## Quellenqualität

Historische Einträge wurden mit lokal archivierten Originalseiten verglichen.
Sie sind ein ausgewählter Ausschnitt, keine unabhängige Fachbegutachtung oder
vollständige Erfassung des Rotwelsch. Region und Zeit bleiben getrennt.
Historische und regionale Wortschätze werden nicht als einheitliche neue
Grammatik oder CEFR-zertifizierte Fremdsprache ausgegeben.

Der vollständige OCR-Text ist **ungeprüftes Erschließungsmaterial**, kein automatisch
freigegebenes Wörterbuch. Sekundärreferenzen und eigene Einträge sind getrennt
gekennzeichnet. Didaktische Texte sind neu verfasst, keine Originaldialoge.
Details stehen in [docs/content-review.md](docs/content-review.md) und im
[Bestandsbericht](data/inventory.json).

Der Originaldruck von Kluge (1901) ist gemeinfrei. Bearbeitete Inhaltsangaben aus
Wikipedia/Wiktionary stehen unter CC BY-SA 4.0; Urheber, Quellen- und Lizenzlinks
sind in der Quellenansicht enthalten. Bibliotheks- und Schriftlizenzen werden
unter den lokalen Assets mitgeliefert. Moderne Kaufwörterbücher wurden nicht kopiert.

## Entwicklung und Prüfung

```powershell
npm run build
npm run test:all
```

Der Build bündelt die gepinnten Browserbibliotheken, kopiert lokale Schriften und
Lizenzen und erzeugt Versions- und Cachemanifest. Der Build-Hash dient nur als
Kennung für neue Cacheversionen, nicht als Datei-Prüfsumme bei der Installation.
Die vorhandenen Installationssymbole können unter Windows mit
`tools/create-icons.ps1` neu erzeugt werden.

Browserprüfungen benötigen einmalig `npx playwright install chromium`. Sie testen
Root- und verschachtelte Hub-Pfade, Kartenpersistenz, Lektionen, Textarbeit, alle
Spielmodi, Sicherungen, 320-/390-Pixel-Mobilansichten und Offline-Neustart bei
abgeschaltetem Server. Ein gesonderter Test prüft gute und defekte Cacheupdates.