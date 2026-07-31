# ADR 0014: Suche und GDELT als Zugangswege — Frühwarnkanäle ohne Feed
Datum: 31.07.2026 · Status: angenommen · Freigegeben am: 31.07.2026

## Kontext
Die Kernfrage dieses Systems lautet: *Gibt es diese Behauptung online, wer hat
sie zuerst aufgestellt, und wo wurde sie abgeschrieben?* Bis hierher konnte das
System darauf nur so weit antworten, wie jemand vorher Quellen eingetragen
hatte. Das ist ein Zirkelschluss: Man müsste die Quelle schon kennen, um zu
erfahren, dass dort etwas steht.

Besonders schmerzhaft ist das bei den Kanälen, die als erste anspringen. Ein
Gerücht beginnt selten bei einem Fachmedium. Es beginnt in einem Forum, einem
Nischenblog, einem Kommentarstrang — und diese Kanäle haben zwei Eigenschaften,
die zusammen alles Bisherige unbrauchbar machen: Man kennt sie vorher nicht,
und sie haben meist keinen Feed.

Ein Feed setzt voraus, dass man die Quelle gefunden hat. Eine Suche setzt nur
voraus, dass man die Frage kennt. Das ist der Unterschied, um den es hier geht.

Dazu kam ein zweiter Befund aus dem laufenden Betrieb: Bei 4.256 Beiträgen aus
sieben Quellen entstanden ganze 7 Verknüpfungen. Nicht weil die
Zusammenführung schlecht wäre, sondern weil sieben Quellen zu wenig sind, als
dass dieselbe Meldung mehrfach auftauchen könnte. Ohne mehr Blickfeld ist die
Frage nach dem Ursprung nicht zu beantworten.

## Untersuchung
Vor dem Bauen wurde geprüft, was es schon gibt (ausdrücklicher Auftrag: das Rad
nicht neu erfinden).

**SearXNG** ist ein selbst betriebener Meta-Sucher: Er fragt fremde
Suchmaschinen ab und gibt das Ergebnis als JSON zurück. Wir sprechen also nie
unmittelbar mit Google oder Brave, es fällt kein Schlüssel und keine Gebühr an,
und die Instanz läuft ohnehin schon. Bestätigt am laufenden System:
`GET /search?q=test&format=json` → HTTP 200, `application/json`, 20 Treffer.

**GDELT** liest weltweit Nachrichtenseiten in über 100 Sprachen und macht sie
über die DOC-2.0-Schnittstelle durchsuchbar — offen, ohne Schlüssel, ohne
Vertrag. Für die Ursprungsfrage ist das der entscheidende Baustein: GDELT
liefert zu jedem Treffer den Zeitpunkt der ersten Sichtung.

## Entscheidung

### 1. Eine Spalte `zugangsweg`, kein weiterer Wert in `typ`
Bisher entschied allein die Adresse, wie eine Quelle gelesen wird: sieht sie
nach Feed aus, dann RSS, sonst Webseite. Diese Regel bleibt und ist die Vorgabe
(`automatisch`) — sie trägt den Regelfall, ohne dass jemand etwas einstellt.

Sie trägt aber nicht mehr weiter: `https://search.n0de.online/search?q=…` ist
von einer gewöhnlichen Webseite nicht zu unterscheiden. Eine Sonderregel im Code
("wenn die Adresse /search enthält…") hieße, die Entscheidung eines Betreibers
in den Code zu schreiben — genau das, wovor der Kopf von
`src/lib/quellen/registrierung.ts` seit ADR 0007 warnt, und dort steht auch
schon, was stattdessen richtig ist: eine eigene Spalte per Migration und ADR.

Warum nicht einfach `suche` als weiteren Wert in `typ`: `typ` sagt, **wer**
veröffentlicht (Hersteller, Fachmedium, Forum). Davon hängt die
Reifegrad-Einstufung ab. Der Zugangsweg sagt, **wie** wir lesen. Beides in eine
Spalte zu legen hieße, dass die Bewertung einer Meldung davon abhinge, über
welche Leitung sie hereinkam.

Ein unbekannter Wert wird nicht stillschweigend als `automatisch` gedeutet,
sondern gemeldet. Er kann nur aus einer neueren Datenbank in eine ältere
Anwendung geraten sein — und dann wäre jede Deutung geraten.

### 2. Die Suchfrage steht in der Adresse der Quelle, nicht im Auftrag
Eine Suchquelle ist `…/search?q=Kabinett+Merz`. Der Adapter hängt nur
`format=json` an.

Naheliegender wäre gewesen, die Suchbegriffe des Auftrags zu nehmen. Dagegen
sprechen zwei Dinge. Erstens braucht ein Auftrag oft mehrere verschiedene
Suchen — eine weite zum Umsehen, eine enge auf einen Namen — und mit der
Suchfrage in der Adresse ist das einfach eine zweite Quelle. Zweitens bekäme
der Adapter sonst den Auftrag zu sehen und wäre an ihn gebunden statt an die
Quelle; der Adapter-Vertrag (eine Adresse, sonst nichts) wäre gebrochen. Die
Relevanzregeln sieben ohnehin hinterher.

### 3. Zugangsdaten sind freiwillig — und werden nie unverschlüsselt gesendet
`SUCHE_ZUGANGSDATEN` in der Form `benutzer:passwort`, als Basic-Kopf. Fehlt die
Variable, wird nichts mitgeschickt.

