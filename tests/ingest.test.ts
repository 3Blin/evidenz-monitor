/**
 * Prüft die Einlieferung externer Sammler (ADR 0002 Punkt 2, ADR 0007).
 *
 * Zwei Ebenen:
 * 1. Die Datenbankfunktion inhalt_einliefern - sie trägt die Token-Prüfung und
 *    die Dublettenerkennung. Besonders wichtig ist der Nachweis, dass sie den
 *    Inhalt-Hash nach genau derselben Regel bildet wie src/lib/dedup.ts. Liefen
 *    die beiden Regeln auseinander, würde dieselbe Meldung doppelt gespeichert
 *    und als zweite, unabhängige Bestätigung gezählt - genau der Fehler, den
 *    Anforderung 4.3 ausschließen soll.
 * 2. Die Anwendungsseite - Formprüfung, Kürzung der Auszüge, Übersetzung der
 *    Abweisungen.
 */
import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { datenbank, schliesseDatenbank } from "../src/lib/db";
import { inhaltHash } from "../src/lib/dedup";
import {
  einlieferungSchema,
  auszuegeKuerzen,
  liefereInhalteEin,
  tokenAusKopf,
  EinlieferungAbgewiesen,
  ZUSTAND_KEIN_ZUGRIFF,
  MAX_INHALTE_JE_ANFRAGE,
  type Einlieferung,
} from "../src/lib/ingest";

const db = datenbank();
const NUTZER = "00000000-0000-0000-0000-0000000000e1";
const TOKEN = "geheimes-testtoken-mit-genug-laenge";
const TOKEN_ABGESCHALTET = "abgeschaltetes-testtoken-lang-genug";

let auftragId = "";

