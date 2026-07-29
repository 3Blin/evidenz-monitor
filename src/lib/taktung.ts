/**
 * Taktung der Sammelläufe.
 *
 * Anlass: Das Feld `intervall_minuten` stand seit Migration 0001 im Schema,
 * wurde aber von keinem Lauf gelesen - der Sammellauf nahm immer alle aktiven
 * Aufträge. Eine Einstellung, die nichts bewirkt, ist schlimmer als keine:
 * Man verlässt sich auf sie.
 *
 * Der Takt ist keine feste Zahl, sondern ein Bereich. Grund: Wie schnell ein
 * Thema läuft, weiß man vorher nicht, und es ändert sich. Ein Auftrag über
 * eine akute Störung braucht Minuten, einer über eine Gesetzesnovelle Tage -
 * und derselbe Auftrag braucht in der heißen Phase etwas anderes als drei
 * Wochen später.
 *
 * Deshalb stellt die Nutzerin die Grenzen ein, und der Takt bewegt sich
 * zwischen ihnen: Bringt ein Lauf neue Beiträge, rückt er in Richtung
 * Untergrenze; bringt er nichts, in Richtung Obergrenze. Beides in Schritten
 * um den Faktor zwei - schnell genug, um binnen weniger Läufe anzukommen, und
 * langsam genug, dass ein einzelner Ausreißer den Takt nicht umwirft.
 *
 * Reine Rechenlogik ohne Netz- und Datenbankzugriff, damit vollständig
 * prüfbar (Modulgrenze 3).
 */

/** Untergrenze für die Untergrenze. Schützt fremde Server vor uns. */
export const KLEINSTER_TAKT_MINUTEN = 5;

/** Obergrenze für die Obergrenze: 30 Tage. Darüber ist es keine Beobachtung mehr. */
export const GROESSTER_TAKT_MINUTEN = 43_200;

export interface Taktbereich {
  readonly minMinuten: number;
  readonly maxMinuten: number;
}

/**
 * Bringt einen von Hand eingegebenen Bereich in eine brauchbare Form.
 *
 * Wichtig ist der letzte Schritt: Eine vertauschte Eingabe (Untergrenze über
 * Obergrenze) wird getauscht statt abgewiesen. Sonst stünde die Nutzerin vor
 * einer Fehlermeldung, obwohl völlig klar ist, was sie meinte.
 */
export function pruefeBereich(minMinuten: number, maxMinuten: number): Taktbereich {
  const grenze = (wert: number, ersatz: number): number => {
    const zahl = Number.isFinite(wert) ? Math.round(wert) : ersatz;
    return Math.min(GROESSTER_TAKT_MINUTEN, Math.max(KLEINSTER_TAKT_MINUTEN, zahl));
  };
  const a = grenze(minMinuten, 60);
  const b = grenze(maxMinuten, 1440);
  return a <= b ? { minMinuten: a, maxMinuten: b } : { minMinuten: b, maxMinuten: a };
}

/**
 * Der Takt für den nächsten Lauf.
 *
 * @param bereich      Die von der Nutzerin gesetzten Grenzen.
 * @param aktuell      Bisheriger Takt; null bedeutet "noch nie gelaufen".
 * @param ertragreich  Hat der letzte Lauf neue Beiträge gebracht?
 */
export function naechsterTakt(
  bereich: Taktbereich,
  aktuell: number | null,
  ertragreich: boolean,
): number {
  const { minMinuten, maxMinuten } = pruefeBereich(bereich.minMinuten, bereich.maxMinuten);

  // Ohne Vorgeschichte am schnellsten Ende beginnen. Ein neuer Auftrag soll
  // zügig erste Ergebnisse zeigen; wird nichts gefunden, bremst er sich von
  // selbst.
  if (aktuell === null || !Number.isFinite(aktuell)) return minMinuten;

  const gerundet = Math.max(minMinuten, Math.min(maxMinuten, Math.round(aktuell)));
  const neu = ertragreich ? gerundet / 2 : gerundet * 2;
  return Math.max(minMinuten, Math.min(maxMinuten, Math.round(neu)));
}

/** Zeitpunkt des nächsten Laufs. */
export function naechsterLauf(jetzt: Date, taktMinuten: number): Date {
  return new Date(jetzt.getTime() + Math.max(1, taktMinuten) * 60_000);
}

/**
 * Ist ein Auftrag fällig? Ohne gesetzten Zeitpunkt ja - ein Auftrag, der noch
 * nie lief, wartet nicht erst einen Takt lang.
 */
export function istFaellig(naechsterLaufAm: Date | null, jetzt: Date): boolean {
  if (!naechsterLaufAm) return true;
  return naechsterLaufAm.getTime() <= jetzt.getTime();
}

/** Klartext für die Oberfläche: "alle 90 Minuten" wird zu "alle 1,5 Stunden". */
export function taktInWorten(minuten: number): string {
  if (minuten < 60) return `${minuten} Minuten`;
  if (minuten < 60 * 48) {
    const stunden = minuten / 60;
    const text = Number.isInteger(stunden) ? String(stunden) : stunden.toFixed(1).replace(".", ",");
    return `${text} Stunden`;
  }
  const tage = minuten / 1440;
  const text = Number.isInteger(tage) ? String(tage) : tage.toFixed(1).replace(".", ",");
  return `${text} Tage`;
}
