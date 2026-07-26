/**
 * Verbindung zu Supabase im Browser (Anmeldeformular, Bearbeiten).
 *
 * Bewusst getrennt von supabase-server.ts: Diese Datei darf nichts aus
 * next/headers importieren, sonst lässt sie sich in Client-Komponenten nicht
 * verwenden. Die Trennung ist keine Kosmetik - der Build scheitert sonst.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ladeWebKonfiguration } from "./konfig";

export function supabaseImBrowser(): SupabaseClient {
  const konfig = ladeWebKonfiguration({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_KEY: process.env["NEXT_PUBLIC_SUPABASE_KEY"],
    NEXT_PUBLIC_AUFTRAG: process.env["NEXT_PUBLIC_AUFTRAG"],
  });
  return createBrowserClient(konfig.supabaseUrl, konfig.supabaseSchluessel);
}
