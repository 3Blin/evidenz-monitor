# Funktionsübersicht (Klartext)

Was die Software kann, welcher Baustein es macht und wozu. Ohne Fachbegriffe.

## Anmelden
**Macht:** Anmeldung per Anmeldelink an die eigene E-Mail-Adresse. Kein Passwort.
**Existiert, damit:** jeder nur seine eigenen Aufträge sieht und bearbeiten kann.
Ein Passwort, das schlecht gewählt oder wiederverwendet wird, gibt es damit nicht
— und auch kein Zurücksetzen-Verfahren, das selbst angreifbar wäre.
**Baustein:** Anmeldung (Supabase Auth)

## Beobachtungsaufträge verwalten
**Macht:** Speichert, was beobachtet werden soll — Thema, Fragestellung,
Suchbegriffe, Relevanzregeln, Quellen, Abstand zwischen Abrufen. Angemeldet ist
das alles in der Oberfläche unter „Verwalten" bearbeitbar; neue Aufträge legt man
dort ebenfalls an.
**Existiert, damit:** neue Themen ohne Programmierung entstehen. Ein Auftrag
ist ein Eintrag in der Datenbank, kein Code. Windows 11 ist nur der erste
Eintrag; Sicherheitslücken, Wetterlage oder Preise funktionieren genauso — die
Grundeinrichtung legt bewusst zwei Aufträge aus verschiedenen Bereichen an.
**Baustein:** Auftragsverwaltung · **Tests:** dashboard-funktion.test.ts (8 Tests),
verwaltung-funktionen.test.ts (14 Tests)

## Mehrere Aufträge nebeneinander zeigen
**Macht:** Oben in der Oberfläche stehen alle Aufträge zur Auswahl, die ohne
Anmeldung lesbar sind — angemeldet zusätzlich die eigenen.
**Existiert, damit:** sichtbar wird, dass der Kern kein Thema kennt. Vorher zeigte
die Oberfläche genau einen fest eingestellten Auftrag.
**Baustein:** Auftragsverwaltung · **Tests:** auftragsliste.test.ts (11 Tests)

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
**Macht:** Erkennt exakt gleiche Beiträge über einen Prüfwert, inhaltsgleiche
Meldungen über Titelähnlichkeit und — seit ADR 0010 — Beiträge über dieselbe
Sache an einer **gemeinsamen Kennung**: einer KB-Nummer, einer CVE-Nummer, einer
Buildnummer. Zwei Forenbeiträge zu „KB5094126" gehören zusammen, auch wenn ihre
Titel nur elf Prozent Übereinstimmung haben.
Umgekehrt trennen Kennungen auch: Tragen zwei Beiträge verschiedene Kennungen,
sind es verschiedene Sachen — dann hilft auch ein ähnlich klingender Titel
nicht. Zusätzlich verbindet ein gemeinsamer Verweis auf dieselbe fremde Seite,
und ähnliche Titel gelten nur innerhalb von 45 Tagen als dieselbe Meldung.
**Existiert, damit:** dieselbe Nachricht in zehn Portalen nicht als zehn
unabhängige Bestätigungen zählt — und umgekehrt zwei Berichte über denselben
Vorgang nicht als zwei unverbundene Einzelhinweise stehen bleiben.
**Baustein:** Dublettenerkennung · **Tests:** dedup.test.ts (11),
kennungen.test.ts (19), gruppierung.test.ts (21), verweise.test.ts (11),
gruppierung-echtdaten.test.ts (5, gegen die 144 echten Inhalte)

## Unpassende Meldungen aussortieren
**Macht:** Prüft für jeden Beitrag, ob er zum Auftrag gehört. Dafür gelten drei
Angaben am Auftrag: Begriffe, die vorkommen **müssen**, Begriffe, die ihn
**ausschließen**, und wie viele der Suchbegriffe mindestens treffen müssen.
Begriffe zählen nur am Wortanfang, damit „KB" die Kennung „KB5000001" findet,
aber nicht mitten in einem fremden Wort trifft. Quellen, die schon auf das
Thema begrenzt sind — ein reines Windows-Forum etwa —, müssen das Thema im Text
nicht wiederholen. Jede Entscheidung wird begründet mitgeschrieben.
**Existiert, damit:** im Dashboard steht, was zum Auftrag gehört. Vorher genügte
ein einziges allgemeines Wort wie „Updates", wodurch ein Viertel der Aussagen
nichts mit dem Thema zu tun hatte.
**Baustein:** Relevanzprüfung · **Tests:** relevanz.test.ts (17 Tests)

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
Beiträge, beschriftete Linien zeigen, wer von wem übernommen hat. Offizielle
Quellen haben einen zusätzlichen Ring. Der Ausschnitt legt sich um die Knoten,
sodass immer alle sichtbar sind; ziehen, vergrößern und zurücksetzen geht mit
Maus, Finger und Tastatur. Ein Klick auf eine Quelle zeigt nur ihre Aussagen.
Gibt es keine Verknüpfungen, sagt die Ansicht das ausdrücklich.
**Existiert, damit:** auf einen Blick sichtbar ist, ob viele Quellen
wirklich unabhängig sind oder nur voneinander abschreiben.
**Baustein:** Dashboard · **Tests:** graph.test.ts (7), netz-layout.test.ts (15)

