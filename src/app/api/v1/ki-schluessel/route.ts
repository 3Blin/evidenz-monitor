/**
 * API v1: eigenen KI-Schlüssel hinterlegen oder entfernen (BYOK, ADR 0009).
 *
 * Warum diese Route überhaupt existiert: Der Schlüssel muss verschlüsselt in
 * der Datenbank liegen, und der Verschlüsselungsschlüssel darf nur auf dem
 * Server liegen. Würde der Browser verschlüsseln, wäre das Geheimnis im
 * Browser - also kein Geheimnis. Deshalb: Klartext einmal an den eigenen
 * Server, dort verschlüsseln, nur den verschlüsselten Wert weitergeben.
 *
 * Der Klartext wird nie protokolliert und nie zurückgegeben.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verschluessle } from "@/lib/krypto";
import { ladeVerschluesselungsSchluessel } from "@/lib/konfig";
import { supabaseAufServer } from "@/lib/supabase-server";
import { neueCorrelationId, vorgangsLogger } from "@/lib/logger";

const anfrageSchema = z.object({
  anbieter: z.enum(["anthropic", "openai", "kompatibel"]),
  endpunktUrl: z.string().url("endpunktUrl muss eine Adresse sein").nullish(),
  schluessel: z.string().min(8, "Der Schlüssel ist zu kurz"),
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

  try {
    const supabase = await supabaseAufServer();
    const { data: sitzung } = await supabase.auth.getUser();
    if (!sitzung.user) {
      return NextResponse.json({ fehler: "Anmeldung erforderlich", correlationId }, { status: 401 });
    }

    const verschluesselt = verschluessle(
      geprueft.data.schluessel,
      ladeVerschluesselungsSchluessel(process.env),
    );

    const { error } = await supabase.rpc("api_schluessel_speichern", {
      p_anbieter: geprueft.data.anbieter,
      p_endpunkt_url: geprueft.data.endpunktUrl ?? null,
      p_verschluesselt: verschluesselt,
    });
    if (error) throw new Error(error.message);

    // Nur der Anbieter, nie der Schlüssel.
    log.info({ anbieter: geprueft.data.anbieter }, "KI-Schlüssel hinterlegt");
    return new NextResponse(null, { status: 204 });
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    log.error({ fehler: text }, "KI-Schlüssel konnte nicht gespeichert werden");
    return NextResponse.json(
      { fehler: "Schlüssel konnte nicht gespeichert werden", correlationId },
      { status: 502 },
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  const correlationId = neueCorrelationId();
  const log = vorgangsLogger(correlationId);
  try {
    const supabase = await supabaseAufServer();
    const { data: sitzung } = await supabase.auth.getUser();
    if (!sitzung.user) {
      return NextResponse.json({ fehler: "Anmeldung erforderlich", correlationId }, { status: 401 });
    }
    const { error } = await supabase.rpc("api_schluessel_entfernen");
    if (error) throw new Error(error.message);
    log.info("KI-Schlüssel entfernt");
    return new NextResponse(null, { status: 204 });
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    log.error({ fehler: text }, "KI-Schlüssel konnte nicht entfernt werden");
    return NextResponse.json(
      { fehler: "Schlüssel konnte nicht entfernt werden", correlationId },
      { status: 502 },
    );
  }
}
