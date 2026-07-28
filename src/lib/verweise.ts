/**
 * Verweise aus einem Beitrag lesen.
 *
 * Zweck: Eine Übernahme verlinkt fast immer das Original. Zwei Beiträge, die
 * auf dieselbe fremde Adresse zeigen, behandeln denselben Vorgang - das ist
 * ein härteres Signal als jede Wortähnlichkeit, weil es nicht von der
 * Formulierung abhängt.
 *
 * Zwei Beispiele aus den echten Daten: Beide Beiträge tragen denselben Titel
 * und verweisen beide auf denselben Artikel bei arstechnica.com. Der
 * Aggregator ist dabei nicht die Quelle, sondern zeigt auf sie.
 *
 * Themenneutral: Es geht um die Form von Adressen, nicht um bestimmte
 * Anbieter.
 */

const ADRESSE = /https?:\/\/[^\s<>"'()\[\]]+/giu;

/**
 * Adressen, die auf die Plattform selbst zeigen und deshalb nichts über den
 * Gegenstand aussagen. Ein Kommentarverweis verbindet jeden Beitrag eines
 * Aggregators mit jedem anderen - das wäre ein Zusammenhang aus Technik,
 * nicht aus Inhalt.
 */
const EIGENE_WEGE = /\/(?:item|comments|thread|user|profile|tag|search)\b/iu;

/** Kleinschreibung, ohne Nachlaufzeichen, ohne Sitzungs- und Werbeanhänge. */
function vereinheitliche(roh: string): string | null {
  let wert = roh.replace(/[.,;:!?)\]]+$/u, "");
  try {
    const adresse = new URL(wert);
    // Anhängsel zur Erfolgsmessung sagen nichts über den Inhalt und
    // unterscheiden sonst zwei Verweise auf dieselbe Seite.
    for (const name of [...adresse.searchParams.keys()]) {
      if (/^(?:utm_|ref|source|fbclid|gclid)/iu.test(name)) adresse.searchParams.delete(name);
    }
    adresse.hash = "";
    adresse.protocol = "https:";
    adresse.hostname = adresse.hostname.replace(/^www\./iu, "").toLowerCase();
    if (adresse.pathname !== "/" && adresse.pathname.endsWith("/")) {
      adresse.pathname = adresse.pathname.slice(0, -1);
    }
    wert = adresse.toString();
  } catch {
    return null;
  }
  return wert;
}

/**
 * Alle Verweise eines Textes, vereinheitlicht und ohne Wiederholungen.
 * `eigeneAdresse` ist die Adresse des Beitrags selbst; Verweise auf denselben
 * Rechner fallen heraus, weil sie nur auf die Plattform zurückzeigen.
 */
export function verweise(text: string, eigeneAdresse?: string): readonly string[] {
  if (!text) return [];
  let eigenerRechner = "";
  if (eigeneAdresse) {
    try {
      eigenerRechner = new URL(eigeneAdresse).hostname.replace(/^www\./iu, "").toLowerCase();
    } catch {
      eigenerRechner = "";
    }
  }

  const gefunden = new Set<string>();
  for (const treffer of text.matchAll(new RegExp(ADRESSE.source, ADRESSE.flags))) {
    const wert = vereinheitliche(treffer[0]);
    if (!wert) continue;
    if (EIGENE_WEGE.test(wert)) continue;
    if (eigenerRechner) {
      try {
        const rechner = new URL(wert).hostname.replace(/^www\./iu, "").toLowerCase();
        if (rechner === eigenerRechner) continue;
      } catch {
        continue;
      }
    }
    gefunden.add(wert);
  }
  return [...gefunden];
}

/** Verweise, auf die beide Beiträge zeigen. */
export function gemeinsameVerweise(
  a: readonly string[],
  b: readonly string[],
): readonly string[] {
  const menge = new Set(b);
  return a.filter((v) => menge.has(v));
}
