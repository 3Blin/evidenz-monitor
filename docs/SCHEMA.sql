-- SCHEMA.sql — Fixiertes Datenmodell Evidenz-Monitor (Vertrag, Phase 1)
-- Änderungen NUR über Migrationen + ADR. Stand: 25.07.2026
-- Nutzerkonten selbst liegen in Supabase Auth (auth.users); hier nur Verweise.
--
-- Diese Datei beschreibt die Tabellen. Zeilen-Sicherheit und die
-- Datenbankfunktionen (dashboard_daten, inhalt_einliefern) stehen in
-- migrations/0002_zeilensicherheit_und_datenbankfunktionen.sql — sie gehören
-- laut ADR 0006 genauso in Migrationen wie die Tabellen selbst.

-- Beobachtungsauftrag: themenneutraler Datensatz, KEIN Code.
CREATE TABLE auftraege (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,            -- Besitzer (auth.users.id)
  name          TEXT NOT NULL,            -- eindeutiger Anzeigename
  zielbeschreibung TEXT NOT NULL,         -- Alltagssprache
  fragestellung TEXT NOT NULL,
  suchbegriffe  TEXT[] NOT NULL DEFAULT '{}',
  sprachen      TEXT[] NOT NULL DEFAULT '{de,en}',
  intervall_minuten INT NOT NULL DEFAULT 360 CHECK (intervall_minuten >= 15),
  aktiv         BOOLEAN NOT NULL DEFAULT true,
  dashboard_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- deklarative Widget-Konfig (Schema in docs/dashboard-config.schema.json)
  oeffentliche_demo BOOLEAN NOT NULL DEFAULT false, -- ohne Anmeldung lesbar (ADR 0004), nachgetragen in Migration 0002
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Quelle: Woher Informationen kommen. Zweck: Metadatenpflicht aus Anforderung 4.2.
CREATE TABLE quellen (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id    UUID NOT NULL REFERENCES auftraege(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  typ           TEXT NOT NULL CHECK (typ IN
    ('hersteller_offiziell','status_seite','fachmedium','forum','community',
     'rss','api','extern_agent','nutzer_dokument','sonstige')),
  herausgeber   TEXT NOT NULL,
  sprache       TEXT NOT NULL DEFAULT 'de',
  geo_bezug     TEXT,
  vertrauens_basis TEXT NOT NULL DEFAULT 'unbewertet', -- Grundeinstufung, begründet
  aktiv         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (auftrag_id, url)
);

-- Abruf: jeder Sammellauf pro Quelle (Fehlertoleranz: Ausfall je Quelle sichtbar).
CREATE TABLE abrufe (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quelle_id     UUID NOT NULL REFERENCES quellen(id) ON DELETE CASCADE,
  gestartet_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL CHECK (status IN ('ok','fehler','uebersprungen')),
  http_status   INT,
  fehler_text   TEXT,
  neue_inhalte  INT NOT NULL DEFAULT 0
);

-- Inhalt: revisionssicherer Auszug einer abgerufenen Veröffentlichung.
CREATE TABLE inhalte (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quelle_id     UUID NOT NULL REFERENCES quellen(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  titel         TEXT NOT NULL,
  autor         TEXT,
  veroeffentlicht_am TIMESTAMPTZ,
  abgerufen_am  TIMESTAMPTZ NOT NULL DEFAULT now(),
  auszug        TEXT NOT NULL,            -- Auszug, kein Volltext (Urheberrecht)
  inhalt_hash   TEXT NOT NULL,            -- exakte Dublettenerkennung
  verarbeitungsstatus TEXT NOT NULL DEFAULT 'neu'
    CHECK (verarbeitungsstatus IN ('neu','analysiert','fehler','ignoriert')),
  UNIQUE (quelle_id, inhalt_hash)
);

-- Meldungsgruppe: inhaltlich zusammengehörige Veröffentlichungen (Dedup 4.3).
CREATE TABLE meldungsgruppen (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id    UUID NOT NULL REFERENCES auftraege(id) ON DELETE CASCADE,
  kanonischer_titel TEXT NOT NULL,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zuordnung Inhalt→Gruppe mit Beziehung (Primärinfo/Übernahme/... aus 4.3).
CREATE TABLE inhalt_gruppen (
  inhalt_id     UUID NOT NULL REFERENCES inhalte(id) ON DELETE CASCADE,
  gruppe_id     UUID NOT NULL REFERENCES meldungsgruppen(id) ON DELETE CASCADE,
  beziehung     TEXT NOT NULL CHECK (beziehung IN
    ('primaer','uebernahme','zusammenfassung','zitat',
     'unabhaengige_bestaetigung','verdaechtig_automatisiert')),
  begruendung   TEXT NOT NULL,            -- KI-Klassifikation, nachvollziehbar
  PRIMARY KEY (inhalt_id, gruppe_id)
);

-- Aussage: strukturierte Behauptung (4.4). Bewertung NICHT hier —
-- Reifegrad lebt ausschließlich im append-only Verlauf.
CREATE TABLE aussagen (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id    UUID NOT NULL REFERENCES auftraege(id) ON DELETE CASCADE,
  sachverhalt   TEXT NOT NULL,
  entitaeten    TEXT[] NOT NULL DEFAULT '{}',
  zeitraum_von  TIMESTAMPTZ,
  zeitraum_bis  TIMESTAMPTZ,
  kontext       TEXT,
  moegliche_ursache TEXT,
  moegliche_auswirkung TEXT,
  gegenmassnahmen TEXT,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Beleg: welche Quelle stützt welche Aussage wie (Transparenzpflicht Kap. 5).
CREATE TABLE aussage_belege (
  aussage_id    UUID NOT NULL REFERENCES aussagen(id) ON DELETE CASCADE,
  inhalt_id     UUID NOT NULL REFERENCES inhalte(id) ON DELETE CASCADE,
  belegstelle   TEXT NOT NULL,            -- Zitat-/Fundstelle im Auszug
  klassifikation TEXT NOT NULL CHECK (klassifikation IN
    ('stuetzt','widerspricht','offizielle_bestaetigung','offizielle_widerlegung',
     'workaround','korrektur')),
  erfasst_am    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (aussage_id, inhalt_id)
);

-- Reifegrad-Verlauf: append-only. Frühere Bewertungen werden NIE geändert (4.6/4.7).
CREATE TABLE reifegrad_verlauf (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aussage_id    UUID NOT NULL REFERENCES aussagen(id) ON DELETE CASCADE,
  stufe         INT NOT NULL CHECK (stufe BETWEEN 1 AND 8),
  -- 1 Einzelhinweis 2 mehrfach 3 Trend 4 techn. plausibel
  -- 5 unabh. bestätigt 6 offiziell bestätigt 7 behoben 8 widerlegt
  ausloeser     TEXT NOT NULL,            -- regelbasierte Begründung
  ausloeser_inhalt_id UUID REFERENCES inhalte(id),
  regel_version TEXT NOT NULL,            -- Version des Regelwerks
  datum         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KI-Analyse-Läufe: Nachvollziehbarkeit + Kostenkontrolle (7.7).
CREATE TABLE analyse_laeufe (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inhalt_id     UUID NOT NULL REFERENCES inhalte(id) ON DELETE CASCADE,
  prompt_version TEXT NOT NULL,
  modell        TEXT NOT NULL,
  eingabe_tokens INT, ausgabe_tokens INT,
  status        TEXT NOT NULL CHECK (status IN ('ok','fehler')),
  fehler_text   TEXT,
  gestartet_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BYOK: KI-Schlüssel je Nutzer, verschlüsselt (nie im Klartext, nie in Logs).
CREATE TABLE api_schluessel (
  user_id       UUID PRIMARY KEY,         -- auth.users.id
  anbieter      TEXT NOT NULL CHECK (anbieter IN ('anthropic','openai','kompatibel')),
  endpunkt_url  TEXT,                     -- für kompatible/lokale Endpunkte
  schluessel_verschluesselt TEXT NOT NULL,
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security: jeder Nutzer sieht nur eigene Aufträge. Aktiviert für
-- alle zwölf Tabellen in Migration 0002 (ADR 0006). api_schluessel und
-- ingest_tokens haben bewusst keine Regel und sind damit für die Anwendung
-- vollständig gesperrt.

-- Ingest-Token: erlaubt externen Sammlern das Einliefern in genau einen
-- Auftrag (ADR 0002). Token wird nur als Hash gespeichert.
CREATE TABLE ingest_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id    UUID NOT NULL REFERENCES auftraege(id) ON DELETE CASCADE,
  bezeichnung   TEXT NOT NULL,            -- z. B. "Hermes-Sammler"
  token_hash    TEXT NOT NULL,
  aktiv         BOOLEAN NOT NULL DEFAULT true,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);
