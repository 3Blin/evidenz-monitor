/**
 * Datenbankzugriff. Zweck: Eine einzige Verbindungsstelle mit Timeouts,
 * damit hängende Abfragen die Anwendung nicht blockieren (Fehlertoleranz).
 */
import { Pool } from "pg";
import { ladeKonfiguration } from "./config";

let pool: Pool | undefined;

export function datenbank(): Pool {
  if (!pool) {
    const config = ladeKonfiguration();
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
      max: 10,
    });
  }
  return pool;
}

export async function schliesseDatenbank(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
