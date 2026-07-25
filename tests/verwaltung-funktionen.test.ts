/**
 * Prüft die Datenbankfunktionen für Anmeldung und Verwaltung (Migration 0004).
 *
 * Der wichtigste Fall steht unten: Der verschlüsselte KI-Schlüssel darf die
 * Datenbank nie wieder verlassen. Die Architektur sagt "niemals an den Browser
 * zurückgegeben" - und weil api_schluessel bewusst ohne Zugriffsregel bleibt,
 * muss die Zustandsfunktion beweisen, dass sie nur Zustand herausgibt.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { datenbank, schliesseDatenbank } from "../src/lib/db";
import { verschluessle, entschluessle } from "../src/lib/krypto";

const db = datenbank();
const NUTZER_A = "00000000-0000-0000-0000-0000000000a1";
const NUTZER_B = "00000000-0000-0000-0000-0000000000a2";
// Eigener Schlüssel je Lauf, wie in fundament.test.ts - unabhängig davon, was
// in der Umgebung steht.
const SCHLUESSEL = randomBytes(32).toString("base64");

let demoAuftrag = "";
let stillerAuftrag = "";

/** Ruft etwas als angemeldeter Nutzer auf und rollt danach zurück. */
async function alsNutzer<T>(
  nutzer: string | null,
  arbeit: (frage: (sql: string, werte?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (nutzer) {
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [nutzer]);
    }
    return await arbeit(async (sql, werte) => (await client.query(sql, werte)).rows);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

beforeAll(async () => {
  const demo = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,oeffentliche_demo)
     VALUES ($1,'Verwaltung Demo','Ziel','Frage?',true) RETURNING id`,
    [NUTZER_A],
  );
  demoAuftrag = demo.rows[0]!.id;

  const still = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,oeffentliche_demo)
     VALUES ($1,'Verwaltung Still','Ziel','Frage?',false) RETURNING id`,
    [NUTZER_A],
  );
  stillerAuftrag = still.rows[0]!.id;
});

afterAll(async () => {
  await db.query("DELETE FROM auftraege WHERE id = ANY($1::uuid[])", [
    [demoAuftrag, stillerAuftrag],
  ]);
  await db.query("DELETE FROM api_schluessel WHERE user_id = ANY($1::uuid[])", [
    [NUTZER_A, NUTZER_B],
  ]);
  await schliesseDatenbank();
});

describe("oeffentliche_auftraege", () => {
  it("nennt freigegebene Aufträge auch ohne Anmeldung", async () => {
    const { rows } = await db.query<{ liste: { id: string }[] }>(
      "SELECT oeffentliche_auftraege() AS liste",
    );
    expect(rows[0]!.liste.some((a) => a.id === demoAuftrag)).toBe(true);
  });

  it("nennt nicht freigegebene Aufträge nicht", async () => {
    const { rows } = await db.query<{ liste: { id: string }[] }>(
      "SELECT oeffentliche_auftraege() AS liste",
    );
    expect(rows[0]!.liste.some((a) => a.id === stillerAuftrag)).toBe(false);
  });

  it("gibt nur Kennung, Name und Fragestellung heraus", async () => {
    const { rows } = await db.query<{ liste: Record<string, unknown>[] }>(
      "SELECT oeffentliche_auftraege() AS liste",
    );
    const eintrag = rows[0]!.liste.find((a) => a["id"] === demoAuftrag)!;
    expect(Object.keys(eintrag).sort()).toEqual(["fragestellung", "id", "name"]);
  });

  it("gibt eine leere Liste statt null zurück, wenn nichts freigegeben ist", async () => {
    await alsNutzer(null, async (frage) => {
      await frage("UPDATE auftraege SET oeffentliche_demo=false");
      const zeilen = (await frage("SELECT oeffentliche_auftraege() AS liste")) as {
        liste: unknown[];
      }[];
      expect(zeilen[0]!.liste).toEqual([]);
    });
  });
});

