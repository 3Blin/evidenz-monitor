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

/**
 * Liest eine Antwort, bricht aber bei maxBytes ab.
 *
 * Gemeinsam für alle Adapter, weil jeder von ihnen dieselbe Gefahr hat: Ein
 * fremder Server bestimmt, wie lang seine Antwort ist. Ohne Obergrenze
 * entscheidet er damit über unseren Speicher.
 */
export async function begrenztLesen(antwort: Response, maxBytes: number): Promise<string> {
  const koerper = antwort.body;
  if (!koerper) return "";
  const leser = koerper.getReader();
  const teile: Uint8Array[] = [];
  let gelesen = 0;
  try {
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      if (!value) continue;
      gelesen += value.byteLength;
      teile.push(value);
      if (gelesen >= maxBytes) break;
    }
  } finally {
    await leser.cancel().catch(() => undefined);
  }
  return new TextDecoder("utf-8").decode(
    Buffer.concat(teile.map((t) => Buffer.from(t))).subarray(0, maxBytes),
  );
}
