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
- **0006 Datenbankobjekte gehören in Migrationen:** Zeilen-Sicherheit und
  Datenbankfunktionen werden per Migration angelegt, nicht von Hand in der
  Konsole — weil ein Zugriffsschutz, den man nicht prüfen kann, keiner ist.
  Beim ersten Test trat sofort ein Fehler zutage, der jeden Auftrag öffentlich
  lesbar gemacht hätte.
- **0007 Einlieferung über eine Datenbankfunktion:** Externe Sammler liefern
  über eine token-geprüfte Datenbankfunktion ein, und der fehlende
  Web-Abruf-Adapter wurde nachgezogen — weil die Schnittstelle so ohne
  Datenbank-Zugangsdaten auskommt und die Dublettenerkennung an einer Stelle
  bleibt.
- **0008 Relevanzregeln sind Angaben am Auftrag:** Pflicht-, Ausschluss- und
  Suchbegriffe samt nötiger Trefferzahl gehören zum Auftrag, die Auswertung in
  ein getestetes Regelwerk — weil im ersten Betrieb 6 von 24 Aussagen nichts
  mit dem Thema zu tun hatten. Quellen, die durch ihre Adresse schon auf das
  Thema begrenzt sind, müssen es im Text nicht wiederholen; sonst fielen
  gerade die Frühwarnkanäle heraus.
- **0009 Anmeldung per Magic Link, Verwaltung in der Oberfläche:** Anmeldung
  ohne Passwort über Supabase Auth; Aufträge, Quellen, Relevanzregeln und der
  eigene KI-Zugang sind in der Oberfläche bearbeitbar — weil Einstellungen,
  die nur über die Datenbank erreichbar sind, nicht gepflegt werden.
  Schreibzugriff über die vorhandenen Zugriffsregeln, eigene
  Datenbankfunktionen nur dort, wo diese nicht greifen können.
  `NEXT_PUBLIC_AUFTRAG` wird zur Vorauswahl, mehrere Demo-Aufträge sind möglich.
- **0010 Belege zeigen, Netz lesbar machen, Regeln vorschlagen:** Nach der
  ersten Nutzung behoben — die Knoten des Quellennetzes trieben aus der
  Zeichenfläche (jetzt legt sich der Ausschnitt um sie), Aussagen nannten
  weder Datum noch Verweis (jetzt klappen sie ihre Belege auf), und
  Zusammenführungen entstanden nur bei ähnlichen Titeln (jetzt auch über
  gemeinsame Kennungen wie eine KB- oder CVE-Nummer). Freigegebene Aufträge
  lassen sich ins eigene Konto übernehmen, und die Relevanzregeln kann die KI
  auf Wunsch mit Begründung vorschlagen — entschieden wird weiterhin von Hand.
- **0011 Zusammenführung präzisieren:** Die Messung an den echten Daten zeigte,
  dass vier von acht Zusammenführungen falsch waren — drei verschiedene
  Sicherheitslücken galten wegen gleicher Formelwörter als eine Meldung, auf
  Stufe „offiziell bestätigt". Kennungen trennen jetzt auch, nicht nur
  verbinden; verglichen wird gegen alle Gruppenmitglieder statt nur gegen das
  erste; Titelähnlichkeit gilt nur innerhalb von 45 Tagen; gemeinsame Verweise
  verbinden. Und: Unabhängigkeit zweier Herausgeber wird nicht mehr
  unterstellt, sondern bleibt der KI-Analyse vorbehalten — ohne sie endet die
  Leiter bei Stufe 2 statt eine Bestätigung zu behaupten, die nie geprüft wurde.
- **0012 Der Abrufabstand ist ein Bereich:** Statt eines festen Werts stellt
  die Nutzerin eine Unter- und eine Obergrenze ein; bringt ein Abruf neue
  Beiträge, rückt der Takt zur Untergrenze, bleibt er leer, zur Obergrenze —
  weil niemand vorab weiß, wie schnell ein Thema läuft, und weil sich das
  ändert. Der Zeitplan läuft als GitHub-Workflow und nicht bei Vercel, damit
  die Weboberfläche weiterhin ohne Datenbankzugang auskommt. Nebenbei behoben:
  Das bisherige Feld `intervall_minuten` war einstellbar, wurde aber von keinem
  Lauf gelesen.
- **0013 Quellensuche außerhalb des Kerns:** Ein neuer Auftrag beginnt ohne
  Quellen und sammelt deshalb nichts. NotebookLMs Web-Recherche findet welche —
  aber sie meldet sich mit dem ganzen Google-Konto an, nicht mit einem eng
  begrenzten Schlüssel. Deshalb läuft die Suche als externer Sammler auf dem
  eigenen Rechner und gibt eine Datei aus; in der Verwaltung wird eingefügt und
  je Eintrag ausgewählt. Der Umweg über die Datei ist die Trennfuge, an der die
  Zugangsdaten hängen bleiben. NotebookLM ersetzt keine Feeds: Es hilft, sie zu
  finden.
- **0014 Suche und GDELT als Zugangswege:** Foren und Nischenblogs sind die
  Frühwarnkanäle — man kennt sie vorher nicht und sie haben keinen Feed. Ein
  Feed setzt voraus, dass man die Quelle gefunden hat; eine Suche setzt nur
  voraus, dass man die Frage kennt. Deshalb zwei neue Adapter: die eigene
  SearXNG-Instanz (Foren, Blogs, das ganze Netz) und GDELT (weltweite
  Nachrichten mit Zeitpunkt der ersten Sichtung, für die Ursprungsfrage). Beide
  ohne Schlüssel und ohne Kosten. Gewählt wird der Weg über die neue Spalte
  `zugangsweg` und nicht über `typ`, weil `typ` sagt, WER veröffentlicht, und
  davon die Reifegrad-Einstufung abhängt — der Zugangsweg sagt nur, WIE wir
  lesen. Ein Treffer bleibt "irgendwo stand das", nie eine Bestätigung.
