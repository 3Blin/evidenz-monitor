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
import { istFaellig, naechsterLauf, naechsterTakt, taktInWorten } from "../src/lib/taktung";

interface AuftragZeile {
  readonly id: string;
  readonly name: string;
  readonly intervall_min_minuten: number;
  readonly intervall_max_minuten: number;
  readonly aktueller_takt_minuten: number | null;
  readonly naechster_lauf_am: Date | null;
}

async function main(): Promise<void> {
  const db = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const correlationId = neueCorrelationId();

  // "--alle" übergeht die Taktung. Gedacht für den Erstlauf und die
  // Fehlersuche von Hand; der Zeitplan ruft das Skript ohne diesen Schalter.
  const alle = process.argv.includes("--alle");
  const jetzt = new Date();

  try {
    const { rows: auftraege } = await db.query<AuftragZeile>(
      `SELECT id, name, intervall_min_minuten, intervall_max_minuten,
              aktueller_takt_minuten, naechster_lauf_am
         FROM auftraege WHERE aktiv=true ORDER BY erstellt_am`,
    );
    if (auftraege.length === 0) throw new Error("Kein aktiver Beobachtungsauftrag vorhanden");

    const faellig = alle
      ? auftraege
      : auftraege.filter((a) => istFaellig(a.naechster_lauf_am, jetzt));

    if (faellig.length === 0) {
      // Kein Fehler, sondern der Normalfall: Der Zeitplan ruft häufiger auf,
      // als die meisten Aufträge abgerufen werden wollen.
      const naechster = auftraege
        .map((a) => a.naechster_lauf_am)
        .filter((d): d is Date => d !== null)
        .sort((x, y) => x.getTime() - y.getTime())[0];
      process.stdout.write(
        `Kein Auftrag faellig${
          naechster ? ` · naechster ab ${naechster.toISOString()}` : ""
        }\n`,
      );
      return;
    }

    let neueInhalte = 0;
    let fehler = 0;

    for (const auftrag of faellig) {
      process.stdout.write(`${auftrag.name}\n`);
      const ergebnisse = await sammleAuftrag(db, auftrag.id, adapterFuerQuelle, correlationId);

      // Der Takt richtet sich am Ertrag aus: Bringt der Lauf neue Beitraege,
      // rueckt er zur Untergrenze, sonst zur Obergrenze.
      const ertrag = ergebnisse.reduce((summe, e) => summe + (e.neueInhalte ?? 0), 0);
      const takt = naechsterTakt(
        { minMinuten: auftrag.intervall_min_minuten, maxMinuten: auftrag.intervall_max_minuten },
        auftrag.aktueller_takt_minuten,
        ertrag > 0,
      );
      await db.query(
        "UPDATE auftraege SET aktueller_takt_minuten=$2, naechster_lauf_am=$3 WHERE id=$1",
        [auftrag.id, takt, naechsterLauf(jetzt, takt)],
      );
      process.stdout.write(`  Takt: alle ${taktInWorten(takt)}\n`);

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
      `\nAuftraege bearbeitet: ${faellig.length} von ${auftraege.length}` +
        ` · Neu in diesem Lauf: ${neueInhalte}` +
        ` · nicht erreichbare Quellen: ${fehler}` +
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
