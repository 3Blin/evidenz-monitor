# ADR 0016: Netz und Liste lesbar machen
Datum: 31.07.2026 · Status: angenommen · Freigegeben am: 31.07.2026

## Kontext
Zwei Anlässe.

**Erstens** der ausdrückliche Wunsch, den Graphen im Stil von Graphify zu
gestalten. Das ist keine Geschmacksfrage: Ein Netz aus dünnen Umrissen zerfällt
optisch, während gefüllte Scheiben sich als Körper lesen und Größe als Aussage
tragen.

**Zweitens** — und das kam erst beim Hinsehen heraus — trug die Ansicht an
mehreren Stellen etwas anderes vor, als gemeint war. Um das zu finden, wurden
die echten Bausteine nach HTML gerendert und mit einem Browser abgelichtet,
statt sie sich vorzustellen. Jeder der folgenden Punkte ist auf diesem Weg
gefunden worden oder durch einen Test, der daraufhin entstand.

## Entscheidung

### 1. Einfärbung nach Gruppen — aber Einzelgänger bekommen keine
Gleiche Farbe heißt: Diese Quellen berichten nachweislich über dieselben
Vorgänge. Das ist die Aussage, für die es dieses Bild gibt.

Der erste Wurf gab jeder Zusammenhangskomponente eine Farbe — also auch jeder
unverbundenen Einzelquelle. Bei sieben Quellen mit einer Dreiergruppe standen
da vier bunte Einzelne, die aussahen wie vier Befunde, obwohl keiner vorlag,
und die die eine Gruppe übertönten, um die es ging. Unverbundene Quellen sind
jetzt unbunt (`OHNE_GRUPPE`).

Wer die Art der Quelle sehen will — offiziell, Fachmedium, Forum — schaltet um.
Die alte Einfärbung bleibt erreichbar, statt ersetzt zu werden: Ob eine Aussage
von offizieller Stelle kommt, ist eine der vier Kernfragen. Der Ring um
offizielle Primärquellen bleibt in **beiden** Einfärbungen stehen.

### 2. Die Anordnung folgt der Form der Zeichenfläche
Drei Fehler steckten hier übereinander, jeder für sich unsichtbar:

- **Jede Gruppe lag auf demselben großen Ring**, auch jeder einzelne Knoten.
  Zwei Drittel der Fläche blieben leer, alles wirkte winzig. Jetzt: verbundene
  Gruppen in die Mitte, Einzelne in einen Ring darum.
- **Beide Ringe begannen beim selben Winkel.** Bei zwei Gruppen und zwei
  Einzelnen standen alle vier auf derselben Waagerechten — das Ergebnis war
  kein Netz, sondern eine Reihe. Der äußere Ring ist jetzt um einen halben
  Schritt versetzt.
- **Die Dehnung traf eine fest gewählte Achse.** Sie half deshalb nur in der
  Hälfte der Fälle. Jetzt wird die tatsächliche Ausdehnung gemessen und die zu
  kurze Achse gedehnt — nie die andere gestaucht, sonst rückten Knoten
  zusammen und könnten sich überlagern.

Dazu kommt: Das Seitenverhältnis der Zeichenfläche wird **gemessen**
(`ResizeObserver`) statt geraten. Nur so lässt sich der Leerraum an den Rändern
vermeiden — eine SVG-Zeichnung passt ihren Ausschnitt ein und lässt an zwei
Seiten Platz, wenn die Verhältnisse nicht übereinstimmen. Am Telefon war das
der Unterschied zwischen brauchbar und unlesbar, und genau dorthin ging die
erste Rückmeldung: „am Handy sehe ich einen".

### 3. Eine Zweiergruppe stand weiter auseinander als vom Fremden entfernt
Der Kreis, auf dem die Mitglieder einer Gruppe liegen, hatte eine feste
Untergrenze von 120. Bei zwei Mitgliedern liegen diese einander gegenüber, ihr
Abstand war also 240 — während der Ring der Unverbundenen bei 146 lag. Das Bild
sagte damit das Gegenteil dessen, was gemeint war. Die Untergrenze hängt jetzt
an der Knotengröße.

**Gefunden hat das ein Test, nicht das Hinsehen.** Er stand schon vorher da und
prüfte genau diese Zusage; er schlug fehl, als der Umbau ihn erstmals unter
Druck setzte.

