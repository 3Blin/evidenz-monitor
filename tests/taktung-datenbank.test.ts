/**
 * Prüft Migration 0006 an der Datenbank.
 *
 * Der Kern dieser Änderung ist, dass eine Einstellung wieder etwas bewirkt.
 * Genau das muss belegt sein - `intervall_minuten` stand über fünf
 * Migrationen hinweg im Schema, ohne dass irgendein Lauf es gelesen hätte.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { datenbank, schliesseDatenbank } from "../src/lib/db";
import { istFaellig, naechsterLauf, naechsterTakt } from "../src/lib/taktung";

const db = datenbank();
const NUTZER = "00000000-0000-0000-0000-0000000006a1";

afterAll(async () => {
  await db.query("DELETE FROM auftraege WHERE user_id=$1", [NUTZER]);
  await schliesseDatenbank();
});

let auftrag = "";

beforeAll(async () => {
  await db.query("DELETE FROM auftraege WHERE user_id=$1", [NUTZER]);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,
                            intervall_min_minuten,intervall_max_minuten)
     VALUES ($1,'Takttest','Ziel','Frage?',30,480) RETURNING id`,
    [NUTZER],
  );
  auftrag = rows[0]!.id;
});

describe("Taktspalten", () => {
  it("legt einen neuen Auftrag als sofort fällig an", async () => {
    const { rows } = await db.query<{
      naechster_lauf_am: Date | null; aktueller_takt_minuten: number | null;
    }>("SELECT naechster_lauf_am, aktueller_takt_minuten FROM auftraege WHERE id=$1", [auftrag]);
    expect(rows[0]?.naechster_lauf_am).toBeNull();
    expect(rows[0]?.aktueller_takt_minuten).toBeNull();
    expect(istFaellig(rows[0]?.naechster_lauf_am ?? null, new Date())).toBe(true);
  });

  it("weist eine Obergrenze unter der Untergrenze zurück", async () => {
    await expect(
      db.query("UPDATE auftraege SET intervall_max_minuten=10 WHERE id=$1", [auftrag]),
    ).rejects.toThrow(/auftraege_taktbereich/);
  });

  it("weist einen Takt unter der harten Untergrenze zurück", async () => {
    await expect(
      db.query("UPDATE auftraege SET intervall_min_minuten=1 WHERE id=$1", [auftrag]),
    ).rejects.toThrow();
  });

  it("hat die alte Spalte entfernt, statt sie danebenstehen zu lassen", async () => {
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name='auftraege'
          AND column_name='intervall_minuten'`,
    );
    expect(rows[0]?.n).toBe("0");
  });

  it("schreibt Takt und nächsten Lauf so fort, wie es der Sammellauf tut", async () => {
    // Bildet den Schritt aus scripts/sammeln.job.ts nach: Ertrag beschleunigt,
    // Leerlauf bremst - und der Auftrag ist danach nicht mehr sofort fällig.
    const jetzt = new Date();
    const takt = naechsterTakt({ minMinuten: 30, maxMinuten: 480 }, null, false);
    await db.query(
      "UPDATE auftraege SET aktueller_takt_minuten=$2, naechster_lauf_am=$3 WHERE id=$1",
      [auftrag, takt, naechsterLauf(jetzt, takt)],
    );

    const { rows } = await db.query<{
      naechster_lauf_am: Date; aktueller_takt_minuten: number;
    }>("SELECT naechster_lauf_am, aktueller_takt_minuten FROM auftraege WHERE id=$1", [auftrag]);
    expect(rows[0]?.aktueller_takt_minuten).toBe(30);
    expect(istFaellig(rows[0]?.naechster_lauf_am ?? null, jetzt)).toBe(false);
  });

  it("findet fällige Aufträge über den Index", async () => {
    await db.query(
      "UPDATE auftraege SET naechster_lauf_am = now() - interval '1 minute' WHERE id=$1",
      [auftrag],
    );
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM auftraege
        WHERE aktiv = true AND (naechster_lauf_am IS NULL OR naechster_lauf_am <= now())
          AND user_id = $1`,
      [NUTZER],
    );
    expect(rows.map((r) => r.id)).toContain(auftrag);
  });
});

describe("auftrag_uebernehmen nach Migration 0006", () => {
  it("kopiert den Taktbereich, aber nicht die Vorgeschichte", async () => {
    const fremder = "00000000-0000-0000-0000-0000000006b2";
    await db.query("DELETE FROM auftraege WHERE user_id=$1", [fremder]);
    await db.query("UPDATE auftraege SET oeffentliche_demo=true WHERE id=$1", [auftrag]);

    const client = await db.connect();
    let neu = "";
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [fremder]);
      const { rows } = await client.query<{ auftrag_uebernehmen: string }>(
        "SELECT auftrag_uebernehmen($1)",
        [auftrag],
      );
      neu = rows[0]!.auftrag_uebernehmen;
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    const { rows } = await db.query<{
      intervall_min_minuten: number; intervall_max_minuten: number;
      aktueller_takt_minuten: number | null; naechster_lauf_am: Date | null;
    }>(
      `SELECT intervall_min_minuten, intervall_max_minuten,
              aktueller_takt_minuten, naechster_lauf_am
         FROM auftraege WHERE id=$1`,
      [neu],
    );
    expect(rows[0]?.intervall_min_minuten).toBe(30);
    expect(rows[0]?.intervall_max_minuten).toBe(480);
    // Die Kopie beginnt bei null: eigene Vorgeschichte hat sie nicht.
    expect(rows[0]?.aktueller_takt_minuten).toBeNull();
    expect(rows[0]?.naechster_lauf_am).toBeNull();

    await db.query("DELETE FROM auftraege WHERE user_id=$1", [fremder]);
  });
});
