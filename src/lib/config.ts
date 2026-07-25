/**
 * Zentrale Konfiguration. Zweck: Fehlende Pflichtwerte brechen den Start
 * sofort mit klarer Meldung ab, statt später zur Laufzeit zu überraschen.
 * Secrets stehen ausschließlich hier (aus Umgebungsvariablen), nie im Code.
 */
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL fehlt"),
  BYOK_ENCRYPTION_KEY: z
    .string()
    .min(1, "BYOK_ENCRYPTION_KEY fehlt (32 Bytes base64)"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof schema>;

export function ladeKonfiguration(env: NodeJS.ProcessEnv = process.env): Config {
  const ergebnis = schema.safeParse(env);
  if (!ergebnis.success) {
    const felder = ergebnis.error.issues
      .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
      .join("; ");
    throw new Error(`Konfiguration unvollständig: ${felder}`);
  }
  return ergebnis.data;
}
