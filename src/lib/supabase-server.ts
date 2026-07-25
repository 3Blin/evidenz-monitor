/**
 * Verbindung zu Supabase auf dem Server (Seiten und Routen).
 *
 * Liest und schreibt die Sitzung in Cookies, damit auch serverseitig
 * gerenderte Seiten wissen, wer angemeldet ist.
 *
 * Wichtig für den Rest des Systems: Erst mit einer echten Sitzung liefert
 * auth.uid() in der Datenbank einen Wert. Damit greifen die Zugriffsregeln aus
 * Migration 0002 - vorher sperrten sie schlicht alles außer den freigegebenen
 * Demo-Aufträgen.
 */
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ladeWebKonfiguration } from "./konfig";

export async function supabaseAufServer(): Promise<SupabaseClient> {
  const konfig = ladeWebKonfiguration(process.env);
  const kekse = await cookies();

  return createServerClient(konfig.supabaseUrl, konfig.supabaseSchluessel, {
    cookies: {
      getAll: () => kekse.getAll(),
      setAll: (neue) => {
        try {
          for (const { name, value, options } of neue) kekse.set(name, value, options);
        } catch {
          // In Server Components darf man keine Cookies setzen. Das ist kein
          // Fehler: Die Erneuerung der Sitzung übernimmt dann die Middleware.
          // Bewusst still, damit keine irreführende Meldung im Protokoll steht.
        }
      },
    },
  });
}

/** Die angemeldete Person, oder null. */
export async function angemeldeterNutzer(): Promise<{ id: string; email: string } | null> {
  const supabase = await supabaseAufServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}
