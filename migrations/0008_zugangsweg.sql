-- Migration 0008: Zugangsweg je Quelle (ADR 0014)
--
-- Anlass: Bisher entschied allein die Adresse, wie eine Quelle gelesen wird -
-- sieht sie nach Feed aus, dann RSS, sonst Webseite. Das trug, solange es nur
-- diese beiden Wege gab. Mit der Suche (SearXNG) und GDELT kommen Wege dazu,
-- die man einer Adresse nicht ansieht: `https://such.beispiel.tld/search?q=…`
-- ist von einer gewöhnlichen Webseite nicht zu unterscheiden.
--
-- Warum eine eigene Spalte und nicht ein weiterer Wert in `typ`: `typ` sagt,
-- WER veröffentlicht (Hersteller, Fachmedium, Forum). Davon hängt die
-- Einstufung im Reifegrad ab. Der Zugangsweg sagt, WIE wir lesen. Beides in
-- eine Spalte zu legen hieße, dass eine Suche plötzlich eine Herausgeberart
-- wäre - und die Reifegrad-Logik daran hinge, über welche Leitung etwas kam.
-- Genau davor warnt der Kopf von src/lib/quellen/registrierung.ts.
--
-- Rückwärtsverträglich: Alle vorhandenen Zeilen bekommen 'automatisch', also
-- genau das bisherige Verhalten. Die alte Fassung der Anwendung sieht die
-- Spalte nicht und läuft unverändert weiter.
--
-- REIHENFOLGE: Diese Migration gehört VOR das Ausliefern der neuen Fassung.
-- Sie ist ergänzend und damit für die alte Fassung unschädlich; die neue
-- Fassung dagegen braucht die Spalte und bricht ohne sie. Beim ersten Mal war
-- es andersherum angegeben, und der Sammellauf endete drei Stunden lang mit
-- `column "zugangsweg" does not exist`. Siehe ADR 0014, Nachtrag.

ALTER TABLE quellen
  ADD COLUMN IF NOT EXISTS zugangsweg TEXT NOT NULL DEFAULT 'automatisch'
    CHECK (zugangsweg IN ('automatisch','feed','web','suche','gdelt'));

COMMENT ON COLUMN quellen.zugangsweg IS
  'Wie die Quelle gelesen wird. automatisch = an der Adresse erkennen (Feed oder Webseite).';

-- ---------------------------------------------------------------------------
-- Übernahmefunktion nachziehen
--
-- auftrag_uebernehmen kopiert die Quellen eines Demo-Auftrags. Ohne diese
-- Anpassung verlöre die Kopie den Zugangsweg und fiele auf 'automatisch'
-- zurück - eine Suchquelle würde in der Kopie als Webseite gelesen und
-- lieferte die HTML-Seite der Suchmaschine statt der Treffer.
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
  INSERT INTO quellen (auftrag_id, url, typ, herausgeber, aktiv, themenspezifisch, zugangsweg)
  SELECT v_neu, q.url, q.typ, q.herausgeber, q.aktiv, q.themenspezifisch, q.zugangsweg
    FROM quellen q WHERE q.auftrag_id = p_auftrag;

  RETURN v_neu;
END;
$$;
