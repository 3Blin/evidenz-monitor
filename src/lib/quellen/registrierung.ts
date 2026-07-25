/**
 * Zuordnung Quelle -> Zugangsweg (Adapter).
 *
 * Warum an der Adresse und nicht am Typ: Das Feld `typ` im Schema beschreibt,
 * *wer* veröffentlicht (Fachmedium, Forum, Hersteller), nicht *wie* abgerufen
 * wird. Der Reddit-Feed des ersten Auftrags steht zum Beispiel als 'community'
 * und ist trotzdem ein RSS-Feed. Deshalb entscheidet die Adresse über den
 * Zugangsweg - sie ist die Angabe, die tatsächlich darüber Auskunft gibt.
 *
 * Sollte das später zu grob werden, ist der richtige Weg eine eigene Spalte
 * `zugangsweg` per Migration und ADR - nicht eine Sonderregel im Code.
 */
import type { QuellenAdapter } from "./adapter";
import { rssAdapter } from "./rss";
import { webAdapter } from "./web";

/** Quellen dieses Typs werden nicht abgerufen, sondern eingeliefert (ADR 0002). */
export const EINGELIEFERTER_TYP = "extern_agent";

const FEED_MUSTER = /(\.(rss|atom|xml)(\?|$))|(\/(rss|feed|atom)\b)|(feed=|format=rss)/i;

/** Erkennt an der Adresse, ob es ein Feed ist. */
export function istFeedAdresse(url: string): boolean {
  return FEED_MUSTER.test(url);
}

/**
 * Liefert den Adapter für eine Quelle. Wirft bei eingelieferten Quellen -
 * die holt niemand ab, und stilles Überspringen würde den Fehler verstecken.
 */
export function adapterFuerQuelle(quelle: { readonly url: string; readonly typ: string }): QuellenAdapter {
  if (quelle.typ === EINGELIEFERTER_TYP) {
    throw new Error(
      `Quellen vom Typ ${EINGELIEFERTER_TYP} werden eingeliefert, nicht abgerufen`,
    );
  }
  return istFeedAdresse(quelle.url) ? rssAdapter : webAdapter;
}
