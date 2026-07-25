# ADR 0003: Versionsaktualisierung nach Sicherheitsbefunden
Datum: 24.07.2026 · Status: angenommen

## Kontext (Alltagssprache)
Beim ersten Dependency-Audit im Prüftor meldeten sich 7 Schwachstellen
(4 hoch, 3 kritisch) in den zunächst gewählten Paketversionen — u. a. in
Next.js, Vitest, PostCSS und sharp. Die zunächst gepinnten Versionen
stammten aus einem älteren Wissensstand.

## Entscheidung
Aktualisierung auf next 16.2.11, vitest/@vitest/coverage-v8 4.1.10;
zusätzlich npm-"overrides" für postcss 8.5.23 und sharp 0.35.3, weil
diese als indirekte Abhängigkeiten in veralteten Versionen mitgezogen
wurden.

## Begründung
Die Skill-Regel verbietet, eine Prüfung abzuschalten, statt den Befund zu
beheben. Overrides sind das schmalste Mittel, um indirekte Abhängigkeiten
sicher zu pinnen, ohne ein Paket zu ersetzen. Ergebnis: 0 Schwachstellen.

## Konsequenzen
Versionen bleiben exakt gepinnt (kein ^ / ~). Die overrides müssen bei
künftigen Next.js-Updates geprüft werden — Vorgehen ist in BETRIEB.md
(Phase 5) beschrieben. Ein Dependency-Audit gehört ab jetzt in jeden
Prüflauf.
