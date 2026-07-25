/**
 * Datenzugriff über Supabase. Zweck: Die Weboberfläche ruft eine einzige
 * geprüfte Datenbankfunktion auf, die die Zugriffsrechte selbst durchsetzt
 * (eigener Auftrag oder ausdrücklich freigegebene Demo). Der veröffentlichte
 * Schlüssel ist dafür vorgesehen, öffentlich zu sein - er gewährt nichts,
 * was die Zeilen-Sicherheit nicht erlaubt.
 */
import { z } from "zod";

const knotenSchema = z.object({
  id: z.string(), label: z.string(), quellentyp: z.string(),
  gewicht: z.number(), offiziell: z.boolean(),
});
const kantenSchema = z.object({ von: z.string(), nach: z.string(), art: z.string() });
const aussageSchema = z.object({
  id: z.string(), sachverhalt: z.string(), stufe: z.number().min(1).max(8),
  ausloeser: z.string(), belegAnzahl: z.number(),
  herausgeber: z.array(z.string()), seit: z.string().nullable(),
});

export const dashboardSchema = z.object({
  auftrag: z.object({ id: z.string(), name: z.string(), fragestellung: z.string() }),
  kennzahlen: z.object({
    quellen: z.number(), quellenFehler: z.number(), inhalte: z.number(),
    aussagen: z.number(), letzterAbruf: z.string().nullable(),
  }),
  knoten: z.array(knotenSchema),
  kanten: z.array(kantenSchema),
  aussagen: z.array(aussageSchema),
});

export type DashboardDaten = z.infer<typeof dashboardSchema>;

export async function ladeDashboardVonSupabase(
  basisUrl: string, schluessel: string, auftragId: string,
): Promise<DashboardDaten> {
  const antwort = await fetch(`${basisUrl}/rest/v1/rpc/dashboard_daten`, {
    method: "POST",
    headers: { apikey: schluessel, Authorization: `Bearer ${schluessel}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_auftrag: auftragId }),
    cache: "no-store",
  });
  if (!antwort.ok) {
    throw new Error(`Dashboard konnte nicht geladen werden (HTTP ${antwort.status})`);
  }
  const roh: unknown = await antwort.json();
  const geprueft = dashboardSchema.safeParse(roh);
  if (!geprueft.success) {
    throw new Error(
      `Antwort der Datenbank entspricht nicht dem erwarteten Aufbau: ${geprueft.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return geprueft.data;
}
