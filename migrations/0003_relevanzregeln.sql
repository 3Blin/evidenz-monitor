-- Migration 0003: Relevanzregeln je Beobachtungsauftrag (ADR 0008)
--
-- Anlass: Im ersten echten Betrieb waren 6 von 24 Aussagen ohne jeden Bezug
-- zum Auftrag. Ursache war die Auswahlregel "irgendein Suchbegriff kommt
-- irgendwo vor": Das Wort "Updates" in einem Artikel über eine Lücke in der
-- redis-Datenbank genügte, um ihn in einen Windows-Auftrag zu holen.
--
-- Die Regeln gehören zum Auftrag, nicht in den Code - sonst wäre der Kern
-- nicht mehr themenneutral (verbindliche Vorgabe der Anforderungen). Ein
-- Wetter- oder Preisauftrag benutzt dieselben Felder mit anderen Werten.

ALTER TABLE auftraege
  ADD COLUMN IF NOT EXISTS pflichtbegriffe TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ausschlussbegriffe TEXT[] NOT NULL DEFAULT '{}',
  -- Vorbelegung 1 entspricht genau dem bisherigen Verhalten. Bestehende
  -- Aufträge ändern sich durch diese Migration also nicht von selbst.
  ADD COLUMN IF NOT EXISTS mindest_treffer INT NOT NULL DEFAULT 1
    CHECK (mindest_treffer >= 1);

COMMENT ON COLUMN auftraege.pflichtbegriffe IS
  'Alle diese Begriffe müssen vorkommen, sonst ist der Inhalt nicht relevant.';
COMMENT ON COLUMN auftraege.ausschlussbegriffe IS
  'Kommt einer davon vor, ist der Inhalt ausgeschlossen.';
COMMENT ON COLUMN auftraege.mindest_treffer IS
  'Wie viele verschiedene Suchbegriffe nötig sind (Vorbelegung 1).';

-- Manche Quellen sind durch ihre Adresse schon auf das Thema begrenzt: ein
-- reines Windows-Forum, ein auf ein Board eingeschränkter Feed, eine Suchabfrage
-- wie "?q=Windows". Dort das Thema im Text noch einmal zu verlangen, sortiert
-- gerade die Frühwarnkanäle aus - ein Forenbeitrag schreibt selten dazu, für
-- welches Betriebssystem er gilt. Diese Quellen erfüllen die Pflichtbegriffe
-- also durch ihre Herkunft.
--
-- Ausdrücklich NICHT gesetzt wird das bei breiten Quellen wie MSRC: der Feed
-- deckt alle Microsoft-Produkte ab, dort muss der Text das Thema belegen.
ALTER TABLE quellen
  ADD COLUMN IF NOT EXISTS themenspezifisch BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN quellen.themenspezifisch IS
  'Quelle ist bereits auf das Thema begrenzt; Pflichtbegriffe gelten als erfüllt.';