### 4. Kantenbeschriftung nur bei Auswahl, Nachbarschaft hervorheben
Vorher stand an jeder Linie ein Wort. Bei drei Kanten geht das, ab einem Dutzend
ist es Rauschen. Jetzt erscheint die Beziehung, sobald man auf einen Knoten
zeigt oder eine Aussage wählt — und dann tritt zugleich zurück, was mit dem
Knoten nicht verbunden ist. Das beantwortet die eigentliche Frage („wer
bestätigt wen?") in einer Bewegung.

### 5. Stufe 8 ist keine Sprosse
„Widerlegt" ist kein höherer Grad als „Behoben", sondern ein anderer Ausgang.
Als achter Balken einer Reihe von acht las es sich als Steigerung — bei einem
System, das Falschmeldungen erkennen soll, die schlimmste denkbare
Verwechslung. Die Leiter zeigt jetzt 1 bis 7; Stufe 8 steht abgesetzt daneben.
Auch die Sortierung nach Belastbarkeit stellt Widerlegtes ans Ende und nicht,
der Zahl folgend, an die Spitze.

### 6. Die Leiter zeigt die Verteilung
Acht gleich breite Balken sagten nur „hier ist überhaupt etwas". Die Breite
folgt jetzt der Häufigkeit — 81 Aussagen auf Stufe 1 und zwei auf Stufe 5 sind
ein völlig anderes Bild als umgekehrt. Leere Stufen behalten einen schmalen
Rest, damit sie anklickbar bleiben: Ein Filter, der verschwindet, sobald er
nichts trifft, ist keiner.

### 7. „Zuerst: X · TT.MM.JJJJ" steht in der zugeklappten Zeile
Wer zuerst berichtet hat, ist die Kernfrage dieses Systems. Sie stand bisher nur
aufgeklappt und auch dort nur mittelbar.

Belege ohne Datum können nicht der erste sein. Sie *könnten* es sein — aber
„könnte" ist keine Erstmeldung, und eine geratene Erstmeldung wäre schlimmer
als keine. Trägt kein Beleg ein Datum, sagt die Zeile genau das, statt zu
schweigen: Eine Lücke in den Daten ist eine Aussage über die Daten.

### 8. Sortierung, und die Kopfzeile bleibt stehen
Belastbarkeit, Neueste, Meiste Belege. Bei 81 Aussagen ist eine Liste ohne
Sortierung eine Halde. Leiter, Sortierung und Filter bleiben beim Blättern
stehen — sie gehören zur Liste und nicht zu deren erstem Eintrag.

## Begründung
Der rote Faden ist derselbe wie in ADR 0011: Ein zu niedriger Ausweis ist ein
Mangel, ein zu hoher eine Falschaussage. Punkt 1, 3 und 5 sind allesamt Fälle,
in denen das Bild mehr behauptete, als die Daten hergaben — vier Befunde statt
keinem, Nähe statt Ferne, Steigerung statt Gegenteil.

Verworfene Alternativen:

- **Nur nach Gruppen einfärben, die Art der Quelle streichen.** Sähe ruhiger
  aus, verlöre aber die Antwort auf „gab es eine offizielle Äußerung?".
- **Kräftesimulation für eine lebendigere Anordnung.** Ein Netz, das bei jedem
  Laden anders aussieht, kann man nicht wiedererkennen und niemandem zeigen.
  Die Anordnung bleibt deterministisch.
- **Gemeinschaftserkennung im engeren Sinn (Leiden, Louvain).** Würde innerhalb
  einer Komponente weiter unterteilen. Bei Netzen dieser Größe gibt es dafür
  nichts zu tun; ein Verfahren einzubauen, dessen Nutzen erst bei tausend
  Knoten beginnt, wäre Vorratshaltung.
- **Ein festes Seitenverhältnis annehmen statt zu messen.** Trifft genau einen
  Bildschirm und keinen zweiten.

## Konsequenzen
- Neu: `src/lib/aussagen-ansicht.ts` (Erstmeldung, Sortierung, Leiterbalken,
  Zeitangaben) mit 18 Tests. `netz-layout.ts` um Gruppennummern, gebogene
  Kanten, Formanpassung erweitert; dessen Tests von 18 auf 33.
- Die Rechenteile liegen in Bibliotheksdateien und nicht in den Bausteinen der
  Oberfläche. Sonst wären genau die Fehler oben nicht prüfbar gewesen.
- Keine Migration, keine neue Abhängigkeit, keine Einrichtung.
- **Offen:** Zum Prüfen wurden die Bausteine einmalig nach HTML gerendert und
  abgelichtet. Als dauerhafter Test ist das nicht eingerichtet — es bräuchte
  Vergleichsbilder im Auslieferstand, und deren Pflege kostet mehr, als sie an
  diesem Projekt einbringt. Wer die Ansicht wieder umbaut, sollte den Weg
  jedoch kennen: Er hat hier vier Fehler gefunden, die beim Lesen des Codes
  keinem aufgefallen waren.
