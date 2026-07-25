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
- **0006 Datenbankobjekte gehören in Migrationen** *(Vorschlag, Freigabe
  ausstehend)*: Zeilen-Sicherheit und Datenbankfunktionen werden per Migration
  angelegt, nicht von Hand in der Konsole — weil ein Zugriffsschutz, den man
  nicht prüfen kann, keiner ist. Beim ersten Test trat sofort ein Fehler
  zutage, der jeden Auftrag öffentlich lesbar gemacht hätte.
- **0007 Einlieferung über eine Datenbankfunktion** *(Vorschlag, Freigabe
  ausstehend)*: Externe Sammler liefern über eine token-geprüfte
  Datenbankfunktion ein, und der fehlende Web-Abruf-Adapter wird nachgezogen —
  weil die Schnittstelle so ohne Datenbank-Zugangsdaten auskommt und die
  Dublettenerkennung an einer Stelle bleibt.
- **0008 Relevanzregeln sind Angaben am Auftrag** *(Vorschlag, Freigabe
  ausstehend)*: Pflicht-, Ausschluss- und Suchbegriffe samt nötiger Trefferzahl
  gehören zum Auftrag, die Auswertung in ein getestetes Regelwerk — weil im
  ersten Betrieb 6 von 24 Aussagen nichts mit dem Thema zu tun hatten. Quellen,
  die durch ihre Adresse schon auf das Thema begrenzt sind, müssen es im Text
  nicht wiederholen; sonst fielen gerade die Frühwarnkanäle heraus.
- **0009 Anmeldung per Magic Link, Verwaltung in der Oberfläche** *(Vorschlag,
  Freigabe ausstehend)*: Anmeldung ohne Passwort über Supabase Auth; Aufträge,
  Quellen, Relevanzregeln und der eigene KI-Zugang sind in der Oberfläche
  bearbeitbar — weil Einstellungen, die nur über die Datenbank erreichbar sind,
  nicht gepflegt werden. Schreibzugriff über die vorhandenen Zugriffsregeln,
  eigene Datenbankfunktionen nur dort, wo diese nicht greifen können.
  `NEXT_PUBLIC_AUFTRAG` wird zur Vorauswahl, mehrere Demo-Aufträge sind möglich.
