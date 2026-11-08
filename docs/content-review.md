# Originalbestand und Erweiterungen

Der Bestand ist ein redaktionell ausgewählter Ausschnitt, nicht das gesamte
Rotwelsch und kein vollständiger Atlas seiner regionalen Varianten.

## Belege

- Historische Lerninhalte stammen aus dem gemeinfreien Originaldruck von
  Friedrich Kluges Quellenbuch (Straßburg 1901). Jede historische Karte enthält
  eine gedruckte Seite, die konkrete Glosse und ein lokal archiviertes Bild.
- Die historische Grundliste stammt aus dem Liber-Vagatorum-Abdruck von 1510.
  Ergänzungen sind nach Böckels oberhessischem Glossar (1885), Rocholls
  Kundenlexikon, Linkes Handwerkslexikon, Killertaler Erhebungen (1899),
  Pfälzer Händlersprache und Winterfelder Hausiersprache getrennt.
- Alle aufgenommenen historischen Glossen wurden mit den entsprechenden
  Seitenbildern verglichen. Das ist eine Quellenlesung, keine unabhängige
  sprachwissenschaftliche Fachbegutachtung. Unsichere Lesarten oder ausdrücklich
  fragliche Bedeutungen werden ausgelassen oder klar als solche erläutert.
- OCR wird nicht automatisch als Wörterbuch freigegeben. Der komplette
  archivierte OCR-Text ist Erschließungsmaterial; er enthält Lesefehler und
  historische diskriminierende Fremdwertungen.
- Sekundärreferenzen aus Wikipedia/Wiktionary bleiben als solche gekennzeichnet.
  Eine moderne Definition ist kein Nachweis der damaligen Aussprache.

## Transkription

Langes s wird als s wiedergegeben. Historische Umlautzeichen werden als heutige
Umlautzeichen transkribiert, Zeilen- und Trennungsumbrüche aufgelöst. Die im Druck
eingeklammerten optionalen Buchstaben ergeben ausdrücklich dokumentierte
Lernformen. Invertierte Glossarüberschriften und aufgelöste Abkürzungen werden
bei den betreffenden Wendungen erläutert. Keine neuen Zusammensetzungen werden
aus vermeintlichen Wortbildungsregeln erzeugt.

Suchtransliteration (ae/oe/ue, Ligaturen, Groß-/Kleinschreibung) ist eine
Eingabehilfe und gilt nicht als zusätzlicher historischer Ausdruck. Echte
Varianten stehen gesondert bei der jeweiligen Quelle. Regionale Bedeutungen
werden nicht vermischt: stichler kann im Killertal Metzger, in Kundenlisten
Schneider bedeuten; schucken ist bei Rocholl bezahlen, in der Pfälzer Liste sein.

## Zählung

Der Bestandsbericht unterscheidet:

- `entries`: Karten mit quellenbezogener Bedeutung; eine Wortform kann mehrere
  Einträge haben, wenn Quelle oder Sinn unterschiedlich sind.
- `headwords`: unterschiedliche Hauptformen, ohne zusätzliche Zählung von
  Groß-/Kleinschreibung oder Varianten.
- `phrases` und `phraseHeadwords`: mehrteilige Einträge beziehungsweise
  unterschiedliche mehrteilige Hauptformen. Das sind nicht sämtlich idiomatische
  Redewendungen; auch Grüße, Kurzformen und mehrteilige Bezeichnungen zählen dazu.
- `variants`: dokumentierte Nebenformen, die nicht bereits Hauptformen sind.
- `originalTexts`: Originalauszüge, darunter zusammengestellte Glossareinträge;
  keine Behauptung historischer zusammenhängender Gespräche.

Die nachträglich aufgenommenen Quellen erhöhen nicht automatisch die Anzahl
heute gebräuchlicher Wörter. Dafür ist eine zusätzliche Gegenwartsreferenz nötig.

## Weitere Aufnahmen

1. Gemeinfreiheit und tatsächliche Ausgabe prüfen.
2. Seiten über das strukturierte Archivmapping beziehen und Prüfsumme sichern.
3. Wort, Bedeutung und gegebenenfalls Variante direkt im Quellenbild prüfen.
4. Region und Zeitraum nur angeben, soweit die Quelle sie trägt.
5. Einträge über eine Quellensammlung mit stabiler ASCII-ID ergänzen.
6. Keine OCR-Kandidaten, erfundenen Beispiele oder automatische Etymologien als
   Originalbelege ausgeben.
7. `npm run test:content` und `npm test` ausführen. Den Bestandsbericht mit
   `node tools/validate-content.mjs --report` aktualisieren.

Quellenbilder können unter Windows mit dem Importskript um weitere eindeutig
zugeordnete Seiten ergänzt werden. Fehlende Seitenzuordnungen werden nicht
interpoliert. Das Archivmapping enthält beispielsweise keine eindeutige Seite 421.