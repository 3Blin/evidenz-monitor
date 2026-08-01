# ADR 0011: Zusammenführung präzisieren, Unabhängigkeit nicht mehr unterstellen
Datum: 27.07.2026 · Status: angenommen · Freigegeben am: 27.07.2026

## Kontext
Eine Durchsicht des Projekts nach ADR 0010 brachte fünf Befunde. Vier davon
wurden am Code bestätigt, der fünfte kam erst bei der Messung an den echten
Daten heraus — und war der schwerwiegendste.

### Befund 1: Der KI-Abgleich ist gebaut, läuft aber nie
`src/lib/ki-adapter.ts` kann genau das, was für herausgeberübergreifende
Verknüpfung nötig wäre: `beziehung_zur_vergleichsmeldung`. Der Baustein hat 16
Tests. Er wird von nichts außer seinem eigenen Test importiert.

`scripts/auswerten.job.ts` schreibt an jede Aussage „KI-Analyse noch nicht
ausgeführt". Das ist zutreffend und wird nie unzutreffend, weil kein Aufruf
existiert. ADR 0010 verwies für übergreifende Zuordnung auf „die KI-Analyse" —
eine Aufgabe, die niemand ausführt.

### Befund 2: Nur das erste Gruppenmitglied wurde verglichen
`gruppiereMitBegruendung` prüfte die Titelähnlichkeit gegen `gruppe.inhalte[0]`.
Sind A und B ähnlich und B und C ähnlich, A und C aber nicht, landete C nicht
bei [A, B]. Das Ergebnis hing an der Eingabereihenfolge statt am Inhalt.

### Befund 3: Unabhängigkeit war die Vorgabe statt der Nachweis
`klassifiziereGruppe` stufte jeden Beitrag mit Titelähnlichkeit unter 0,8 und
abweichendem Herausgeber als `unabhaengige_bestaetigung` ein. Das ist ein
Fehlschluss: Der Beitrag ist ja gerade deshalb in dieser Gruppe, weil er
dieselbe Sache behandelt. Dass er sie anders formuliert, belegt keine eigene
Recherche.

