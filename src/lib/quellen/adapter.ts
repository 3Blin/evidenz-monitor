/**
 * Adapter-Schnittstelle für Quellen (Vertrag ADR 0002).
 *
 * Zweck: Themen sind Daten, Zugangswege sind Code. Ein neuer Zugangsweg
 * (z. B. eine JSON-API) wird als weiterer Adapter ergänzt, ohne dass der
 * übrige Kern verändert werden muss.
 */

/** Ein von einer Quelle geholter Beitrag, vor der Speicherung. */
export interface RohInhalt {
  readonly url: string;
  readonly titel: string;
  readonly autor: string | null;
  readonly veroeffentlichtAm: Date | null;
  readonly auszug: string;
}

export interface QuellenAdapter {
  readonly name: string;
  /** Holt neue Beiträge. Wirft bei Fehlern - Fehler werden nie verschluckt. */
  abrufen(url: string, signal?: AbortSignal): Promise<readonly RohInhalt[]>;
}

/** Kürzt Inhalte auf einen zitierfähigen Auszug (Urheberrecht, Anforderung 4.2). */
export function auszugBilden(text: string, maxZeichen = 1200): string {
  const bereinigt = text.replace(/\s+/g, " ").trim();
  if (bereinigt.length <= maxZeichen) return bereinigt;
  return `${bereinigt.slice(0, maxZeichen)} […]`;
}
