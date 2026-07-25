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
3. Unter "Environment Variables" **vier Werte** eintragen (Production und
   Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` – Adresse des Supabase-Projekts
   - `NEXT_PUBLIC_SUPABASE_KEY` – der "publishable key" (öffentlich, ungefährlich)
   - `NEXT_PUBLIC_AUFTRAG` – Vorauswahl des angezeigten Auftrags. Weitere
     freigegebene Aufträge erscheinen in der Oberfläche zur Auswahl.
   - `BYOK_ENCRYPTION_KEY` – **geheim**, ohne `NEXT_PUBLIC_`. Damit verschlüsselt
     die Anwendung die KI-Zugänge der Nutzer, bevor sie in die Datenbank gehen
     (ADR 0009). Muss genau 32 Bytes lang sein (base64) und identisch zu dem
     Wert sein, den die serverseitigen Werkzeuge benutzen — sonst lassen sich
     bereits hinterlegte Schlüssel nicht mehr entschlüsseln.
4. Deploy. Die Adresse erscheint nach etwa einer Minute.
5. `NEXT_PUBLIC_`-Werte werden beim **Bauen** eingebacken. Nach einer Änderung
   also neu bereitstellen (Deployments → Redeploy); Speichern allein genügt nicht.

Werte fehlen? Die Seite zeigt dann eine verständliche Meldung statt einer
leeren Seite — genau dafür ist die Prüfung beim Start da.

## 2b. Anmeldung in Supabase einschalten

Ohne diesen Schritt führt der Anmeldelink ins Leere.

1. Supabase → Authentication → Sign In / Providers: **Email** aktiviert lassen,
   "Magic Link" erlauben. Ein Passwort wird nicht gebraucht.
2. Authentication → URL Configuration:
   - **Site URL**: die Produktionsadresse, z. B. `https://evidenz-monitor.vercel.app`
   - **Redirect URLs**: `https://DEINE-ADRESSE/auth/bestaetigen` und, wenn du
     Vorschau-Bereitstellungen benutzen willst, zusätzlich
     `https://*-DEINKONTO.vercel.app/auth/bestaetigen`
   - Für die Entwicklung am eigenen Rechner:
     `http://localhost:3000/auth/bestaetigen`
3. Wer sich anmelden darf, steuerst du über Authentication → Users (einladen)
   oder über die Einstellung, ob Selbstregistrierung erlaubt ist. Bei einem
   Bekanntenkreis von 2–10 Personen ist Einladen die einfachere Wahl.

Angemeldete Nutzer sehen ihre eigenen Aufträge, können sie unter „Verwalten"
bearbeiten und ihren eigenen KI-Zugang hinterlegen. Ohne Anmeldung sind nur die
ausdrücklich freigegebenen Demo-Aufträge lesbar — geprüft von der Datenbank.

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