function hashVon(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function einliefern(
  token: string,
  quelle: { url: string; herausgeber: string },
  inhalte: readonly Record<string, unknown>[],
): Promise<{ angenommen: number; uebersprungen: number; quelle: string }> {
  const { rows } = await db.query<{ ergebnis: { angenommen: number; uebersprungen: number; quelle: string } }>(
    "SELECT inhalt_einliefern($1,$2::jsonb,$3::jsonb) AS ergebnis",
    [token, JSON.stringify(quelle), JSON.stringify(inhalte)],
  );
  return rows[0]!.ergebnis;
}

const QUELLE = { url: "https://sammler.example/hermes", herausgeber: "Hermes-Sammler" };

beforeAll(async () => {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO auftraege (user_id,name,zielbeschreibung,fragestellung)
     VALUES ($1,'Ingesttest','Ziel','Frage?') RETURNING id`,
    [NUTZER],
  );
  auftragId = rows[0]!.id;
  await db.query(
    `INSERT INTO ingest_tokens (auftrag_id,bezeichnung,token_hash,aktiv)
     VALUES ($1,'Testsammler',$2,true), ($1,'Abgeschaltet',$3,false)`,
    [auftragId, hashVon(TOKEN), hashVon(TOKEN_ABGESCHALTET)],
  );
});

afterAll(async () => {
  await db.query("DELETE FROM auftraege WHERE id=$1", [auftragId]);
  await schliesseDatenbank();
});

describe("inhalt_einliefern (Datenbank)", () => {
  it("nimmt Inhalte an und legt die Quelle als eingeliefert an", async () => {
    const ergebnis = await einliefern(TOKEN, QUELLE, [
      { url: "https://x.example/a", titel: "Erste Meldung", auszug: "Auszug A" },
      { url: "https://x.example/b", titel: "Zweite Meldung", auszug: "Auszug B", autor: "Beobachter" },
    ]);
    expect(ergebnis.angenommen).toBe(2);
    expect(ergebnis.uebersprungen).toBe(0);

    const { rows } = await db.query<{ typ: string; vertrauens_basis: string }>(
      "SELECT typ, vertrauens_basis FROM quellen WHERE id=$1",
      [ergebnis.quelle],
    );
    expect(rows[0]?.typ).toBe("extern_agent");
    expect(rows[0]?.vertrauens_basis).toBe("eingeliefert_extern");
  });

  it("bildet den Inhalt-Hash genau wie src/lib/dedup.ts", async () => {
    const titel = "  Gemischte   GROSSschreibung\tund Leerraum ";
    const auszug = "Mehrere\nZeilen   mit  unregelmäßigem Abstand.";
    const ergebnis = await einliefern(TOKEN, QUELLE, [
      { url: "https://x.example/hash", titel, auszug },
    ]);
    expect(ergebnis.angenommen).toBe(1);

    const { rows } = await db.query<{ inhalt_hash: string }>(
      "SELECT inhalt_hash FROM inhalte WHERE url='https://x.example/hash'",
    );
    expect(rows[0]?.inhalt_hash).toBe(inhaltHash(titel, auszug));
  });

  it("überspringt eine erneut eingelieferte Meldung (Dublettenschutz)", async () => {
    const inhalt = { url: "https://x.example/c", titel: "Dritte Meldung", auszug: "Auszug C" };
    expect((await einliefern(TOKEN, QUELLE, [inhalt])).angenommen).toBe(1);
    const zweitesMal = await einliefern(TOKEN, QUELLE, [inhalt]);
    expect(zweitesMal.angenommen).toBe(0);
    expect(zweitesMal.uebersprungen).toBe(1);
  });

  it("protokolliert die Einlieferung wie einen Abruf", async () => {
    const ergebnis = await einliefern(TOKEN, QUELLE, [
      { url: "https://x.example/d", titel: "Vierte Meldung", auszug: "Auszug D" },
    ]);
    const { rows } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM abrufe WHERE quelle_id=$1 AND status='ok'",
      [ergebnis.quelle],
    );
    expect(rows[0]!.n).toBeGreaterThan(0);
  });

  it("übernimmt den Veröffentlichungszeitpunkt, wenn er mitgeliefert wird", async () => {
    await einliefern(TOKEN, QUELLE, [
      {
        url: "https://x.example/e",
        titel: "Fuenfte Meldung",
        auszug: "Auszug E",
        veroeffentlichtAm: "2026-07-19T06:15:00Z",
      },
    ]);
    const { rows } = await db.query<{ veroeffentlicht_am: Date }>(
      "SELECT veroeffentlicht_am FROM inhalte WHERE url='https://x.example/e'",
    );
    expect(rows[0]!.veroeffentlicht_am.toISOString()).toBe("2026-07-19T06:15:00.000Z");
  });

  it("weist ein unbekanntes Token ab (Fehlerfall)", async () => {
    await expect(
      einliefern("voellig-falsches-token-lang-genug", QUELLE, [
        { url: "https://x.example/f", titel: "Meldung", auszug: "Auszug" },
      ]),
    ).rejects.toThrow(/Token unbekannt/);
  });

  it("weist ein abgeschaltetes Token ab (Fehlerfall)", async () => {
    await expect(
      einliefern(TOKEN_ABGESCHALTET, QUELLE, [
        { url: "https://x.example/g", titel: "Meldung", auszug: "Auszug" },
      ]),
    ).rejects.toThrow(/Token unbekannt oder abgeschaltet/);
  });

  it("weist ein zu kurzes Token ab, ohne die Datenbank zu befragen (Fehlerfall)", async () => {
    await expect(einliefern("kurz", QUELLE, [])).rejects.toThrow(/zu kurz/);
  });

  it("weist eine leere Liste ab (Fehlerfall)", async () => {
    await expect(einliefern(TOKEN, QUELLE, [])).rejects.toThrow(/nicht leere Liste/);
  });

  it("weist mehr als 50 Inhalte ab (Fehlerfall)", async () => {
    const viele = Array.from({ length: 51 }, (_, n) => ({
      url: `https://x.example/viel-${n}`,
      titel: `Meldung ${n}`,
      auszug: `Auszug ${n}`,
    }));
    await expect(einliefern(TOKEN, QUELLE, viele)).rejects.toThrow(/höchstens 50/);
  });

  it("weist Inhalte ohne Pflichtangaben ab (Fehlerfall)", async () => {
    await expect(
      einliefern(TOKEN, QUELLE, [{ url: "https://x.example/h", titel: "Ohne Auszug" }]),
    ).rejects.toThrow(/url, titel und auszug/);
  });

  it("kann nur in den Auftrag des Tokens einliefern", async () => {
    // Das Token bestimmt den Auftrag - ein Absender kann keinen anderen wählen.
    const ergebnis = await einliefern(TOKEN, QUELLE, [
      { url: "https://x.example/i", titel: "Sechste Meldung", auszug: "Auszug I" },
    ]);
    const { rows } = await db.query<{ auftrag_id: string }>(
      "SELECT auftrag_id FROM quellen WHERE id=$1",
      [ergebnis.quelle],
    );
    expect(rows[0]?.auftrag_id).toBe(auftragId);
  });
});