Das ist die Antwort auf einen berechtigten Einwand zur offenen Instanz: Wer sie
findet, kann über sie Suchanfragen feuern und das Kontingent bei den
Upstream-Maschinen aufbrauchen. Eine IP-Freigabeliste hilft hier nicht — die
Läufe laufen auf GitHub-Maschinen mit wechselnden Adressen. Basic-Auth als
Traefik-Middleware davor, Zugangsdaten als GitHub-Geheimnis: klein im Aufwand,
und weil der Adapter sie **freiwillig** mitschickt, lässt sich die Instanz
später absichern, ohne dass am Code etwas geändert werden muss.

Über unverschlüsseltes `http` bricht der Abruf ab, statt das Passwort im
Klartext über das Netz zu schicken. Ein Passwort preiszugeben ist schlimmer als
der Fehlschlag, den es verhindern soll.

### 4. Jeder Abruf ist begrenzt: 50 Treffer bei der Suche, 75 bei GDELT
Nicht, was die Gegenseite liefern *könnte*, sondern was ein Beobachtungslauf
sinnvoll verarbeitet. Wer mehr Abdeckung braucht, stellt einen engeren Takt ein
(ADR 0012) — nicht eine größere Ladung auf einmal.

Der Anlass ist eine gemachte Erfahrung: Der MSRC-Feed lieferte in einem
einzigen Abruf 2.274 Beiträge. Eine Suche über das offene Netz kann das
mühelos übertreffen.

### 5. GDELT bestätigt nichts
Ein Treffer heißt "irgendwo stand das", nicht "es stimmt". Weder GDELT noch die
Suche vergeben eine Stufe; die Einordnung bleibt beim Regelwerk (ADR 0011).
Dass 300 Seiten dieselbe Meldung führen, ist gerade **kein** Beleg — es ist der
Normalfall beim Abschreiben, und ihn sichtbar zu machen ist der Zweck.

### 6. Suche und GDELT ersetzen einander nicht
SearXNG durchsucht das ganze Netz und findet auch Foren und Blogs, hat aber
kein verlässliches Datum. GDELT deckt nur Nachrichtenseiten ab, liefert dafür
zu jedem Treffer den Zeitpunkt der ersten Sichtung. Die Frühwarnung kommt von
der Suche, die Ursprungsfrage beantwortet GDELT.

## Begründung
Beide Wege sind offen, kostenlos und schlüsselfrei — der eine, weil er auf
eigener Maschine läuft, der andere, weil GDELT von einem Forschungsprojekt
betrieben wird. Für ein System, das niemand hauptamtlich pflegen soll (ADR
0001), ist das keine Nebensache, sondern die Bedingung.

Verworfene Alternativen:

- **Suchmaschinen unmittelbar anbinden** (Google CSE, Bing, Brave). Kostet,
  braucht Schlüssel und Vertrag, und jede Maschine spricht ihre eigene
  Sprache. SearXNG ist genau dafür da, das zu bündeln.
- **Einen eigenen Webcrawler bauen.** Der Aufwand ist erheblich, der Betrieb
  dauerhaft, und das Ergebnis wäre schlechter als das, was SearXNG heute schon
  liefert.
- **`suche` als weiteren Wert in `typ`.** Siehe oben — bindet die Bewertung an
  den Zugangsweg.
- **Suchbegriffe des Auftrags an den Adapter durchreichen.** Bricht den
  Adapter-Vertrag und schließt mehrere Suchen je Auftrag aus.
- **IP-Freigabeliste für die SearXNG-Instanz.** Funktioniert nicht mit
  GitHub-Maschinen.
- **Die Sozialen Netze unmittelbar anbinden** (X, Facebook, Instagram). Alle
  drei haben ihre offenen Schnittstellen geschlossen oder kostenpflichtig
  gemacht. Mastodon und Reddit gehen weiterhin über Feeds, also über den
  vorhandenen Weg.

## Konsequenzen
- Neu: `src/lib/quellen/suche.ts`, `src/lib/quellen/gdelt.ts`, Migration 0008,
  Auswahl des Zugangswegs in der Quellenverwaltung. 40 Tests.
- `begrenztLesen` ist aus `web.ts` nach `adapter.ts` gewandert. Alle drei
  abrufenden Adapter haben dieselbe Gefahr: Ein fremder Server bestimmt, wie
  lang seine Antwort ist. Eine gemeinsame Obergrenze ist besser als drei.
- **Einzurichten, damit Suchquellen laufen:** nichts, solange die Instanz offen
  ist. Wird sie abgesichert, kommt `SUCHE_ZUGANGSDATEN` als GitHub-Geheimnis
  dazu. GDELT braucht gar nichts.
- Rückwärtsverträglich: Alle vorhandenen Zeilen bekommen `automatisch`, also
  genau das bisherige Verhalten. Die alte Fassung der Anwendung sieht die
  Spalte nicht und läuft unverändert weiter — anders als bei ADR 0012 ist hier
  kein zweiter Migrationsschritt nötig, weil nichts entfernt wird.
- Die Adapter sind gegen nachgebildete Antworten geprüft, nicht gegen eine
  laufende Instanz. Ein Test, der ein fremdes Netz braucht, prüft am Ende
  dessen Erreichbarkeit und nicht unseren Code. Dass die JSON-Schnittstelle der
  Instanz antwortet, ist am laufenden System bestätigt worden; dass unsere
  Deutung ihrer Antwort stimmt, zeigt der erste Abruf.
