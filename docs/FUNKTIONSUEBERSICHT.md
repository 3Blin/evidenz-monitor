# Funktionsübersicht (Klartext)

Was die Software kann, welcher Baustein es macht und wozu. Ohne Fachbegriffe.

## Beobachtungsaufträge verwalten
**Macht:** Speichert, was beobachtet werden soll — Thema, Fragestellung,
Suchbegriffe, Quellen, Abstand zwischen Abrufen.
**Existiert, damit:** neue Themen ohne Programmierung entstehen. Ein Auftrag
ist ein Eintrag in der Datenbank, kein Code. Windows 11 ist nur der erste
Eintrag; Wetterlage, Preise oder Ferienhäuser funktionieren genauso.
**Baustein:** Auftragsverwaltung · **Tests:** dashboard-funktion.test.ts (8 Tests)

## Quellen abrufen
**Macht:** Holt in festen Abständen neue Beiträge von den hinterlegten
Quellen, speichert Titel, Autor, Datum und einen Auszug — nie den ganzen
Text, wegen des Urheberrechts. Zwei Zugangswege: Feeds (RSS/Atom) und
einzelne Webseiten. Welcher Weg genommen wird, entscheidet die Adresse der
Quelle, nicht die Art des Herausgebers.
**Existiert, damit:** neue Informationen automatisch hereinkommen, ohne dass
jemand Seiten manuell durchsucht.
**Baustein:** Quellen-Abrufer · **Tests:** sammler.test.ts (6 Tests),
quellen-adapter.test.ts (19 Tests), quellen-registrierung.test.ts (4 Tests)

## Webseiten ohne Feed lesen
**Macht:** Liest eine einzelne Webseite — etwa eine Status-Seite oder einen
Support-Artikel des Herstellers — und holt Titel, Autor, Datum und
Fließtext heraus. Skripte, Stile und eingebettete Inhalte werden vorher
entfernt und niemals ausgeführt.
**Existiert, damit:** gerade die Bestätigungskanäle nutzbar sind. Die
wichtigsten offiziellen Meldungen erscheinen auf Seiten ohne Feed.
**Baustein:** Quellen-Abrufer (Web-Adapter) · **Tests:** quellen-adapter.test.ts

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
**Baustein:** Vorklassifikation · **Tests:** vorklassifikation.test.ts (10 Tests)

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
**Baustein:** Dashboard · **Tests:** dashboard-funktion.test.ts

## Schnittstelle für Apps und eigene Agenten
**Macht:** Stellt die Dashboard-Daten unter `/api/v1/dashboard` bereit;
Eingaben werden geprüft, Fehler bekommen eine Kennnummer zum Nachverfolgen.
**Existiert, damit:** die geplante Handy-App und externe Sammler dieselben
geprüften Wege nutzen wie die Weboberfläche.
**Baustein:** API-Schicht

## Inhalte von eigenen Sammlern annehmen
**Macht:** Nimmt unter `/api/v1/ingest` Beiträge an, die ein eigener Agent
oder Ablauf (n8n und Ähnliches) eingeliefert hat. Ein Token, das zu genau
einem Beobachtungsauftrag gehört, weist die Berechtigung nach. Die Inhalte
laufen danach durch dieselbe Dublettenerkennung, Einordnung und Bewertung
wie selbst abgerufene.
**Existiert, damit:** Kanäle mit Anmeldezwang nutzbar bleiben, ohne dass
riskante Beschaffung in die Software selbst wandert. Eingeliefertes ist als
solches gekennzeichnet und wird in der Quellenbewertung entsprechend
eingestuft.
**Baustein:** API-Schicht · **Tests:** ingest.test.ts (21 Tests)

## Fremde Daten voneinander trennen
**Macht:** Die Datenbank selbst gibt jedem nur die Daten seiner eigenen
Beobachtungsaufträge heraus. Verschlüsselte KI-Schlüssel und Ingest-Token
sind für die Anwendung vollständig gesperrt. Ein einzelner Auftrag kann
ausdrücklich als öffentlich lesbare Vorführung freigegeben werden.
**Existiert, damit:** der Schutz auch dann gilt, wenn jemand die
Schnittstelle direkt anspricht, statt die Weboberfläche zu benutzen. Läge
die Prüfung nur in der Anwendung, wäre sie am Vorbeiweg wirkungslos.
**Baustein:** Datenbank (Zeilen-Sicherheit) · **Tests:** zeilensicherheit.test.ts (8 Tests)

## Zugangsschlüssel schützen
**Macht:** Verschlüsselt den KI-Schlüssel des Nutzers vor dem Speichern und
filtert ihn automatisch aus allen Protokollen.
**Existiert, damit:** ein Datenbank- oder Protokollzugriff den Schlüssel
nicht preisgibt.
**Baustein:** Verschlüsselung · **Tests:** fundament.test.ts
