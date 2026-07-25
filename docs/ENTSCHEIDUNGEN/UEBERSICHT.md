# Entscheidungen im Überblick

- **0001 Technologiewahl:** Next.js mit TypeScript, Supabase (verwaltete
  Datenbank mit fertiger Anmeldung), Betrieb auf Vercel — weil ein eigenes
  Login die häufigste Sicherheitsfalle ist und niemand die Datenbank
  hauptamtlich pflegen soll.
- **0002 Quellen-Adapter und Ingest-Schnittstelle:** Der Kern kann RSS und
  Webseiten selbst abrufen; schwierige Kanäle (Login-Zwang) liefern externe
  Sammler über eine Schnittstelle ein — weil riskante Beschaffung nicht im
  Kern laufen soll, die Informationen aber nutzbar bleiben müssen.
- **0003 Versionsaktualisierung:** Nach Sicherheitsbefunden im ersten
  Prüflauf wurden Next.js, Vitest und zwei indirekte Pakete aktualisiert —
  weil eine Prüfung nie abgeschaltet, sondern der Befund behoben wird.
- **0004 Öffentlich lesbarer Demo-Auftrag:** Ein einzelner Auftrag ist ohne
  Anmeldung lesbar, geprüft von der Datenbank selbst — weil die Oberfläche
  bewertet werden sollte, bevor die Anmeldung fertig ist.
- **0005 Ein Datenweg für die Oberfläche:** Weboberfläche und Schnittstelle
  lesen ausschließlich über die geprüfte Datenbankfunktion — weil zwei Wege
  zu denselben Daten unweigerlich auseinanderlaufen.
