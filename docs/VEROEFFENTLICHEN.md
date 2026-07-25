# Veröffentlichen über GitHub und Vercel

Empfohlener Weg: Der Code liegt auf GitHub, Vercel baut bei jeder Änderung
automatisch. Vorteile: Vorschau-Adresse je Änderung, Rückrollen per Klick,
und die Prüfungen laufen automatisch mit (`.github/workflows/pruefung.yml`).

## 1. Repository anlegen und hochladen

Im Projektordner:

```
git init
git add .
git commit -m "Evidenz-Monitor: Kern-Slice"
git branch -M main
git remote add origin https://github.com/DEINKONTO/evidenz-monitor.git
git push -u origin main
```

Vorher prüfen: `git status` darf **keine** `.env` anzeigen (steht in
`.gitignore`). Falls doch, nicht hochladen und zuerst klären.

## 2. In Vercel importieren

1. vercel.com → Add New → Project → Import Git Repository → Repository wählen.
2. Framework: Next.js (wird erkannt). Root Directory: Projektwurzel.
3. Unter "Environment Variables" **drei Werte** eintragen (Production und
   Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` – Adresse des Supabase-Projekts
   - `NEXT_PUBLIC_SUPABASE_KEY` – der "publishable key" (öffentlich, ungefährlich)
   - `NEXT_PUBLIC_AUFTRAG` – Kennung des anzuzeigenden Beobachtungsauftrags
4. Deploy. Die Adresse erscheint nach etwa einer Minute.

Werte fehlen? Die Seite zeigt dann eine verständliche Meldung statt einer
leeren Seite — genau dafür ist die Prüfung beim Start da.

## 3. Prüfungen als Pflicht setzen (empfohlen)

Auf GitHub: Settings → Branches → Branch protection rule für `main` →
"Require status checks to pass" → `pruefen` auswählen. Damit kann nichts
zusammengeführt werden, das die sieben Prüfschritte nicht besteht.

## 4. Sammellauf regelmäßig ausführen

Die Weboberfläche zeigt nur an. Das Abrufen der Quellen läuft getrennt:

```
npm run sammeln
npm run auswerten
```

Für den Dauerbetrieb später ein Zeitplan (Vercel Cron oder ein kleiner
Server im eigenen Netz) mit den serverseitigen Werten `DATABASE_URL` und
`BYOK_ENCRYPTION_KEY` — diese gehören **nicht** zu den öffentlichen
`NEXT_PUBLIC_`-Werten.

## Vor dem echten Produktivbetrieb

- Anmeldung anbinden (Supabase Auth) und `oeffentliche_demo` abschalten.
- Checkliste aus dem Skill, Phase 4b (Inbetriebnahme) durchgehen.
