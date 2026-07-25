# ADR 0009: Anmeldung per Magic Link, Verwaltung in der Oberfläche
Datum: 25.07.2026 · Status: **Vorschlag, Freigabe ausstehend**

## Kontext
`ANFORDERUNGEN.md` nennt Mehrbenutzerfähigkeit mit Anmeldung "von Anfang an
Pflicht" und führt im MVP-Umfang als Punkt 1 und 2 die Anmeldung samt
Bearbeiten eines Auftrags. Gebaut war davon nichts: Die Oberfläche konnte nur
anzeigen, es gab keine einzige schreibende Route, und die Zugriffsregeln aus
Migration 0002 liefen leer, weil `auth.uid()` immer NULL war.

Praktisch hieß das: Suchbegriffe, Quellen und Relevanzregeln waren nur über
`psql` änderbar. Gerade die Relevanzregeln müssen aber regelmäßig nachgezogen
werden (ADR 0008) — eine Einstellung, die nur mit Datenbankzugang erreichbar
ist, wird nicht gepflegt.

Zusätzlich zeigte die Oberfläche genau **einen** Auftrag, festgelegt über
`NEXT_PUBLIC_AUFTRAG`. Damit ließ sich die Themenneutralität des Kerns nicht
zeigen, obwohl sie verbindlich ist.

## Entscheidung
1. **Anmeldung per Magic Link** über Supabase Auth. Kein Passwort: keins, das
   schlecht gewählt oder wiederverwendet wird, und kein Zurücksetzen-Verfahren,
   das selbst zur Schwachstelle wird. Für 2–10 Personen der geringste Aufwand.
2. Die Sitzung liegt in Cookies; eine Middleware erneuert sie bei jeder Anfrage.
   Ohne Erneuerung wäre man nach etwa einer Stunde mitten im Bearbeiten
   stillschweigend abgemeldet.
3. **Schreibzugriff läuft über die Tabellen, nicht über eigene Funktionen.** Die
   Zeilen-Sicherheit aus Migration 0002 ist der Schutz und ist getestet. Eine
   zusätzliche Prüfung in der Anwendung wäre eine zweite Wahrheit, die
   auseinanderlaufen kann.
4. Zwei Ausnahmen brauchen doch Datenbankfunktionen (Migration 0004), weil die
   Zeilen-Sicherheit sie nicht leisten kann:
   - `oeffentliche_auftraege()` — ohne Anmeldung ist die Tabelle vollständig
     gesperrt, die Auswahlliste der Demos muss also aus einer Funktion kommen.
     Sie gibt nur Kennung, Name und Fragestellung heraus.
   - `api_schluessel_speichern` / `api_schluessel_zustand` /
     `api_schluessel_entfernen` — `api_schluessel` hat bewusst keine
     Zugriffsregel (ADR 0006) und ist damit auch für den Besitzer gesperrt.
5. **Der KI-Schlüssel wird serverseitig verschlüsselt.** Der Klartext geht genau
   einmal an eine eigene Route, wird dort mit `BYOK_ENCRYPTION_KEY`
   verschlüsselt und nur verschlüsselt weitergegeben. Er wird nie protokolliert
   und nie zurückgegeben — auch das Formular kann ihn nicht anzeigen, nur
   ersetzen. Die Zustandsfunktion gibt ausdrücklich nur Zustand heraus.
6. **`NEXT_PUBLIC_AUFTRAG` wird zur Vorauswahl.** Alle freigegebenen Aufträge
   stehen in der Oberfläche zur Auswahl; angemeldete Nutzer sehen zusätzlich
   ihre eigenen. Das Seed legt zwei Aufträge aus verschiedenen Bereichen an —
   Windows-Updates und Sicherheitslücken —, damit die Themenneutralität nicht
   behauptet, sondern gezeigt wird.
7. Zwei neue Abhängigkeiten: `@supabase/supabase-js` und `@supabase/ssr`, beide
   auf genaue Versionen festgelegt wie alle anderen.

