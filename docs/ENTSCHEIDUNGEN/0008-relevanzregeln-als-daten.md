# ADR 0008: Relevanzregeln sind Angaben am Auftrag, nicht Code
Datum: 25.07.2026 · Status: angenommen · Freigegeben am: 25.07.2026

## Kontext
Im ersten echten Betrieb standen im Dashboard 24 Aussagen. Sechs davon hatten
keinen Bezug zum Auftrag, unter anderem „Kimi K3: Chinesische KI findet
Zero-Day-Lücken in redis-Datenbank", „ChatGPT Voice experience gets a massive
upgrade" und „Meta AI is about to become a lot more useful". Erfolgskriterium 6
verlangt das Gegenteil: wenige irrelevante Meldungen.

Die Auswahl lief in `scripts/auswerten.job.ts` über eine Bedingung in SQL:

```sql
AND (i.titel ILIKE ANY($2) OR i.auszug ILIKE ANY($2))
```

Zwei Fehler steckten darin:

1. **Ein einzelner Treffer genügte.** Der Auftrag hat den Suchbegriff „Update".
   Das Wort „Updates" im Auszug eines Artikels über eine Datenbanklücke reichte
   damit aus. Von den 6 Fehltreffern gingen alle 6 auf diesen einen Begriff
   zurück.
2. **Treffer mitten im Wort zählten.** `%KB%` trifft auch „SKBackup".

Bei der Messung auf den echten Daten kam ein dritter, gegenläufiger Fehler zum
Vorschein. Ein einfacher Pflichtbegriff „Windows" hätte zwar alle 6 Fehltreffer
entfernt, aber auch zwei echte Windows-Meldungen:

- „CrossDeviceResume has reappeared after the Insider Preview update KB5089573"
- „I just updated to the Insider Program, and the memory graph is blank."

Beide kommen aus Windows-Foren und schreiben das Wort „Windows" nicht. Genau so
reden Menschen in Foren — und Foren sind laut Anforderungen die
**Frühwarnkanäle der Stufen 1–3**. Eine Regel, die sie beschneidet, beschädigt
die Kernfunktion.

## Entscheidung
1. Die Relevanzregeln werden Angaben am Auftrag (Migration 0003):
   `pflichtbegriffe`, `ausschlussbegriffe`, `mindest_treffer`. Der Code enthält
   nur die Auswertung. Ein Wetter- oder Preisauftrag benutzt dieselben Felder.
2. Die Auswertung wandert aus SQL in `src/lib/relevanz.ts` — reine Logik ohne
   Netz- und Datenbankzugriff, damit vollständig testbar (Modulgrenze 3).
3. Begriffe treffen nur **am Wortanfang**. Bewusst nicht auch am Wortende:
   „KB" soll die Herstellerkennungen finden („KB5000001"), „Update" auch
   „Updates". Ein Treffer mitten im Wort ist ausgeschlossen.
4. Quellen erhalten das Feld `themenspezifisch`. Ist eine Quelle durch ihre
   Adresse schon auf das Thema begrenzt — ein reines Windows-Forum, ein auf ein
   Board eingeschränkter Feed, eine Suchabfrage wie `?q=Windows` —, dann bürgt
   die Herkunft für das Thema und die Pflichtbegriffe müssen nicht im Text
   stehen. Ausschlussbegriffe und nötige Trefferzahl gelten weiterhin.
5. Jede Entscheidung wird begründet und am Ergebnis mitgeschrieben (Feld
   `kontext` der Aussage).

## Begründung
Die Regeln gehören zum Auftrag, weil der Kern themenneutral bleiben muss — das
ist eine verbindliche Vorgabe der Anforderungen. Eine Sonderregel „ignoriere
KI-Artikel" im Code würde den Kern auf Windows festlegen.

Das Feld `themenspezifisch` ist kein Zusatz, sondern der Kern der Lösung. Die
Frage „Geht es hier um mein Thema?" wird bei einer themengebundenen Quelle
bereits durch die Wahl der Quelle beantwortet. Sie im Text noch einmal zu
stellen, verwirft brauchbare Hinweise. Bei breiten Quellen ist es umgekehrt:
`api.msrc.microsoft.com/update-guide/rss` deckt **alle** Microsoft-Produkte ab,
dort muss der Text das Thema belegen. Dass diese Quelle derzeit null Treffer
liefert, ist deshalb korrekt und kein Fehler — unter den letzten 25
Sicherheitsmeldungen war keine zu Windows.

Gemessen an den 144 echten Inhalten des ersten Auftrags:

| Regel | Aussagen | Fehltreffer | verlorene echte Meldungen |
|---|---|---|---|
| bisher (ein Treffer irgendwo) | 24 | 6 | – |
| Pflichtbegriff, ohne Quellenwissen | 18 | 0 | 2 |
| Pflichtbegriff + `themenspezifisch` | 21 | 0 | 0 |

Verworfene Alternativen:

- **Nur „Update" aus den Suchbegriffen entfernen.** Behebt den Einzelfall, nicht
  die Ursache; der nächste allgemeine Begriff macht denselben Fehler.
- **Volltextsuche von Postgres (`tsvector`).** Mächtiger, aber die Bewertung
  läge wieder in SQL und wäre nicht mit Tests belegbar. Bleibt möglich, wenn die
  Begriffslisten nicht mehr ausreichen.
- **Die KI entscheiden lassen.** Widerspricht der Arbeitsteilung aus den
  Anforderungen: Die KI liest Texte, deterministische Regeln entscheiden.
- **Treffer am Wortanfang und Wortende verlangen.** Klingt strenger, würde aber
  „KB5000001" nicht mehr finden — also gerade die Kennungen, um die es geht.

## Konsequenzen
- Die Vorbelegung `mindest_treffer = 1` und leere Begriffslisten entsprechen
  genau dem bisherigen Verhalten. Bestehende Aufträge ändern sich durch die
  Migration nicht von selbst; erst gesetzte Werte wirken.
- 17 neue Tests in `tests/relevanz.test.ts`. Der Artikel, der es auf die
  Plattform geschafft hatte, steht als erster Testfall darin — derselbe Fehler
  kann nicht unbemerkt zurückkommen.
- Der Auswertungslauf meldet jetzt, wie viele Inhalte geprüft und wie viele
  aussortiert wurden. Vorher war nur die Zahl der Treffer sichtbar, wodurch der
  Fehler lange unbemerkt blieb.
- Begriffe und das Feld `themenspezifisch` waren zunächst nur über die
  Datenbank änderbar. Mit ADR 0009 sind sie in der Oberfläche bearbeitbar —
  genau deshalb, weil eine Einstellung, die nur mit Datenbankzugang erreichbar
  ist, nicht gepflegt wird.
