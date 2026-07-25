/**
 * API v1: Dashboard-Daten eines Beobachtungsauftrags.
 * Zweck: Die spätere Handy-App nutzt exakt diesen Endpunkt. Die Zugriffs-
 * prüfung erfolgt in der Datenbank (eigener Auftrag oder freigegebene Demo).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { ladeDashboardVonSupabase } from "@/lib/supabase-daten";
import { ladeWebKonfiguration } from "@/lib/konfig";
import { neueCorrelationId, vorgangsLogger } from "@/lib/logger";

const anfrageSchema = z.object({ auftrag: z.string().uuid("auftrag muss eine UUID sein") });

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = neueCorrelationId();
  const log = vorgangsLogger(correlationId);
  const { searchParams } = new URL(request.url);
  const geprueft = anfrageSchema.safeParse({ auftrag: searchParams.get("auftrag") });

  if (!geprueft.success) {
    return NextResponse.json(
      { fehler: "Ungültige Anfrage", details: geprueft.error.issues.map((i) => i.message), correlationId },
      { status: 400 },
    );
  }
  try {
    const konfig = ladeWebKonfiguration(process.env);
    const daten = await ladeDashboardVonSupabase(
      konfig.supabaseUrl, konfig.supabaseSchluessel, geprueft.data.auftrag,
    );
    return NextResponse.json(daten);
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    log.error({ fehler: text }, "Dashboard konnte nicht geladen werden");
    return NextResponse.json(
      { fehler: "Dashboard konnte nicht geladen werden", correlationId },
      { status: 502 },
    );
  }
}
