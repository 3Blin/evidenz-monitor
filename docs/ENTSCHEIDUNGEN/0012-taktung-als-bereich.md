# ADR 0012: Der Abrufabstand ist ein Bereich, kein Wert
Datum: 28.07.2026 · Status: angenommen · Freigegeben am: 28.07.2026

## Kontext
Zwei Dinge kamen zusammen.

**Erstens:** Es gab keinen Zeitplan. `sammeln` und `auswerten` liefen nur, wenn
jemand sie von Hand aufrief. Ohne Zeitplan sind die Relevanzregeln (ADR 0008),
die Belege (ADR 0010) und die präzisere Zusammenführung (ADR 0011) wirkungslos:
Sie greifen erst beim nächsten Lauf, und der kam nie.

**Zweitens, beim Nachsehen aufgefallen:** `auftraege.intervall_minuten` stand
seit Migration 0001 im Schema, war in der Oberfläche einstellbar — und wurde
von **keinem Lauf gelesen**. `scripts/sammeln.job.ts` nahm bei jedem Aufruf
alle aktiven Aufträge. Eine Einstellung, die nichts bewirkt, ist schlechter als
gar keine: Man verlässt sich auf sie.

Die Anforderung an den Zeitplan lautete, er müsse sich je Anwendungsfall
anpassen lassen, weil manche Ereignisse schnelllebiger sind als andere, und die
Nutzerin solle einen Mindest- und einen Höchstwert frei einstellen können.

## Entscheidung

### 1. Der Takt ist ein Bereich, kein fester Wert
`intervall_min_minuten` und `intervall_max_minuten` ersetzen
`intervall_minuten` (Migration 0006). Die Nutzerin setzt die Grenzen, der Takt
bewegt sich zwischen ihnen:

- Bringt ein Lauf **neue Beiträge**, halbiert sich der Abstand — in Richtung
  Untergrenze.
- Bringt er **nichts**, verdoppelt er sich — in Richtung Obergrenze.
- Beides begrenzt auf den eingestellten Bereich.

Ein neuer Auftrag beginnt an der Untergrenze und ist sofort fällig; er wartet
nicht erst einen Takt lang, bevor er zum ersten Mal etwas zeigt.

Warum ein Bereich und nicht ein Wert: Wie schnell ein Thema läuft, weiß man
vorher nicht, und es ändert sich. Ein Auftrag über eine akute Störung braucht
Minuten, einer über eine Gesetzesnovelle Tage — und derselbe Auftrag braucht in
der heißen Phase etwas anderes als drei Wochen später. Ein fester Wert zwingt
zur Wahl zwischen "zu oft, wenn nichts passiert" und "zu selten, wenn es
darauf ankommt".

Warum Halbieren und Verdoppeln: In vier Schritten ist jede übliche Spanne
durchlaufen — schnell genug, um brauchbar zu reagieren, und langsam genug, dass
ein einzelner Ausreißer den Takt nicht umwirft.

### 2. Vertauschte Grenzen werden getauscht, nicht abgewiesen
Gibt jemand Untergrenze 480 und Obergrenze 30 ein, ist offensichtlich, was
gemeint war. Eine Fehlermeldung wäre Schikane (`pruefeBereich`).

### 3. Harte Grenzen: 5 Minuten bis 30 Tage
Die Untergrenze schützt fremde Server vor uns — häufiger als alle fünf Minuten
abzurufen ist bei keinem der vorgesehenen Quellentypen zu rechtfertigen. Die
Obergrenze ist die Schwelle, unterhalb derer man nicht mehr von Beobachtung
sprechen kann.

### 4. Der Zeitplan läuft als GitHub-Workflow, nicht als Vercel-Cron
`.github/workflows/takt.yml`, alle 15 Minuten, zusätzlich von Hand auslösbar.

Grund: Die Läufe brauchen einen direkten Datenbankzugang (`DATABASE_URL`). Die
Weboberfläche hat den bewusst nicht und soll ihn nicht bekommen — sie liest
ausschließlich über die geprüfte Datenbankfunktion (ADR 0005). Ein Cron-Auftrag
bei Vercel müsste diesen Vertrag brechen oder den halben Sammellauf in eine
Route kopieren. Hier bleiben die Läufe, was sie sind: dieselben Skripte wie von
Hand, auf einer Maschine.

Der 15-Minuten-Takt des Workflows ist **nicht** der Takt der Aufträge. Der
Workflow klopft nur an; welcher Auftrag abgerufen wird, entscheidet dessen
eigene Taktung. Ist keiner fällig, endet der Lauf nach Sekunden.

### 5. Die alte Spalte fällt weg
Nicht danebenstehen lassen: Zwei Felder für denselben Zweck werden unweigerlich
zu zwei Wahrheiten (ARCHITEKTUR-Regel 5). Der vorhandene Wert wird zur
Untergrenze, das Vierfache zur Obergrenze — ein bestehender Auftrag läuft
danach nicht seltener als vorher, kann sich bei Leerlauf aber zurücknehmen.

## Begründung
Der Bereich löst die Aufgabe besser als jede feste Zahl, weil er die Frage
umdreht: Statt "wie oft soll abgerufen werden?" — was niemand vorab beantworten
kann — fragt er "was ist gerade noch zu häufig, was schon zu selten?". Das ist
beantwortbar, und dazwischen findet das System die Antwort selbst.

Verworfene Alternativen:

- **Fester Wert je Auftrag, wie bisher vorgesehen.** Löst den Anwendungsfall
  nicht: Derselbe Auftrag braucht zu verschiedenen Zeiten verschiedene Takte.
- **Takt aus der Trefferrate berechnen** (etwa "Ziel: ein Treffer pro Lauf").
  Klingt eleganter, ist aber schwer zu erklären und schwer vorherzusagen. Wer
  eine Einstellung nicht vorhersagen kann, traut ihr nicht.
- **Vercel-Cron.** Bricht ADR 0005 oder verdoppelt die Sammellogik.
- **Eigene Maschine.** Wäre unabhängiger von GitHub, aber niemand soll dieses
  System hauptamtlich pflegen (ADR 0001).

## Konsequenzen
- Migration 0006 mit den neuen Spalten, dem Index auf fällige Aufträge und der
  nachgezogenen Funktion `auftrag_uebernehmen`. Dass diese Funktion die alte
  Spalte kopierte, hat der Test gefunden, nicht das Nachdenken.
- `src/lib/taktung.ts` als reine Rechenlogik, 21 Tests. Dazu 7 Tests gegen die
  Datenbank, darunter einer, der belegt, dass die alte Spalte wirklich weg ist.
- Die Oberfläche zeigt neben den beiden Feldern den **derzeitigen** Takt und
  den nächsten Abruf. Ohne diese Anzeige wäre eine sich selbst verstellende
  Einstellung undurchschaubar.
- `npm run sammeln -- --alle` übergeht die Taktung, für den Erstlauf und die
  Fehlersuche.
- **Einzurichten:** Der Workflow braucht das Geheimnis `DATABASE_URL` in den
  GitHub-Einstellungen. Fehlt es, meldet der Lauf eine Warnung und überspringt
  die Schritte, statt fehlzuschlagen — ein rot blinkendes Projekt, dessen
  Rotfärbung "noch nicht eingerichtet" bedeutet, gewöhnt einem das Hinsehen ab.

### Nicht entschieden: der KI-Abgleich
Bleibt offen (ADR 0011). Er verursacht laufende Kosten und ist deshalb eine
Entscheidung des Betreibers, keine technische.
