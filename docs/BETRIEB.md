# Betriebsanleitung

Für Menschen ohne Programmierkenntnisse. Befehle im Projektordner ausführen.

## Einmalig einrichten

1. Node.js 22 oder neuer installieren (nodejs.org).
2. Im Projektordner: `npm install`
3. Datei `.env.example` kopieren zu `.env` und ausfüllen (die drei
   NEXT_PUBLIC_-Werte zusätzlich in Vercel eintragen, siehe
   docs/VEROEFFENTLICHEN.md):
   - `DATABASE_URL` — Verbindung zur Datenbank (von Supabase oder lokal)
   - `BYOK_ENCRYPTION_KEY` — Schlüssel zum Verschlüsseln der KI-Zugänge.
     Erzeugen mit:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
     **Diesen Wert sichern.** Geht er verloren, müssen alle Nutzer ihren
     KI-Schlüssel neu hinterlegen.
   - `LOG_LEVEL` — `info` im Normalbetrieb, `debug` zur Fehlersuche
4. Datenbankstruktur anlegen: `npm run migrate`
   Das legt Tabellen, Zugriffsregeln und die Datenbankfunktionen an. Ohne
   diesen Schritt bleibt das Dashboard leer.
5. Ersten Beobachtungsauftrag anlegen: `npm run seed`
   Ohne einen Auftrag hat der Sammellauf nichts zu tun und bricht mit einer
   Meldung ab.

Fehlt ein Pflichtwert, startet die Anwendung nicht und sagt genau, welcher.

## Starten

- Entwicklung (mit automatischem Neuladen): `npm run dev`
- Betrieb: `npm run build`, danach `npm start`
- Erreichbar unter `http://localhost:3000`

## Stoppen

Im Terminalfenster `Strg + C`.

## Quellen abrufen

Ein Sammellauf: `npm run sammeln`
Auswertung (Gruppierung, Bewertung): `npm run auswerten`

Im Dauerbetrieb übernimmt das ein Zeitplan (z. B. ein Vercel-Cron-Auftrag)
im Abstand, der im Auftrag hinterlegt ist.

Ob eine Quelle als Feed oder als Webseite gelesen wird, entscheidet ihre
Adresse: Endet sie auf `.rss`, `.xml`, `.atom` oder enthält sie `/feed`,
wird sie als Feed gelesen, sonst als einzelne Webseite.

## Inhalte von einem eigenen Sammler einliefern

Kanäle mit Anmeldezwang ruft die Software nicht selbst ab. Ein eigener
Agent kann sie einliefern. Dafür braucht er ein Token, das zu genau einem
Beobachtungsauftrag gehört. Anlegen (Token selbst ausdenken, mindestens 24
Zeichen, danach **nicht mehr auslesbar** — die Datenbank speichert nur den
Prüfwert):

```
TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
echo "Token merken: $TOKEN"
psql "$DATABASE_URL" -c "INSERT INTO ingest_tokens (auftrag_id,bezeichnung,token_hash)
  VALUES ('DIE-AUFTRAGSKENNUNG','Mein Sammler',
          encode(sha256(convert_to('$TOKEN','utf8')),'hex'));"
```

Einliefern:

```
curl -X POST https://MEINE-ADRESSE/api/v1/ingest \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"quelle":{"url":"https://sammler.example/kanal","herausgeber":"Mein Sammler"},
       "inhalte":[{"url":"https://beispiel.example/1","titel":"Meldung",
                   "auszug":"Kurzer Auszug","veroeffentlichtAm":"2026-07-25T10:00:00Z"}]}'
```

Höchstens 50 Inhalte je Anfrage. Die Antwort nennt, wie viele angenommen
und wie viele als Dublette übersprungen wurden. Ein Token abschalten:
`UPDATE ingest_tokens SET aktiv=false WHERE bezeichnung='Mein Sammler';`

## Sichern

- **Bei Supabase:** tägliche Sicherungen laufen automatisch; im
  Supabase-Dashboard unter "Database → Backups" prüfen und dort auch
  manuell auslösen.
- **Bei eigener Datenbank:**
  `pg_dump "$DATABASE_URL" > sicherung-$(date +%F).sql`
  Die Datei außerhalb des Servers aufbewahren. Zusätzlich die `.env`
  sichern (enthält den Verschlüsselungsschlüssel) — getrennt von der
  Datenbanksicherung.

## Wiederherstellen

1. Leere Datenbank bereitstellen und `DATABASE_URL` darauf zeigen lassen.
2. `psql "$DATABASE_URL" < sicherung-JJJJ-MM-TT.sql`
3. `.env` mit dem **ursprünglichen** `BYOK_ENCRYPTION_KEY` einspielen.
4. `npm run build && npm start`, danach im Dashboard prüfen, ob Quellen
   und Aussagen wieder da sind.

Die Wiederherstellung einmal im Ruhezustand üben — eine Sicherung, die nie
zurückgespielt wurde, ist keine Sicherung.

## Aktualisieren

1. Neue Version holen (`git pull` oder neue Dateien einspielen).
2. `npm install`
3. `npm run migrate` — spielt neue Datenbankänderungen ein.
4. `npm audit` — meldet Sicherheitslücken in verwendeten Bausteinen.
   Bei Befunden: `npm audit fix`, danach `npm test` und `npm run build`.
   Achtung: In `package.json` stehen unter `overrides` zwei fest gesetzte
   Versionen (postcss, sharp). Nach größeren Next.js-Updates prüfen, ob sie
   noch nötig sind.
5. `npm test && npm run build`, dann neu starten.

## Wenn etwas nicht geht

- **Anwendung startet nicht, Meldung "Konfiguration unvollständig":**
  Der genannte Wert fehlt in `.env`.
- **Seite zeigt "Interner Fehler":** Meist ist die Datenbank nicht
  erreichbar. Verbindung prüfen (`DATABASE_URL`), Datenbank starten.
- **Einzelne Quellen liefern nichts:** Im Dashboard steht "X Quellen nicht
  erreichbar". Häufige Gründe: Feed-Adresse geändert, Sperre durch den
  Anbieter (dann Quelle deaktivieren oder über einen externen Sammler
  einliefern lassen).
- **Logs lesen:** Die Anwendung schreibt JSON-Zeilen ins Terminal. Jede
  Anfrage hat eine `correlationId` — dieselbe Nummer taucht in der
  Fehlermeldung der Oberfläche auf. Mit ihr findet man alle zugehörigen
  Einträge: `npm start | grep "DIE-NUMMER"`.
- **Alles neu prüfen:** `npm test` (Tests), `npm run lint` (Regelverstöße),
  `npm run typecheck` (Typfehler). Alle drei müssen fehlerfrei sein.

## Grenzen im aktuellen Stand

- Anmeldung/Mehrbenutzerbetrieb ist im Datenmodell vorbereitet und die
  Datenbank trennt die Daten verschiedener Nutzer bereits selbst; die
  Supabase-Anmeldung selbst ist noch nicht eingerichtet. Solange sie fehlt,
  ist genau ein Auftrag über das Feld `oeffentliche_demo` ohne Anmeldung
  lesbar. Vor der Veröffentlichung im Internet: Anmeldung nachziehen und
  dieses Feld bewusst bestätigen oder abschalten.
- Die KI-Analyse ist gebaut und getestet, aber noch nicht in den
  Sammellauf eingehängt; bis dahin arbeitet die Vorklassifikation.
- Benachrichtigungen, Widerspruchsanzeige und Handlungsempfehlungen sind
  geplant, aber nicht Teil dieses Ausbaustands.
