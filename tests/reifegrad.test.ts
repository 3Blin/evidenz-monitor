import { describe, it, expect } from "vitest";
import {
  ermittleReifegrad,
  zaehleUnabhaengigeQuellen,
  stufenName,
  STUFEN,
  REGEL_VERSION,
  type Beleg,
} from "../src/lib/reifegrad";

function beleg(p: Partial<Beleg> & { herausgeber: string }): Beleg {
  return {
    inhaltId: crypto.randomUUID(),
    quellentyp: "community",
    beziehung: "primaer",
    klassifikation: "stuetzt",
    technischNachvollziehbar: false,
    erfasstAm: new Date("2026-07-01T10:00:00Z"),
    ...p,
  };
}

describe("Unabhängige Quellen zählen", () => {
  it("zählt Übernahmen NICHT als unabhängige Bestätigung (Anforderung 4.3)", () => {
    const belege = [
      beleg({ herausgeber: "reddit.com", beziehung: "primaer" }),
      beleg({ herausgeber: "newsblog.de", beziehung: "uebernahme" }),
      beleg({ herausgeber: "aggregator.com", beziehung: "zusammenfassung" }),
      beleg({ herausgeber: "zitierer.net", beziehung: "zitat" }),
    ];
    expect(zaehleUnabhaengigeQuellen(belege)).toBe(1);
  });

  it("zählt denselben Herausgeber nur einmal", () => {
    const belege = [
      beleg({ herausgeber: "Heise" }),
      beleg({ herausgeber: "heise" }),
      beleg({ herausgeber: "Golem" }),
    ];
    expect(zaehleUnabhaengigeQuellen(belege)).toBe(2);
  });

  it("zählt widersprechende Belege nicht als Bestätigung", () => {
    const belege = [
      beleg({ herausgeber: "A" }),
      beleg({ herausgeber: "B", klassifikation: "widerspricht" }),
    ];
    expect(zaehleUnabhaengigeQuellen(belege)).toBe(1);
  });
});

describe("Reifegrad-Regelkaskade", () => {
  it("Stufe 1 ohne Belege (Fehlerfall: leere Eingabe)", () => {
    const b = ermittleReifegrad([]);
    expect(b.stufe).toBe(STUFEN.EINZELHINWEIS);
    expect(b.regelVersion).toBe(REGEL_VERSION);
  });

  it("Stufe 1 bei einer einzelnen Meldung", () => {
    expect(ermittleReifegrad([beleg({ herausgeber: "reddit.com" })]).stufe).toBe(1);
  });

  it("Stufe 2, wenn mehrere Meldungen nur von einer unabhängigen Quelle stammen", () => {
    const b = ermittleReifegrad([
      beleg({ herausgeber: "reddit.com" }),
      beleg({ herausgeber: "kopie.de", beziehung: "uebernahme" }),
    ]);
    expect(b.stufe).toBe(STUFEN.MEHRFACH_BEOBACHTET);
    expect(b.ausloeser).toContain("1 unabhängige");
  });

  it("Stufe 3 bei zwei unabhängigen Quellen", () => {
    const b = ermittleReifegrad([
      beleg({ herausgeber: "reddit.com" }),
      beleg({ herausgeber: "elevenforum.com", beziehung: "unabhaengige_bestaetigung" }),
    ]);
    expect(b.stufe).toBe(STUFEN.TREND);
  });

  it("Stufe 4, wenn zusätzlich technisch nachvollziehbar", () => {
    const b = ermittleReifegrad([
      beleg({ herausgeber: "reddit.com", technischNachvollziehbar: true }),
      beleg({ herausgeber: "elevenforum.com", beziehung: "unabhaengige_bestaetigung" }),
    ]);
    expect(b.stufe).toBe(STUFEN.TECHNISCH_PLAUSIBEL);
  });

  it("Stufe 5 ab drei unabhängigen Quellen", () => {
    const b = ermittleReifegrad([
      beleg({ herausgeber: "reddit.com" }),
      beleg({ herausgeber: "elevenforum.com", beziehung: "unabhaengige_bestaetigung" }),
      beleg({ herausgeber: "heise.de", beziehung: "unabhaengige_bestaetigung" }),
    ]);
    expect(b.stufe).toBe(STUFEN.UNABHAENGIG_BESTAETIGT);
    expect(b.unabhaengigeQuellen).toBe(3);
  });

  it("Stufe 6 bei offizieller Bestätigung, auch wenn nur eine Quelle", () => {
    const b = ermittleReifegrad([
      beleg({ herausgeber: "Microsoft", quellentyp: "hersteller_offiziell", klassifikation: "offizielle_bestaetigung" }),
    ]);
    expect(b.stufe).toBe(STUFEN.OFFIZIELL_BESTAETIGT);
  });

  it("Stufe 7, wenn eine Korrektur vorliegt (hat Vorrang vor Bestätigung)", () => {
    const b = ermittleReifegrad([
      beleg({ herausgeber: "Microsoft", klassifikation: "offizielle_bestaetigung" }),
      beleg({ herausgeber: "Microsoft", klassifikation: "korrektur" }),
    ]);
    expect(b.stufe).toBe(STUFEN.BEHOBEN);
  });

  it("Stufe 8 bei offizieller Widerlegung (höchster Vorrang)", () => {
    const b = ermittleReifegrad([
      beleg({ herausgeber: "reddit.com" }),
      beleg({ herausgeber: "heise.de", beziehung: "unabhaengige_bestaetigung" }),
      beleg({ herausgeber: "Microsoft", klassifikation: "offizielle_widerlegung" }),
    ]);
    expect(b.stufe).toBe(STUFEN.WIDERLEGT);
    expect(b.widersprueche).toBe(1);
  });

  it("liefert für jede Stufe eine Begründung", () => {
    const b = ermittleReifegrad([beleg({ herausgeber: "x" })]);
    expect(b.ausloeser.length).toBeGreaterThan(10);
  });

  it("ist reproduzierbar: gleiche Eingabe, gleiches Ergebnis", () => {
    const belege = [beleg({ herausgeber: "a" }), beleg({ herausgeber: "b" })];
    expect(ermittleReifegrad(belege)).toEqual(ermittleReifegrad(belege));
  });
});

describe("Stufennamen", () => {
  it("liefert Klartext für alle acht Stufen", () => {
    for (let s = 1; s <= 8; s++) {
      expect(stufenName(s as 1)).toBeTruthy();
    }
  });
});
