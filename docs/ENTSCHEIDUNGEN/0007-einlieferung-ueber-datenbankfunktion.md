# ADR 0007: Einlieferung externer Sammler über eine Datenbankfunktion
Datum: 25.07.2026 · Status: **Vorschlag, Freigabe ausstehend**

## Kontext
ADR 0002 hat zwei Dinge beschlossen: zwei Kern-Adapter (RSS/Atom und Web-Abruf)
und einen Ingest-Endpunkt für externe Sammler. Beim Übertragen auf GitHub zeigte
sich, dass von beidem nur der RSS-Adapter existierte. Die Tabelle
`ingest_tokens` stand im Schema, der Endpunkt fehlte, und der Web-Adapter fehlte
ebenfalls — obwohl `docs/FUNKTIONSUEBERSICHT.md` "RSS-Feeds und Webseiten"
zusagte.

Beim Nachbauen des Endpunkts stellte sich eine Frage, die ADR 0002 offengelassen
hatte: Woher nimmt die Schnittstelle ihren Schreibzugriff? ADR 0005 hat
festgelegt, dass die Weboberfläche und die API ausschließlich über die
Datenbankfunktion `dashboard_daten` gehen und auf Vercel nur die drei
öffentlichen Werte brauchen. Ein Endpunkt mit eigener Datenbankverbindung würde
diese Eigenschaft aufgeben.

## Entscheidung
1. Die Einlieferung läuft über die Datenbankfunktion
   `inhalt_einliefern(token, quelle, inhalte)`. Sie prüft das Token selbst,
   ermittelt daraus den Auftrag und schreibt die Inhalte.
2. Die Route `POST /api/v1/ingest` prüft nur die Form der Anfrage, kürzt die
   Auszüge und übersetzt Abweisungen der Datenbank in HTTP-Antworten
   (401 bei unbekanntem Token, 400 bei unbrauchbaren Angaben).
3. Das Token steht im `Authorization`-Kopf und wird nur als SHA-256-Hash
   gespeichert. Es geht nie in ein Protokoll.
4. Der Auftrag ergibt sich **allein** aus dem Token. Ein Absender kann keinen
   Auftrag angeben und damit auch keinen fremden treffen.
5. Der Web-Abruf-Adapter wird nachgezogen. Welcher Zugangsweg für eine Quelle
   gilt, entscheidet die Adresse und nicht das Feld `typ` — `typ` beschreibt den
   Herausgeber ("fachmedium", "community"), nicht den Abrufweg. Die
   Reddit-Feeds des ersten Auftrags stehen als `community` und sind trotzdem
   Feeds.
6. Quellen vom Typ `extern_agent` nimmt der Quellen-Abrufer nicht mehr an. Sie
   werden eingeliefert, nicht abgerufen.

## Begründung
Der Zugriffsschutz liegt damit an derselben Stelle wie bei ADR 0004: in der
Datenbank. Das hat drei handfeste Vorteile. Die Anwendung braucht weiterhin
keine Datenbank-Zugangsdaten, also muss auf Vercel kein `DATABASE_URL`
hinterlegt werden — das wäre ein Schreibzugriff auf alles, für einen Endpunkt,
der von außen erreichbar ist. Die Prüfung gilt auch für direkte Aufrufe der
Schnittstelle. Und die Dublettenerkennung sitzt an einer Stelle: Die Funktion
bildet den Inhalt-Hash nach genau derselben Regel wie `src/lib/dedup.ts`, was
ein Test ausdrücklich nachweist. Liefen die Regeln auseinander, würde dieselbe
Meldung zweimal gespeichert und als zweite unabhängige Bestätigung gezählt —
der Fehler, den Anforderung 4.3 ausschließen soll.

Verworfene Alternativen:

- **Eigene Datenbankverbindung in der Route.** Kürzer zu schreiben, aber der
  offene Endpunkt bekäme damit vollen Schreibzugriff, und ADR 0005 wäre
  ausgehöhlt.
- **Token in der Adresse statt im Kopf.** Adressen landen in Protokollen und
  im Verlauf von Zwischenstellen.
- **Zugangsweg aus dem Feld `typ` ableiten.** Scheitert an den echten Daten:
  derselbe Typ kommt als Feed und als Webseite vor.
- **Eine HTML-Bibliothek für den Web-Adapter.** Für das Herauslösen von Titel
  und Fließtext wäre das zusätzliche Angriffsfläche ohne Gewinn (Haltung aus
  ADR 0003). Der Adapter entfernt Skripte, Stile und eingebettete Inhalte und
  führt nie etwas aus.

## Konsequenzen
- Neuer Quellentyp im Betrieb: eingelieferte Quellen werden als
  `extern_agent` angelegt und in der Vertrauensbasis als
  `eingeliefert_extern` eingestuft (Auflage aus ADR 0002).
- Höchstens 50 Inhalte je Anfrage, doppelt geprüft: in der Anwendung und in der
  Datenbank.
- Auszüge werden serverseitig gekürzt, unabhängig davon was ein Sammler
  schickt. Die Urheberrechtsauflage aus Anforderung 4.2 gilt auch für
  eingelieferte Inhalte.
- Eine Einlieferung wird wie ein Abruf protokolliert, damit sie im Betrieb
  genauso sichtbar ist wie ein eigener Sammellauf.
- Tokens anlegen und abschalten ist noch Handarbeit auf der Datenbank. Eine
  Verwaltungsoberfläche dafür gehört zur Anmeldung und ist hier nicht enthalten.
- `scripts/sammeln.mjs` ist entfallen. Es hat die Sammellogik ein zweites Mal
  enthalten, wodurch der Web-Adapter im Betrieb nie zum Einsatz gekommen wäre.
  Ersatz ist `scripts/sammeln.job.ts`, das die geprüfte Bibliothek nutzt.
