# ADR 0015: Triage der Fragestellung — die Frage bestimmt die Betriebsart
Datum: 31.07.2026 · Status: angenommen · Freigegeben am: 31.07.2026

## Kontext
Bis hierher behandelte das System jede Fragestellung gleich: derselbe
Taktbereich als Vorschlag, dasselbe Zeitfenster von 45 Tagen für die
Zusammenführung. Das ist für alle Fälle gleich falsch, weil die Fälle
grundverschieden sind:

- **"Ich habe eben gehört, dass …"** — Die erste Frage ist nicht "stimmt das?",
  sondern "gibt es dazu überhaupt schon etwas im Netz?". Und dann: beobachten.
  Tauchen plötzlich weitere Meldungen auf? Wird abgeschrieben, oder kommt
  tatsächlich Neues hinzu? Hier zählt der enge Takt, und alles Ältere als zwei
  Wochen ist nicht dieselbe Meldung, sondern ein anderer Vorgang.
- **"Wie entwickelt sich …"** — laufende Beobachtung über Wochen.
- **"Wurde damals wirklich …"** — Hier hilft häufiges Abrufen gar nichts. Was
  zählt, ist der weite Rückblick: Äußerungen aus verschiedenen Zeiten
  gegenüberstellen. Bei 45 Tagen Fenster findet man davon nichts.

Ein festes Zeitfenster schneidet die dritte Frage schlicht ab. Ein fester Takt
verpasst die erste. Das ist keine Feinheit, sondern der Unterschied zwischen
"das System beantwortet meine Frage" und "das System beantwortet eine andere".

## Entscheidung

### 1. Drei Betriebsarten, aus dem Text der Frage abgeleitet
`akut`, `laufend`, `historisch`. Jede bringt einen Taktbereich und ein
Zeitfenster mit:

| Betriebsart | Takt | Rückblick |
|---|---|---|
| akut | 15 min – 4 h | 14 Tage |
| laufend | 1 h – 24 h | 45 Tage (Vorgabe wie bisher) |
| historisch | 24 h – 30 Tage | 10 Jahre |

### 2. Regelbasiert, nicht per Sprachmodell
Die Merkmale sind Redewendungen und Zeitbezüge — "eben gehört", "angeblich",
"stimmt es, dass", "damals", "seit wann", "in den 1970ern". Das läuft ohne
Schlüssel, ohne Kosten, in Millisekunden und bei jedem Tastendruck im Formular.

Vor allem aber ist es **erklärbar**: Der Befund nennt im Klartext, welches
Merkmal angesprochen hat. Eine unerklärliche Betriebsart wäre schlimmer als
eine grobe — wer einen Vorschlag nicht prüfen kann, kann ihn auch nicht guten
Gewissens übernehmen. Ein Sprachmodell kann die Einordnung später verfeinern;
es ersetzt sie nicht.

Themenneutralität (verbindliche Anforderung) bleibt gewahrt: Kein einziges
Merkmal nennt ein Thema, eine Firma oder ein Produkt. Wer die Datei liest, kann
nicht erraten, worüber dieses System wacht.

### 3. Frisch und alt zugleich ist kein Widerspruch, sondern ein eigener Fall
"Ich habe eben gehört, dass schon in den 1970ern davor gewarnt wurde." Beide
Merkmalsarten sprechen an. Frisch ist die **Behauptung**, alt ist der
**Gegenstand**.

Dann gilt der enge Takt (die Behauptung ist frisch und will beobachtet werden)
zusammen mit dem weiten Rückblick (der Gegenstand liegt zurück). Sich für eines
von beiden zu entscheiden, hieße die halbe Frage wegzuwerfen. Das ist der
Grund, warum Betriebsart und Zeitfenster getrennte Felder sind und nicht ein
einziges.

### 4. Jahreszahlen zählen nur mit Begleitwort
`seit 1998`, `im Jahre 1815`, `in den 1970ern` — aber nicht eine nackte
Vierstellige. Manche Produktfassungen tragen Bezeichnungen, die wie
Jahreszahlen aussehen; "1809" ist dort eine Version. Ohne diese Regel landeten
halbe Auftragslisten in der falschen Betriebsart.

### 5. Der Vorschlag wird angezeigt, nie von selbst übernommen
Im Formular steht die erkannte Betriebsart mit Begründung und ein Knopf
*Vorschlag übernehmen*. Was das System abruft, entscheidet die Nutzerin.

### 6. Das Zeitfenster wirkt tatsächlich
`gruppiereMitBegruendung` nimmt es als Aufrufwert, der Auswertungslauf reicht
den Wert der Triage durch, und ein Test belegt, dass dasselbe Beitragspaar bei
45 Tagen getrennt und bei 3650 Tagen zusammengeführt wird.

Dieser letzte Punkt steht hier ausdrücklich, weil ADR 0012 genau daran
gescheitert wäre: `intervall_minuten` war einstellbar und wurde von keinem Lauf
gelesen. Eine Einstellung, die nichts bewirkt, ist schlechter als gar keine —
man verlässt sich auf sie.

## Begründung
Die Triage ist der Baustein, ohne den die Kernidee nicht funktioniert. Die
Frage lautet: *Gibt es diese Behauptung online, wer war zuerst, wo wurde sie
übernommen, und gab es offizielle Äußerungen dazu?* Wann "zuerst" war, hängt
davon ab, wie weit man zurücksieht — und das kann nur die Frage selbst
beantworten.

Verworfene Alternativen:

- **Betriebsart von Hand wählen lassen.** Wäre ein weiteres Feld in einer
  Maske, die schon zu voll ist (das war die ausdrückliche Rückmeldung zur
  ersten Nutzung). Die Frage enthält die Antwort bereits; sie noch einmal
  abzufragen ist Arbeit ohne Gewinn.
- **Per Sprachmodell einordnen.** Kostet bei jedem Tastendruck, braucht einen
  Schlüssel und ist nicht erklärbar. Als spätere Verfeinerung sinnvoll, als
  Grundlage nicht.
- **Nur den Takt anpassen, das Zeitfenster fest lassen.** Damit bliebe die
  rückblickende Frage unbeantwortbar — und gerade sie ist der Fall, bei dem der
  Takt egal ist.
- **Eine vierte Betriebsart für "frisch über alt".** Sieht ordentlich aus, ist
  aber eine Scheinunterscheidung: Takt und Rückblick sind zwei unabhängige
  Größen, und zwei unabhängige Größen gehören nicht in eine Aufzählung.

## Konsequenzen
- Neu: `src/lib/triage.ts`, 19 Tests. `gruppiereMitBegruendung` und `gruppiere`
  nehmen das Zeitfenster als Aufrufwert; die Vorgabe bleibt `ZEITFENSTER_TAGE`,
  sodass alle vorhandenen Aufrufe unverändert weiterlaufen.
- Der Auswertungslauf schreibt Betriebsart, Rückblick und Begründung in seine
  Ausgabe. Wer den Lauf liest, sieht, wonach er sich gerichtet hat.
- `triage.ts` wiederholt den Wert 45, statt ihn zu importieren: Die Datei läuft
  auch im Browser, und ein Import zöge die gesamte Zusammenführungslogik ins
  Auslieferpaket. Ein Test hält beide Stellen zusammen.
- Keine Migration, keine neue Abhängigkeit, keine Einrichtung.
- **Offen:** Die Merkmale sind deutschsprachig. Eine englische Fragestellung
  landet in `laufend` — die Vorgabe, also nichts Falsches, aber auch nichts
  Gewonnenes. Erweitern, sobald jemand das braucht.
