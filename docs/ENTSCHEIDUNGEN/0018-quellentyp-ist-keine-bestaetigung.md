# ADR 0018: Der Quellentyp ist keine Bestätigung
Datum: 01.08.2026 · Status: angenommen · Freigegeben am: 01.08.2026

## Kontext
`klassifiziereGruppe` stufte jeden Beitrag aus einer als offiziell eingetragenen
Quelle (`hersteller_offiziell`, `status_seite`) als `offizielle_bestaetigung`
ein. Das Reifegrad-Regelwerk hebt eine Aussage bei dieser Klassifikation auf
**Stufe 6 — „Offiziell bestätigt"**.

Damit genügte es, dass eine zuständige Stelle *überhaupt etwas veröffentlicht
hat*, um eine Aussage als offiziell bestätigt auszuweisen. Nicht bewertet wurde,
**was** sie veröffentlicht hat.

Konkret hätten alle drei Fälle „offiziell bestätigt" ergeben:

- ein **Dementi** („dieses Verhalten ist uns nicht bekannt und nicht reproduzierbar")
- ein **Zwischenstand** („wir prüfen den Sachverhalt")
- eine Meldung über ein **ganz anderes Teilproblem**, die nur zufällig in
  dieselbe Meldungsgruppe geriet

Für ein System, dessen erklärter Zweck es ist, Falschmeldungen zu erkennen und
den Ursprung einer Behauptung zu ermitteln, ist der erste Fall der schlimmste
denkbare Fehler: **Es hätte eine Widerlegung als Bestätigung ausgewiesen.**

### Ausmaß im Betrieb
Zum Zeitpunkt der Entdeckung, an den echten Daten gezählt:

| Stufe | Aussagen |
|---|---|
| 1 — Unbestätigter Einzelhinweis | 43 |
| 2 — Mehrfach beobachtet | 9 |
| **6 — Offiziell bestätigt** | **52** |

**Die Hälfte aller Aussagen stand auf Stufe 6**, und keine einzige davon war
inhaltlich geprüft — die KI-Analyse ist nicht angeschlossen (ADR 0011). Der
höchste ausgewiesene Belastbarkeitsgrad des Systems beruhte ausschließlich
darauf, wer etwas veröffentlicht hat.

## Entscheidung

### 1. Die Vorklassifikation vergibt ausschließlich `stuetzt`
Ohne Sprachverständnis ist über einen Beleg nur feststellbar, dass er zur
Meldungsgruppe gehört. `widerspricht`, `offizielle_bestaetigung`,
`offizielle_widerlegung` und `korrektur` setzt ausschließlich die KI-Analyse.

Das Reifegrad-Regelwerk selbst bleibt **unverändert**. Es war nie falsch: Es
verlangt eine inhaltliche Klassifikation und hat sie bekommen — nur war sie
erfunden. Der Fehler lag eine Ebene darüber.

### 2. Die Angabe geht nicht verloren — sie wechselt die Rolle
Dass eine zuständige Primärquelle beteiligt ist, ist eine wertvolle Information.
Sie steht jetzt in der Begründung des Belegs:

> „Früheste Veröffentlichung dieser Meldung. Beitrag einer zuständigen
> Primärquelle — ob er den Sachverhalt bestätigt oder ihm widerspricht, ist ohne
> inhaltliche Prüfung nicht entscheidbar."

Als **Hinweis**, nicht als Urteil. Der Ring um offizielle Quellen im
Quellennetz bleibt ebenfalls; auch er behauptet nichts, er zeigt nur, wer
spricht.

### 3. Ohne KI-Analyse endet die Leiter bei Stufe 2 — ausnahmslos
Die Ausnahme aus ADR 0011 („sofern keine offizielle Primärquelle beteiligt
ist") entfällt. Sie war derselbe Fehlschluss ein zweites Mal, nur an anderer
Stelle.

ADR 0011 hatte richtig erkannt, dass Unabhängigkeit zweier Herausgeber ohne
Sprachverständnis nicht feststellbar ist, und hatte daraus die vorsichtige
Annahme abgeleitet. Dieselbe Überlegung gilt für Bestätigung, und sie wurde
damals nicht zu Ende geführt: **Ob eine Äußerung zustimmt oder widerspricht, ist
genauso eine inhaltliche Frage wie die Frage nach eigener Recherche.**

## Begründung
Die Leitregel dieses Projekts lautet: *Ein zu niedriger Ausweis ist ein Mangel,
ein zu hoher ist eine Falschaussage.* Sie ist bewusst nicht symmetrisch. 52
Aussagen fallen mit dieser Änderung von Stufe 6 auf 1 oder 2 — das ist kein
Verlust, sondern die Berichtigung einer Behauptung, die nie gedeckt war.

Der wiederkehrende Fehler, dem beide Fassungen aufgesessen sind, hat eine Form,
die man sich merken kann: **Eine Eigenschaft der Quelle wurde für eine
Eigenschaft der Aussage gehalten.** Wer veröffentlicht, ist Metadatum. Was
gesagt wurde, ist Inhalt. Zwischen beiden liegt Sprachverständnis, und das hat
dieses System derzeit nicht.

Verworfene Alternativen:

- **Eine eigene, niedrigere Stufe für „zuständige Stelle hat sich geäußert".**
  Klingt maßvoll, verschiebt das Problem aber nur: Auch eine solche Stufe würde
  über einer bloßen Mehrfachbeobachtung stehen, obwohl der Inhalt der Äußerung
  weiterhin unbekannt ist. Ein Dementi stünde damit über einem Bericht.
- **Nach Schlüsselwörtern im Titel klassifizieren** („bestätigt", „behoben",
  „kein Fehler"). Genau die Art Heuristik, die bei Verneinungen, Zitaten und
  Fragen zuverlässig das Gegenteil trifft — und sie wäre nicht themenneutral.
- **Es lassen, bis die KI angeschlossen ist.** Hieße, wissentlich die Hälfte
  aller Aussagen falsch auszuweisen. Der Zeitpunkt des KI-Anschlusses ist offen;
  die Falschaussage ist es jetzt.

## Konsequenzen
- `klassifiziereGruppe` vergibt nur noch `stuetzt`; die Begründung nennt die
  Primärquelle. Drei neue Tests, darunter einer, der belegt, dass die Leiter
  auch bei vier Belegen mit zwei offiziellen Quellen nicht über Stufe 2 geht.
- Beim nächsten Auswertungslauf fallen die 52 Aussagen auf Stufe 1 oder 2. Der
  Reifegrad-Verlauf bleibt erhalten — frühere Bewertungen werden nicht
  überschrieben (Anforderung 4.7), die Berichtigung ist also nachvollziehbar.
- Das Dashboard wirkt danach **deutlich zurückhaltender**. Das ist der Punkt:
  Vorher zeigte es eine Belastbarkeit, die nicht bestand.
- `REGEL_VERSION` bleibt bei 1.0.0 — die Regeln des Reifegrads haben sich nicht
  geändert, nur die Eingangsdaten. Das ist die richtige Trennung: Die Version
  bezeichnet das Regelwerk, nicht seine Zulieferer.
- Der Wert der KI-Analyse steigt damit erheblich. Sie ist jetzt der einzige Weg
  über Stufe 2 hinaus — was ehrlich ist und was in ADR 0011 schon so gemeint war.
