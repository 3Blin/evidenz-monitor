/**
 * API v1: Vorschlag für Relevanzregeln und Quellen (ADR 0010).
 *
 * Läuft auf dem Server, weil hier zwei Dinge zusammenkommen, die nie in den
 * Browser dürfen: der Verschlüsselungsschlüssel aus der Umgebung und der
 * entschlüsselte KI-Zugang des Nutzers. Der Browser bekommt ausschließlich
 * den fertigen Vorschlag zurück.
 *
 * Der Vorschlag wird nicht gespeichert. Er füllt die Felder des Formulars,
 * gespeichert wird erst, wenn ein Mensch auf Speichern drückt - die
 * Entscheidung bleibt beim Menschen.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { entschluessle } from "@/lib/krypto";
import { ladeVerschluesselungsSchluessel } from "@/lib/konfig";
import { supabaseAufServer } from "@/lib/supabase-server";
import { neueCorrelationId, vorgangsLogger } from "@/lib/logger";
import { baueAnweisung, leseVorschlag } from "@/lib/ki/vorschlag";
import { frageModell, type Anbieter } from "@/lib/ki/anbieter";

const anfrageSchema = z.object({
  name: z.string().min(1, "Der Name fehlt").max(120),
  fragestellung: z.string().min(1, "Die Fragestellung fehlt").max(400),
  zielbeschreibung: z.string().max(2000).optional(),
});

const zugangSchema = z.object({
  anbieter: z.enum(["anthropic", "openai", "kompatibel"]),
  endpunktUrl: z.string().nullable(),
  verschluesselt: z.string().min(16),
});

export async function POST(anfrage: Request): Promise<NextResponse> {
  const correlationId = neueCorrelationId();
  const log = vorgangsLogger(correlationId);

  let koerper: unknown;
  try {
    koerper = await anfrage.json();
  } catch {
    return NextResponse.json({ fehler: "Kein gültiges JSON", correlationId }, { status: 400 });
  }

  const geprueft = anfrageSchema.safeParse(koerper);
  if (!geprueft.success) {
    return NextResponse.json(
      {
        fehler: "Ungültige Anfrage",
        details: geprueft.error.issues.map((i) => `${i.path.join(".") || "?"}: ${i.message}`),
        correlationId,
      },
      { status: 400 },
    );
  }

  const supabase = await supabaseAufServer();
  const { data: sitzung } = await supabase.auth.getUser();
  if (!sitzung.user) {
    return NextResponse.json({ fehler: "Anmeldung erforderlich", correlationId }, { status: 401 });
  }

  // Zugang holen. Fehlt er, ist das kein Fehler des Servers, sondern eine
  // Voraussetzung, die die Nutzerin selbst erfüllen kann - deshalb 409 mit
  // einem Satz, der sagt, was zu tun ist.
  const { data: rohZugang, error: zugangsFehler } = await supabase.rpc("api_schluessel_geheim");
  if (zugangsFehler || !rohZugang) {
    return NextResponse.json(
      {
        fehler:
          "Für Vorschläge braucht es einen hinterlegten KI-Zugang. " +
          "Du kannst die Felder auch von Hand ausfüllen.",
        correlationId,
      },
      { status: 409 },
    );
  }

  const zugang = zugangSchema.safeParse(rohZugang);
  if (!zugang.success) {
    log.error("Hinterlegter KI-Zugang hat einen unerwarteten Aufbau");
    return NextResponse.json(
      { fehler: "Der hinterlegte KI-Zugang ist unbrauchbar. Bitte neu hinterlegen.", correlationId },
      { status: 409 },
    );
  }

  try {
    const schluessel = entschluessle(
      zugang.data.verschluesselt,
      ladeVerschluesselungsSchluessel(process.env),
    );

    const roh = await frageModell({
      anbieter: zugang.data.anbieter as Anbieter,
      schluessel,
      endpunktUrl: zugang.data.endpunktUrl,
      anweisung: baueAnweisung(geprueft.data),
    });

    const vorschlag = leseVorschlag(roh);
    log.info(
      {
        anbieter: zugang.data.anbieter,
        suchbegriffe: vorschlag.suchbegriffe.length,
        quellen: vorschlag.quellen.length,
      },
      "Regelvorschlag erstellt",
    );
    return NextResponse.json(vorschlag);
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    log.error({ fehler: text }, "Regelvorschlag fehlgeschlagen");
    // Der Text stammt aus dem eigenen Code oder vom Anbieter und enthält den
    // Schlüssel nicht; er ist für die Fehlersuche wertvoll.
    return NextResponse.json({ fehler: text, correlationId }, { status: 502 });
  }
}
