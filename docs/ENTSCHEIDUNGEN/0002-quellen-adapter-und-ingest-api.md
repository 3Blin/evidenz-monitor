# ADR 0002: Quellen-Adapter-Schnittstelle und Ingest-API
Datum: 24.07.2026 · Status: angenommen

## Kontext (Alltagssprache)
Frühe Hinweise entstehen in Communities und Foren; manche Kanäle (X,
geschlossene Gruppen) sind aber nur mit Login/Cookies oder rechtlich
heiklen Scraping-Werkzeugen (z. B. Agent-Reach) erreichbar. Solcher Code
soll nicht im Kern laufen (Rechtskonformität 7.6, Wartbarkeit,
Codequalität) — die Informationen sollen trotzdem nutzbar sein.

## Entscheidung
1. Der Quellen-Abrufer arbeitet über eine feste Adapter-Schnittstelle;
   der Kern liefert zwei Adapter: RSS/Atom und Web-Abruf.
2. Zusätzlich bietet die API einen Ingest-Endpunkt: Externe Sammler
   liefern mit Auftrag-gebundenem Token Inhalte im Standardformat ein
   (gleiche Metadatenpflichten, gleiche Validierung, gleiche Analyse).

## Begründung
Trennung von Verantwortung: Der Kern bleibt rechtlich sauber, klein und
testbar; riskante oder exotische Beschaffung läuft beim Nutzer (z. B.
Hermes-Agent mit Agent-Reach) unter dessen Kontrolle und Verantwortung.
Verworfene Alternative "Agent-Reach in den Kern einbauen": Shell-/Cookie-
Abhängigkeiten laufen auf Vercel nicht, Sperr- und Rechtsrisiken,
Fremd-Codequalität als tragende Säule.

## Konsequenzen
Neue Tabelle ingest_tokens (Token nur als Hash); Quellentyp
'extern_agent'; ein zusätzlicher API-Endpunkt mit strenger Validierung.
Eingelieferte Inhalte sind als solche gekennzeichnet und in der
Quellenbewertung entsprechend eingestuft.
