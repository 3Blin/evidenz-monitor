-- Migration 0004: Bausteine für Anmeldung und Verwaltung (ADR 0009)
--
-- Zwei Dinge, die die Zeilen-Sicherheit aus Migration 0002 nicht leisten kann
-- und die deshalb Datenbankfunktionen brauchen:
--
-- 1. Die Liste der öffentlich lesbaren Aufträge. Ohne Anmeldung sperrt die
--    Zeilen-Sicherheit die Tabelle vollständig - die Auswahl der Demos muss
--    also über eine Funktion laufen, die genau diese Aufträge freigibt und
--    sonst nichts (kein user_id, keine Suchbegriffe).
-- 2. Das Hinterlegen des KI-Schlüssels. api_schluessel hat bewusst keine
--    Zugriffsregel (ADR 0006), ist also auch für den Besitzer über die
--    Schnittstelle gesperrt. Nur so kann der verschlüsselte Schlüssel nie im
--    Browser landen.
--
-- Alles andere - Aufträge und Quellen bearbeiten - läuft über die vorhandenen
-- Zugriffsregeln. Dort ist die Zeilen-Sicherheit der Schutz und braucht keine
-- zusätzliche Funktion.

-- ---------------------------------------------------------------------------
-- 1. Öffentlich lesbare Aufträge auflisten
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.oeffentliche_auftraege()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'id', a.id, 'name', a.name, 'fragestellung', a.fragestellung
    ) ORDER BY a.erstellt_am),
    '[]'::jsonb)
    FROM auftraege a
   WHERE a.oeffentliche_demo = true AND a.aktiv = true;
$$;

COMMENT ON FUNCTION public.oeffentliche_auftraege() IS
  'ADR 0009: Auswahlliste der ohne Anmeldung lesbaren Aufträge. Gibt nur Kennung, Name und Fragestellung heraus.';

-- ---------------------------------------------------------------------------
-- 2. KI-Schlüssel hinterlegen und Zustand abfragen
--
-- Der Schlüssel kommt hier bereits verschlüsselt an. Verschlüsselt wird
-- serverseitig in der Anwendung, weil nur dort BYOK_ENCRYPTION_KEY liegt -
-- niemals im Browser.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.api_schluessel_speichern(
  p_anbieter     text,
  p_endpunkt_url text,
  p_verschluesselt text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nutzer uuid := auth.uid();
BEGIN
  IF v_nutzer IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_anbieter NOT IN ('anthropic', 'openai', 'kompatibel') THEN
    RAISE EXCEPTION 'Unbekannter Anbieter' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_verschluesselt IS NULL OR length(p_verschluesselt) < 16 THEN
    RAISE EXCEPTION 'Kein verschlüsselter Schlüssel übergeben'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO api_schluessel (user_id, anbieter, endpunkt_url, schluessel_verschluesselt)
  VALUES (v_nutzer, p_anbieter, p_endpunkt_url, p_verschluesselt)
  ON CONFLICT (user_id) DO UPDATE
     SET anbieter = EXCLUDED.anbieter,
         endpunkt_url = EXCLUDED.endpunkt_url,
         schluessel_verschluesselt = EXCLUDED.schluessel_verschluesselt,
         aktualisiert_am = now();
END;
$$;

COMMENT ON FUNCTION public.api_schluessel_speichern(text, text, text) IS
  'ADR 0009: Nimmt den bereits verschlüsselten KI-Schlüssel des angemeldeten Nutzers auf.';

-- Zustand, nicht Inhalt: ob ein Schlüssel hinterlegt ist, für welchen Anbieter
-- und seit wann. Der Schlüssel selbst wird nie herausgegeben (Vertrag der
-- Architektur), auch nicht verschlüsselt.
CREATE OR REPLACE FUNCTION public.api_schluessel_zustand()
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
           'hinterlegt', true,
           'anbieter', anbieter,
           'endpunktUrl', endpunkt_url,
           'aktualisiertAm', aktualisiert_am
         )
    INTO v_ergebnis
    FROM api_schluessel WHERE user_id = v_nutzer;

  RETURN COALESCE(v_ergebnis, jsonb_build_object(
    'hinterlegt', false, 'anbieter', NULL, 'endpunktUrl', NULL, 'aktualisiertAm', NULL));
END;
$$;

COMMENT ON FUNCTION public.api_schluessel_zustand() IS
  'ADR 0009: Meldet, ob ein KI-Schlüssel hinterlegt ist - nie den Schlüssel selbst.';

CREATE OR REPLACE FUNCTION public.api_schluessel_entfernen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nutzer uuid := auth.uid();
BEGIN
  IF v_nutzer IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM api_schluessel WHERE user_id = v_nutzer;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Rechte
--
-- oeffentliche_auftraege darf auch ohne Anmeldung aufgerufen werden, die
-- Schlüsselfunktionen nur angemeldet - sie prüfen das zusätzlich selbst, damit
-- ein falsch gesetztes Recht nicht ausreicht.
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.oeffentliche_auftraege() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_schluessel_speichern(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_schluessel_zustand() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_schluessel_entfernen() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.api_schluessel_speichern(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.api_schluessel_zustand() FROM anon;
REVOKE EXECUTE ON FUNCTION public.api_schluessel_entfernen() FROM anon;

-- Die Oberfläche bearbeitet Aufträge und Quellen über die Tabellen; dort
-- entscheidet die Zeilen-Sicherheit. Ohne diese Rechte käme auch der Besitzer
-- nicht heran (auf Supabase sind sie voreingestellt, lokal nicht).
GRANT SELECT, INSERT, UPDATE, DELETE ON auftraege, quellen TO authenticated;
GRANT SELECT ON abrufe, inhalte TO authenticated;
