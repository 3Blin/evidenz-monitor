# ADR 0017: Das Netz am Telefon — Beschriftung, Maßstab, kein Überlagern
Datum: 31.07.2026 · Status: angenommen · Freigegeben am: 31.07.2026

## Kontext
Zwei Anlässe.

**Ein Vorbild.** Eine Anzeige zeigte ein Netz, dessen Knoten Namen in gerahmten
Feldern tragen, mit dünnen, zurückhaltenden Linien und roten Feldern für
Problemzustände. Das ist nicht nur Geschmack: Der Hintergrund dieser Anwendung
trägt ein Raster, und freistehender heller Text darauf ist schwer zu lesen.

**Eine Anforderung, ausdrücklich betont:** „wichtig ist ein responsive Design".
Das war ernst gemeint — die allererste Rückmeldung zu diesem Projekt lautete
„am Handy sehe ich einen".

Geprüft wurde diesmal nicht durch Ansehen des Codes, sondern durch Ausführen:
Die echten Bausteine wurden mit `esbuild` gebündelt, in einem Browser
tatsächlich ausgeführt und bei 414, 820 und 1440 Punkten Breite abgelichtet.
Das ist der Unterschied zum letzten Mal — dort lief nur die Serverfassung, und
alles, was von einer Messung im Browser abhängt, blieb ungeprüft.

## Entscheidung

### 1. Der Name steht in einem gerahmten Feld
Nicht nur schöner, sondern lesbar: Das Feld deckt das Raster ab. Die Breite wird
gerechnet und nicht gemessen — in einer SVG-Zeichnung ist die Textbreite erst
nach dem Zeichnen bekannt, und bis dahin stünde das Feld an der falschen Stelle.
Die Schrift ist eine Festbreitenschrift, deshalb ist die Rechnung genau genug.

Lange Namen werden gekürzt und mit einem Auslassungszeichen versehen — das ist
ehrlicher als ein Name, der einfach endet: Man sieht, dass etwas fehlt.

### 2. Schrift und Linien behalten ihre Größe auf dem Bildschirm
Der wichtigste Punkt, und der, den man ohne Ausführen nicht findet.

Schrift in einer SVG-Zeichnung wird mit dem Ausschnitt mitskaliert. Eine feste
Größe in Zeichnungseinheiten heißt deshalb: am großen Bildschirm lesbar, am
Telefon winzig — und beim Hineinzoomen riesig. Multipliziert man sie mit dem
Maßstab (Zeichnungseinheiten je Bildschirmpunkt), bleibt sie überall gleich
groß. Dasselbe gilt für Strichstärken.

### 3. Beschriftung nur, wenn sie passt — und das wird gerechnet
Aus Punkt 2 folgt ein neues Problem: Felder mit fester Bildschirmgröße werden
in Zeichnungseinheiten umso breiter, je kleiner die Fläche ist. Am Telefon
wurden aus lesbaren Feldern Balken, die einander überdeckten.

Die Lösung ist nicht eine geratene Bildschirmbreite („ab 640 Punkten passt es
wohl"), sondern eine Rechnung: Wie weit stehen die nächsten waagerechten
Nachbarn auseinander, und wie breit ist das breiteste Feld? Passt es nicht,
erscheint der Name nur noch für den Knoten, auf den gezeigt oder getippt wird.
**Weniger Beschriftung ist besser als unleserliche.**

Dass nur der *waagerechte* Abstand zählt, ist kein Detail: Felder liegen
untereinander, nicht nebeneinander. Die erste Fassung prüfte beide Richtungen
und verwarf deshalb auch am großen Bildschirm jede Beschriftung — aufgefallen
ist das erst beim Ablichten, und behoben durch Nachrechnen statt Nachdenken.

### 4. Überschrift und Bedienung stehen im normalen Fluss
Vorher lagen beide frei über der Zeichnung. Bei 1440 Punkten passte das, bei 820
schob sich die Bedienung über den Text — der Zwischenbereich war nie geprüft
worden. Eine umbrechende Zeile im normalen Fluss kann das bei **keiner**
Bildschirmbreite. Auch Legende und Fußnote stehen jetzt im Fluss.

Das ersetzt drei Sonderregeln für schmale Schirme durch keine. Eine
Bildschirmbreite, ab der man etwas anders anordnet, ist immer geraten; kein
Überlagern ist eine Eigenschaft.

### 5. Widerspruch ist rot
Der einzige Fall, in dem eine Kante etwas anderes bedeutet als „dieselbe
Meldung": Hier sagt eine Quelle das Gegenteil der anderen. In derselben Farbe zu
zeichnen wie eine Bestätigung wäre irreführend. Die Linien sind zugleich dünner
und zurückhaltender geworden — die Knoten tragen die Aussage, nicht die Linien.

## Begründung
Der rote Faden ist: **Was von der Größe der Fläche abhängt, muss gemessen oder
gerechnet werden, nicht geraten.** Alle vier Fehler oben — winzige Schrift,
überdeckende Felder, verworfene Beschriftung, überlagerte Bedienung — sind
Varianten desselben Fehlers, und alle vier tauchten erst auf, als die Bausteine
wirklich liefen.

Verworfene Alternativen:

- **Feste Bildschirmbreite als Schwelle** („ab 640 Punkten Namen zeigen").
  Trifft ein Gerät und kein zweites, und sagt nichts über die Zahl der Knoten.
- **Felder immer zeigen und kleiner setzen.** Bei sieben Quellen auf einem
  Telefon müsste die Schrift so klein werden, dass niemand sie liest.
- **Die Anordnung weiter auseinanderziehen, damit Felder passen.** Dann wären
  die Knoten winzig — dasselbe Problem an anderer Stelle.
- **Namen ganz weglassen und nur Zahlen zeigen.** Ein Netz ohne Namen ist ein
  Bild ohne Aussage.

## Konsequenzen
- `netz-layout.ts` um `feldBreite`, `gekuerzt` und `felderPassen` erweitert,
  Tests von 33 auf 41. Die Entscheidung „passt es?" ist eine reine Funktion und
  damit prüfbar — in einem Baustein der Oberfläche wäre sie es nicht.
- Der Kartenaufbau kommt ohne absolute Anordnung aus. Drei Sonderregeln für
  schmale Schirme sind entfallen.
- Keine Migration, keine neue Abhängigkeit, keine Einrichtung.
- **Zur Arbeitsweise:** Das Bündeln mit `esbuild` und Ablichten mit einem echten
  Browser hat in einem Durchgang vier Fehler gefunden, von denen keiner beim
  Lesen des Codes aufgefallen wäre. Als dauerhafter Test ist es weiterhin nicht
  eingerichtet (siehe ADR 0016) — aber wer die Ansicht anfasst, sollte es tun.