## Bewertungspanel anzeigen
**Macht:** Listet rechts die Aussagen mit Stufe, Begründung, Alter und den
beteiligten Herausgebern. Ein Klick klappt die Belege auf: je Beleg der
Herausgeber, seine Rolle (Erstmeldung, Übernahme, unabhängige Bestätigung), das
Veröffentlichungsdatum, die Fundstelle im Text und ein Verweis auf den Beitrag.
Die Reifegrad-Leiter filtert nach Stufe.
**Existiert, damit:** jede Anzeige auf ihre Quellen zurückführbar bleibt — und
zwar nachschlagbar. Eine Belegangabe ohne Verweis ist keine.
**Baustein:** Dashboard · **Tests:** dashboard-funktion.test.ts,
belege-und-uebernahme.test.ts (12)

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
filtert ihn automatisch aus allen Protokollen. Verschlüsselt wird auf dem
Server, nie im Browser. Der Schlüssel wird nie wieder herausgegeben — auch das
Formular kann ihn nicht anzeigen, nur ersetzen.
**Existiert, damit:** ein Datenbank- oder Protokollzugriff den Schlüssel
nicht preisgibt.
**Baustein:** Verschlüsselung · **Tests:** fundament.test.ts,
verwaltung-funktionen.test.ts

## Regeln von der KI vorschlagen lassen
**Macht:** Erzeugt aus Name und Fragestellung einen Vorschlag für Suchbegriffe,
Pflicht- und Ausschlussbegriffe, die nötige Trefferzahl und mögliche Quellen —
mit einer Begründung in Alltagssprache. Nutzt den eigenen hinterlegten
KI-Zugang. Gespeichert wird nichts von selbst: Der Vorschlag füllt die Felder,
gespeichert wird erst auf Knopfdruck.
**Existiert, damit:** der Einstieg keine Fachkenntnis über das Regelwerk
voraussetzt. Die Felder bleiben trotzdem sichtbar und änderbar — wer sie nie
sieht, kann ein schlechtes Ergebnis nicht verbessern.
**Baustein:** KI-Anbindung · **Tests:** ki-vorschlag.test.ts (17 Tests)

## Freigegebenen Auftrag übernehmen
**Macht:** Kopiert einen öffentlich freigegebenen Auftrag samt Quellen und
Relevanzregeln ins eigene Konto. Ohne die gesammelten Beiträge des Originals,
und ohne selbst wieder öffentlich zu sein.
**Existiert, damit:** ein Beispiel nicht nur anzusehen, sondern zu benutzen ist.
Vorher verwies die Verwaltung auf einen Fall, den man nicht bearbeiten konnte.
**Baustein:** Verwaltung · **Tests:** belege-und-uebernahme.test.ts

## Einordnen ohne Sprachverständnis (Grenze)
**Macht:** Ohne KI-Analyse gilt jeder Beitrag außer der Erstmeldung als
Übernahme. Unabhängigkeit wird nicht unterstellt.
**Existiert, damit:** keine Stufe behauptet wird, die nie geprüft wurde. Drei
Portale, die dieselbe Herstellermeldung abschreiben, sind keine drei
unabhängigen Quellen. Die Folge ist ausdrücklich gewollt: Ohne KI-Analyse endet
die Leiter bei Stufe 2 — ausnahmslos (ADR 0018). Auch ein Beitrag einer
zuständigen Primärquelle hebt sie nicht: Ob er bestätigt oder widerspricht,
ist ohne inhaltliche Prüfung nicht entscheidbar.
**Nicht im Betrieb:** Der KI-Analyse-Baustein (`src/lib/ki-adapter.ts`) ist
gebaut und getestet, wird aber von keinem Auswertungslauf aufgerufen. Was zum
Anschließen fehlt, steht in ADR 0011.
**Baustein:** Vorklassifikation · **Tests:** vorklassifikation.test.ts

## Von selbst abrufen, im passenden Takt
**Macht:** Ein Zeitplan ruft alle 15 Minuten an; abgerufen wird nur, was fällig
ist. Wie oft ein Auftrag fällig wird, entscheidet sein eigener Takt — und der
ist kein fester Wert, sondern bewegt sich zwischen einer Unter- und einer
Obergrenze, die du einstellst. Bringt ein Abruf neue Beiträge, halbiert sich
der Abstand; bringt er nichts, verdoppelt er sich.
**Existiert, damit:** ein schnelllebiges Thema von selbst mehr Aufmerksamkeit
bekommt als ein ruhiges, ohne dass du nachstellen musst. Und damit überhaupt
etwas läuft: Vorher passierte ohne Handaufruf gar nichts, und das Feld für den
Abstand war zwar einstellbar, wurde aber von keinem Lauf gelesen.
**Baustein:** Taktung · **Tests:** taktung.test.ts (21),
taktung-datenbank.test.ts (7)

## Quellen zu einer Fragestellung finden
**Macht:** Ein Skript auf deinem Rechner (`sammler/notebooklm/`) lässt
NotebookLM das Netz nach passenden Quellen durchsuchen und schreibt die
Fundstellen in eine Datei. Deren Inhalt fügst du in der Verwaltung ein und
wählst je Eintrag aus, was angelegt wird.
**Existiert, damit:** ein neuer Auftrag nicht mit null Quellen dasteht. Anders
als der KI-Vorschlag, der sich an Adressen *erinnert*, wird hier tatsächlich
*gesucht* — die Adressen existieren.
**Warum außerhalb der Plattform:** Das Werkzeug meldet sich mit dem ganzen
Google-Konto an, nicht mit einem eng begrenzten Schlüssel. Ein solches
Geheimnis gehört nicht auf einen Server. Der Umweg über die Datei ist die
Trennfuge (ADR 0013).
**Baustein:** Externer Sammler · **Tests:** vorschlagsdatei.test.ts (12)
