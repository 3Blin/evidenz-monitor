/**
 * Rückkanal der Anmeldung: tauscht den Inhalt des Anmeldelinks gegen eine
 * Sitzung (ADR 0009).
 *
 * Supabase verschickt je nach Einstellung des Projekts zwei Formen von Link -
 * einen mit `code` (PKCE) und einen mit `token_hash` und `type`. Beide werden
 * hier behandelt, damit die Anmeldung nicht davon abhängt, welche Variante im
 * Supabase-Projekt eingestellt ist.
 */
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseAufServer } from "@/lib/supabase-server";
import { neueCorrelationId, vorgangsLogger } from "@/lib/logger";

const ERLAUBTE_ARTEN: readonly EmailOtpType[] = [
  "email", "magiclink", "signup", "invite", "recovery", "email_change",
];

export async function GET(anfrage: Request): Promise<NextResponse> {
  const correlationId = neueCorrelationId();
  const log = vorgangsLogger(correlationId);
  const { searchParams, origin } = new URL(anfrage.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const art = searchParams.get("type");
  // Nur eigene Pfade als Ziel zulassen - sonst wäre der Anmeldelink ein
  // offener Weiterleiter auf fremde Adressen.
  const zielParameter = searchParams.get("weiter") ?? "/";
  const ziel = zielParameter.startsWith("/") && !zielParameter.startsWith("//")
    ? zielParameter
    : "/";

  try {
    const supabase = await supabaseAufServer();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw new Error(error.message);
    } else if (tokenHash && art && ERLAUBTE_ARTEN.includes(art as EmailOtpType)) {
      const { error } = await supabase.auth.verifyOtp({
        type: art as EmailOtpType,
        token_hash: tokenHash,
      });
      if (error) throw new Error(error.message);
    } else {
      return NextResponse.redirect(`${origin}/anmelden?fehler=unvollstaendig`);
    }

    log.info("Anmeldung bestätigt");
    return NextResponse.redirect(`${origin}${ziel}`);
  } catch (fehler) {
    // Die Meldung selbst kann den Grund enthalten (abgelaufen, schon benutzt);
    // sie gehört ins Protokoll, nicht in die Adresszeile.
    log.warn(
      { fehler: fehler instanceof Error ? fehler.message : String(fehler) },
      "Anmeldelink konnte nicht eingelöst werden",
    );
    return NextResponse.redirect(`${origin}/anmelden?fehler=abgelaufen`);
  }
}