describe("Einlieferung (Anwendungsseite)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const gueltig: Einlieferung = {
    quelle: { url: "https://sammler.example/x", herausgeber: "Sammler" },
    inhalte: [{ url: "https://x.example/1", titel: "Titel", auszug: "Auszug", autor: null, veroeffentlichtAm: null }],
  };

  it("liest das Token aus dem Authorization-Kopf", () => {
    expect(tokenAusKopf("Bearer abc123")).toBe("abc123");
    expect(tokenAusKopf("bearer abc123")).toBe("abc123");
    expect(tokenAusKopf("Basic abc123")).toBeNull();
    expect(tokenAusKopf(null)).toBeNull();
    expect(tokenAusKopf("Bearer")).toBeNull();
  });

  it("lehnt eine Anfrage ohne Inhalte ab", () => {
    const ergebnis = einlieferungSchema.safeParse({ quelle: gueltig.quelle, inhalte: [] });
    expect(ergebnis.success).toBe(false);
  });

  it("lehnt mehr als die erlaubte Zahl an Inhalten ab", () => {
    const zuViele = Array.from({ length: MAX_INHALTE_JE_ANFRAGE + 1 }, (_, n) => ({
      url: `https://x.example/${n}`,
      titel: `T${n}`,
      auszug: "A",
    }));
    expect(einlieferungSchema.safeParse({ quelle: gueltig.quelle, inhalte: zuViele }).success).toBe(false);
  });

  it("lehnt eine Adresse ab, die keine ist", () => {
    const ergebnis = einlieferungSchema.safeParse({
      quelle: { url: "kein-link", herausgeber: "X" },
      inhalte: gueltig.inhalte,
    });
    expect(ergebnis.success).toBe(false);
  });

  it("kürzt zu lange Auszüge, egal was der Absender schickt (Urheberrecht)", () => {
    const lang = "Wort ".repeat(1000);
    const gekuerzt = auszuegeKuerzen({
      quelle: gueltig.quelle,
      inhalte: [{ url: "https://x.example/1", titel: "T", auszug: lang }],
    });
    expect(gekuerzt.inhalte[0]!.auszug.length).toBeLessThan(1250);
    expect(gekuerzt.inhalte[0]!.auszug.endsWith("[…]")).toBe(true);
  });

  it("gibt das Ergebnis der Datenbank zurück", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ auftrag: "a", quelle: "q", angenommen: 2, uebersprungen: 1 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const ergebnis = await liefereInhalteEin("https://db.example", "key", "token", gueltig);
    expect(ergebnis.angenommen).toBe(2);
    expect(ergebnis.uebersprungen).toBe(1);
  });

  it("schickt das Token im Rumpf, nicht in der Adresse", async () => {
    const stub = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ auftrag: "a", quelle: "q", angenommen: 1, uebersprungen: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await liefereInhalteEin("https://db.example", "key", "geheim", gueltig);
    const [adresse, optionen] = stub.mock.calls[0]!;
    expect(String(adresse)).not.toContain("geheim");
    expect(String((optionen as RequestInit).body)).toContain("geheim");
  });

  it("macht aus der Abweisung der Datenbank einen erkennbaren Fehler (Fehlerfall)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: ZUSTAND_KEIN_ZUGRIFF, message: "Token unbekannt" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(liefereInhalteEin("https://db.example", "key", "token", gueltig)).rejects.toThrow(
      EinlieferungAbgewiesen,
    );
  });

  it("meldet eine unerwartete Antwortform, statt sie zu übernehmen (Fehlerfall)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ etwas: "anderes" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(liefereInhalteEin("https://db.example", "key", "token", gueltig)).rejects.toThrow(
      /erwarteten Aufbau/,
    );
  });
});
