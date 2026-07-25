# Funktionsübersicht (Klartext)

Was die Software kann, welcher Baustein es macht und wozu. Ohne Fachbegriffe.

## Beobachtungsaufträge verwalten
**Macht:** Speichert, was beobachtet werden soll — Thema, Fragestellung,
Suchbegriffe, Quellen, Abstand zwischen Abrufen.
**Existiert, damit:** neue Themen ohne Programmierung entstehen. Ein Auftrag
ist ein Eintrag in der Datenbank, kein Code. Windows 11 ist nur der erste
Eintrag; Wetterlage, Preise oder Ferienhäuser funktionieren genauso.
**Baustein:** Auftragsverwaltung · **Tests:** dashboard-daten.test.ts

## Quellen abrufen
**Macht:** Holt in festen Abständen neue Beiträge von den hinterlegten
Quellen (RSS-Feeds und Webseiten), speichert Titel, Autor, Datum und einen
Auszug — nie den ganzen Text, wegen des Urheberrechts.
**Existiert, damit:** neue Informationen automatisch hereinkommen, ohne dass
jemand Seiten manuell durchsucht.
**Baustein:** Quellen-Abrufer · **Tests:** sammler.test.ts (5 Tests)

## Ausfälle verkraften
**Macht:** Wenn eine Quelle nicht erreichbar ist, wird der Fehler
protokolliert und die nächste Quelle bearbeitet.
**Existiert, damit:** ein einzelner Ausfall nie den ganzen Auftrag stoppt.
Im Dashboard steht dann "X Quellen nicht erreichbar".
**Baustein:** Quellen-Abrufer · **Tests:** sammler.test.ts

## Doppelte Meldungen erkennen
**Macht:** Erkennt exakt gleiche Beiträge über einen Prüfwert und
inhaltsgleiche Meldungen über Titelähnlichkeit; ordnet sie einer Gruppe zu.
**Existiert, damit:** dieselbe Nachricht in zehn Portalen nicht als zehn
unabhängige Bestätigungen zählt. Das ist der häufigste Fehler bei
automatischer Nachrichtenauswertung.
**Baustein:** Dublettenerkennung · **Tests:** dedup.test.ts (11 Tests)

## Meldungen einordnen (ohne KI)
**Macht:** Bestimmt anhand von Zeitpunkt, Herausgeber und Titelähnlichkeit,
welcher Beitrag die Ursprungsmeldung ist und welche Übernahmen oder
eigenständige Bestätigungen sind. Jede Einordnung wird begründet.
**Existiert, damit:** das System auch ohne hinterlegten KI-Schlüssel
nachvollziehbare Ergebnisse liefert.
**Baustein:** Vorklassifikation · **Tests:** vorklassifikation.test.ts

## Meldungen einordnen (mit KI, eigener Schlüssel)
**Macht:** Schickt einen Beitrag mit einem festen Analyse-Auftrag an den
KI-Dienst, den der Nutzer selbst hinterlegt hat (Anthropic, OpenAI oder ein
eigener Endpunkt im Heimnetz). Die KI extrahiert Aussagen samt Fundstelle
und ordnet sie ein. Antworten, die nicht der vorgegebenen Form entsprechen,
werden abgelehnt.
**Existiert, damit:** Texte inhaltlich verstanden werden — und trotzdem
nichts Erfundenes ins System gelangt. Anweisungen, die in fremden Texten
stehen ("ignoriere deine Regeln"), werden ausdrücklich nicht befolgt.
**Baustein:** KI-Analyse-Adapter · **Tests:** ki-adapter.test.ts (16 Tests)

## Belastbarkeit bewerten (Reifegrad 1–8)
**Macht:** Berechnet aus den Belegen nach festen Regeln, wie belastbar eine
Aussage ist: von "unbestätigter Einzelhinweis" (1) über "erkennbarer Trend"
(3) und "unabhängig bestätigt" (5) bis "offiziell bestätigt" (6), "behoben"
(7) oder "widerlegt" (8). Jede Stufe wird mit Begründung gespeichert.
**Existiert, damit:** die Bewertung reproduzierbar und überprüfbar ist. Die
KI vergibt keine Stufen — sonst könnte niemand nachrechnen, warum etwas als
gesichert gilt.
**Baustein:** Reifegrad-Regelwerk · **Tests:** reifegrad.test.ts (15 Tests)

## Verlauf festhalten
**Macht:** Jede Bewertungsänderung wird als neuer Eintrag angehängt, alte
Einträge bleiben unverändert erhalten.
**Existiert, damit:** man sieht, wie aus einem Gerücht eine bestätigte
Erkenntnis wurde — und wann. Überschreiben ist technisch ausgeschlossen.
**Baustein:** Datenbank (Verlaufstabelle)

## Quellen-Graph anzeigen
**Macht:** Zeigt jede Quelle als Punkt; die Größe entspricht der Zahl ihrer
Beiträge, Linien zeigen, wer von wem übernommen hat. Offizielle Quellen
haben einen zusätzlichen Ring.
**Existiert, damit:** auf einen Blick sichtbar ist, ob viele Quellen
wirklich unabhängig sind oder nur voneinander abschreiben.
**Baustein:** Dashboard · **Tests:** graph.test.ts (7 Tests)

## Bewertungspanel anzeigen
**Macht:** Listet rechts die Aussagen mit Stufe, Begründung, Anzahl der
Belege und den beteiligten Herausgebern.
**Existiert, damit:** jede Anzeige auf ihre Quellen zurückführbar bleibt.
**Baustein:** Dashboard · **Tests:** dashboard-daten.test.ts

## Schnittstelle für Apps und eigene Agenten
**Macht:** Stellt die Dashboard-Daten unter `/api/v1/dashboard` bereit;
Eingaben werden geprüft, Fehler bekommen eine Kennnummer zum Nachverfolgen.
**Existiert, damit:** die geplante Handy-App und externe Sammler dieselben
geprüften Wege nutzen wie die Weboberfläche.
**Baustein:** API-Schicht

## Zugangsschlüssel schützen
**Macht:** Verschlüsselt den KI-Schlüssel des Nutzers vor dem Speichern und
filtert ihn automatisch aus allen Protokollen.
**Existiert, damit:** ein Datenbank- oder Protokollzugriff den Schlüssel
nicht preisgibt.
**Baustein:** Verschlüsselung · **Tests:** fundament.test.ts
