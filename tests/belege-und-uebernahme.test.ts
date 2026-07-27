/**
 * Prüft Migration 0005: Belege im Dashboard und das Übernehmen eines
 * freigegebenen Auftrags.
 *
 * Beide Zusagen sind ohne Prüfung wertlos: Ein Beleg ohne Verweis lässt sich
 * nicht nachschlagen, und eine Übernahmefunktion, die auch fremde, nicht
 * freigegebene Aufträge kopiert, wäre ein Datenleck.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { datenbank, schliesseDatenbank } from "../src/lib/db";
import { dashboardSchema } from "../src/lib/supabase-daten";
import { REGEL_VERSION } from "../src/lib/reifegrad";

const db = datenbank();
const BESITZER = "00000000-0000-0000-0000-0000000005a1";
const FREMDER = "00000000-0000-0000-0000-0000000005b2";

let demoAuftrag = "";
let privaterAuftrag = "";

/** Führt eine Abfrage als bestimmter angemeldeter Nutzer aus. */
async function alsNutzer<T extends Record<string, unknown>>(
  nutzer: string | null,
  sql: string,
  werte: unknown[] = [],
): Promise<T[]> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [nutzer ?? ""]);
    const { rows } = await client.query<T>(sql, werte);
    await client.query("COMMIT");
    return rows;
  } catch (fehler) {
    await client.query("ROLLBACK");
    throw fehler;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  const demo = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,oeffentliche_demo,
                            suchbegriffe,pflichtbegriffe,mindest_treffer)
     VALUES ($1,'Belegtest Demo','Ziel','Frage?',true,
             ARRAY['Alpha','Beta'],ARRAY['Alpha'],2) RETURNING id`,
    [BESITZER],
  );
  demoAuftrag = demo.rows[0]!.id;

  const privat = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,oeffentliche_demo)
     VALUES ($1,'Belegtest Privat','Ziel','Frage?',false) RETURNING id`,
    [BESITZER],
  );
  privaterAuftrag = privat.rows[0]!.id;

  const quelle = await db.query<{ id: string }>(
    `INSERT INTO quellen (auftrag_id,url,typ,herausgeber,themenspezifisch)
     VALUES ($1,'https://test.example/feed','fachmedium','Belegblatt',true) RETURNING id`,
    [demoAuftrag],
  );
  const quelleId = quelle.rows[0]!.id;

  const inhalt = await db.query<{ id: string }>(
    `INSERT INTO inhalte (quelle_id,url,titel,auszug,veroeffentlicht_am,inhalt_hash)
     VALUES ($1,'https://test.example/beitrag-1','Beitrag mit Beleg','Auszug zum Beleg',
             '2026-07-20T10:00:00Z','hash-beleg-1') RETURNING id`,
    [quelleId],
  );
  const inhaltId = inhalt.rows[0]!.id;

  const gruppe = await db.query<{ id: string }>(
    `INSERT INTO meldungsgruppen (auftrag_id,kanonischer_titel)
     VALUES ($1,'Beitrag mit Beleg') RETURNING id`,
    [demoAuftrag],
  );
  await db.query(
    `INSERT INTO inhalt_gruppen (inhalt_id,gruppe_id,beziehung,begruendung)
     VALUES ($1,$2,'primaer','Früheste Veröffentlichung')`,
    [inhaltId, gruppe.rows[0]!.id],
  );

  const aussage = await db.query<{ id: string }>(
    `INSERT INTO aussagen (auftrag_id,sachverhalt,entitaeten,kontext)
     VALUES ($1,'Beitrag mit Beleg',ARRAY[]::text[],'Zusammenführung: Einzelmeldung')
     RETURNING id`,
    [demoAuftrag],
  );
  const aussageId = aussage.rows[0]!.id;

  await db.query(
    `INSERT INTO aussage_belege (aussage_id,inhalt_id,belegstelle,klassifikation)
     VALUES ($1,$2,'Wörtliche Fundstelle im Auszug','stuetzt')`,
    [aussageId, inhaltId],
  );
  await db.query(
    `INSERT INTO reifegrad_verlauf (aussage_id,stufe,ausloeser,regel_version)
     VALUES ($1,1,'Ein Beleg',$2)`,
    [aussageId, REGEL_VERSION],
  );
});

