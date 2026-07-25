/**
 * Quellen-Abrufer. Zweck: Holt in festen Intervallen neue Inhalte je Quelle,
 * erkennt exakte Dubletten per Hash und protokolliert jeden Lauf.
 *
 * Fehlertoleranz: Der Ausfall einer Quelle beendet nie den gesamten Lauf -
 * der Fehler wird protokolliert und die nächste Quelle bearbeitet.
 */
import type { Pool } from "pg";
import type { QuellenAdapter } from "./quellen/adapter";
import { inhaltHash } from "./dedup";
import { vorgangsLogger } from "./logger";

export interface QuelleZeile {
  readonly id: string;
  readonly url: string;
  readonly typ: string;
  readonly herausgeber: string;
}

export interface AbrufErgebnis {
  readonly quelleId: string;
  readonly status: "ok" | "fehler";
  readonly neueInhalte: number;
  readonly fehlerText: string | null;
}

/** Ruft eine einzelne Quelle ab und speichert neue Inhalte. */
export async function sammleQuelle(
  db: Pool,
  quelle: QuelleZeile,
  adapter: QuellenAdapter,
  correlationId: string,
): Promise<AbrufErgebnis> {
  const log = vorgangsLogger(correlationId).child({ quelleId: quelle.id });
  try {
    const rohInhalte = await adapter.abrufen(quelle.url);
    let neue = 0;
    for (const roh of rohInhalte) {
      const hash = inhaltHash(roh.titel, roh.auszug);
      const res = await db.query(
        `INSERT INTO inhalte (quelle_id, url, titel, autor, veroeffentlicht_am, auszug, inhalt_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (quelle_id, inhalt_hash) DO NOTHING
         RETURNING id`,
        [quelle.id, roh.url, roh.titel, roh.autor, roh.veroeffentlichtAm, roh.auszug, hash],
      );
      if (res.rowCount && res.rowCount > 0) neue++;
    }
    await db.query(
      `INSERT INTO abrufe (quelle_id, status, neue_inhalte) VALUES ($1,'ok',$2)`,
      [quelle.id, neue],
    );
    log.info({ neue, gesamt: rohInhalte.length }, "Quelle abgerufen");
    return { quelleId: quelle.id, status: "ok", neueInhalte: neue, fehlerText: null };
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    await db.query(
      `INSERT INTO abrufe (quelle_id, status, fehler_text) VALUES ($1,'fehler',$2)`,
      [quelle.id, text],
    );
    log.warn({ fehler: text }, "Quelle nicht erreichbar - Lauf wird fortgesetzt");
    return { quelleId: quelle.id, status: "fehler", neueInhalte: 0, fehlerText: text };
  }
}

/** Ruft alle aktiven Quellen eines Auftrags ab. Einzelfehler stoppen nichts. */
export async function sammleAuftrag(
  db: Pool,
  auftragId: string,
  adapterFuer: (typ: string) => QuellenAdapter,
  correlationId: string,
): Promise<readonly AbrufErgebnis[]> {
  const { rows } = await db.query<QuelleZeile>(
    `SELECT id, url, typ, herausgeber FROM quellen WHERE auftrag_id=$1 AND aktiv=true`,
    [auftragId],
  );
  const ergebnisse: AbrufErgebnis[] = [];
  for (const quelle of rows) {
    ergebnisse.push(await sammleQuelle(db, quelle, adapterFuer(quelle.typ), correlationId));
  }
  return ergebnisse;
}
