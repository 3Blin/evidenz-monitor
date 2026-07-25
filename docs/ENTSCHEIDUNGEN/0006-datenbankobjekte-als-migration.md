# ADR 0006: Zeilen-Sicherheit und Datenbankfunktionen gehören in Migrationen
Datum: 25.07.2026 · Status: **Vorschlag, Freigabe ausstehend**

## Kontext
Beim Übertragen des Projekts auf GitHub fiel auf, dass zwei in ADR 0004 und
ADR 0005 beschlossene Dinge nirgends im Repository standen:

- die Spalte `auftraege.oeffentliche_demo`,
- die Funktion `dashboard_daten(auftrag)`.

Beide waren von Hand in der Supabase-Konsole angelegt. Zusätzlich stand die in
Migration 0001 angekündigte Zeilen-Sicherheit noch aus ("wird in Migration 0002
je Tabelle aktiviert" — diese Migration gab es nicht).

Die Folgen waren größer als ein Schönheitsfehler:

1. Eine nach `docs/BETRIEB.md` frisch eingerichtete Datenbank konnte das
   Dashboard überhaupt nicht bedienen. Die Anleitung führte zu einem System,
   das nicht läuft.
2. ARCHITEKTUR-Regel 5 ("Schema-Änderungen nur per Migration + ADR") war
   verletzt, und zwar unbemerkt.
3. Der Zugriffsschutz, den ADR 0004 der Datenbank zuschreibt, bestand real nur
   aus der einen Prüfung innerhalb der von Hand angelegten Funktion. Ohne
   Zeilen-Sicherheit hätte ein direkter Zugriff mit dem veröffentlichten
   Schlüssel auf alle Tabellen gelesen — genau das, was ADR 0004 verhindern
   sollte. Auf Supabase haben die Rollen `anon` und `authenticated` im Schema
   `public` von Haus aus Tabellenrechte; erst Regeln machen daraus Schutz.

## Entscheidung
1. Migration `0002_zeilensicherheit_und_datenbankfunktionen.sql` führt alles
   nach, was in der Datenbank leben muss: die Spalte `oeffentliche_demo`,
   Zeilen-Sicherheit auf allen zwölf Tabellen und die Funktion
   `dashboard_daten`.
2. Datenbankfunktionen und Sicherheitsregeln sind ab jetzt Teil der Migrationen
   wie Tabellen. Handarbeit in der Supabase-Konsole gilt als Fehler, nicht als
   Abkürzung.
3. Die Migration ist wiederholbar geschrieben (`IF NOT EXISTS`,
   `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`), damit sie auch auf der schon
   von Hand veränderten Datenbank durchläuft.
4. `api_schluessel` und `ingest_tokens` erhalten bewusst **keine** Regel: bei
   eingeschalteter Zeilen-Sicherheit ohne Regel sind sie für die Anwendung
   vollständig gesperrt. Verschlüsselte KI-Schlüssel dürfen laut ARCHITEKTUR
   nie an den Browser gelangen, und ein auslesbares Ingest-Token wäre ein
   Vollzugriff auf den Auftrag.
5. Damit die Regeln lokal und im Prüftor überhaupt prüfbar sind, legt die
   Migration die Supabase-Bausteine `auth.uid()`, `anon` und `authenticated`
   an, falls sie fehlen. Der Ersatz für `auth.uid()` liest dieselbe
   Sitzungsvariable wie das Original, sodass beide Richtungen prüfbar sind:
   ohne Kennung kein Zugriff, mit Kennung genau dieser Nutzer.

## Begründung
Ein Zugriffsschutz, der nur in einer Konsole existiert, ist nicht überprüfbar,
nicht wiederherstellbar und nicht nachvollziehbar. Er lässt sich auch nicht
testen — und beim ersten Test dieser Migration trat sofort ein echter Fehler
zutage: Die Prüfung war als `NOT (demo OR besitzer = auth.uid())` geschrieben.
Ohne Anmeldung liefert `auth.uid()` NULL, damit wird der Vergleich NULL und
`NOT NULL` ist wieder NULL — die Bedingung löste **nie** aus, jeder Auftrag
wäre öffentlich lesbar gewesen. Sichtbar wurde das erst durch einen Test, den
es ohne diese Migration nicht hätte geben können. Genau das ist die
Begründung für diesen ADR.

Verworfene Alternativen:

- **So lassen und nur dokumentieren.** Dann bleibt die Anleitung in BETRIEB.md
  falsch und der Schutz unbelegt.
- **Zeilen-Sicherheit weglassen, weil die Funktion ja prüft.** Die Funktion
  prüft nur ihren eigenen Weg. Ein direkter Tabellenaufruf ginge daran vorbei.
- **Regeln nur für Lesezugriffe.** Ein fremder Schreibzugriff wäre dann
  möglich; die Regeln gelten deshalb für alle Zugriffsarten.

## Konsequenzen
- `npm run migrate` erzeugt ab jetzt ein vollständig funktionsfähiges System.
- Neue Tests: `tests/zeilensicherheit.test.ts` (8) und
  `tests/dashboard-funktion.test.ts` (8). Letztere weisen zusätzlich nach, dass
  die Datenbankfunktion denselben Graphen liefert wie das geprüfte Regelwerk in
  `src/lib/graph.ts` — zwei Wege zur selben Aussage laufen sonst auseinander.
- Das Bewertungspanel zeigt nur Aussagen, die einen Eintrag im Reifegrad-Verlauf
  haben. Eine Aussage ohne Verlauf hat noch keine Bewertung; eine Stufe zu
  erfinden wäre falsch. Die Kennzahl "Aussagen" zählt weiterhin alle.
- `scripts/seed.mjs` setzt `oeffentliche_demo` nun ausdrücklich, statt sich auf
  Handarbeit zu verlassen.
- Auf der bestehenden Supabase-Datenbank muss die Migration einmal nachgezogen
  werden. Danach ist die dortige Funktion die aus dem Repository.
