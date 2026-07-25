/**
 * Prüft die Datenbankfunktion dashboard_daten (Migration 0002, ADR 0004/0005).
 *
 * Zweck dieser Tests: Die Funktion ist der einzige Lesepfad der Oberfläche und
 * trägt zugleich die Zugriffsprüfung. Beides muss belegt sein - eine
 * Zugriffsprüfung, die nie geprüft wurde, ist keine.
 *
 * Zusätzlich wird nachgewiesen, dass die Funktion denselben Graphen liefert wie
 * das getestete Regelwerk in src/lib/graph.ts. Zwei Wege zur selben Aussage
 * laufen sonst mit der Zeit auseinander (genau die Sorge aus ADR 0005).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { datenbank, schliesseDatenbank } from "../src/lib/db";
import { dashboardSchema } from "../src/lib/supabase-daten";
import { baueGraph, type InhaltMitQuelle } from "../src/lib/graph";
import { REGEL_VERSION } from "../src/lib/reifegrad";

const db = datenbank();
const NUTZER = "00000000-0000-0000-0000-0000000000d1";

let demoAuftrag = "";
let fremderAuftrag = "";
let quelleOffiziell = "";
let quelleUebernahme = "";

beforeAll(async () => {
  const demo = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,oeffentliche_demo)
     VALUES ($1,'Dashboardtest Demo','Ziel','Frage?',true) RETURNING id`,
    [NUTZER],
  );
  demoAuftrag = demo.rows[0]!.id;

  const fremd = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,oeffentliche_demo)
     VALUES ($1,'Dashboardtest Fremd','Ziel','Frage?',false) RETURNING id`,
    [NUTZER],
  );
  fremderAuftrag = fremd.rows[0]!.id;

  const q1 = await db.query<{ id: string }>(
    `INSERT INTO quellen (auftrag_id,url,typ,herausgeber)
     VALUES ($1,'https://test.example/msrc','hersteller_offiziell','Microsoft MSRC') RETURNING id`,
    [demoAuftrag],
  );
  quelleOffiziell = q1.rows[0]!.id;

  const q2 = await db.query<{ id: string }>(
    `INSERT INTO quellen (auftrag_id,url,typ,herausgeber)
     VALUES ($1,'https://test.example/blog','fachmedium','Newsblog') RETURNING id`,
    [demoAuftrag],
  );
  quelleUebernahme = q2.rows[0]!.id;

  // Eine Meldung, die von der offiziellen Quelle stammt und vom Fachmedium
  // übernommen wurde - der Fall, den der Graph sichtbar machen soll.
  const gruppe = await db.query<{ id: string }>(
    `INSERT INTO meldungsgruppen (auftrag_id,kanonischer_titel)
     VALUES ($1,'Treiberproblem nach Update') RETURNING id`,
    [demoAuftrag],
  );
  const gruppeId = gruppe.rows[0]!.id;

  const inhaltPrimaer = await db.query<{ id: string }>(
    `INSERT INTO inhalte (quelle_id,url,titel,auszug,inhalt_hash)
     VALUES ($1,'https://test.example/msrc/1','Treiberproblem nach Update','Auszug amtlich','hash-primaer')
     RETURNING id`,
    [quelleOffiziell],
  );
  const inhaltUebernahme = await db.query<{ id: string }>(
    `INSERT INTO inhalte (quelle_id,url,titel,auszug,inhalt_hash)
     VALUES ($1,'https://test.example/blog/1','Treiberproblem nach Update','Auszug uebernommen','hash-uebernahme')
     RETURNING id`,
    [quelleUebernahme],
  );

  await db.query(
    `INSERT INTO inhalt_gruppen (inhalt_id,gruppe_id,beziehung,begruendung)
     VALUES ($1,$2,'primaer','Erstveroeffentlichung'), ($3,$2,'uebernahme','Gleicher Wortlaut, spaeter')`,
    [inhaltPrimaer.rows[0]!.id, gruppeId, inhaltUebernahme.rows[0]!.id],
  );

  const aussage = await db.query<{ id: string }>(
    `INSERT INTO aussagen (auftrag_id,sachverhalt) VALUES ($1,'Treiber X verursacht Abstuerze') RETURNING id`,
    [demoAuftrag],
  );
  const aussageId = aussage.rows[0]!.id;

  await db.query(
    `INSERT INTO aussage_belege (aussage_id,inhalt_id,belegstelle,klassifikation)
     VALUES ($1,$2,'Absatz 1','offizielle_bestaetigung'), ($1,$3,'Absatz 2','stuetzt')`,
    [aussageId, inhaltPrimaer.rows[0]!.id, inhaltUebernahme.rows[0]!.id],
  );

  // Zwei Verlaufseinträge: die Funktion muss den neuesten nehmen (append-only).
  await db.query(
    `INSERT INTO reifegrad_verlauf (aussage_id,stufe,ausloeser,regel_version,datum)
     VALUES ($1,3,'Mehrere Hinweise',$2,now() - interval '2 days'),
            ($1,6,'Offizielle Bestaetigung durch Hersteller',$2,now())`,
    [aussageId, REGEL_VERSION],
  );

  await db.query(
    `INSERT INTO abrufe (quelle_id,status,neue_inhalte) VALUES ($1,'ok',1)`,
    [quelleOffiziell],
  );
  await db.query(
    `INSERT INTO abrufe (quelle_id,status,fehler_text) VALUES ($1,'fehler','Status code 503')`,
    [quelleUebernahme],
  );
});

afterAll(async () => {
  await db.query("DELETE FROM auftraege WHERE id = ANY($1::uuid[])", [
    [demoAuftrag, fremderAuftrag],
  ]);
  await schliesseDatenbank();
});

async function dashboard(auftrag: string): Promise<unknown> {
  const { rows } = await db.query<{ dashboard_daten: unknown }>(
    "SELECT dashboard_daten($1) AS dashboard_daten",
    [auftrag],
  );
  return rows[0]!.dashboard_daten;
}

describe("dashboard_daten", () => {
  it("liefert genau die Form, die die Oberfläche erwartet", async () => {
    const geprueft = dashboardSchema.safeParse(await dashboard(demoAuftrag));
    // Bei Abweichung die Ursache zeigen, statt nur "false erwartet".
    expect(geprueft.success ? [] : geprueft.error.issues).toEqual([]);
  });

  it("zählt Quellen, Inhalte, Aussagen und nicht erreichbare Quellen", async () => {
    const daten = dashboardSchema.parse(await dashboard(demoAuftrag));
    expect(daten.auftrag.name).toBe("Dashboardtest Demo");
    expect(daten.kennzahlen.quellen).toBe(2);
    expect(daten.kennzahlen.inhalte).toBe(2);
    expect(daten.kennzahlen.aussagen).toBe(1);
    expect(daten.kennzahlen.quellenFehler).toBe(1);
    expect(daten.kennzahlen.letzterAbruf).not.toBeNull();
  });

  it("baut denselben Graphen wie das geprüfte Regelwerk in graph.ts", async () => {
    const daten = dashboardSchema.parse(await dashboard(demoAuftrag));

    const gleicheEingabe: readonly InhaltMitQuelle[] = [
      {
        inhaltId: "i1", quelleId: quelleOffiziell, herausgeber: "Microsoft MSRC",
        quellentyp: "hersteller_offiziell", gruppeId: "g1", beziehung: "primaer",
      },
      {
        inhaltId: "i2", quelleId: quelleUebernahme, herausgeber: "Newsblog",
        quellentyp: "fachmedium", gruppeId: "g1", beziehung: "uebernahme",
      },
    ];
    const erwartet = baueGraph(gleicheEingabe);

    const sortiere = <T extends { id?: string; nach?: string }>(x: readonly T[]) =>
      [...x].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

    expect(sortiere(daten.knoten)).toEqual(sortiere(erwartet.knoten));
    expect(sortiere(daten.kanten)).toEqual(sortiere(erwartet.kanten));
  });

  it("markiert die offizielle Quelle und gewichtet nach Beitragszahl", async () => {
    const daten = dashboardSchema.parse(await dashboard(demoAuftrag));
    const offiziell = daten.knoten.find((k) => k.id === quelleOffiziell);
    expect(offiziell?.offiziell).toBe(true);
    expect(offiziell?.gewicht).toBe(1);
    expect(daten.knoten.find((k) => k.id === quelleUebernahme)?.offiziell).toBe(false);
  });

  it("nimmt den neuesten Verlaufseintrag, nicht den ersten", async () => {
    const daten = dashboardSchema.parse(await dashboard(demoAuftrag));
    expect(daten.aussagen).toHaveLength(1);
    expect(daten.aussagen[0]!.stufe).toBe(6);
    expect(daten.aussagen[0]!.ausloeser).toContain("Offizielle");
    expect(daten.aussagen[0]!.belegAnzahl).toBe(2);
    expect([...daten.aussagen[0]!.herausgeber].sort()).toEqual(["Microsoft MSRC", "Newsblog"]);
  });

  it("verweigert einen fremden Auftrag ohne Anmeldung (Fehlerfall)", async () => {
    await expect(dashboard(fremderAuftrag)).rejects.toThrow(/Kein Zugriff/);
  });

  it("meldet einen unbekannten Auftrag als nicht gefunden (Fehlerfall)", async () => {
    await expect(dashboard("00000000-0000-0000-0000-0000000000ff")).rejects.toThrow(
      /nicht gefunden/,
    );
  });

  it("zählt abgeschaltete Quellen nicht als betriebsbereit oder gestört", async () => {
    // Eine bewusst abgeschaltete Quelle ist nicht "nicht erreichbar" - ihr
    // alter Fehlversuch darf die Anzeige nicht dauerhaft rot färben.
    await db.query("UPDATE quellen SET aktiv=false WHERE id=$1", [quelleUebernahme]);
    const daten = dashboardSchema.parse(await dashboard(demoAuftrag));
    expect(daten.kennzahlen.quellen).toBe(1);
    expect(daten.kennzahlen.quellenFehler).toBe(0);
    // Ihre bisherigen Beiträge bleiben als Belege sichtbar.
    expect(daten.knoten.some((k) => k.id === quelleUebernahme)).toBe(true);
    await db.query("UPDATE quellen SET aktiv=true WHERE id=$1", [quelleUebernahme]);
  });

  it("gibt leere Listen statt null für einen Auftrag ohne Inhalte", async () => {
    const leer = await db.query<{ id: string }>(
      `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung,oeffentliche_demo)
       VALUES ($1,'Dashboardtest Leer','Ziel','Frage?',true) RETURNING id`,
      [NUTZER],
    );
    const id = leer.rows[0]!.id;
    const daten = dashboardSchema.parse(await dashboard(id));
    expect(daten.knoten).toEqual([]);
    expect(daten.kanten).toEqual([]);
    expect(daten.aussagen).toEqual([]);
    expect(daten.kennzahlen.letzterAbruf).toBeNull();
    await db.query("DELETE FROM auftraege WHERE id=$1", [id]);
  });
});
