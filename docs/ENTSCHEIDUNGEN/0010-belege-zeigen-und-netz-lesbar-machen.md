# ADR 0010: Belege zeigen, Netz lesbar machen, Regeln vorschlagen
Datum: 26.07.2026 · Status: angenommen · Freigegeben am: 26.07.2026

## Kontext
Rückmeldung aus der ersten echten Nutzung, im Wortlaut zusammengefasst:

1. Im Quellennetz „driften die Symbole auseinander", sichtbar waren zwei von
   sieben Quellen, am Telefon eine. Keine Navigation im Fenster möglich.
2. Keine „parallelen Verknüpfungen, also Bestätigungen zwischen den Quellen"
   erkennbar.
3. In der Bewertungsliste ließen sich Einträge anklicken, „es passiert aber
   nichts". Die Angaben seien „sehr dünn": kein Datum, kein Verweis zur Quelle.
4. Der im Dashboard gezeigte Auftrag „lässt sich nicht verwalten".
5. Die Verwaltung begrüßt mit einem Satz über „Windows 11 ist nur der erste
   Fall" — dieser Fall stand in der Liste aber nicht.
6. Die Felder für Relevanzregeln „überfordern den Endanwender".
7. Für OpenAI fehle die OAuth-Anmeldung.

Die Punkte 1 bis 3 haben eine gemeinsame Wurzel: Die Oberfläche versprach
Belege und zeigte Behauptungen. Punkt 4 und 5 sind ein Widerspruch zwischen
Text und Zugriffsrecht. Punkt 6 betrifft den Einstieg, Punkt 7 eine Annahme
über einen fremden Dienst.

## Entscheidung

### 1. Die Anordnung des Netzes wird umgekehrt
Statt einer Kräftesimulation auf fester Fläche entsteht die Anordnung fest
(`src/lib/netz-layout.ts`) und der **Ausschnitt legt sich um die Knoten**.
Damit ist jeder Knoten sichtbar — bei jeder Knotenzahl und jeder
Bildschirmgröße. Belegt durch einen Test über 1 bis 50 Quellen.

Dazu Navigation: ziehen, vergrößern, zurücksetzen; mit Maus, Finger und
Tastatur. Ein Klick auf eine Quelle filtert die Aussagen dieser Quelle — die
Gegenrichtung zu „Aussage hebt Quellen hervor", die es schon gab.

Verworfen: die Simulation mit Begrenzungskräften zu retten. Sie war nicht nur
unbegrenzt, sondern auch zufällig — bei jedem Laden ein anderes Bild. Für
Netze dieser Größenordnung (unter hundert Quellen) leistet eine feste
Vorschrift dasselbe, ist sofort fertig und wiedererkennbar.

### 2. Aussagen zeigen ihre Belege
`dashboard_daten` liefert je Aussage die Belege mit Herausgeber, Rolle
(Erstmeldung/Übernahme/Bestätigung), **Datum**, **Verweis** und Fundstelle
(Migration 0005). Ein Klick klappt sie auf. Zusätzlich steht in der Kopfzeile
jeder Aussage ihr Alter in Worten — bei einer Frühwarnung die wichtigste
Angabe überhaupt.

Die Reifegrad-Leiter wird anklickbar und filtert nach Stufe.

### 3. Zusammenführung über Kennungen
Ursache für die fehlenden Verknüpfungen: `gruppiere` verband Beiträge nur bei
einer Titelähnlichkeit ab 0,5. Aus 24 Beiträgen wurden 24 Gruppen mit je einem
Beitrag — keine einzige Verknüpfung, jede Aussage auf Stufe 1.

Neu (`src/lib/kennungen.ts`): Beiträge mit **gemeinsamer Kennung** gehören
zusammen, unabhängig vom Titel. Aus den echten Daten:

| Titel | Ähnlichkeit |
|---|---|
| „How to Stop the Win 11 **KB5094126** Installation Loop …" | — |
| „Urgent: Stuck **KB5094126** (2026-06 Security Update) Loop on ASUS M413A" | 0,11 |

Die Kennung benennt den Gegenstand, der Titel umschreibt ihn nur. Außerdem
wird jetzt die *ähnlichste* Gruppe gewählt statt der ersten passenden.

Bewusst **nicht** gesenkt wurde die Ähnlichkeitsschwelle. Mehr Verknüpfungen
wären leicht zu haben, aber falsche: Aus zwei unabhängigen Meldungen würde eine
„unabhängige Bestätigung" und der Reifegrad stiege ohne Grund. Ein zu
niedriger Reifegrad ist ein Mangel, ein zu hoher eine Falschaussage.

