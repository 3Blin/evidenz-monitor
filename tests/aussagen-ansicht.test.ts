/**
 * Prüft den Rechenteil der Aussagenliste.
 *
 * Der wichtigste Punkt steht bei der Leiter: Stufe 8 ("Widerlegt") darf nicht
 * als höchste Sprosse erscheinen. Für ein System, das Falschmeldungen erkennen
 * soll, wäre das die schlimmste denkbare Verwechslung.
 */
import { describe, it, expect } from "vitest";
import {
  fruehesterBeleg, leiterBalken, sortiere, alterInWorten, datumInWorten,
  LEITER_STUFEN, STUFE_WIDERLEGT, SORTIERUNG_TEXT,
} from "../src/lib/aussagen-ansicht";
import type { Beleg } from "../src/lib/supabase-daten";

function beleg(herausgeber: string, veroeffentlichtAm: string | null): Beleg {
  return {
    inhaltId: herausgeber, titel: `Titel ${herausgeber}`,
    url: `https://${herausgeber}.example/x`, herausgeber,
    quellentyp: "fachmedium", veroeffentlichtAm, belegstelle: null,
    beziehung: "uebernahme", klassifikation: null,
  };
}

describe("Erstmeldung", () => {
  it("findet den frühesten Beleg", () => {
    const b = fruehesterBeleg([
      beleg("spaet", "2026-07-20T10:00:00Z"),
      beleg("frueh", "2026-07-18T09:00:00Z"),
      beleg("mittel", "2026-07-19T09:00:00Z"),
    ]);
    expect(b?.herausgeber).toBe("frueh");
  });

  it("hält einen Beleg ohne Datum nicht für den ersten", () => {
    // Er könnte der erste sein - aber "könnte" ist keine Erstmeldung, und
    // eine geratene Erstmeldung wäre schlimmer als keine.
    const b = fruehesterBeleg([beleg("ohne", null), beleg("mit", "2026-07-20T10:00:00Z")]);
    expect(b?.herausgeber).toBe("mit");
  });

  it("gibt null zurück, wenn kein Beleg ein Datum hat", () => {
    expect(fruehesterBeleg([beleg("a", null), beleg("b", "unlesbar")])).toBeNull();
    expect(fruehesterBeleg([])).toBeNull();
    expect(fruehesterBeleg(undefined)).toBeNull();
  });
});

describe("Sortierung", () => {
  const aussagen = [
    { stufe: 2, seit: "2026-07-10T00:00:00Z", belegAnzahl: 7 },
    { stufe: 6, seit: "2026-07-01T00:00:00Z", belegAnzahl: 2 },
    { stufe: 8, seit: "2026-07-30T00:00:00Z", belegAnzahl: 3 },
  ];

  it("stellt nach Belastbarkeit die höchste Leiterstufe voran", () => {
    expect(sortiere(aussagen, "stufe").map((a) => a.stufe)).toEqual([6, 2, 8]);
  });

  it("stellt Widerlegtes ans Ende, nicht an die Spitze", () => {
    // Stufe 8 ist die höchste Zahl, aber der schwächste Befund. Eine
    // Sortierung nach der nackten Zahl kehrte die Aussage um.
    expect(sortiere(aussagen, "stufe").at(-1)?.stufe).toBe(STUFE_WIDERLEGT);
  });

  it("sortiert nach Datum, neueste zuerst", () => {
    expect(sortiere(aussagen, "neueste").map((a) => a.stufe)).toEqual([8, 2, 6]);
  });

  it("stellt Aussagen ohne Datum bei 'neueste' ans Ende", () => {
    const mitLuecke = [...aussagen, { stufe: 3, seit: null, belegAnzahl: 1 }];
    expect(sortiere(mitLuecke, "neueste").at(-1)?.stufe).toBe(3);
  });

  it("sortiert nach Zahl der Belege", () => {
    expect(sortiere(aussagen, "belege").map((a) => a.belegAnzahl)).toEqual([7, 3, 2]);
  });

  it("verändert die Vorlage nicht", () => {
    const vorher = aussagen.map((a) => a.stufe);
    sortiere(aussagen, "neueste");
    expect(aussagen.map((a) => a.stufe)).toEqual(vorher);
  });

  it("hat für jede Sortierart einen Klartext", () => {
    for (const art of ["stufe", "neueste", "belege"] as const) {
      expect(SORTIERUNG_TEXT[art]).toBeTruthy();
    }
  });
});

