# Quellen finden mit NotebookLM

Findet zu einer Fragestellung passende Quellen im Netz und schreibt sie in eine
Datei. Die Datei fügst du anschließend in der Verwaltung ein und wählst aus,
welche Quellen wirklich angelegt werden.

Dieses Skript ist **kein Teil der Plattform**. Es läuft auf deinem Rechner und
die Plattform weiß nichts von ihm.

## Bevor du anfängst: drei Dinge, die du wissen solltest

**1. Es meldet sich mit deinem Google-Konto an.** Nicht mit einem eng
begrenzten Schlüssel, wie ihn Anthropic oder OpenAI ausgeben, sondern mit
deiner Google-Sitzung — also mit Zugriff auf alles, was an diesem Konto hängt.
Genau deshalb läuft das Skript bei dir und nicht auf dem Server: Ein solches
Geheimnis gehört nicht in eine Cloud-Umgebung.

**2. Es benutzt eine undokumentierte Schnittstelle.** Das Paket `notebooklm-py`
spricht Google-interne Aufrufe an, die sich ohne Vorwarnung ändern können. Wenn
das Skript eines Tages nicht mehr funktioniert, ist das kein Fehler in deinem
Projekt. Geprüft ist es gegen **notebooklm-py 0.7.3**.

**3. Es kann gegen Googles Nutzungsbedingungen verstoßen.** Ein
Verbraucherprodukt mit dem eigenen Konto zu automatisieren, kann im
Extremfall das Konto kosten. Für gelegentliche Recherchen beim Einrichten eines
Auftrags ist das Risiko gering — als Dauerbetrieb würde ich es nicht laufen
lassen.

Ein offizieller Zugang existiert bislang nur für Unternehmenskunden über Gemini
Enterprise. Sobald Google eine offene Schnittstelle anbietet, lässt sich in
`quellen_finden.py` die Anbindung tauschen, ohne dass die Plattform etwas
davon merkt.

## Einrichten (einmalig)

Du brauchst Python 3.11 oder neuer.

```bash
cd sammler/notebooklm
python3 -m venv .venv
source .venv/bin/activate        # unter Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Dann einmal bei Google anmelden:

```bash
notebooklm login
```

Es öffnet sich ein Browserfenster mit der gewohnten Google-Anmeldung. Die
Sitzung wird lokal gespeichert; du musst das nicht bei jedem Lauf wiederholen.

Wenn sich kein Browser öffnen lässt, gibt es zwei Alternativen:

```bash
notebooklm login --browser-cookies chrome    # Sitzung aus dem laufenden Browser
notebooklm login --master-token --account du@example.com
```

## Benutzen

```bash
source .venv/bin/activate
python quellen_finden.py --frage "Wer wird nächster Bundesverkehrsminister?"
```

Das dauert im Schnellmodus etwa eine Minute. Danach steht im Verzeichnis eine
Datei `quellenvorschlaege.json`, und im Terminal siehst du die Fundstellen.

### Was du einstellen kannst

| Schalter | Bedeutung |
|---|---|
| `--frage "…"` | Die Fragestellung. **Pflicht.** Je genauer, desto besser. |
| `--modus deep` | Gründlicher, dauert aber deutlich länger. Vorgabe: `fast`. |
| `--zeitgrenze 3600` | Abbruch nach so vielen Sekunden. Vorgabe: 1800. |
| `--ausgabe datei.json` | Andere Zieldatei. |
| `--notizbuch "Titel"` | Titel des Notizbuchs in NotebookLM. |

Nimm am besten die **Fragestellung deines Auftrags** wörtlich — sie ist genau
dafür gedacht.

## Die Funde übernehmen

1. Datei `quellenvorschlaege.json` öffnen und den **gesamten** Inhalt kopieren.
2. In der Plattform auf *Verwalten* → den Auftrag anklicken.
3. Unten *Quellen aus einer Recherche übernehmen* aufklappen.
4. Inhalt einfügen, auf *Prüfen*.
5. Bei jeder Quelle, die du willst, das Häkchen setzen und die Art wählen
   (Feeds werden automatisch als solche erkannt).
6. *Ausgewählte Quellen anlegen*.

**Nichts wird ungefragt angelegt.** Eine Quelle bestimmt, was du künftig zu
sehen bekommst — deshalb entscheidest du je Eintrag. Ob eine Adresse
tatsächlich trägt, zeigt der nächste Sammellauf; nicht erreichbare Quellen
erscheinen im Dashboard als Warnung.

## Wofür sich das eignet — und wofür nicht

**Geeignet:** Quellen finden, wenn du einen Auftrag neu einrichtest oder wenn
ein Auftrag zu wenig liefert. Ein Lauf, dann wieder wochenlang nicht.

**Nicht geeignet:** als laufende Suche. NotebookLM liefert einmalig eine
Handvoll passender Quellen zu einem Thema — es beobachtet nicht. Für die
laufende Beobachtung sind die Feeds da, die du hier anlegst; die ruft die
Plattform von selbst im eingestellten Takt ab.

## Wenn etwas nicht klappt

| Meldung | Ursache |
|---|---|
| `Das Paket notebooklm-py fehlt` | Umgebung nicht aktiviert (`source .venv/bin/activate`). |
| `Nicht angemeldet` | `notebooklm login` ausführen. |
| `NotebookLM hat keine Recherche gestartet` | Fragestellung zu unbestimmt — konkreter formulieren. |
| `Die Recherche endete mit dem Zustand FAILED` | Meist dieselbe Ursache; anders formulieren. |
| `Zustand IN_PROGRESS` nach Abbruch | Zeitgrenze erhöhen: `--zeitgrenze 3600`. |
| Andere Fehler kurz nach einem Update | Google hat vermutlich die Schnittstelle geändert. |