### 4. Freigegebene Aufträge sind übernehmbar
Der Demo-Auftrag gehört einem anderen Konto; die Zeilen-Sicherheit sperrt ihn
zu Recht. Statt den Verweis zu streichen, wird der Fall benutzbar:
`auftrag_uebernehmen` kopiert einen **freigegebenen** Auftrag samt Quellen und
Regeln ins eigene Konto — ohne fremde Inhalte und Aussagen, und nicht von
selbst wieder öffentlich. Der Einstiegstext der Verwaltung nennt kein
Sachgebiet mehr.

### 5. Ein Vorschlag statt einer Fachmaske
Die Regelfelder werden eingeklappt und erst auf Wunsch geöffnet; davor stehen
Name, Fragestellung und Beobachtungsziel. Im geöffneten Bereich erzeugt
„Vorschlag von der KI" aus Name und Fragestellung Begriffe, nötige Trefferzahl
und Quellenvorschläge — **mit Begründung in Alltagssprache**.

Gespeichert wird nichts davon von selbst. Der Vorschlag füllt Felder, ein
Mensch drückt auf Speichern. Die Arbeitsteilung aus den Anforderungen bleibt
damit unberührt: Die KI liest und formuliert, entschieden wird deterministisch.

Verworfen: die Felder ganz zu verstecken. Sie entscheiden über die Güte des
Ergebnisses; wer sie nie sieht, kann ein schlechtes Ergebnis nicht verbessern —
genau der Anlass für ADR 0008.

Quellenvorschläge sind ausdrücklich als ungeprüft gekennzeichnet. Ein
Sprachmodell erfindet Adressen; ob eine Adresse trägt, zeigt erst der
Sammellauf.

### 6. Kein OAuth für OpenAI
OpenAI bietet keine Anmeldung an, mit der eine fremde Anwendung Modellaufrufe
über das Konto der Nutzerin abrechnen kann. „Sign in with ChatGPT" ist
Identität — Name, E-Mail, Bild —, nicht Zugriff auf die Schnittstelle; die
einzige Anmeldung, die tatsächlich über ein ChatGPT-Abonnement abrechnet, ist
an OpenAIs eigene Codex-Werkzeuge gebunden. Solange das so bleibt, ist der
eingetragene Schlüssel der einzige Weg. Sollte OpenAI das öffnen, ist die
Stelle im Code klar umrissen (`src/lib/ki/anbieter.ts`).

## Begründung
Der gemeinsame Nenner der ersten drei Punkte ist eine Zusage, die die
Oberfläche nicht einlöste. Eine Plattform, deren Zweck es ist, Behauptungen von
Belegen zu unterscheiden, muss den Beleg zeigen: wer, wann, wo nachzulesen.
Fehlt der Verweis, bleibt nur Vertrauen — und dann wäre die ganze Anlage
überflüssig.

Beim Messen an den 144 echten Inhalten wurden zwei Fehler im neuen Code
gefunden, bevor sie Schaden anrichten konnten:

- Das allgemeine Kennungsmuster fand in „CVE-2026-62835" zusätzlich das
  Bruchstück „CVE-2026". Alle Sicherheitsmeldungen eines Jahrgangs hätten sich
  damit eine Kennung geteilt und wären zu **einer** Meldung verschmolzen.
- Der erste Block einer Geräte-UUID („ACF35976-45A5-…") erfüllte das Muster
  ebenfalls. Ein Zufallswert hätte zwei Beiträge verbunden.

Beide sind jetzt Testfälle. Kennungen werden zudem nur in Großschreibung
erkannt: Mit Kleinbuchstaben wäre auch „the 2026" eine Kennung. Der Preis ist
ein verpasstes „kb5094126" — der Gegenwert ist, dass keine Verknüpfung erfunden
wird.

## Konsequenzen
- Migration 0005 mit `dashboard_daten` (Belege), `auftrag_uebernehmen` und
  `api_schluessel_geheim`.
- Neue Module: `netz-layout.ts`, `kennungen.ts`, `ki/vorschlag.ts`,
  `ki/anbieter.ts`. 70 neue Tests (271 gesamt).
- `api_schluessel_geheim` gibt den Zugang **verschlüsselt** an seinen Besitzer
  heraus. Entschlüsseln kann ihn nur, wer `BYOK_ENCRYPTION_KEY` kennt, und
  dieser Wert liegt allein auf dem Server. Der Besitzer erhält damit nichts,
  was er nicht selbst hinterlegt hat; die Zusage aus ADR 0009 — der Klartext
  verlässt den Server nie — bleibt unberührt.
- Auf den vorhandenen Daten führt die Kennungsregel drei Zusammenführungen
  herbei, alle innerhalb desselben Herausgebers. Verknüpfungen **zwischen**
  Herausgebern entstehen dadurch noch nicht: Unter den sieben Quellen berichten
  nur wenige über dieselben Einzelvorgänge. Das Netz zeigt diesen Befund jetzt
  ausdrücklich an, statt leer zu wirken. Übergreifende Zuordnung nach Bedeutung
  statt nach Kennung bleibt Aufgabe der KI-Analyse.
