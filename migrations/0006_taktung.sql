-- Migration 0006: Taktung der Sammelläufe als Bereich (ADR 0012)
--
-- Anlass: `intervall_minuten` stand seit Migration 0001 im Schema und wurde
-- von keinem Lauf gelesen. Der Sammellauf nahm bei jedem Aufruf alle aktiven
-- Aufträge. Die Einstellung war Dekoration - und das ist schlimmer als keine
-- Einstellung, weil man sich auf sie verlässt.
--
-- Neu ist außerdem, dass der Takt kein fester Wert mehr ist, sondern ein
-- Bereich. Wie schnell ein Thema läuft, weiß man vorher nicht, und es ändert
-- sich: Ein Auftrag über eine akute Störung braucht Minuten, einer über eine
-- Gesetzesnovelle Tage - und derselbe Auftrag braucht in der heißen Phase
-- etwas anderes als drei Wochen später. Die Nutzerin setzt die Grenzen, der
-- Takt bewegt sich zwischen ihnen.

ALTER TABLE auftraege
  ADD COLUMN IF NOT EXISTS intervall_min_minuten INT NOT NULL DEFAULT 60
    CHECK (intervall_min_minuten >= 5),
  ADD COLUMN IF NOT EXISTS intervall_max_minuten INT NOT NULL DEFAULT 1440
    CHECK (intervall_max_minuten <= 43200),
  -- Der aktuell gewählte Takt innerhalb des Bereichs. NULL heißt "noch nie
  -- gelaufen"; dann beginnt der Auftrag an der Untergrenze.
  ADD COLUMN IF NOT EXISTS aktueller_takt_minuten INT,
  -- NULL heißt "sofort fällig". Ein neuer Auftrag wartet nicht erst einen
  -- Takt lang, bevor er zum ersten Mal etwas zeigt.
  ADD COLUMN IF NOT EXISTS naechster_lauf_am TIMESTAMPTZ;

COMMENT ON COLUMN auftraege.intervall_min_minuten IS
  'Untergrenze des Abrufabstands. Bei Ertrag nähert sich der Takt ihr an.';
COMMENT ON COLUMN auftraege.intervall_max_minuten IS
  'Obergrenze des Abrufabstands. Bei Leerlauf nähert sich der Takt ihr an.';
COMMENT ON COLUMN auftraege.aktueller_takt_minuten IS
  'Zuletzt gewählter Takt. NULL = noch nie gelaufen.';
COMMENT ON COLUMN auftraege.naechster_lauf_am IS
  'Frühester Zeitpunkt des nächsten Sammellaufs. NULL = sofort fällig.';

-- Vorhandene Aufträge behalten ihre Einstellung: Der bisherige feste Wert
-- wird zur Untergrenze, das Vierfache zur Obergrenze. Damit läuft ein
-- bestehender Auftrag nach der Migration nicht seltener als vorher, kann sich
-- bei Leerlauf aber zurücknehmen.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'auftraege'
       AND column_name = 'intervall_minuten'
  ) THEN
    UPDATE auftraege
       SET intervall_min_minuten = GREATEST(5, LEAST(43200, intervall_minuten)),
           intervall_max_minuten = GREATEST(5, LEAST(43200, intervall_minuten * 4));

    -- Die alte Spalte fällt weg, statt daneben stehen zu bleiben. Zwei Felder
    -- für denselben Zweck werden unweigerlich zu zwei Wahrheiten - genau das
    -- verbietet ARCHITEKTUR-Regel 5. Der Wert ist oben übernommen.
    ALTER TABLE auftraege DROP COLUMN intervall_minuten;
  END IF;
END $$;

-- Die Obergrenze darf nicht unter der Untergrenze liegen. Als Tabellenregel,
-- weil sie zwei Spalten vergleicht.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'auftraege_taktbereich'
  ) THEN
    ALTER TABLE auftraege ADD CONSTRAINT auftraege_taktbereich
      CHECK (intervall_max_minuten >= intervall_min_minuten);
  END IF;
END $$;

-- Fällige Aufträge werden bei jedem Lauf gesucht; ohne Index ist das ein
-- vollständiger Durchlauf der Tabelle.
CREATE INDEX IF NOT EXISTS auftraege_faellig
  ON auftraege (naechster_lauf_am) WHERE aktiv = true;

-- ---------------------------------------------------------------------------
-- Übernahmefunktion nachziehen
--
-- auftrag_uebernehmen (Migration 0005) kopiert die Takteinstellung mit. Ohne
-- diese Anpassung verwiese sie auf die soeben entfernte Spalte und jede
-- Übernahme schlüge fehl. Aufgefallen durch den Test, nicht durch Nachdenken.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auftrag_uebernehmen(p_auftrag uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nutzer uuid := auth.uid();
  v_demo   boolean;
  v_neu    uuid;
  v_name   text;
  v_ziel   text;
  v_zaehler int := 1;
BEGIN
  IF v_nutzer IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT oeffentliche_demo INTO v_demo FROM auftraege WHERE id = p_auftrag;
  IF v_demo IS NULL THEN
    RAISE EXCEPTION 'Auftrag nicht gefunden' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT v_demo THEN
    RAISE EXCEPTION 'Dieser Auftrag ist nicht freigegeben' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT a.name INTO v_name FROM auftraege a WHERE a.id = p_auftrag;
  v_ziel := left(v_name || ' (Kopie)', 120);
  WHILE EXISTS (
    SELECT 1 FROM auftraege WHERE user_id = v_nutzer AND name = v_ziel
  ) LOOP
    v_zaehler := v_zaehler + 1;
    v_ziel := left(v_name || ' (Kopie ' || v_zaehler || ')', 120);
  END LOOP;

  INSERT INTO auftraege (
    user_id, name, zielbeschreibung, fragestellung, suchbegriffe,
    pflichtbegriffe, ausschlussbegriffe, mindest_treffer,
    intervall_min_minuten, intervall_max_minuten,
    aktiv, oeffentliche_demo
  )
  SELECT v_nutzer, v_ziel, a.zielbeschreibung, a.fragestellung,
         a.suchbegriffe, a.pflichtbegriffe, a.ausschlussbegriffe, a.mindest_treffer,
         a.intervall_min_minuten, a.intervall_max_minuten,
         a.aktiv, false
    FROM auftraege a WHERE a.id = p_auftrag
  RETURNING id INTO v_neu;

  -- Der Takt selbst wird bewusst NICHT kopiert: Die Kopie hat keine eigene
  -- Vorgeschichte und beginnt an ihrer Untergrenze.
  INSERT INTO quellen (auftrag_id, url, typ, herausgeber, aktiv, themenspezifisch)
  SELECT v_neu, q.url, q.typ, q.herausgeber, q.aktiv, q.themenspezifisch
    FROM quellen q WHERE q.auftrag_id = p_auftrag;

  RETURN v_neu;
END;
$$;
