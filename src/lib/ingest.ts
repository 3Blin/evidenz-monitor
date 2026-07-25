/**
 * Einlieferung durch externe Sammler (ADR 0002 Punkt 2, ADR 0007).
 *
 * Zweck: Kanäle mit Login- oder Cookie-Zwang sollen nicht im Kern abgerufen
 * werden - riskante Beschaffung läuft beim Nutzer, unter dessen Kontrolle. Die
 * Informationen kommen über diese Schnittstelle herein und durchlaufen danach
 * genau dieselbe Verarbeitung wie selbst abgerufene Inhalte.
 *
 * Der Zugriffsschutz liegt in der Datenbank: Die Funktion inhalt_einliefern
 * prüft das Token selbst (nur als Hash gespeichert) und ermittelt daraus den
 * Auftrag. Die Anwendung braucht damit weiterhin keine Datenbank-Zugangsdaten
 * (ADR 0005) und kann auch keinen falschen Auftrag adressieren.
 */
import { z } from "zod";
import { auszugBilden } from "./quellen/adapter";

/** Höchstzahl je Anfrage. Dieselbe Grenze prüft die Datenbank noch einmal. */
export const MAX_INHALTE_JE_ANFRAGE = 50;

const inhaltSchema = z.object({
  url: z.string().url("url muss eine Adresse sein"),
  titel: z.string().min(1, "titel fehlt").max(500),
  autor: z.string().max(200).nullish(),
  veroeffentlichtAm: z
    .string()
    .datetime({ offset: true, message: "veroeffentlichtAm muss ein Zeitpunkt nach ISO 8601 sein" })
    .nullish(),
  auszug: z.string().min(1, "auszug fehlt"),
});

export const einlieferungSchema = z.object({
  quelle: z.object({
    url: z.string().url("quelle.url muss eine Adresse sein"),
    herausgeber: z.string().min(1, "quelle.herausgeber fehlt").max(200),
  }),
  inhalte: z
    .array(inhaltSchema)
    .min(1, "inhalte darf nicht leer sein")
    .max(MAX_INHALTE_JE_ANFRAGE, `höchstens ${MAX_INHALTE_JE_ANFRAGE} Inhalte je Anfrage`),
});

export type Einlieferung = z.infer<typeof einlieferungSchema>;

export const einlieferungsErgebnisSchema = z.object({
  auftrag: z.string(),
  quelle: z.string(),
  angenommen: z.number(),
  uebersprungen: z.number(),
});

export type EinlieferungsErgebnis = z.infer<typeof einlieferungsErgebnisSchema>;

/**
 * Abweisung durch die Datenbank, mit dem SQL-Zustand als Unterscheidung.
 * Die Route macht daraus die passende HTTP-Antwort, ohne die Meldung zu raten.
 */
export class EinlieferungAbgewiesen extends Error {
  constructor(
    readonly sqlZustand: string,
    meldung: string,
  ) {
    super(meldung);
    this.name = "EinlieferungAbgewiesen";
  }
}

/** SQL-Zustand für "Token unbekannt oder fehlend". */
export const ZUSTAND_KEIN_ZUGRIFF = "42501";
/** SQL-Zustand für "Angaben unbrauchbar". */
export const ZUSTAND_UNGUELTIGE_ANGABE = "22023";

const fehlerSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Kürzt Auszüge auf zitierfähige Länge. Bewusst hier und nicht beim Absender:
 * die Urheberrechtsauflage aus Anforderung 4.2 gilt unabhängig davon, was ein
 * fremder Sammler schickt.
 */
export function auszuegeKuerzen(daten: Einlieferung): Einlieferung {
  return {
    quelle: daten.quelle,
    inhalte: daten.inhalte.map((i) => ({ ...i, auszug: auszugBilden(i.auszug) })),
  };
}

export async function liefereInhalteEin(
  basisUrl: string,
  schluessel: string,
  token: string,
  daten: Einlieferung,
): Promise<EinlieferungsErgebnis> {
  const bereinigt = auszuegeKuerzen(daten);

  const antwort = await fetch(`${basisUrl}/rest/v1/rpc/inhalt_einliefern`, {
    method: "POST",
    headers: {
      apikey: schluessel,
      Authorization: `Bearer ${schluessel}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_token: token,
      p_quelle: bereinigt.quelle,
      p_inhalte: bereinigt.inhalte,
    }),
    cache: "no-store",
  });

  if (!antwort.ok) {
    const roh: unknown = await antwort.json().catch(() => ({}));
    const fehler = fehlerSchema.safeParse(roh);
    throw new EinlieferungAbgewiesen(
      fehler.success ? (fehler.data.code ?? "") : "",
      fehler.success && fehler.data.message
        ? fehler.data.message
        : `Einlieferung fehlgeschlagen (HTTP ${antwort.status})`,
    );
  }

  const roh: unknown = await antwort.json();
  const geprueft = einlieferungsErgebnisSchema.safeParse(roh);
  if (!geprueft.success) {
    throw new Error(
      `Antwort der Datenbank entspricht nicht dem erwarteten Aufbau: ${geprueft.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return geprueft.data;
}

/** Liest das Token aus dem Authorization-Kopf. Nie protokollieren. */
export function tokenAusKopf(kopf: string | null): string | null {
  if (!kopf) return null;
  const treffer = /^Bearer\s+(\S+)$/i.exec(kopf.trim());
  return treffer?.[1] ?? null;
}
