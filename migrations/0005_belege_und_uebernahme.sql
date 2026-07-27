-- Migration 0005: Belege im Dashboard, Demo-Aufträge übernehmen (ADR 0010)
--
-- Drei Lücken aus der ersten Nutzung:
--
-- 1. Die Aussagenliste nannte nur Zahl und Herausgeber der Belege. Ohne Datum
--    und ohne Verweis ließ sich nichts nachprüfen - eine Plattform, die
--    Belege verspricht, muss sie zeigen. Das Anklicken einer Aussage bewirkte
--    entsprechend nichts Sichtbares.
-- 2. Ein freigegebener Demo-Auftrag ließ sich nicht übernehmen. Er gehört
--    einem anderen Konto, die Zeilen-Sicherheit sperrt ihn also zu Recht -
--    aber die Oberfläche verwies auf ihn, als sei er zu bearbeiten.
-- 3. Für die KI-Unterstützung braucht der Server den hinterlegten Zugang.
--
-- Wiederholbar geschrieben (CREATE OR REPLACE), damit sie auf der bereits
-- laufenden Datenbank durchläuft.

-- ---------------------------------------------------------------------------
-- 1. dashboard_daten liefert die Belege mit
--
-- Neu gegenüber Migration 0002 ist ausschließlich das Feld 'belege' je
-- Aussage. Alles andere bleibt Wort für Wort gleich, damit die Änderung
-- prüfbar bleibt.
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
  -- auslösen und jeder Auftrag wäre öffentlich lesbar.
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
  letzter_je_quelle AS (
    SELECT DISTINCT ON (a.quelle_id) a.quelle_id, a.status, a.gestartet_am
      FROM abrufe a
      JOIN quellen q ON q.id = a.quelle_id
     WHERE q.auftrag_id = p_auftrag AND q.aktiv = true
     ORDER BY a.quelle_id, a.gestartet_am DESC, a.id DESC
  ),
  bewertete_aussagen AS (
    SELECT s.id, s.sachverhalt, s.kontext, v.stufe, v.ausloeser, v.datum,
           (SELECT count(*)::int FROM aussage_belege b WHERE b.aussage_id = s.id) AS beleg_anzahl,
           COALESCE((
             SELECT jsonb_agg(DISTINCT q.herausgeber)
               FROM aussage_belege b
               JOIN inhalte i ON i.id = b.inhalt_id
               JOIN quellen q ON q.id = i.quelle_id
              WHERE b.aussage_id = s.id
           ), '[]'::jsonb) AS herausgeber,
           -- Neu: die Belege selbst. Ohne Verweis und Datum ist eine
           -- Belegangabe nicht nachprüfbar und damit wertlos.
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'inhaltId',        i.id,
                      'titel',           i.titel,
                      'url',             i.url,
                      'herausgeber',     q.herausgeber,
                      'quellentyp',      q.typ,
                      'veroeffentlichtAm', i.veroeffentlicht_am,
                      'belegstelle',     b.belegstelle,
                      'beziehung',       COALESCE(ig.beziehung, 'primaer'),
                      'klassifikation',  b.klassifikation
                    ) ORDER BY i.veroeffentlicht_am NULLS LAST, i.titel)
               FROM aussage_belege b
               JOIN inhalte i ON i.id = b.inhalt_id
               JOIN quellen q ON q.id = i.quelle_id
               LEFT JOIN inhalt_gruppen ig ON ig.inhalt_id = i.id
              WHERE b.aussage_id = s.id
           ), '[]'::jsonb) AS belege
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
        'herausgeber', herausgeber, 'seit', datum,
        'kontext', kontext, 'belege', belege
      ) ORDER BY stufe DESC, datum DESC) FROM bewertete_aussagen
    ), '[]'::jsonb)
  ) INTO v_ergebnis;

  RETURN v_ergebnis;
END;
$$;

COMMENT ON FUNCTION public.dashboard_daten(uuid) IS
  'ADR 0005/0010: Einziger Datenweg der Oberfläche. Prüft den Zugriff selbst und liefert die Belege je Aussage mit Verweis und Datum.';

