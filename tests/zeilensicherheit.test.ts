/**
 * Prüft die Zeilen-Sicherheit aus Migration 0002.
 *
 * Warum diese Tests nötig sind: Auf Supabase haben die Rollen anon und
 * authenticated per Voreinstellung Tabellenrechte im Schema public. Erst die
 * Regeln aus Migration 0002 machen daraus einen Schutz. Damit der Test dieselbe
 * Lage abbildet, vergibt er diese Tabellenrechte absichtlich selbst - und weist
 * nach, dass die Regeln trotzdem greifen. Alle Rechtevergaben laufen in einer
 * Transaktion, die zurückgerollt wird.
 *
 * Der Vertrag aus ARCHITEKTUR: "Row Level Security in Postgres: Datenzugriff
 * nur auf eigene Aufträge."
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { datenbank, schliesseDatenbank } from "../src/lib/db";

const db = datenbank();
const BESITZER = "00000000-0000-0000-0000-0000000000b1";
const FREMDER = "00000000-0000-0000-0000-0000000000b2";

let auftragId = "";

beforeAll(async () => {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung)
     VALUES ($1,'Sicherheitstest','Ziel','Frage?') RETURNING id`,
    [BESITZER],
  );
  auftragId = rows[0]!.id;
  await db.query(
    `INSERT INTO quellen (auftrag_id,url,typ,herausgeber)
     VALUES ($1,'https://test.example/sicher','rss','Testquelle')`,
    [auftragId],
  );
  await db.query(
    `INSERT INTO api_schluessel (user_id,anbieter,schluessel_verschluesselt)
     VALUES ($1,'anthropic','nur-ein-platzhalter')
     ON CONFLICT (user_id) DO NOTHING`,
    [BESITZER],
  );
  await db.query(
    `INSERT INTO ingest_tokens (auftrag_id,bezeichnung,token_hash)
     VALUES ($1,'Testsammler','platzhalter-hash')`,
    [auftragId],
  );
});

afterAll(async () => {
  await db.query("DELETE FROM auftraege WHERE id=$1", [auftragId]);
  await db.query("DELETE FROM api_schluessel WHERE user_id=$1", [BESITZER]);
  await schliesseDatenbank();
});

/**
 * Führt Abfragen als Rolle anon aus, mit optionaler Nutzerkennung, und rollt
 * anschließend alles zurück. Die Tabellenrechte spiegeln die Supabase-Vorgabe.
 */
async function alsAnon<T>(
  nutzer: string | null,
  arbeit: (frage: (sql: string, werte?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON auftraege, quellen, inhalte TO anon",
    );
    if (nutzer) {
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [nutzer]);
    }
    await client.query("SET LOCAL ROLE anon");
    return await arbeit(async (sql, werte) => (await client.query(sql, werte)).rows);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

describe("Zeilen-Sicherheit", () => {
  it("zeigt einem nicht angemeldeten Zugriff keine Aufträge", async () => {
    const zeilen = await alsAnon(null, (frage) =>
      frage("SELECT id FROM auftraege WHERE id=$1", [auftragId]),
    );
    expect(zeilen).toEqual([]);
  });

  it("zeigt dem Besitzer seinen eigenen Auftrag", async () => {
    const zeilen = await alsAnon(BESITZER, (frage) =>
      frage("SELECT id FROM auftraege WHERE id=$1", [auftragId]),
    );
    expect(zeilen).toHaveLength(1);
  });

  it("zeigt einem anderen Nutzer denselben Auftrag nicht (Fehlerfall)", async () => {
    const zeilen = await alsAnon(FREMDER, (frage) =>
      frage("SELECT id FROM auftraege WHERE id=$1", [auftragId]),
    );
    expect(zeilen).toEqual([]);
  });

  it("schützt auch die Quellen eines fremden Auftrags", async () => {
    const eigene = await alsAnon(BESITZER, (frage) =>
      frage("SELECT id FROM quellen WHERE auftrag_id=$1", [auftragId]),
    );
    expect(eigene).toHaveLength(1);
    const fremde = await alsAnon(FREMDER, (frage) =>
      frage("SELECT id FROM quellen WHERE auftrag_id=$1", [auftragId]),
    );
    expect(fremde).toEqual([]);
  });

  it("verhindert das Anlegen einer Quelle in einem fremden Auftrag (Fehlerfall)", async () => {
    await expect(
      alsAnon(FREMDER, (frage) =>
        frage(
          `INSERT INTO quellen (auftrag_id,url,typ,herausgeber)
           VALUES ($1,'https://test.example/eingeschmuggelt','rss','Fremd')`,
          [auftragId],
        ),
      ),
    ).rejects.toThrow(/row-level security|Zeilen/i);
  });

  it("sperrt verschlüsselte KI-Schlüssel vollständig für die Anwendung", async () => {
    await expect(
      alsAnon(BESITZER, (frage) => frage("SELECT * FROM api_schluessel")),
    ).rejects.toThrow(/permission denied|keine Berechtigung/i);
  });

  it("sperrt Ingest-Token vollständig für die Anwendung", async () => {
    await expect(
      alsAnon(BESITZER, (frage) => frage("SELECT * FROM ingest_tokens")),
    ).rejects.toThrow(/permission denied|keine Berechtigung/i);
  });

  it("lässt die geprüfte Dashboard-Funktion trotz gesperrter Tabellen zu", async () => {
    await db.query("UPDATE auftraege SET oeffentliche_demo=true WHERE id=$1", [auftragId]);
    const zeilen = await alsAnon(null, (frage) =>
      frage("SELECT dashboard_daten($1) AS d", [auftragId]),
    );
    expect(zeilen).toHaveLength(1);
    await db.query("UPDATE auftraege SET oeffentliche_demo=false WHERE id=$1", [auftragId]);
  });
});