describe("Reifegrad-Leiter", () => {
  it("enthält Stufe 8 nicht", () => {
    // "Widerlegt" ist kein höherer Grad als "Behoben", sondern ein anderer
    // Ausgang. Als achter Balken einer Reihe läse es sich als Steigerung.
    expect(LEITER_STUFEN).not.toContain(STUFE_WIDERLEGT);
    expect(leiterBalken([]).some((b) => b.stufe === STUFE_WIDERLEGT)).toBe(false);
  });

  it("macht häufige Stufen breiter als seltene", () => {
    const balken = leiterBalken([
      { stufe: 1, seit: null, belegAnzahl: 1 },
      { stufe: 1, seit: null, belegAnzahl: 1 },
      { stufe: 1, seit: null, belegAnzahl: 1 },
      { stufe: 5, seit: null, belegAnzahl: 1 },
    ]);
    const eins = balken.find((b) => b.stufe === 1);
    const fuenf = balken.find((b) => b.stufe === 5);
    expect(eins?.anzahl).toBe(3);
    expect(eins?.anteil ?? 0).toBeGreaterThan(fuenf?.anteil ?? 0);
  });

  it("lässt leere Stufen anklickbar schmal stehen", () => {
    // Ein Filter, der verschwindet, sobald er nichts trifft, ist keiner.
    const balken = leiterBalken([{ stufe: 1, seit: null, belegAnzahl: 1 }]);
    for (const b of balken) expect(b.anteil).toBeGreaterThanOrEqual(4);
  });

  it("summiert sich auf die volle Breite", () => {
    const balken = leiterBalken([
      { stufe: 2, seit: null, belegAnzahl: 1 },
      { stufe: 7, seit: null, belegAnzahl: 1 },
    ]);
    const summe = balken.reduce((a, b) => a + b.anteil, 0);
    expect(summe).toBeCloseTo(100, 6);
  });

  it("verteilt ohne Aussagen gleichmäßig", () => {
    const balken = leiterBalken([]);
    expect(balken).toHaveLength(LEITER_STUFEN.length);
    for (const b of balken) expect(b.anteil).toBeCloseTo(100 / LEITER_STUFEN.length, 6);
  });
});

describe("Zeitangaben", () => {
  const jetzt = new Date("2026-07-31T12:00:00Z").getTime();

  it("nennt das Alter in Worten", () => {
    expect(alterInWorten("2026-07-31T08:00:00Z", jetzt)).toBe("heute");
    expect(alterInWorten("2026-07-30T08:00:00Z", jetzt)).toBe("gestern");
    expect(alterInWorten("2026-07-21T12:00:00Z", jetzt)).toBe("vor 10 Tagen");
    expect(alterInWorten("2026-04-01T12:00:00Z", jetzt)).toBe("vor 4 Monaten");
    expect(alterInWorten("2024-04-01T12:00:00Z", jetzt)).toBe("vor über einem Jahr");
  });

  it("schweigt bei fehlender oder unlesbarer Angabe", () => {
    expect(alterInWorten(null, jetzt)).toBe("");
    expect(alterInWorten("irgendwas", jetzt)).toBe("");
  });

  it("sagt 'ohne Datum' statt eines erfundenen Datums", () => {
    expect(datumInWorten(null)).toBe("ohne Datum");
    expect(datumInWorten("irgendwas")).toBe("ohne Datum");
    expect(datumInWorten("2026-07-20T10:00:00Z")).toContain("2026");
  });
});
