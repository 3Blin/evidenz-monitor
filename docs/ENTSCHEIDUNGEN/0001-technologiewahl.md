# ADR 0001: Technologiewahl
Datum: 24.07.2026 · Status: angenommen

## Kontext (Alltagssprache)
Die Plattform muss übers Internet erreichbar sein, mehrere Nutzer mit Login
bedienen, später eine Handy-App über dieselbe Schnittstelle versorgen und
von einem Nicht-Programmierer betreibbar bleiben. Gewählt wird nach den
Skill-Kriterien: Wartungsarmut vor Eleganz, strikte Typisierung, wenige
etablierte Dependencies.

## Entscheidung
Next.js (React + TypeScript im Strict-Modus) als Web-Anwendung mit
API-Routen; Supabase (verwalteter PostgreSQL + eingebaute Anmeldung/Auth
+ automatische Backups) als Datenhaltung; Betrieb auf Vercel;
Graph-Darstellung mit d3-force; KI-Anbindung als schmaler eigener Adapter
(BYOK, OpenAI-/Anthropic-kompatible Endpunkte).

## Begründung
- **Kein selbstgebautes Login.** Anmeldung/Passwörter selbst zu bauen ist
  die häufigste Sicherheitsfalle. Supabase Auth ist geprüft, gepflegt und
  inklusive. (Alternative "eigenes Auth" verworfen: Sicherheitsrisiko.)
- **Verwaltete Datenbank statt Eigenbetrieb.** Automatische Backups und
  Updates ohne Administrationsaufwand — entscheidend, wenn niemand
  hauptamtlich wartet. (Alternative SQLite verworfen: für Internet-Betrieb
  mit mehreren Nutzern und ohne eigenes Backup-Konzept ungeeigneter;
  Alternative eigener Postgres-Server verworfen: Wartungslast.)
- **Ein Framework für Oberfläche und API.** Next.js deckt beides ab; die
  API bleibt sauber getrennt nutzbar für die spätere Handy-App.
  (Alternative separates Backend-Framework verworfen: zweites System ohne
  Mehrwert bei dieser Größe.)
- **TypeScript strict:** Typfehler brechen den Build statt zur Laufzeit
  aufzutauchen (Skill-Leitplanke).
- **d3-force:** etablierte Standardbibliothek für Netz-Graphen, keine
  exotische Abhängigkeit.
- **Eigener schmaler KI-Adapter statt großem Framework:** BYOK braucht nur
  einen HTTP-Aufruf mit festem Prompt; ein Agenten-Framework wäre
  Abstraktion auf Vorrat (YAGNI).

## Konsequenzen
- Vercel + Supabase haben kostenlose Einstiegsstufen; bei Wachstum
  entstehen laufende Kosten (transparent, kündbar). Ein Umzug auf eigene
  Server bleibt möglich (Next.js und Postgres sind portabel).
- Supabase-Migrations-SQL ist das einzige erlaubte Mittel für
  Schemaänderungen (Skill-Leitplanke Migrationen).
- Für die heutige Probe läuft alles lokal in der Entwicklungsumgebung
  (lokaler Postgres); das Deployment zu Vercel/Supabase ist ein eigener,
  gemeinsamer Schritt danach.

## Neue Dependencies (mit Begründungspflicht)
next/react/typescript (Kern), @supabase/supabase-js (DB/Auth-Client),
d3-force + d3-selection (Graph), zod (Eingabevalidierung an API-Grenzen),
vitest (Tests), eslint + typescript-eslint (Leitplanken), pino
(strukturiertes JSON-Logging). Versionen werden gepinnt (Lockfile).
