-- Migration 0002: Zeilen-Sicherheit und Datenbankfunktionen (ADR 0006, ADR 0007)
--
-- Hintergrund: Die in ADR 0004 und ADR 0005 beschlossenen Datenbankobjekte
-- (Spalte oeffentliche_demo, Funktion dashboard_daten) waren nur von Hand in
-- Supabase angelegt und in keiner Migration festgehalten. Damit widersprachen
-- sie ARCHITEKTUR-Regel 5 ("Schema-Änderungen nur per Migration + ADR") und
-- eine frisch migrierte Datenbank konnte das Dashboard nicht bedienen.
-- Ebenso stand die in Migration 0001 angekündigte Zeilen-Sicherheit aus.
--
-- Diese Migration ist bewusst wiederholbar (IF NOT EXISTS / DROP ... IF EXISTS),
-- damit sie auch auf der bereits von Hand veränderten Datenbank durchläuft.

-- ---------------------------------------------------------------------------
-- 1. Supabase-Bausteine, die lokal fehlen
--
-- auth.uid() und die Rollen anon/authenticated liefert Supabase mit. Lokal
-- (Tests, Prüftor) gibt es sie nicht. Wir legen nur an, was fehlt - auf
-- Supabase bleibt dieser Abschnitt wirkungslos. Ohne diesen Abschnitt wären
-- die Sicherheitsregeln unten nicht lokal prüfbar, und ungeprüfte
-- Sicherheitsregeln sind das eigentliche Risiko.
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    -- Ersatz für lokale Läufe. Liest dieselbe Sitzungsvariable wie Supabase,
    -- damit die Sicherheitsregeln lokal in beide Richtungen prüfbar sind:
    -- ohne gesetzte Kennung ist niemand angemeldet (NULL, also kein Zugriff),
    -- mit gesetzter Kennung gilt genau dieser Nutzer.
    EXECUTE 'CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS '
         || '$f$SELECT NULLIF(current_setting(''request.jwt.claim.sub'', true), '''')::uuid$f$';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Demo-Freigabe als Spalte (ADR 0004)
-- ---------------------------------------------------------------------------

ALTER TABLE auftraege
  ADD COLUMN IF NOT EXISTS oeffentliche_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN auftraege.oeffentliche_demo IS
  'ADR 0004: Auftrag ohne Anmeldung lesbar. Vor Produktivbetrieb prüfen.';

-- ---------------------------------------------------------------------------
-- 3. Zeilen-Sicherheit (Vertrag aus ARCHITEKTUR, angekündigt in 0001)
--
-- Grundsatz: Jeder Nutzer sieht ausschließlich Daten seiner eigenen Aufträge.
-- Wichtig: Auf Supabase haben anon und authenticated per Voreinstellung
-- Tabellenrechte im Schema public - erst diese Regeln machen daraus einen
-- wirksamen Schutz. Der Tabelleneigentümer (Sammellauf, Auswertung,
-- Migrationen) umgeht RLS wie vorgesehen; die Anwendung selbst greift nur
-- über die Funktionen in Abschnitt 4 und 5 zu.
-- ---------------------------------------------------------------------------

ALTER TABLE auftraege          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quellen            ENABLE ROW LEVEL SECURITY;
ALTER TABLE abrufe             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inhalte            ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldungsgruppen    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inhalt_gruppen     ENABLE ROW LEVEL SECURITY;
ALTER TABLE aussagen           ENABLE ROW LEVEL SECURITY;
ALTER TABLE aussage_belege     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reifegrad_verlauf  ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyse_laeufe     ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_schluessel     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_tokens      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eigene_auftraege ON auftraege;
CREATE POLICY eigene_auftraege ON auftraege FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS eigene_quellen ON quellen;
CREATE POLICY eigene_quellen ON quellen FOR ALL
  USING (EXISTS (SELECT 1 FROM auftraege a WHERE a.id = quellen.auftrag_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM auftraege a WHERE a.id = quellen.auftrag_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS eigene_abrufe ON abrufe;
CREATE POLICY eigene_abrufe ON abrufe FOR ALL
  USING (EXISTS (SELECT 1 FROM quellen q JOIN auftraege a ON a.id = q.auftrag_id
                 WHERE q.id = abrufe.quelle_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM quellen q JOIN auftraege a ON a.id = q.auftrag_id
                      WHERE q.id = abrufe.quelle_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS eigene_inhalte ON inhalte;
CREATE POLICY eigene_inhalte ON inhalte FOR ALL
  USING (EXISTS (SELECT 1 FROM quellen q JOIN auftraege a ON a.id = q.auftrag_id
                 WHERE q.id = inhalte.quelle_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM quellen q JOIN auftraege a ON a.id = q.auftrag_id
                      WHERE q.id = inhalte.quelle_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS eigene_meldungsgruppen ON meldungsgruppen;
CREATE POLICY eigene_meldungsgruppen ON meldungsgruppen FOR ALL
  USING (EXISTS (SELECT 1 FROM auftraege a WHERE a.id = meldungsgruppen.auftrag_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM auftraege a WHERE a.id = meldungsgruppen.auftrag_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS eigene_inhalt_gruppen ON inhalt_gruppen;
CREATE POLICY eigene_inhalt_gruppen ON inhalt_gruppen FOR ALL
  USING (EXISTS (SELECT 1 FROM inhalte i JOIN quellen q ON q.id = i.quelle_id
                 JOIN auftraege a ON a.id = q.auftrag_id
                 WHERE i.id = inhalt_gruppen.inhalt_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM inhalte i JOIN quellen q ON q.id = i.quelle_id
                      JOIN auftraege a ON a.id = q.auftrag_id
                      WHERE i.id = inhalt_gruppen.inhalt_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS eigene_aussagen ON aussagen;
CREATE POLICY eigene_aussagen ON aussagen FOR ALL
  USING (EXISTS (SELECT 1 FROM auftraege a WHERE a.id = aussagen.auftrag_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM auftraege a WHERE a.id = aussagen.auftrag_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS eigene_aussage_belege ON aussage_belege;
CREATE POLICY eigene_aussage_belege ON aussage_belege FOR ALL
  USING (EXISTS (SELECT 1 FROM aussagen s JOIN auftraege a ON a.id = s.auftrag_id
                 WHERE s.id = aussage_belege.aussage_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM aussagen s JOIN auftraege a ON a.id = s.auftrag_id
                      WHERE s.id = aussage_belege.aussage_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS eigener_reifegrad_verlauf ON reifegrad_verlauf;
CREATE POLICY eigener_reifegrad_verlauf ON reifegrad_verlauf FOR ALL
  USING (EXISTS (SELECT 1 FROM aussagen s JOIN auftraege a ON a.id = s.auftrag_id
                 WHERE s.id = reifegrad_verlauf.aussage_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM aussagen s JOIN auftraege a ON a.id = s.auftrag_id
                      WHERE s.id = reifegrad_verlauf.aussage_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS eigene_analyse_laeufe ON analyse_laeufe;
CREATE POLICY eigene_analyse_laeufe ON analyse_laeufe FOR ALL
  USING (EXISTS (SELECT 1 FROM inhalte i JOIN quellen q ON q.id = i.quelle_id
                 JOIN auftraege a ON a.id = q.auftrag_id
                 WHERE i.id = analyse_laeufe.inhalt_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM inhalte i JOIN quellen q ON q.id = i.quelle_id
                      JOIN auftraege a ON a.id = q.auftrag_id
                      WHERE i.id = analyse_laeufe.inhalt_id AND a.user_id = auth.uid()));

-- api_schluessel und ingest_tokens erhalten bewusst KEINE Regel: verschlüsselte
-- KI-Schlüssel dürfen laut ARCHITEKTUR nie an den Browser gelangen, und ein
-- Ingest-Token wäre auslesbar ein Vollzugriff auf den Auftrag. Eingeschaltete
-- Zeilen-Sicherheit ohne Regel bedeutet: für anon und authenticated gesperrt.
-- Nur der Eigentümer (serverseitige Werkzeuge) kommt heran.
REVOKE ALL ON api_schluessel FROM anon, authenticated;
REVOKE ALL ON ingest_tokens  FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. dashboard_daten (ADR 0004, ADR 0005)
--
-- Der einzige Lesepfad der Oberfläche. Prüft den Zugriff selbst, damit die
-- Prüfung auch für direkte Aufrufe der Schnittstelle gilt. Die Form der
-- Antwort ist Vertrag: src/lib/supabase-daten.ts prüft sie gegen ein
-- zod-Schema und lehnt Abweichungen ab.
--
-- Die Graph-Regeln spiegeln src/lib/graph.ts: ein Punkt je Quelle mit
-- Beiträgen, Gewicht = Anzahl Beiträge, Ring bei offiziellen Quellen, Kante
-- von der Primärquelle einer Meldungsgruppe zu jeder Übernahme.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dashboard_daten(p_auftrag uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name          text;
  v_fragestellung text;
  v_user          uuid;
  v_demo          boolean;
  v_ergebnis      jsonb;
BEGIN
  SELECT name, fragestellung, user_id, oeffentliche_demo
    INTO v_name, v_fragestellung, v_user, v_demo
    FROM auftraege WHERE id = p_auftrag;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Auftrag nicht gefunden' USING ERRCODE = 'no_data_found';
  END IF;

  -- COALESCE ist hier Absicht und keine Kosmetik: ohne Anmeldung liefert
  -- auth.uid() NULL, damit wird "v_user = auth.uid()" zu NULL und ein
  -- schlichtes NOT (...) wäre ebenfalls NULL - die Prüfung würde nie
  -- auslösen und jeder Auftrag wäre öffentlich lesbar. Unbekannt heißt hier
  -- also ausdrücklich "kein Zugriff".
  IF NOT COALESCE(v_demo OR v_user = auth.uid(), false) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diesen Auftrag' USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH inhalt_quelle AS (
    SELECT i.id AS inhalt_id, q.id AS quelle_id, q.herausgeber, q.typ,
           ig.gruppe_id, ig.beziehung
      FROM inhalte i
      JOIN quellen q ON q.id = i.quelle_id
      LEFT JOIN inhalt_gruppen ig ON ig.inhalt_id = i.id
     WHERE q.auftrag_id = p_auftrag
  ),
  knoten AS (
    SELECT quelle_id, herausgeber, typ, count(DISTINCT inhalt_id)::int AS gewicht
      FROM inhalt_quelle
     GROUP BY quelle_id, herausgeber, typ
  ),
  primaer AS (
    SELECT DISTINCT ON (gruppe_id) gruppe_id, quelle_id
      FROM inhalt_quelle
     WHERE gruppe_id IS NOT NULL AND beziehung = 'primaer'
     ORDER BY gruppe_id, inhalt_id
  ),
  kanten AS (
    SELECT DISTINCT p.quelle_id AS von, iq.quelle_id AS nach, iq.beziehung AS art
      FROM inhalt_quelle iq
      JOIN primaer p ON p.gruppe_id = iq.gruppe_id
     WHERE iq.beziehung IS NOT NULL
       AND iq.beziehung <> 'primaer'
       AND p.quelle_id <> iq.quelle_id
  ),
  -- Nur aktive Quellen: Die Kennzahlen beschreiben den Betrieb. Eine bewusst
  -- abgeschaltete Quelle ist nicht "nicht erreichbar", und ihr letzter
  -- Fehlversuch von früher darf die Anzeige nicht dauerhaft rot färben.
  letzter_je_quelle AS (
    SELECT DISTINCT ON (a.quelle_id) a.quelle_id, a.status, a.gestartet_am
      FROM abrufe a
      JOIN quellen q ON q.id = a.quelle_id
     WHERE q.auftrag_id = p_auftrag AND q.aktiv = true
     ORDER BY a.quelle_id, a.gestartet_am DESC, a.id DESC
  ),
  bewertete_aussagen AS (
    SELECT s.id, s.sachverhalt, v.stufe, v.ausloeser, v.datum,
           (SELECT count(*)::int FROM aussage_belege b WHERE b.aussage_id = s.id) AS beleg_anzahl,
           COALESCE((
             SELECT jsonb_agg(DISTINCT q.herausgeber)
               FROM aussage_belege b
               JOIN inhalte i ON i.id = b.inhalt_id
               JOIN quellen q ON q.id = i.quelle_id
              WHERE b.aussage_id = s.id
           ), '[]'::jsonb) AS herausgeber
      FROM aussagen s
      JOIN LATERAL (
        SELECT r.stufe, r.ausloeser, r.datum
          FROM reifegrad_verlauf r
         WHERE r.aussage_id = s.id
         ORDER BY r.datum DESC, r.id DESC
         LIMIT 1
      ) v ON true
     WHERE s.auftrag_id = p_auftrag
  )
  SELECT jsonb_build_object(
    'auftrag', jsonb_build_object(
      'id', p_auftrag, 'name', v_name, 'fragestellung', v_fragestellung
    ),
    'kennzahlen', jsonb_build_object(
      'quellen',      (SELECT count(*)::int FROM quellen WHERE auftrag_id = p_auftrag AND aktiv = true),
      'quellenFehler',(SELECT count(*)::int FROM letzter_je_quelle WHERE status = 'fehler'),
      'inhalte',      (SELECT count(DISTINCT inhalt_id)::int FROM inhalt_quelle),
      'aussagen',     (SELECT count(*)::int FROM aussagen WHERE auftrag_id = p_auftrag),
      'letzterAbruf', (SELECT max(gestartet_am) FROM letzter_je_quelle)
    ),
    'knoten', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', quelle_id, 'label', herausgeber, 'quellentyp', typ,
        'gewicht', gewicht,
        'offiziell', typ IN ('hersteller_offiziell', 'status_seite')
      ) ORDER BY gewicht DESC, herausgeber) FROM knoten
    ), '[]'::jsonb),
    'kanten', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('von', von, 'nach', nach, 'art', art)) FROM kanten
    ), '[]'::jsonb),
    'aussagen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'sachverhalt', sachverhalt, 'stufe', stufe,
        'ausloeser', ausloeser, 'belegAnzahl', beleg_anzahl,
        'herausgeber', herausgeber, 'seit', datum
      ) ORDER BY stufe DESC, datum DESC) FROM bewertete_aussagen
    ), '[]'::jsonb)
  ) INTO v_ergebnis;

  RETURN v_ergebnis;
END;
$$;

COMMENT ON FUNCTION public.dashboard_daten(uuid) IS
  'ADR 0005: einziger Lesepfad der Oberfläche. Prüft den Zugriff selbst.';

-- ---------------------------------------------------------------------------
-- 5. inhalt_einliefern (ADR 0002 Punkt 2, ADR 0007)
--
-- Externe Sammler liefern mit auftrag-gebundenem Token ein. Der Token ist das
-- einzige Geheimnis und wird nur als SHA-256-Hash gespeichert. Eingelieferte
-- Inhalte laufen durch dieselbe Dublettenerkennung wie selbst abgerufene: der
-- Hash entsteht nach genau derselben Regel wie in src/lib/dedup.ts
-- (Titel, Zeilenumbruch, Auszug -> Kleinschreibung -> Leerraum vereinheitlicht).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.inhalt_einliefern(
  p_token   text,
  p_quelle  jsonb,
  p_inhalte jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auftrag uuid;
  v_quelle  uuid;
  v_neu     int := 0;
  v_gesamt  int := 0;
  v_hash    text;
  v_id      uuid;
  e         jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 24 THEN
    RAISE EXCEPTION 'Token fehlt oder ist zu kurz' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT auftrag_id INTO v_auftrag
    FROM ingest_tokens
   WHERE aktiv = true
     AND token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  IF v_auftrag IS NULL THEN
    RAISE EXCEPTION 'Token unbekannt oder abgeschaltet' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_quelle->>'url' IS NULL OR p_quelle->>'herausgeber' IS NULL THEN
    RAISE EXCEPTION 'quelle braucht url und herausgeber' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF jsonb_typeof(p_inhalte) <> 'array' OR jsonb_array_length(p_inhalte) = 0 THEN
    RAISE EXCEPTION 'inhalte muss eine nicht leere Liste sein' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF jsonb_array_length(p_inhalte) > 50 THEN
    RAISE EXCEPTION 'höchstens 50 Inhalte je Anfrage' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Quelle des Sammlers: als 'extern_agent' gekennzeichnet und in der
  -- Vertrauensbasis entsprechend eingestuft (Konsequenz aus ADR 0002).
  INSERT INTO quellen (auftrag_id, url, typ, herausgeber, vertrauens_basis)
  VALUES (v_auftrag, p_quelle->>'url', 'extern_agent', p_quelle->>'herausgeber', 'eingeliefert_extern')
  ON CONFLICT (auftrag_id, url) DO UPDATE SET herausgeber = EXCLUDED.herausgeber
  RETURNING id INTO v_quelle;

  FOR e IN SELECT * FROM jsonb_array_elements(p_inhalte) LOOP
    v_gesamt := v_gesamt + 1;

    IF e->>'url' IS NULL OR e->>'titel' IS NULL OR e->>'auszug' IS NULL THEN
      RAISE EXCEPTION 'jeder Inhalt braucht url, titel und auszug'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_hash := encode(sha256(convert_to(
      btrim(regexp_replace(lower((e->>'titel') || E'\n' || (e->>'auszug')), '\s+', ' ', 'g')),
      'utf8')), 'hex');

    v_id := NULL;
    INSERT INTO inhalte (quelle_id, url, titel, autor, veroeffentlicht_am, auszug, inhalt_hash)
    VALUES (v_quelle, e->>'url', e->>'titel', e->>'autor',
            (e->>'veroeffentlichtAm')::timestamptz, e->>'auszug', v_hash)
    ON CONFLICT (quelle_id, inhalt_hash) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
      v_neu := v_neu + 1;
    END IF;
  END LOOP;

  -- Einlieferung wie einen Abruf protokollieren, damit sie im Betrieb
  -- genauso sichtbar ist wie ein eigener Sammellauf.
  INSERT INTO abrufe (quelle_id, status, neue_inhalte) VALUES (v_quelle, 'ok', v_neu);

  RETURN jsonb_build_object(
    'auftrag', v_auftrag,
    'quelle', v_quelle,
    'angenommen', v_neu,
    'uebersprungen', v_gesamt - v_neu
  );
END;
$$;

COMMENT ON FUNCTION public.inhalt_einliefern(text, jsonb, jsonb) IS
  'ADR 0002/0007: Einlieferung externer Sammler, Token-geprüft in der Datenbank.';

-- Nur die beiden Funktionen sind von außen erreichbar - kein direkter
-- Tabellenzugriff für die Anwendung (ADR 0005).
GRANT EXECUTE ON FUNCTION public.dashboard_daten(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inhalt_einliefern(text, jsonb, jsonb) TO anon, authenticated;
