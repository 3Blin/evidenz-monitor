# ADR 0013: Quellensuche über NotebookLM — außerhalb des Kerns
Datum: 29.07.2026 · Status: angenommen · Freigegeben am: 29.07.2026

## Kontext
Zwei Dinge trafen zusammen.

**Ein echtes Problem:** Ein neuer Auftrag beginnt ohne Quellen und sammelt
deshalb nichts. Der Auftrag „Neubesetzung von Personalien im Kabinett Merz"
stand tagelang mit null Quellen da. Woher passende Quellen kommen, war bislang
nicht beantwortet — außer „von Hand suchen".

**Ein Behelf, der nicht trägt:** ADR 0010 gab dem KI-Vorschlag die Aufgabe mit,
auch Quellen zu nennen. Das tut er, aber aus dem Gedächtnis des Sprachmodells —
weshalb dort der Hinweis „ungeprüft, die KI kann Adressen erfinden" steht. Ein
Vorschlag, dem man nicht trauen kann, ist ein halber Vorschlag.

Der Anstoß war die Frage, ob sich **NotebookLM** als Suchmaschine einbinden
lässt. NotebookLMs Funktion „Discover sources" durchsucht tatsächlich das Netz
und liefert passende Quellen — sie *sucht*, statt sich zu erinnern. Für die
Anbindung existiert die Bibliothek `notebooklm-py` (MIT).

## Untersuchung
Die Bibliothek wurde installiert und ihre Schnittstelle geprüft, statt sie aus
der Beschreibung zu übernehmen. Das war nötig: Die README nennt ein
`client.sources.add_research()`, **das es in Fassung 0.7.3 nicht gibt**. Der
tatsächliche Weg ist

```
client.research.start(notebook_id, query, source="web", mode="fast")
client.research.wait_for_completion(notebook_id, task_id)  -> ResearchTask
ResearchTask.sources  -> (ResearchSource(url, title, …), …)
```

Der wichtigste Befund dabei: `ResearchTask.sources` liefert Adresse und Titel,
**ohne** dass etwas in ein Notizbuch importiert werden muss. Der Sammler
braucht also nur zu suchen und zu lesen — kein `import_sources`, kein
Aufräumen.

## Entscheidung

### 1. Der Sammler läuft außerhalb der Plattform
`sammler/notebooklm/quellen_finden.py`, ausgeführt auf dem Rechner der
Nutzerin. Die Plattform ruft ihn nicht auf und kennt ihn nicht.

Der Grund ist die Art des Geheimnisses. Ein BYOK-Schlüssel ist eng begrenzt,
einzeln widerrufbar und kostet im schlimmsten Fall Geld. Eine Google-Sitzung
ist **das ganze Konto** — Mail, Drive, alles. Läge sie in den GitHub-
Geheimnissen, hinge das Konto an der Sicherheit dieses Projekts. Dazu kommt:
Die Bibliothek spricht eine undokumentierte Schnittstelle, die ohne Vorwarnung
brechen kann, und die Automatisierung eines Verbraucherprodukts kann gegen
Googles Bedingungen verstoßen.

Das ist keine neue Regel, sondern die vorhandene: ADR 0002 sieht für riskante
Beschaffung ausdrücklich externe Sammler vor, „weil riskante Beschaffung nicht
im Kern laufen soll, die Informationen aber nutzbar bleiben müssen".

### 2. Der Weg zurück führt über eine Datei
Der Sammler schreibt `quellenvorschlaege.json`. In der Verwaltung gibt es
*Quellen aus einer Recherche übernehmen*: Inhalt einfügen, prüfen, auswählen,
anlegen.

Der Umweg ist Absicht. Er ist die Trennfuge, an der die Zugangsdaten hängen
bleiben: Die Plattform sieht nie ein fremdes Konto, sondern nur eine Liste von
Adressen.

### 3. Nichts wird von selbst angelegt
Die Auswahl erfolgt je Eintrag, nichts ist vorausgewählt. Eine Quelle bestimmt,
was künftig im Dashboard erscheint; das ist keine Nebensächlichkeit, die man
durchwinkt.

### 4. Die Datei ist fremde Eingabe und wird so behandelt
`src/lib/quellen/vorschlagsdatei.ts` prüft sie: nur `http` und `https` (ein
`javascript:`-Verweis in einer Quellenliste hat keinen Zweck, den man
wohlwollend deuten könnte), höchstens 50 Vorschläge, Wiederholungen entfernt,
Aussortiertes wird im Klartext benannt statt stillschweigend geschluckt.

### 5. Die Fassung der Bibliothek ist festgenagelt
`notebooklm-py==0.7.3`, mit dem Grund in der Datei. Bei einer undokumentierten
Schnittstelle ist ein loser Versionsbereich eine Zeitbombe.

## Begründung
Der entscheidende Punkt ist die Rollenklärung: **NotebookLM ist kein
Beobachtungswerkzeug.** „Discover sources" liefert einmalig eine Handvoll
passender Quellen. Das im Takt der Beobachtung laufen zu lassen, wäre
Verschwendung und lieferte immer wieder dieselben Fundstellen. Für die laufende
Beobachtung sind die Feeds da — NotebookLM hilft dabei, sie zu *finden*.

Damit besetzt es genau die Lücke, die der KI-Vorschlag aus ADR 0010 offenlässt:
Das Sprachmodell erinnert sich an Adressen, NotebookLM sucht sie. Beide bleiben
nebeneinander bestehen; der Vorschlag ist der schnelle Weg ohne weiteres
Werkzeug, die Recherche der belastbare.

Verworfene Alternativen:

- **Im Kern, mit Google-Sitzung in den GitHub-Geheimnissen.** Siehe oben — eine
  andere Risikoklasse als alles andere in diesem Projekt.
- **Als laufende Suche im Sammeltakt.** Falsches Werkzeug für den Zweck, und
  bei einer undokumentierten Schnittstelle auch das falsche Betriebsmodell.
- **Über die vorhandene Ingest-Schnittstelle einliefern.** Die liefert
  *Inhalte* ein; hier geht es um *Quellen*. Sie sind verschiedene Dinge, und
  eine Schnittstelle für beides zu benutzen hieße, ihren Vertrag zu verwässern.
- **Automatisch anlegen statt auswählen.** Nichts an dieser Kette ist geprüft:
  weder die Suche noch die Fundstellen. Automatisches Anlegen hieße, das
  Dashboard einem fremden Dienst zu überlassen.

## Konsequenzen
- Neu: `sammler/notebooklm/` (Skript, festgenagelte Abhängigkeit, Anleitung),
  `src/lib/quellen/vorschlagsdatei.ts`, `quellen-einfuegen.tsx`. 12 Tests.
- Der Kern hat **keine** neue Abhängigkeit. Python und `notebooklm-py` gehören
  zum Sammler, nicht zur Plattform; das Prüftor sieht sie nicht.
- Bricht Google die Schnittstelle, steht genau dieses eine Skript still. Die
  Plattform merkt nichts davon — sie kennt nur die Quellen, die einmal
  angelegt wurden.
- Der Modus „Inhalte einliefern" für Kanäle ohne Feed ist **nicht** gebaut. Er
  wäre der zweite denkbare Einsatz desselben Sammlers, über die vorhandene
  Ingest-Schnittstelle. Erst bauen, wenn ein konkreter Kanal ihn braucht.
