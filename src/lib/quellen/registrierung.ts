/**
 * Zuordnung Quelle -> Zugangsweg (Adapter).
 *
 * Bis ADR 0014 entschied allein die Adresse: sieht sie nach Feed aus, dann
 * RSS, sonst Webseite. Diese Regel bleibt die Vorgabe und deckt den Regelfall
 * ab, ohne dass jemand etwas einstellen muss.
 *
 * Für Wege, die man einer Adresse nicht ansieht, gibt es nun die Spalte
 * `zugangsweg` (Migration 0008) - genau der Weg, den der Kopf dieser Datei
 * vorher schon vorgezeichnet hat. `https://such.beispiel.tld/search?q=…` ist
 * von einer gewöhnlichen Webseite nicht zu unterscheiden; eine Sonderregel im
 * Code dafür ("wenn die Adresse /search enthält…") hieße, die Entscheidung des
 * Betreibers in den Code zu schreiben.
 *
 * `typ` bleibt außen vor: Der sagt, *wer* veröffentlicht (Fachmedium, Forum,
 * Hersteller), und davon hängt die Reifegrad-Einstufung ab. Der Reddit-Feed des
 * ersten Auftrags steht als 'community' und ist trotzdem ein RSS-Feed. Wie wir
 * lesen, gehört nicht in dieselbe Spalte wie das, was wir bewerten.
 */
import type { QuellenAdapter } from "./adapter";
import { gdeltAdapter } from "./gdelt";
import { rssAdapter } from "./rss";
import { sucheAdapter } from "./suche";
import { webAdapter } from "./web";

/** Quellen dieses Typs werden nicht abgerufen, sondern eingeliefert (ADR 0002). */
export const EINGELIEFERTER_TYP = "extern_agent";

/** Erlaubte Werte der Spalte `zugangsweg`, gleichlautend mit Migration 0008. */
export const ZUGANGSWEGE = ["automatisch", "feed", "web", "suche", "gdelt"] as const;
export type Zugangsweg = (typeof ZUGANGSWEGE)[number];

export const ZUGANGSWEG_VORGABE: Zugangsweg = "automatisch";

/** Klartext für die Oberfläche. Der gespeicherte Wert erklärt sich nicht selbst. */
export const ZUGANGSWEG_TEXT: Record<Zugangsweg, string> = {
  automatisch: "Automatisch erkennen (Feed oder Webseite)",
  feed: "Feed (RSS oder Atom)",
  web: "Einzelne Webseite",
  suche: "Suche (SearXNG)",
  gdelt: "GDELT (weltweite Nachrichtensuche)",
};

const FEED_MUSTER = /(\.(rss|atom|xml)(\?|$))|(\/(rss|feed|atom)\b)|(feed=|format=rss)/i;

/** Erkennt an der Adresse, ob es ein Feed ist. */
export function istFeedAdresse(url: string): boolean {
  return FEED_MUSTER.test(url);
}

export function istZugangsweg(wert: unknown): wert is Zugangsweg {
  return typeof wert === "string" && (ZUGANGSWEGE as readonly string[]).includes(wert);
}

/**
 * Liefert den Adapter für eine Quelle. Wirft bei eingelieferten Quellen -
 * die holt niemand ab, und stilles Überspringen würde den Fehler verstecken.
 */
export function adapterFuerQuelle(quelle: {
  readonly url: string;
  readonly typ: string;
  readonly zugangsweg?: string | null;
}): QuellenAdapter {
  if (quelle.typ === EINGELIEFERTER_TYP) {
    throw new Error(
      `Quellen vom Typ ${EINGELIEFERTER_TYP} werden eingeliefert, nicht abgerufen`,
    );
  }

  const weg = quelle.zugangsweg ?? ZUGANGSWEG_VORGABE;
  switch (weg) {
    case "feed":
      return rssAdapter;
    case "web":
      return webAdapter;
    case "suche":
      return sucheAdapter;
    case "gdelt":
      return gdeltAdapter;
    case "automatisch":
      return istFeedAdresse(quelle.url) ? rssAdapter : webAdapter;
    default:
      // Ein unbekannter Wert wird nicht stillschweigend als "automatisch"
      // behandelt. Er kann nur aus einer neueren Datenbank in eine ältere
      // Anwendung geraten sein - und dann wäre jede Deutung geraten.
      throw new Error(`Unbekannter Zugangsweg: ${weg}`);
  }
}