describe("KI-Schlüssel hinterlegen", () => {
  it("verlangt eine Anmeldung (Fehlerfall)", async () => {
    await expect(
      alsNutzer(null, (frage) =>
        frage("SELECT api_schluessel_speichern('anthropic', NULL, $1)", [
          verschluessle("sk-test", SCHLUESSEL),
        ]),
      ),
    ).rejects.toThrow(/Anmeldung erforderlich/);
  });

  it("nimmt den verschlüsselten Schlüssel des angemeldeten Nutzers auf", async () => {
    const verschluesselt = verschluessle("sk-geheim-123", SCHLUESSEL);
    await alsNutzer(NUTZER_A, async (frage) => {
      await frage("SELECT api_schluessel_speichern('anthropic', NULL, $1)", [verschluesselt]);
      const zeilen = (await frage(
        "SELECT schluessel_verschluesselt AS s FROM api_schluessel WHERE user_id=$1",
        [NUTZER_A],
      )) as { s: string }[];
      // Was gespeichert wurde, ist der verschlüsselte Wert - und er lässt sich
      // mit dem serverseitigen Schlüssel wieder lesen.
      expect(entschluessle(zeilen[0]!.s, SCHLUESSEL)).toBe("sk-geheim-123");
    });
  });

  it("ersetzt einen vorhandenen Schlüssel statt einen zweiten anzulegen", async () => {
    await alsNutzer(NUTZER_A, async (frage) => {
      await frage("SELECT api_schluessel_speichern('anthropic', NULL, $1)", [
        verschluessle("erster", SCHLUESSEL),
      ]);
      await frage("SELECT api_schluessel_speichern('openai', NULL, $1)", [
        verschluessle("zweiter", SCHLUESSEL),
      ]);
      const zeilen = (await frage(
        "SELECT anbieter, schluessel_verschluesselt AS s FROM api_schluessel WHERE user_id=$1",
        [NUTZER_A],
      )) as { anbieter: string; s: string }[];
      expect(zeilen).toHaveLength(1);
      expect(zeilen[0]!.anbieter).toBe("openai");
      expect(entschluessle(zeilen[0]!.s, SCHLUESSEL)).toBe("zweiter");
    });
  });

  it("weist einen unbekannten Anbieter ab (Fehlerfall)", async () => {
    await expect(
      alsNutzer(NUTZER_A, (frage) =>
        frage("SELECT api_schluessel_speichern('irgendwas', NULL, $1)", [
          verschluessle("x", SCHLUESSEL),
        ]),
      ),
    ).rejects.toThrow(/Unbekannter Anbieter/);
  });

  it("weist einen offensichtlich unverschlüsselten Wert ab (Fehlerfall)", async () => {
    await expect(
      alsNutzer(NUTZER_A, (frage) =>
        frage("SELECT api_schluessel_speichern('anthropic', NULL, 'sk-123')"),
      ),
    ).rejects.toThrow(/verschlüsselter Schlüssel/);
  });
});

describe("Zustand des KI-Schlüssels", () => {
  it("gibt den Schlüssel selbst niemals heraus", async () => {
    const verschluesselt = verschluessle("sk-darf-nicht-raus", SCHLUESSEL);
    await alsNutzer(NUTZER_A, async (frage) => {
      await frage("SELECT api_schluessel_speichern('anthropic', NULL, $1)", [verschluesselt]);
      const zeilen = (await frage("SELECT api_schluessel_zustand() AS z")) as {
        z: Record<string, unknown>;
      }[];
      const zustand = zeilen[0]!.z;
      expect(zustand["hinterlegt"]).toBe(true);
      expect(zustand["anbieter"]).toBe("anthropic");
      // Weder Klartext noch verschlüsselter Wert dürfen auftauchen.
      const alsText = JSON.stringify(zustand);
      expect(alsText).not.toContain("sk-darf-nicht-raus");
      expect(alsText).not.toContain(verschluesselt);
      expect(Object.keys(zustand).sort()).toEqual([
        "aktualisiertAm", "anbieter", "endpunktUrl", "hinterlegt",
      ]);
    });
  });

  it("meldet sauber, wenn kein Schlüssel hinterlegt ist", async () => {
    await alsNutzer(NUTZER_B, async (frage) => {
      const zeilen = (await frage("SELECT api_schluessel_zustand() AS z")) as {
        z: { hinterlegt: boolean };
      }[];
      expect(zeilen[0]!.z.hinterlegt).toBe(false);
    });
  });

  it("zeigt einem anderen Nutzer nichts vom fremden Schlüssel", async () => {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [NUTZER_A]);
    await db.query("SELECT api_schluessel_speichern('anthropic', NULL, $1)", [
      verschluessle("nur-fuer-a", SCHLUESSEL),
    ]);
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");

    await alsNutzer(NUTZER_B, async (frage) => {
      const zeilen = (await frage("SELECT api_schluessel_zustand() AS z")) as {
        z: { hinterlegt: boolean };
      }[];
      expect(zeilen[0]!.z.hinterlegt).toBe(false);
    });
  });

  it("verlangt eine Anmeldung (Fehlerfall)", async () => {
    await expect(
      alsNutzer(null, (frage) => frage("SELECT api_schluessel_zustand() AS z")),
    ).rejects.toThrow(/Anmeldung erforderlich/);
  });

  it("entfernt den Schlüssel auf Wunsch", async () => {
    await alsNutzer(NUTZER_A, async (frage) => {
      await frage("SELECT api_schluessel_speichern('anthropic', NULL, $1)", [
        verschluessle("weg-damit", SCHLUESSEL),
      ]);
      await frage("SELECT api_schluessel_entfernen()");
      const zeilen = (await frage("SELECT api_schluessel_zustand() AS z")) as {
        z: { hinterlegt: boolean };
      }[];
      expect(zeilen[0]!.z.hinterlegt).toBe(false);
    });
  });
});