## Begründung
Die Anmeldung selbst zu bauen ist laut ADR 0001 die häufigste Sicherheitsfalle —
genau deshalb steht Supabase in diesem Projekt. Sie dann doch selbst zu bauen,
oder eine eigene Sitzungsverwaltung um die fremde herumzulegen, würde diese
Entscheidung aushöhlen. Die beiden Pakete sind der offizielle Weg; die Sitzung
selbst zu erneuern hieße, Token-Auffrischung von Hand zu schreiben.

Verworfene Alternativen:

- **E-Mail und Passwort.** Braucht ein Zurücksetzen-Verfahren, das selbst
  angreifbar ist, und Passwortregeln, die niemand einhält. Bleibt in Supabase
  jederzeit zuschaltbar, falls der Postfachzugang zum Problem wird.
- **Ein gemeinsames Zugangswort.** Schnell, aber keine Mehrbenutzerfähigkeit;
  die Zeilen-Sicherheit bliebe ungenutzt und die Anforderung unerfüllt.
- **Für jede Änderung eine eigene Datenbankfunktion.** Viel Code, der genau das
  wiederholt, was die Zugriffsregeln schon leisten — und jede Funktion eine
  weitere Stelle, an der die Prüfung fehlen kann.
- **Den KI-Schlüssel im Browser verschlüsseln.** Dann läge das Geheimnis im
  Browser und wäre keins.
- **`NEXT_PUBLIC_AUFTRAG` ganz entfernen.** Hätte die bestehende Einrichtung
  gebrochen und einen Fehlerzustand erzeugt, wenn kein Auftrag freigegeben ist.

## Konsequenzen
- **Die Weboberfläche braucht jetzt einen vierten Wert:
  `BYOK_ENCRYPTION_KEY`.** Das schwächt die Konsequenz aus ADR 0005 ("auf Vercel
  genügen die drei öffentlichen Werte") ab. Der Grund ist unvermeidlich: Ohne
  serverseitiges Geheimnis lässt sich ein Nutzerschlüssel nicht verschlüsselt
  ablegen. Eine Datenbankverbindung braucht die Oberfläche weiterhin nicht.
- Im Supabase-Projekt müssen Site-URL und erlaubte Rückkanal-Adressen
  eingetragen werden (`/auth/bestaetigen`), sonst führt der Anmeldelink ins
  Leere. Schritt für Schritt in `docs/VEROEFFENTLICHEN.md`.
- Der Rückkanal behandelt beide Linkformen von Supabase (`code` und
  `token_hash`), damit die Anmeldung nicht von einer Projekteinstellung abhängt.
  Als Ziel sind nur eigene Pfade erlaubt — sonst wäre der Anmeldelink ein
  offener Weiterleiter.
- Abmelden ist ein POST, damit ein fremder Verweis oder ein vorausgeladenes Bild
  niemanden ungefragt abmeldet.
- `scripts/auswerten.job.ts` verarbeitete `LIMIT 1`. Mit mehreren Aufträgen wäre
  das stiller Datenverlust gewesen — der zweite Auftrag hätte nie eine Bewertung
  bekommen. Jetzt läuft er über alle aktiven Aufträge, und die Stufenverteilung
  wird je Auftrag gezählt statt über die ganze Datenbank.
- Beim Bau aufgefallen und behoben: Der Wert für `BYOK_ENCRYPTION_KEY` im
  Prüftor-Workflow war 35 Bytes lang und damit unbrauchbar — `krypto.ts` verlangt
  genau 32. Bemerkt wurde es erst, als ein Test wirklich damit verschlüsselte.
- Der Demo-Zugang bleibt bestehen: mehrere Aufträge aus verschiedenen Bereichen
  können ohne Anmeldung lesbar sein. Vor dem echten Produktivbetrieb ist je
  Auftrag zu bestätigen, dass er keine persönlichen Angaben enthält.
- Neue Tests: 14 für die Datenbankfunktionen, 11 für die Auswahlliste, 3 für den
  serverseitigen Schlüssel, 3 für die Begriffseingabe.
