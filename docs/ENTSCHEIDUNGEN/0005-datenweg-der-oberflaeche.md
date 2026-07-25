# ADR 0005: Ein Datenweg für die Oberfläche
Datum: 25.07.2026 · Status: angenommen

## Kontext
Es gab zwei Wege zu denselben Daten: eine direkte Datenbankverbindung im
Server und der Aufruf der Supabase-Funktion. Zwei Wege bedeuten doppelte
Pflege und die Gefahr, dass sie auseinanderlaufen.

## Entscheidung
Die Weboberfläche und die API nutzen ausschließlich die Supabase-Funktion
`dashboard_daten`. Die direkte Datenbankverbindung bleibt nur den
serverseitigen Werkzeugen (Sammellauf, Auswertung, Migrationen) vorbehalten.

## Begründung
Die Zugriffsprüfung liegt damit an genau einer Stelle. Zudem braucht die
Weboberfläche keine Datenbank-Zugangsdaten mehr — auf Vercel genügen die
drei öffentlichen Werte.

## Konsequenzen
Die frühere Datei `dashboard-daten.ts` samt Tests wurde entfernt.
Adresse, Schlüssel und Auftrag kommen aus Umgebungsvariablen
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `NEXT_PUBLIC_AUFTRAG`).
