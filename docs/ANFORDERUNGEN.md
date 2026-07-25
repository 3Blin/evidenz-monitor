# Anforderungen: Evidenz-Monitor
Stand: 24.07.2026 · Freigegeben von: — (ausstehend, Tor 0)

## Zweck
Eine Plattform, mit der Nutzer Beobachtungswünsche in Alltagssprache beschreiben
("Beobachte Probleme mit Windows 11 25H2 auf Intel-Netzwerkadaptern").
Das System macht daraus einen strukturierten Beobachtungsauftrag, ruft Quellen
regelmäßig ab, erkennt neue und doppelte Meldungen, extrahiert Aussagen,
bewertet deren Belastbarkeit (Reifegrad) und zeigt alles in einem Dashboard:
Quellen als Netz-Graph, Bewertung rechts daneben.

Leitprinzip: Das System behauptet nicht, die Wahrheit zu kennen. Es zeigt
transparent, wer was wann behauptet, was unabhängig bestätigt ist, wo
Widersprüche liegen und wie sich Bewertungen verändert haben. Jede Aussage
ist auf ihre Quellen zurückführbar.

**Themenneutraler Kern (verbindlich):** Ein Beobachtungsauftrag ist ein
Datensatz (Thema, Fragestellung, Quellen, Suchbegriffe, Regeln, Dashboard-
Konfiguration) — niemals Code. Windows 11 ist nur der erste angelegte
Auftrag; das System selbst kennt kein Thema. Neue Anwendungsfälle
(Wetterlage, Preise, Ferienhäuser, Sicherheitsmeldungen ...) entstehen
durch neue Aufträge, nicht durch Umprogrammierung.

**KI-Integration (verbindlich, Bring Your Own Key):** Der Nutzer hinterlegt
seinen eigenen KI-API-Schlüssel (z. B. Anthropic/OpenAI/lokaler Endpunkt).
Arbeitsteilung:
- Die KI (mit einem festen Analyse-Prompt als geprüftem Systembaustein)
  liest Quelleninhalte und extrahiert strukturierte Aussagen samt
  Klassifikationen: "Kopie/Übernahme von X", "unabhängige Bestätigung",
  "offizielle Bestätigung", "Widerspruch zu Y".
- Deterministische Regeln zählen daraus unabhängige Quellen, prüfen
  Bedingungen und vergeben den Reifegrad (8 Stufen) — reproduzierbar,
  begründet, mit dokumentiertem Auslöser. Die KI vergibt Stufen nie allein.
- Der Analyse-Prompt ist versioniert und Teil der Systemdokumentation.

Vollständige Fachanforderung: siehe `ANFORDERUNGEN-LANGFASSUNG.md`
(vom Nutzer übergebenes Originaldokument, gilt als Zielbild).

## Nutzer
Eric + wenige Bekannte (ca. 2–10 Personen). In 2 Jahren ggf. mehr —
Mehrbenutzerfähigkeit mit Anmeldung ist daher von Anfang an Pflicht.

## Daten
| Datenart | Personenbezogen? | Besonders schützenswert? |
|----------|------------------|--------------------------|
| Beobachtungsaufträge | ja (Nutzerinteressen) | mittel |
| Abgerufene öffentliche Quelleninhalte | i. d. R. nein | Urheberrecht beachten (Auszüge, Quellenlink) |
| Nutzerkonten (Name/E-Mail, Passwort-Hash) | ja | ja |
| KI-API-Schlüssel der Nutzer | ja | ja (verschlüsselt speichern, nie loggen) |
| KI-API-Schlüssel der Nutzer | ja | ja — verschlüsselte Speicherung Pflicht |
| Bewertungen/Verläufe (systemgeneriert) | nein | nein |

Datenschutz-Einstufung: DSGVO-relevant (Konten, Interessenprofile).
Rechtliches: Quellenabruf nur im Rahmen von API-/Plattformbedingungen;
revisionssichere Auszüge statt Volltextkopien, immer mit Quellenlink.

## Zugriff & Geräte
Übers Internet erreichbar (HTTPS, Anmeldung Pflicht). Browser auf PC und
Handy (responsiv). Später native App iOS/Android — die Weboberfläche
spricht deshalb von Anfang an nur über eine saubere API mit dem Server,
damit eine App dieselbe API nutzen kann.

## Bestand & Anbindungen
Kein Altsystem. Quellen der ersten Ausbaustufe — bewusst beide Enden der
Reifegrad-Leiter:
- **Frühwarnkanäle (Stufe 1–3):** Reddit per offiziellem RSS (r/Windows11,
  r/WindowsHelp, r/sysadmin), Windows-Community-Foren mit Feeds
  (z. B. ElevenForum), Microsoft Tech Community, Hacker News.
- **Bestätigungskanäle (Stufe 5–7):** Microsoft Release Health,
  Microsoft Support/MSRC, Hardwarehersteller.
