import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sammleQuelle, sammleAuftrag } from "../src/lib/sammler";
import { datenbank, schliesseDatenbank } from "../src/lib/db";
import type { QuellenAdapter, RohInhalt } from "../src/lib/quellen/adapter";

const db = datenbank();
let auftragId = "";
let quelleId = "";

const NUTZER = "00000000-0000-0000-0000-0000000000aa";

function adapterMit(inhalte: readonly RohInhalt[]): QuellenAdapter {
  return { name: "test", abrufen: async () => inhalte };
}
const kaputterAdapter: QuellenAdapter = {
  name: "kaputt",
  abrufen: async () => {
    throw new Error("Status code 403");
  },
};

function roh(titel: string): RohInhalt {
  return { url: `https://test.example/${encodeURIComponent(titel)}`, titel, autor: null, veroeffentlichtAm: new Date(), auszug: `Auszug zu ${titel}` };
}

beforeAll(async () => {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung)
     VALUES ($1,'Testauftrag Sammler','Test','Test?') RETURNING id`, [NUTZER]);
  auftragId = rows[0]!.id;
  const q = await db.query<{ id: string }>(
    `INSERT INTO quellen (auftrag_id,url,typ,herausgeber) VALUES ($1,'https://test.example/feed','rss','Testquelle') RETURNING id`,
    [auftragId]);
  quelleId = q.rows[0]!.id;
});

afterAll(async () => {
  await db.query("DELETE FROM auftraege WHERE id=$1", [auftragId]);
  await schliesseDatenbank();
});

describe("Quellen-Abrufer", () => {
  it("speichert neue Inhalte und protokolliert den Lauf", async () => {
    const e = await sammleQuelle(db, { id: quelleId, url: "u", typ: "rss", herausgeber: "Testquelle" },
      adapterMit([roh("Erste Meldung"), roh("Zweite Meldung")]), "cid-1");
    expect(e.status).toBe("ok");
    expect(e.neueInhalte).toBe(2);
    const { rows } = await db.query("SELECT status FROM abrufe WHERE quelle_id=$1", [quelleId]);
    expect(rows).toHaveLength(1);
  });

  it("speichert bereits bekannte Inhalte nicht erneut (Dublettenschutz)", async () => {
    const e = await sammleQuelle(db, { id: quelleId, url: "u", typ: "rss", herausgeber: "Testquelle" },
      adapterMit([roh("Erste Meldung"), roh("Dritte Meldung")]), "cid-2");
    expect(e.neueInhalte).toBe(1);
  });

  it("protokolliert Quellenfehler, statt abzubrechen (Fehlertoleranz)", async () => {
    const e = await sammleQuelle(db, { id: quelleId, url: "u", typ: "rss", herausgeber: "Testquelle" },
      kaputterAdapter, "cid-3");
    expect(e.status).toBe("fehler");
    expect(e.fehlerText).toContain("403");
    const { rows } = await db.query<{ fehler_text: string }>(
      "SELECT fehler_text FROM abrufe WHERE quelle_id=$1 AND status='fehler'", [quelleId]);
    expect(rows[0]?.fehler_text).toContain("403");
  });

  it("setzt den Lauf fort, wenn eine von zwei Quellen ausfällt", async () => {
    const zweite = await db.query<{ id: string }>(
      `INSERT INTO quellen (auftrag_id,url,typ,herausgeber) VALUES ($1,'https://test.example/zwei','rss','Zweitquelle') RETURNING id`,
      [auftragId]);
    const zweiteId = zweite.rows[0]!.id;
    const ergebnisse = await sammleAuftrag(db, auftragId,
      (q) => (q.typ === "rss" ? adapterMit([roh("Gemeinsame Meldung")]) : kaputterAdapter), "cid-4");
    expect(ergebnisse).toHaveLength(2);
    expect(ergebnisse.every((e) => e.status === "ok")).toBe(true);
    await db.query("DELETE FROM quellen WHERE id=$1", [zweiteId]);
  });

  it("lässt eingelieferte Quellen beim Abruf aus (ADR 0002)", async () => {
    // Inhalte dieser Quelle kommen über die Ingest-Schnittstelle. Würde der
    // Abrufer sie anfassen, gäbe es bei jedem Lauf einen Fehlereintrag.
    const extern = await db.query<{ id: string }>(
      `INSERT INTO quellen (auftrag_id,url,typ,herausgeber)
       VALUES ($1,'https://sammler.example/hermes','extern_agent','Hermes-Sammler') RETURNING id`,
      [auftragId]);
    const externId = extern.rows[0]!.id;
    const ergebnisse = await sammleAuftrag(db, auftragId,
      () => adapterMit([roh("Nur fuer echte Quellen")]), "cid-extern");
    expect(ergebnisse.some((e) => e.quelleId === externId)).toBe(false);
    await db.query("DELETE FROM quellen WHERE id=$1", [externId]);
  });

  it("liefert leere Liste für einen Auftrag ohne aktive Quellen (Fehlerfall)", async () => {
    const leer = await db.query<{ id: string }>(
      `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung)
       VALUES ($1,'Leer','x','y?') RETURNING id`, [NUTZER]);
    const id = leer.rows[0]!.id;
    expect(await sammleAuftrag(db, id, () => adapterMit([]), "cid-5")).toEqual([]);
    await db.query("DELETE FROM auftraege WHERE id=$1", [id]);
  });
});
