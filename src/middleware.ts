/**
 * Erneuert die Anmeldesitzung bei jeder Anfrage (ADR 0009).
 *
 * Warum nötig: Zugangstoken laufen nach kurzer Zeit ab. Ohne Erneuerung wäre
 * man nach etwa einer Stunde stillschweigend abgemeldet - mitten im Bearbeiten.
 * Serverseitig gerenderte Seiten dürfen keine Cookies setzen, deshalb geschieht
 * es hier.
 *
 * Diese Datei nimmt bewusst keine Zugriffsentscheidung. Wer was sehen darf,
 * entscheidet die Datenbank über die Zeilen-Sicherheit; eine zweite Prüfung an
 * dieser Stelle würde nur auseinanderlaufen.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(anfrage: NextRequest): Promise<NextResponse> {
  let antwort = NextResponse.next({ request: anfrage });

  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const schluessel = process.env["NEXT_PUBLIC_SUPABASE_KEY"];
  // Fehlt die Konfiguration, zeigt die Seite selbst eine verständliche
  // Meldung. Die Middleware darf daran nicht scheitern.
  if (!url || !schluessel) return antwort;

  const supabase = createServerClient(url, schluessel, {
    cookies: {
      getAll: () => anfrage.cookies.getAll(),
      setAll: (neue) => {
        for (const { name, value } of neue) anfrage.cookies.set(name, value);
        antwort = NextResponse.next({ request: anfrage });
        for (const { name, value, options } of neue) antwort.cookies.set(name, value, options);
      },
    },
  });

  // Der Aufruf selbst erneuert die Sitzung, falls nötig.
  await supabase.auth.getUser();
  return antwort;
}

export const config = {
  // Statische Dateien und Bilder brauchen keine Sitzung.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
