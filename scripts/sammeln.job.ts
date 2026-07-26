/**
 * Sammellauf: ruft die Quellen aller aktiven Beobachtungsaufträge ab.
 *
 * Nutzt bewusst die geprüfte Bibliothek (src/lib/sammler.ts und die Adapter),
 * statt die Sammellogik ein zweites Mal zu enthalten. Vorgänger war
 * scripts/sammeln.mjs, das die Logik dupliziert hat - dadurch konnte der
 * Web-Adapter im Betrieb gar nicht zum Einsatz kommen.
 *
 * Der Ablauf steckt in einer Funktion, nicht auf der obersten Ebene: Nur so
 * lässt sich das Skript mit tsx ausführen (Aufruf: npm run sammeln).
 */
import pg from "pg";
import { sammleAuftrag } from "../src/lib/sammler";
import { adapterFuerQuelle } from "../src/lib/quellen/registrierung";
import { neueCorrelationId } from "../src/lib/logger";

async function main(): Promise<void> {
  const db = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const correlationId = neueCorrelationId();

  try {
    const { rows: auftraege } = await db.query<{ id: string; name: string }>(
      "SELECT id, name FROM auftraege WHERE aktiv=true ORDER BY erstellt_am",
    );
    if (auftraege.length === 0) throw new Error("Kein aktiver Beobachtungsauftrag vorhanden");

    let neueInhalte = 0;
    let fehler = 0;

    for (const auftrag of auftraege) {
      process.stdout.write(`${auftrag.name}\n`);
      const ergebnisse = await sammleAuftrag(db, auftrag.id, adapterFuerQuelle, correlationId);

      for (const e of ergebnisse) {
        const { rows } = await db.query<{ herausgeber: string }>(
          "SELECT herausgeber FROM quellen WHERE id=$1",
          [e.quelleId],
        );
        const name = rows[0]?.herausgeber ?? e.quelleId;
        if (e.status === "ok") {
          neueInhalte += e.neueInhalte;
          process.stdout.write(`  ${name}: ok (+${e.neueInhalte} neu)\n`);
        } else {
          fehler++;
          process.stdout.write(`  ${name}: FEHLER - ${(e.fehlerText ?? "").slice(0, 80)}\n`);
        }
      }
    }

    const { rows: summe } = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM inhalte");
    process.stdout.write(
      `\nNeu in diesem Lauf: ${neueInhalte} · nicht erreichbare Quellen: ${fehler}` +
        ` · Inhalte gesamt: ${summe[0]?.n ?? 0}\n`,
    );
  } finally {
    await db.end();
  }
}

main().catch((fehler: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`${fehler instanceof Error ? fehler.message : String(fehler)}\n`);
});
