/**
 * Auswahlliste der Beobachtungsaufträge (ADR 0009).
 *
 * Zweck: Bisher zeigte die Oberfläche genau einen Auftrag, festgelegt über die
 * Umgebungsvariable NEXT_PUBLIC_AUFTRAG. Damit ließ sich die Themenneutralität
 * des Kerns nicht zeigen - obwohl sie eine verbindliche Vorgabe ist. Jetzt gibt
 * die Datenbank die freigegebenen Aufträge heraus und der Wert aus der
 * Umgebungsvariable ist nur noch die Vorauswahl.
 *
 * Die Funktion in der Datenbank gibt bewusst nur Kennung, Name und
 * Fragestellung heraus - keine Besitzer, keine Suchbegriffe.
 */
import { z } from "zod";

export const auftragsEintragSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  fragestellung: z.string(),
});

export const auftragslisteSchema = z.array(auftragsEintragSchema);

export type AuftragsEintrag = z.infer<typeof auftragsEintragSchema>;

export async function ladeOeffentlicheAuftraege(
  basisUrl: string,
  schluessel: string,
): Promise<readonly AuftragsEintrag[]> {
  const antwort = await fetch(`${basisUrl}/rest/v1/rpc/oeffentliche_auftraege`, {
    method: "POST",
    headers: {
      apikey: schluessel,
      Authorization: `Bearer ${schluessel}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (!antwort.ok) {
    throw new Error(`Auftragsliste konnte nicht geladen werden (HTTP ${antwort.status})`);
  }
  const geprueft = auftragslisteSchema.safeParse(await antwort.json());
  if (!geprueft.success) {
    throw new Error(
      `Auftragsliste entspricht nicht dem erwarteten Aufbau: ${geprueft.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return geprueft.data;
}

/**
 * Wählt aus, welcher Auftrag gezeigt wird.
 *
 * Reihenfolge: ausdrücklich gewünschter Auftrag, sonst die Vorauswahl aus der
 * Umgebung, sonst der erste freigegebene. Ein gewünschter Auftrag, den die Liste
 * nicht enthält, wird nicht stillschweigend ersetzt - er wird durchgelassen,
 * damit ein angemeldeter Nutzer seine eigenen, nicht freigegebenen Aufträge
 * ansehen kann. Ob er darf, entscheidet die Datenbank.
 */
export function waehleAuftrag(
  gewuenscht: string | undefined,
  vorauswahl: string,
  liste: readonly AuftragsEintrag[],
): string {
  if (gewuenscht) return gewuenscht;
  if (liste.some((a) => a.id === vorauswahl)) return vorauswahl;
  return liste[0]?.id ?? vorauswahl;
}