-- ---------------------------------------------------------------------------
-- 2. Einen freigegebenen Auftrag ins eigene Konto übernehmen
--
-- Warum eine Funktion und keine Zugriffsregel: Gelesen wird ein fremder
-- Auftrag (erlaubt, weil freigegeben), geschrieben wird ein eigener. Eine
-- Regel kann nur eines von beidem. Kopiert werden Auftrag und Quellen -
-- ausdrücklich keine Inhalte und keine Aussagen: Der übernommene Auftrag
-- sammelt selbst, statt fremde Ergebnisse zu erben.
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
  -- Nur freigegebene Aufträge sind übernehmbar. Ein fremder, nicht
  -- freigegebener Auftrag bleibt unsichtbar - auch für diese Funktion.
  IF NOT v_demo THEN
    RAISE EXCEPTION 'Dieser Auftrag ist nicht freigegeben' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ein freier Name. Aufträge sind je Konto eindeutig benannt; ohne diese
  -- Schleife scheiterte die zweite Übernahme an einer Schlüsselverletzung und
  -- die Nutzerin sähe eine rohe Datenbankmeldung statt eines Ergebnisses.
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
    pflichtbegriffe, ausschlussbegriffe, mindest_treffer, intervall_minuten,
    aktiv, oeffentliche_demo
  )
  SELECT v_nutzer, v_ziel, a.zielbeschreibung, a.fragestellung,
         a.suchbegriffe, a.pflichtbegriffe, a.ausschlussbegriffe, a.mindest_treffer,
         a.intervall_minuten, a.aktiv,
         -- Die Kopie ist nicht von selbst öffentlich. Freigeben ist eine
         -- eigene Entscheidung des neuen Besitzers.
         false
    FROM auftraege a WHERE a.id = p_auftrag
  RETURNING id INTO v_neu;

  INSERT INTO quellen (auftrag_id, url, typ, herausgeber, aktiv, themenspezifisch)
  SELECT v_neu, q.url, q.typ, q.herausgeber, q.aktiv, q.themenspezifisch
    FROM quellen q WHERE q.auftrag_id = p_auftrag;

  RETURN v_neu;
END;
$$;

COMMENT ON FUNCTION public.auftrag_uebernehmen(uuid) IS
  'ADR 0010: Kopiert einen freigegebenen Auftrag samt Quellen ins eigene Konto. Ohne Inhalte und Aussagen.';

-- ---------------------------------------------------------------------------
-- 3. Hinterlegten KI-Zugang für den Server lesbar machen
--
-- Gibt den Schlüssel ausschließlich in verschlüsselter Form heraus und
-- ausschließlich an seinen Besitzer. Entschlüsseln kann ihn nur, wer
-- BYOK_ENCRYPTION_KEY kennt - und der Wert liegt allein auf dem Server,
-- niemals im Browser (ADR 0009). Der Besitzer erhält damit nichts, was er
-- nicht ohnehin selbst hinterlegt hat.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.api_schluessel_geheim()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nutzer uuid := auth.uid();
  v_ergebnis jsonb;
BEGIN
  IF v_nutzer IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
           'anbieter', anbieter,
           'endpunktUrl', endpunkt_url,
           'verschluesselt', schluessel_verschluesselt
         )
    INTO v_ergebnis
    FROM api_schluessel WHERE user_id = v_nutzer;

  IF v_ergebnis IS NULL THEN
    RAISE EXCEPTION 'Kein KI-Zugang hinterlegt' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v_ergebnis;
END;
$$;

COMMENT ON FUNCTION public.api_schluessel_geheim() IS
  'ADR 0010: Liefert den eigenen KI-Zugang verschlüsselt. Entschlüsselbar nur mit BYOK_ENCRYPTION_KEY auf dem Server.';

-- ---------------------------------------------------------------------------
-- 4. Rechte
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.auftrag_uebernehmen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_schluessel_geheim() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.auftrag_uebernehmen(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.api_schluessel_geheim() FROM anon;
