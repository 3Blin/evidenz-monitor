# Evidenz-Monitor

Beobachtungsaufträge, Quellenbewertung und Evidenzverlauf — themenneutral.

**Veröffentlichen:** [docs/VEROEFFENTLICHEN.md](docs/VEROEFFENTLICHEN.md) (GitHub → Vercel)

**Für Nutzer:** [docs/BETRIEB.md](docs/BETRIEB.md) (starten, sichern,
aktualisieren) und [docs/FUNKTIONSUEBERSICHT.md](docs/FUNKTIONSUEBERSICHT.md)
(was die Software kann, in Klartext).

**Verträge (nicht eigenmächtig ändern):**
[Anforderungen](docs/ANFORDERUNGEN.md) ·
[Architektur](docs/ARCHITEKTUR.md) ·
[Datenmodell](docs/SCHEMA.sql) ·
[Entscheidungen](docs/ENTSCHEIDUNGEN/UEBERSICHT.md)

Gebaut nach dem dev-guardrails-Workflow: Anforderung und Architektur wurden
vor dem ersten Code freigegeben, jede Funktion hat Tests, jede Entscheidung
ein Protokoll.

## Kurzbefehle
| Zweck | Befehl |
|---|---|
| Entwicklung starten | `npm run dev` |
| Tests | `npm test` |
| Testabdeckung | `npm run coverage` |
| Regelprüfung | `npm run lint` · `npm run typecheck` |
| Sicherheitsprüfung | `npm run audit:deps` |
| Datenbank aktualisieren | `npm run migrate` |
| Ersten Auftrag anlegen | `npm run seed` |
| Quellen abrufen | `npm run sammeln` |
| Auswerten und bewerten | `npm run auswerten` |
