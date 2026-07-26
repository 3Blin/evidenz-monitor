/**
 * Kennungen aus Titel und Auszug lesen.
 *
 * Zweck: Zwei Beiträge über dieselbe Sache erkennen, auch wenn ihre Titel
 * kaum gemeinsame Wörter haben. Beispiel aus dem ersten Betrieb - beide
 * Beiträge behandeln dieselbe Update-Schleife, die Titelähnlichkeit liegt
 * aber bei 0,11:
 *
 *   "How to Stop the Win 11 KB5094126 Installation Loop and Safely Upgrade …"
 *   "Urgent: Stuck KB5094126 (2026-06 Security Update) Loop on ASUS M413A"
 *
 * Gemeinsam ist ihnen die Kennung KB5094126. Solche Kennungen sind
 * fälschungssicher im Wortsinn: Sie stehen für genau einen Gegenstand,
 * anders als ein geteiltes Wort wie "Update".
 *
 * Bewusst themenneutral: Die Muster beschreiben die *Form* von Kennungen
 * (Buchstaben-Zahl-Kombinationen mit Trennzeichen), nicht das Thema Windows.
 * Ein Auftrag über Arzneimittelrückrufe findet mit demselben Code seine
 * Chargennummern, ein Auftrag über Gesetzgebung seine Drucksachennummern.
 */

/**
 * Muster für Kennungen. Jedes verlangt eine Ziffernfolge von mindestens vier
 * Stellen - kürzere Kombinationen wie "Top 8" oder "45 km/h" sind keine
 * Kennungen, sondern Fließtext.
 */
const MUSTER: readonly RegExp[] = [
  // CVE-2026-62835 und verwandte Register (CWE, GHSA)
  /\b(?:CVE|CWE|GHSA)-\d{4}-\d{3,}\b/giu,
  // KB5094126, MS26-013, RFC 9110 - Buchstabenkürzel plus Nummer.
  // Ausdrücklich nur Großschreibung: Mit Kleinbuchstaben würde auch "the
  // 2026" oder "das 2026" als Kennung gelten, und jeder Beitrag mit dieser
  // Wendung teilte sich eine Kennung mit jedem anderen. Kennungen werden in
  // der Praxis groß geschrieben; ein verpasstes "kb5094126" kostet eine
  // Verknüpfung, ein falsches "THE2026" erfindet eine.
  /\b[A-Z]{2,4}[-\s]?\d{4,}\b/gu,
  // Buildnummern: 26220.8925, 28020.2539. Der Nachkommateil braucht drei
  // Stellen, sonst gälte auch das Datum "2026.07" als Kennung.
  /\b\d{4,6}\.\d{3,5}\b/gu,
];

/**
 * UUIDs sehen aus wie Kennungen, sind aber keine: Ihr erster Block
 * ("ACF35976-45A5-…") erfüllt zufällig das Muster Buchstaben-plus-Ziffern.
 * Beim Messen an echten Daten stand genau so ein Bruchstück einer Geräte-UUID
 * kurz davor, zwei Beiträge zu verbinden. Ein Zufallswert darf nie ein
 * Zusammenhang sein, deshalb fallen UUIDs vorher heraus.
 *
 * Als Trennzeichen kommen auch typografische Striche vor - Foren-Software
 * ersetzt den Bindestrich gern durch U+2010 bis U+2015.
 */
const UUID = /\b[0-9A-F]{8}[-‐-―][0-9A-F]{4}(?:[-‐-―][0-9A-F]{4}){2}[-‐-―][0-9A-F]{12}\b/giu;

/**
 * Zeichen, die innerhalb einer Kennung bedeutungslos sind. "KB 5094126",
 * "KB-5094126" und "KB5094126" bezeichnen dieselbe Sache.
 */
function vereinheitliche(roh: string): string {
  return (
    roh
      .toUpperCase()
      // "KB 5094126" und "KB5094126" sind dieselbe Kennung.
      .replace(/\s+/gu, "")
      // Ebenso "KB-5094126". Der Strich zwischen zwei Ziffern bleibt, sonst
      // fielen CVE-2026-62835 und CVE-2026-6283 zusammen.
      .replace(/(?<=[A-Z])-(?=\d)/gu, "")
  );
}

/**
 * Alle Kennungen eines Textes, vereinheitlicht und ohne Wiederholungen.
 * Die Reihenfolge folgt dem Text, damit Ergebnisse vorhersagbar bleiben.
 */
export function kennungen(...texte: readonly string[]): readonly string[] {
  const gefunden = new Set<string>();
  for (const roher of texte) {
    if (!roher) continue;
    let rest = roher.replace(new RegExp(UUID.source, UUID.flags), " ");

    for (const muster of MUSTER) {
      // Ein eigener Ausdruck je Aufruf: Ein geteilter Ausdruck mit /g merkt
      // sich lastIndex und liefert beim zweiten Aufruf andere Ergebnisse.
      const treffer = [...rest.matchAll(new RegExp(muster.source, muster.flags))];
      for (const t of treffer) {
        const wert = vereinheitliche(t[0]);
        // Eine Kennung ohne Ziffern ist keine.
        if (/\d{4,}/u.test(wert)) gefunden.add(wert);
      }
      // Erkanntes wird aus dem Text entfernt, bevor das nächste Muster läuft.
      // Ohne diesen Schritt fände das allgemeine Muster in "CVE-2026-62835"
      // zusätzlich das Bruchstück "CVE-2026" - und alle Sicherheitsmeldungen
      // eines Jahrgangs teilten sich dann die Kennung "CVE2026". Beim Messen
      // an echten Daten hätte das sämtliche MSRC-Meldungen zu einer einzigen
      // Meldung verschmolzen.
      rest = rest.replace(new RegExp(muster.source, muster.flags), " ");
    }
  }
  return [...gefunden];
}

/**
 * Gemeinsame Kennungen zweier Beiträge. Eine einzige genügt, um sie
 * derselben Meldung zuzuordnen - genau das ist der Sinn einer Kennung.
 */
export function gemeinsameKennungen(
  a: readonly string[],
  b: readonly string[],
): readonly string[] {
  const menge = new Set(b);
  return a.filter((k) => menge.has(k));
}
