/**
 * Öffentliche Konfiguration der Weboberfläche.
 *
 * Zweck: Adresse und Schlüssel stehen nicht im Code, sondern in
 * Umgebungsvariablen - so kann dieselbe Anwendung gegen verschiedene
 * Umgebungen laufen (Test, Produktion) ohne Codeänderung.
 *
 * Der Supabase-"publishable key" ist dafür vorgesehen, im Browser zu stehen.
 * Er gewährt nichts, was die Zeilen-Sicherheit der Datenbank nicht erlaubt.
 */
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL fehlt oder ist keine Adresse"),
  NEXT_PUBLIC_SUPABASE_KEY: z.string().min(10, "NEXT_PUBLIC_SUPABASE_KEY fehlt"),
  NEXT_PUBLIC_AUFTRAG: z.string().uuid("NEXT_PUBLIC_AUFTRAG muss eine UUID sein"),
});

export interface WebKonfiguration {
  readonly supabaseUrl: string;
  readonly supabaseSchluessel: string;
  readonly auftragId: string;
}

export function ladeWebKonfiguration(env: Record<string, string | undefined>): WebKonfiguration {
  const ergebnis = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_KEY: env["NEXT_PUBLIC_SUPABASE_KEY"],
    NEXT_PUBLIC_AUFTRAG: env["NEXT_PUBLIC_AUFTRAG"],
  });
  if (!ergebnis.success) {
    throw new Error(
      `Konfiguration unvollständig: ${ergebnis.error.issues.map((i) => `${i.path.join(".") || "?"}: ${i.message}`).join("; ")}`,
    );
  }
  return {
    supabaseUrl: ergebnis.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseSchluessel: ergebnis.data.NEXT_PUBLIC_SUPABASE_KEY,
    auftragId: ergebnis.data.NEXT_PUBLIC_AUFTRAG,
  };
}