- **Einordnung (dazwischen):** 2–3 Fachmedien per RSS.
- Manuell hinterlegte RSS-Feeds/Webseiten jederzeit ergänzbar.
Kanäle mit Login-/Cookie-Zwang (X, geschlossene Gruppen) laufen nicht im
Kern, sondern über die Ingest-API externer Sammler (ADR 0002).

## Erfolgskriterien
1. ≥ 80 % der relevanten offiziellen Windows-Meldungen werden erkannt.
2. Wiederveröffentlichungen werden zuverlässig gruppiert (keine Mehrfachzählung als "unabhängige Bestätigung").
3. Jede wesentliche Aussage ist mit Quelle(n) verknüpft; Verlauf nachvollziehbar.
4. Offizielle Bestätigungen verändern den Reifegrad korrekt.
5. Die wichtigsten Entwicklungen sind in wenigen Minuten erfassbar.
6. Wenige irrelevante Benachrichtigungen (tauglich für täglichen Betrieb).
7. Neuer Beobachtungsauftrag ohne Programmierung konfigurierbar.

## Nicht-Ziele (Version 1)
- Kein unbegrenztes Durchsuchen beliebiger Websites (rechtliche/technische Grenzen).
- Keine autonomen Käufe oder verbindlichen Aktionen.
- Keine Wahrheitsgarantie; keine Aussagen ohne Quellenkette.
- Keine frei von der KI programmierten Oberflächen: Die KI erzeugt nur
  einen kontrollierten Beobachtungsplan und eine deklarative
  Dashboard-Konfiguration; Datensammler, Bewertungslogik und Widgets
  sind geprüfte, feste Systembausteine.
- Keine allgemeine Agentenplattform.

## Optik (Design-Anforderung)
Dunkles, modernes Dashboard nach übergebenem Vorbild:
- Oben: Bezeichnung des Beobachtungsauftrags + Status.
- Mitte/links: Quellen-Netz-Graph — jede Quelle ein Punkt, Verbindungen
  zeigen Quellverkehr/Verlinkung (wer übernimmt von wem), Farbe/Markierung
  nach Quellentyp und Status.
- Rechts: Bewertungspanel — Aussagen mit Reifegrad, Evidenzbegründung,
  Verlauf, Widersprüche.

## KI-Integration (Kernbestandteil, nicht optional)
- **Bring your own API key**: Jeder Nutzer hinterlegt seinen eigenen
  KI-Schlüssel (Anthropic- oder OpenAI-kompatibler Endpunkt, konfigurierbar).
  Schlüssel werden verschlüsselt gespeichert; Kosten laufen pro Nutzer.
- Die KI wird an **definierten Stellen** mit **versionierten Systemprompts**
  eingesetzt (Prompts sind Konfigurationsdateien, nicht Code):
  1. Auftragsersteller: Alltagssprache → strukturierter Beobachtungsauftrag
     (Nutzer prüft und bearbeitet vor Aktivierung).
  2. Inhaltsanalysator: Quelltext → strukturierte Aussage (Sachverhalt,
     Entitäten, Zeitpunkt, Primärquelle/Übernahme, Belegstelle).
- Der **Reifegrad (8 Stufen) wird deterministisch berechnet** aus den
  strukturierten KI-Ausgaben (z. B. Anzahl unabhängiger Quellen, offizielle
  Bestätigung ja/nein) — reproduzierbar, begründbar, jede Änderung
  protokolliert. Kein freies "Prompt-Scoring".
- Themenunabhängigkeit: Kein Anwendungsfall wird fest verdrahtet.
  Windows 11 ist nur der erste Beispielauftrag zum Testen.

## MVP-Umfang — heutiger Kern-Slice (Probe)
1. Anmeldung + Hinterlegen des eigenen KI-Schlüssels (verschlüsselt)
2. Beobachtungsauftrag aus Alltagssprache erzeugen lassen, prüfen,
   aktivieren (Beispiel: "Windows 11 Updates & bekannte Probleme")
3. Quellen abrufen (RSS/Web), neue Inhalte erkennen, Duplikate gruppieren
4. KI-Aussagen-Extraktion + deterministische Reifegrad-Berechnung
   mit dokumentiertem Verlauf (nichts wird überschrieben)
5. Dashboard: Titel oben, Quellen-Graph, Bewertungspanel rechts (Hypefy-Stil)

## Später denkbar (nicht Teil des Kern-Slice)
- KI-Quellenfinder: schlägt zu einem Auftrag passende Quellen vor (immer Vorschlag mit Nutzer-Bestätigung, nie Autoaktivierung)
- Weitere Zugangsweg-Adapter bei realem Bedarf (APIs, Preise, Wetter, Karten), weitere Widgets
- Benachrichtigungsregeln, Eskalationen, Kostenlimits pro Auftrag
- Widerspruchserkennung automatisiert, Handlungsempfehlungen
- Native Apps iOS/Android
