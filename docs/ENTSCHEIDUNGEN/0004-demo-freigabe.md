# ADR 0004: Öffentlich lesbarer Demo-Auftrag
Datum: 25.07.2026 · Status: angenommen

## Kontext
Für eine erste Bewertung der Oberfläche musste ein Auftrag ohne Anmeldung
sichtbar sein, obwohl die Anmeldung noch nicht eingebaut ist.

## Entscheidung
Die Tabelle `auftraege` hat ein Feld `oeffentliche_demo`. Alle Daten laufen
über die Datenbankfunktion `dashboard_daten(auftrag)`, die den Zugriff selbst
prüft: erlaubt nur bei eigenem Auftrag (angemeldet) oder gesetztem Demo-Flag.

## Begründung
Der Zugriffsschutz liegt in der Datenbank, nicht in der Anwendung — er gilt
damit auch für direkte Aufrufe der Schnittstelle. Verworfen: Daten fest in
die Oberfläche einbauen (dann wäre es keine echte Anwendung mehr) und
allgemeiner Lesezugriff für alle Tabellen (zu weit).

## Konsequenzen
Der Demo-Auftrag enthält nur öffentlich abgerufene Inhalte, keine
personenbezogenen Daten. Vor dem Produktivbetrieb: Flag entfernen oder
bewusst bestätigen. Schreibzugriff bleibt für nicht angemeldete Zugriffe
gesperrt (praktisch geprüft: HTTP 401).
