-- Migration 0007: Die alte Taktspalte entfernen (ADR 0012)
--
-- Zweiter Schritt der Umstellung aus Migration 0006. Dort wurden die neuen
-- Spalten nur ergänzt, damit die noch laufende alte Fassung der Anwendung
-- weiterarbeiten kann; hier fällt die alte Spalte.
--
-- ANWENDUNGSREIHENFOLGE, wichtig:
--   1. Migration 0006 anwenden  (unschädlich für beide Fassungen)
--   2. Neue Fassung ausliefern  (liest nur noch die neuen Spalten)
--   3. Migration 0007 anwenden  (diese hier)
--
-- Wird 0007 vor Schritt 2 angewandt, bricht die alte Fassung beim Bearbeiten
-- eines Auftrags. Deshalb ist sie eine eigene Migration und kein Nachsatz.
--
-- Warum überhaupt entfernen: Zwei Felder für denselben Zweck werden
-- unweigerlich zu zwei Wahrheiten - ARCHITEKTUR-Regel 5. Der Wert ist in
-- Migration 0006 in intervall_min_minuten übernommen worden.

ALTER TABLE auftraege DROP COLUMN IF EXISTS intervall_minuten;