Drei Portale, die dieselbe Herstellermeldung abschreiben, wären damit zu drei
unabhängigen Quellen geworden — `zaehleUnabhaengigeQuellen` hätte 3 gezählt und
die Aussage auf **Stufe 5 „unabhängig bestätigt"** gehoben. Nach dem eigenen
Maßstab dieses Projekts („ein zu hoher Reifegrad ist eine Falschaussage") ist
das der schlimmste mögliche Fehler.

### Befund 4: Kein Zeitfenster, keine Verweis-Signale
Die Gruppierung ignorierte das Datum vollständig. Wiederkehrende Vorgänge
tragen wiederkehrende Titel — ein monatlicher Bericht, eine jährliche
Preisrunde. Und: Eine Übernahme verlinkt fast immer das Original; dieses
Signal wurde nicht gelesen.

### Befund 5 (bei der Messung entdeckt): Verschiedene Sachen wurden verschmolzen
Die Messung an den 144 echten Inhalten zeigte acht Zusammenführungen, davon
**vier falsche** — alle nach demselben Muster:

```
CVE-2026-54120 Microsoft Surface Remote Code Execution Vulnerability
CVE-2026-56165 Microsoft Account Remote Code Execution Vulnerability
CVE-2026-50517 Microsoft M365 Copilot Remote Code Execution Vulnerability
```

Drei verschiedene Sicherheitslücken, Titelähnlichkeit 0,64 — allein wegen der
Formelwörter „Microsoft … Remote Code Execution Vulnerability". Weil MSRC eine
Herstellerquelle ist, trug das Ergebnis die Klassifikation
`offizielle_bestaetigung` und stand auf **Stufe 6 „offiziell bestätigt"**: eine
amtlich klingende Aussage über einen Sachverhalt, den es so nicht gibt.

## Entscheidung

### 1. Kennungen trennen, nicht nur verbinden
Tragen zwei Beiträge je eine Kennung und teilen keine, sind es verschiedene
Gegenstände. Die Titelähnlichkeit wird dann gar nicht erst befragt
(`nachweislichVerschieden`). Eine Kennung benennt genau eine Sache;
Titelähnlichkeit misst Wortgebrauch, nicht Sachidentität.

Bewusst nur bei beidseitig vorhandener Kennung: Trägt einer der beiden keine,
ist nichts bewiesen, und der Titel entscheidet weiter.

### 2. Gegen alle Mitglieder prüfen, beste Passung wählen
Behebt Befund 2. Das Ergebnis hängt nicht mehr von der Eingabereihenfolge ab;
ein Test belegt das durch Umkehren der Reihenfolge.

### 3. Zeitfenster für Titelähnlichkeit
45 Tage (`ZEITFENSTER_TAGE`). Ausdrücklich **nicht** für Zusammenführungen über
eine gemeinsame Kennung oder einen gemeinsamen Verweis: Dieselbe
Sicherheitslücke bleibt dieselbe, auch nach einem halben Jahr.

### 4. Gemeinsame Verweise als Zusammenführungsgrund
`src/lib/verweise.ts` liest Adressen aus dem Auszug, vereinheitlicht sie
(Protokoll, `www.`, Nachlaufzeichen, Werbeanhänge) und übergeht Verweise auf
die eigene Plattform. Ohne diese Ausnahme verbände ein Kommentarverweis jeden
Beitrag eines Aggregators mit jedem anderen — ein Zusammenhang aus Technik
statt aus Inhalt.

### 5. Unabhängigkeit muss belegt werden
Die Vorgabe wird umgedreht: Jeder Beitrag außer der Primärmeldung gilt als
`uebernahme`. `unabhaengige_bestaetigung` bleibt der KI-Analyse vorbehalten,
die diese Einordnung überschreiben darf (Vertrag: ARCHITEKTUR.md).

**Folge, ausdrücklich gewollt:** Ohne KI-Analyse erreicht eine Aussage höchstens
Stufe 2 („mehrfach beobachtet"), sofern keine offizielle Primärquelle beteiligt
[**diese Ausnahme ist mit ADR 0018 entfallen — sie war derselbe Fehlschluss
noch einmal**]
ist. Die Leiter wird also kürzer — aber sie lügt nicht mehr.

### 6. Der ungenutzte KI-Adapter wird als solcher gekennzeichnet
Nicht gelöscht, nicht stillschweigend belassen: Der Dateikopf sagt jetzt, dass
der Baustein in keinem Auswertungslauf aufgerufen wird. Ein Baustein, der
aussieht wie eine Funktion, aber keine ist, ist die schlimmste Sorte
Dokumentationsfehler.

### 7. `d3-force` und `d3-selection` entfernt
Seit ADR 0010 unbenutzt.

## Begründung
Die Messung an echten Daten hat wieder mehr gefunden als jede Überlegung am
Schreibtisch. Vorher/nachher über die 144 Inhalte:

| | vorher | nachher |
|---|---|---|
| Gruppen | 134 | 140 |
| Zusammenführungen | 8 | 4 |
| davon sachlich falsch | **4** | **0** |
| Belege „unabhängige Bestätigung" | 0 | 0 |
| Stufe 6 | 18 | 24 |

Dass die Zahl der Zusammenführungen sinkt, ist der Zweck: Die vier
verbliebenen sind sämtlich richtig und einzeln als Test festgehalten. Dass
Stufe 6 steigt, ist die Gegenbuchung — die falsch verschmolzenen
Herstellermeldungen zählen wieder einzeln, wie es ihnen zusteht.

„Unabhängige Bestätigung" kam auf diesen Daten nie vor, weil alle vier
Zusammenführungen innerhalb desselben Herausgebers liegen. Der Fehler aus
Befund 3 hätte also erst gewirkt, sobald übergreifende Verknüpfungen entstehen
— das heißt: genau dann, wenn das System anfängt zu funktionieren.

## Konsequenzen
- Neue Module `verweise.ts`, erweitertes `kennungen.ts`. 26 neue Tests
  (297 gesamt), darunter `gruppierung-echtdaten.test.ts`, das alle vier
  Zusammenführungen einzeln festschreibt — eine bloße Anzahl stimmte auch dann
  noch, wenn eine richtige gegen eine falsche getauscht würde.
- `tests/daten/echte-inhalte.txt` als dauerhafte Messgrundlage. Ohne Auszüge,
  weil diese Nutzertexte enthalten.
- `npm run messen` gibt die Kennzahlen und alle Zusammenführungen aus.
- Der Verweis-Weg ist auf dieser Messgrundlage **nicht** belegt: Die Auszüge
  fehlen dort. Er ist mit eigenen Tests abgedeckt, seine Wirkung im Betrieb
  steht noch aus.

### Offen: der KI-Abgleich (Phase 2)
Nicht Teil dieser Entscheidung, weil er laufende Kosten verursacht und deshalb
eine Entscheidung des Betreibers ist. Skizze, falls er kommen soll:

1. **Kandidatenpaare** billig bilden: Zeitfenster plus niedrige Wortüberlappung
   (etwa 0,15) über Titel und Auszug. Bei 144 Inhalten einige hundert Paare.
2. **Urteil** teuer einholen: der vorhandene `vergleichsmeldung`-Prompt je
   Kandidatenpaar, schema-geprüft, mit Obergrenze für die Zahl der Aufrufe.
3. **Zwischenspeicher** als Tabelle (Paar-Kennung → Urteil). Ohne ihn zahlt
   jeder Lauf dieselben Urteile erneut, denn der Auswertungslauf löscht die
   Gruppen und baut sie neu.
4. **Entitäten** als zweite Runde: Die Spalte `aussagen.entitaeten` existiert
   und ist leer. Von der KI gefüllt, wäre sie die themenneutrale
   Verallgemeinerung der Kennungen — ein Wetter- oder Preisauftrag hat keine
   KB-Nummern, aber Orte, Firmen und Personen.