afterAll(async () => {
  await db.query("DELETE FROM auftraege WHERE user_id IN ($1,$2)", [BESITZER, FREMDER]);
  await schliesseDatenbank();
});

describe("dashboard_daten liefert Belege", () => {
  it("nennt Verweis, Datum und Fundstelle je Beleg", async () => {
    const rows = await alsNutzer<{ dashboard_daten: unknown }>(
      null,
      "SELECT dashboard_daten($1)",
      [demoAuftrag],
    );
    const daten = dashboardSchema.parse(rows[0]!.dashboard_daten);
    const aussage = daten.aussagen[0];
    expect(aussage).toBeDefined();
    const beleg = aussage!.belege[0];
    expect(beleg?.url).toBe("https://test.example/beitrag-1");
    expect(beleg?.herausgeber).toBe("Belegblatt");
    expect(beleg?.veroeffentlichtAm).not.toBeNull();
    expect(beleg?.belegstelle).toBe("Wörtliche Fundstelle im Auszug");
    expect(beleg?.beziehung).toBe("primaer");
  });

  it("gibt die Zusammenführungsbegründung mit heraus", async () => {
    const rows = await alsNutzer<{ dashboard_daten: unknown }>(
      null,
      "SELECT dashboard_daten($1)",
      [demoAuftrag],
    );
    const daten = dashboardSchema.parse(rows[0]!.dashboard_daten);
    expect(daten.aussagen[0]?.kontext).toContain("Zusammenführung");
  });

  it("bleibt für einen nicht freigegebenen Auftrag gesperrt", async () => {
    await expect(
      alsNutzer(null, "SELECT dashboard_daten($1)", [privaterAuftrag]),
    ).rejects.toThrow(/Kein Zugriff/);
  });
});

describe("auftrag_uebernehmen", () => {
  it("verlangt eine Anmeldung", async () => {
    await expect(
      alsNutzer(null, "SELECT auftrag_uebernehmen($1)", [demoAuftrag]),
    ).rejects.toThrow(/Anmeldung erforderlich/);
  });

  it("verweigert einen fremden, nicht freigegebenen Auftrag", async () => {
    await expect(
      alsNutzer(FREMDER, "SELECT auftrag_uebernehmen($1)", [privaterAuftrag]),
    ).rejects.toThrow(/nicht freigegeben/);
  });

  it("meldet einen unbekannten Auftrag", async () => {
    await expect(
      alsNutzer(FREMDER, "SELECT auftrag_uebernehmen($1)", [
        "00000000-0000-0000-0000-00000000ffff",
      ]),
    ).rejects.toThrow(/nicht gefunden/);
  });

  it("kopiert Regeln und Quellen ins eigene Konto", async () => {
    const rows = await alsNutzer<{ auftrag_uebernehmen: string }>(
      FREMDER,
      "SELECT auftrag_uebernehmen($1)",
      [demoAuftrag],
    );
    const neu = rows[0]!.auftrag_uebernehmen;

    const { rows: kopie } = await db.query<{
      user_id: string; name: string; oeffentliche_demo: boolean;
      pflichtbegriffe: string[]; mindest_treffer: number;
    }>(
      `SELECT user_id,name,oeffentliche_demo,pflichtbegriffe,mindest_treffer
         FROM auftraege WHERE id=$1`,
      [neu],
    );
    expect(kopie[0]?.user_id).toBe(FREMDER);
    expect(kopie[0]?.name).toContain("(Kopie)");
    expect(kopie[0]?.pflichtbegriffe).toEqual(["Alpha"]);
    expect(kopie[0]?.mindest_treffer).toBe(2);
    // Die Kopie ist nicht von selbst öffentlich - Freigeben bleibt eine
    // eigene Entscheidung des neuen Besitzers.
    expect(kopie[0]?.oeffentliche_demo).toBe(false);

    const { rows: quellen } = await db.query<{ url: string; themenspezifisch: boolean }>(
      "SELECT url,themenspezifisch FROM quellen WHERE auftrag_id=$1",
      [neu],
    );
    expect(quellen).toHaveLength(1);
    expect(quellen[0]?.themenspezifisch).toBe(true);
  });

  it("übernimmt keine fremden Inhalte und Aussagen", async () => {
    const rows = await alsNutzer<{ auftrag_uebernehmen: string }>(
      FREMDER,
      "SELECT auftrag_uebernehmen($1)",
      [demoAuftrag],
    );
    const neu = rows[0]!.auftrag_uebernehmen;
    const { rows: aussagen } = await db.query<{ anzahl: string }>(
      "SELECT count(*)::text AS anzahl FROM aussagen WHERE auftrag_id=$1",
      [neu],
    );
    expect(aussagen[0]?.anzahl).toBe("0");

    const { rows: inhalte } = await db.query<{ anzahl: string }>(
      `SELECT count(*)::text AS anzahl FROM inhalte i
         JOIN quellen q ON q.id=i.quelle_id WHERE q.auftrag_id=$1`,
      [neu],
    );
    expect(inhalte[0]?.anzahl).toBe("0");
  });
});

