/**
 * API v1: Einlieferung durch externe Sammler (ADR 0002 Punkt 2).
 *
 * Zweck: Eigene Agenten oder Ablauf-Werkzeuge (n8n und Ähnliches) liefern
 * Inhalte aus Kanälen ein, die der Kern nicht selbst abrufen soll. Das
 * auftrag-gebundene Token prüft die Datenbank; diese Route validiert nur die
 * Form und übersetzt Abweisungen in verständliche HTTP-Antworten.
 *
 * Aufruf:
 *   POST /api/v1/ingest
 *   Authorization: Bearer <Token des Auftrags>
 *   { "quelle": { "url": "...", "herausgeber": "..." },
 *     "inhalte": [ { "url": "...", "titel": "...", "auszug": "..." } ] }
 */
import { NextResponse } from "next/server";
import { ladeWebKonfiguration } from "@/lib/konfig";
import { neueCorrelationId, vorgangsLogger } from "@/lib/logger";
import {
  einlieferungSchema,
  liefereInhalteEin,
  tokenAusKopf,
  EinlieferungAbgewiesen,
  ZUSTAND_KEIN_ZUGRIFF,
  ZUSTAND_UNGUELTIGE_ANGABE,
} from "@/lib/ingest";

export async function POST(request: Request): Promise<NextResponse> {
  const correlationId = neueCorrelationId();
  const log = vorgangsLogger(correlationId);

  const token = tokenAusKopf(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json(
      { fehler: "Token fehlt (Authorization: Bearer ...)", correlationId },
      { status: 401 },
    );
  }

  let koerper: unknown;
  try {
    koerper = await request.json();
  } catch {
    return NextResponse.json(
      { fehler: "Anfrage ist kein gültiges JSON", correlationId },
      { status: 400 },
    );
  }

  const geprueft = einlieferungSchema.safeParse(koerper);
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
    const konfig = ladeWebKonfiguration(process.env);
    const ergebnis = await liefereInhalteEin(
      konfig.supabaseUrl,
      konfig.supabaseSchluessel,
      token,
      geprueft.data,
    );
    // Ohne Token und ohne Auszüge: das Protokoll zeigt nur Zählwerte.
    log.info(
      { angenommen: ergebnis.angenommen, uebersprungen: ergebnis.uebersprungen },
      "Inhalte eingeliefert",
    );
    return NextResponse.json(ergebnis, { status: 201 });
  } catch (fehler) {
    if (fehler instanceof EinlieferungAbgewiesen) {
      if (fehler.sqlZustand === ZUSTAND_KEIN_ZUGRIFF) {
        log.warn("Einlieferung mit unbekanntem Token abgewiesen");
        return NextResponse.json(
          { fehler: "Token unbekannt oder abgeschaltet", correlationId },
          { status: 401 },
        );
      }
      if (fehler.sqlZustand === ZUSTAND_UNGUELTIGE_ANGABE) {
        return NextResponse.json(
          { fehler: fehler.message, correlationId },
          { status: 400 },
        );
      }
    }
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    log.error({ fehler: text }, "Einlieferung fehlgeschlagen");
    return NextResponse.json(
      { fehler: "Einlieferung fehlgeschlagen", correlationId },
      { status: 502 },
    );
  }
}