describe("api_schluessel_geheim", () => {
  it("verlangt eine Anmeldung", async () => {
    await expect(alsNutzer(null, "SELECT api_schluessel_geheim()")).rejects.toThrow(
      /Anmeldung erforderlich/,
    );
  });

  it("meldet einen fehlenden Zugang als solchen", async () => {
    await expect(alsNutzer(FREMDER, "SELECT api_schluessel_geheim()")).rejects.toThrow(
      /Kein KI-Zugang hinterlegt/,
    );
  });

  it("gibt den eigenen Zugang ausschließlich verschlüsselt heraus", async () => {
    await db.query(
      `INSERT INTO api_schluessel (user_id,anbieter,schluessel_verschluesselt)
       VALUES ($1,'anthropic','iv.tag.geheimerchiffretext')
       ON CONFLICT (user_id) DO UPDATE SET schluessel_verschluesselt=EXCLUDED.schluessel_verschluesselt`,
      [BESITZER],
    );
    const rows = await alsNutzer<{ api_schluessel_geheim: Record<string, unknown> }>(
      BESITZER,
      "SELECT api_schluessel_geheim()",
    );
    const zugang = rows[0]!.api_schluessel_geheim;
    expect(zugang["anbieter"]).toBe("anthropic");
    expect(zugang["verschluesselt"]).toBe("iv.tag.geheimerchiffretext");
    await db.query("DELETE FROM api_schluessel WHERE user_id=$1", [BESITZER]);
  });
});

describe("auftrag_uebernehmen mehrfach", () => {
  it("vergibt beim zweiten Mal einen freien Namen statt zu scheitern", async () => {
    const zweiter = "00000000-0000-0000-0000-0000000005c3";
    // Vorher aufräumen, nicht nur hinterher: Bricht ein Lauf mittendrin ab,
    // bleiben Zeilen liegen und der nächste Lauf prüft an ihnen vorbei.
    await db.query("DELETE FROM auftraege WHERE user_id=$1", [zweiter]);
    await alsNutzer(zweiter, "SELECT auftrag_uebernehmen($1)", [demoAuftrag]);
    await alsNutzer(zweiter, "SELECT auftrag_uebernehmen($1)", [demoAuftrag]);
    const { rows } = await db.query<{ name: string }>(
      // Nach Anlagezeitpunkt, nicht nach Namen: Die Sortierung von Namen
      // hängt an der Spracheinstellung der Datenbank, die Klammern und
      // Leerzeichen unterschiedlich gewichtet.
      "SELECT name FROM auftraege WHERE user_id=$1 ORDER BY erstellt_am",
      [zweiter],
    );
    expect(rows.map((r) => r.name)).toEqual([
      "Belegtest Demo (Kopie)",
      "Belegtest Demo (Kopie 2)",
    ]);
    await db.query("DELETE FROM auftraege WHERE user_id=$1", [zweiter]);
  });
});
