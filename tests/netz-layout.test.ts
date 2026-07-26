/**
 * Prüft die Anordnung des Quellennetzes.
 *
 * Anlass: Beim ersten Gebrauch waren von sieben Quellen nur zwei zu sehen,
 * am Telefon eine. Die entscheidende Zusage dieses Moduls ist deshalb: Jeder
 * Knoten liegt im gelieferten Ausschnitt - bei jeder Knotenzahl.
 */
import { describe, expect, it } from "vitest";
import {
  alsViewBox, ordneAn, passendeAnsicht, radius, verschobeneAnsicht,
  zusammenhangskomponenten, type NetzKante, type NetzKnoten,
} from "../src/lib/netz-layout";

function knoten(id: string, gewicht = 5): NetzKnoten {
  return { id, label: `Quelle ${id}`, quellentyp: "forum", gewicht, offiziell: false };
}

function alleImAusschnitt(k: readonly NetzKnoten[], kanten: readonly NetzKante[] = []): boolean {
  const platziert = ordneAn(k, kanten);
  const a = passendeAnsicht(platziert);
  return platziert.every(
    (p) =>
      p.x - p.radius >= a.x &&
      p.y - p.radius >= a.y &&
      p.x + p.radius <= a.x + a.breite &&
      p.y + p.radius <= a.y + a.hoehe,
  );
}

describe("ordneAn und passendeAnsicht", () => {
  it("hält jeden Knoten im Ausschnitt - von einer bis fünfzig Quellen", () => {
    for (let anzahl = 1; anzahl <= 50; anzahl++) {
      const k = Array.from({ length: anzahl }, (_, i) => knoten(String(i)));
      expect(alleImAusschnitt(k), `${anzahl} Quellen`).toBe(true);
    }
  });

  it("hält auch sehr unterschiedlich große Knoten im Ausschnitt", () => {
    const k = [knoten("a", 1), knoten("b", 500), knoten("c", 40), knoten("d", 0)];
    expect(alleImAusschnitt(k)).toBe(true);
  });

  it("liefert bei gleicher Eingabe dieselbe Anordnung", () => {
    const k = [knoten("a"), knoten("b"), knoten("c")];
    expect(ordneAn(k, [])).toEqual(ordneAn(k, []));
  });

  it("lässt Knoten einander nicht überdecken", () => {
    const k = Array.from({ length: 8 }, (_, i) => knoten(String(i), 20));
    const platziert = ordneAn(k, []);
    for (const a of platziert) {
      for (const b of platziert) {
        if (a.id === b.id) continue;
        const abstand = Math.hypot(a.x - b.x, a.y - b.y);
        expect(abstand).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it("stellt verbundene Quellen näher zueinander als zu unverbundenen", () => {
    const k = [knoten("a"), knoten("b"), knoten("fern")];
    const kanten: NetzKante[] = [{ von: "a", nach: "b", art: "uebernahme" }];
    const p = ordneAn(k, kanten);
    const a = p.find((x) => x.id === "a");
    const b = p.find((x) => x.id === "b");
    const fern = p.find((x) => x.id === "fern");
    if (!a || !b || !fern) throw new Error("Knoten fehlt");
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(Math.hypot(a.x - fern.x, a.y - fern.y));
  });

  it("kommt ohne Knoten zurecht", () => {
    expect(ordneAn([], [])).toEqual([]);
    const a = passendeAnsicht([]);
    expect(a.breite).toBeGreaterThan(0);
    expect(a.hoehe).toBeGreaterThan(0);
  });

  it("übergeht Kanten auf unbekannte Knoten", () => {
    const k = [knoten("a")];
    expect(() => ordneAn(k, [{ von: "a", nach: "gibtesnicht", art: "uebernahme" }])).not.toThrow();
  });
});

describe("zusammenhangskomponenten", () => {
  it("erkennt eine verbundene Gruppe", () => {
    const k = [knoten("a"), knoten("b"), knoten("c")];
    const gruppen = zusammenhangskomponenten(k, [
      { von: "a", nach: "b", art: "uebernahme" },
      { von: "b", nach: "c", art: "uebernahme" },
    ]);
    expect(gruppen).toHaveLength(1);
    expect(gruppen[0]).toHaveLength(3);
  });

  it("zählt jede unverbundene Quelle als eigene Gruppe", () => {
    const k = [knoten("a"), knoten("b"), knoten("c")];
    expect(zusammenhangskomponenten(k, [])).toHaveLength(3);
  });
});

describe("verschobeneAnsicht", () => {
  it("behält die Mitte beim Vergrößern", () => {
    const grund = { x: 0, y: 0, breite: 100, hoehe: 100 };
    const gezoomt = verschobeneAnsicht(grund, 2, 0, 0);
    expect(gezoomt.x + gezoomt.breite / 2).toBeCloseTo(50);
    expect(gezoomt.y + gezoomt.hoehe / 2).toBeCloseTo(50);
    expect(gezoomt.breite).toBeCloseTo(50);
  });

  it("verschiebt um den angegebenen Versatz", () => {
    const grund = { x: 0, y: 0, breite: 100, hoehe: 100 };
    expect(verschobeneAnsicht(grund, 1, 30, -10).x).toBeCloseTo(30);
    expect(verschobeneAnsicht(grund, 1, 30, -10).y).toBeCloseTo(-10);
  });

  it("verhindert eine Vergrößerung von null oder darunter", () => {
    const grund = { x: 0, y: 0, breite: 100, hoehe: 100 };
    expect(Number.isFinite(verschobeneAnsicht(grund, 0, 0, 0).breite)).toBe(true);
    expect(verschobeneAnsicht(grund, -3, 0, 0).breite).toBeGreaterThan(0);
  });
});

describe("radius", () => {
  it("wächst mit der Zahl der Beiträge, aber begrenzt", () => {
    expect(radius(1)).toBeLessThan(radius(20));
    expect(radius(10_000)).toBeLessThanOrEqual(40);
  });

  it("bleibt auch bei null oder negativen Angaben sichtbar", () => {
    expect(radius(0)).toBeGreaterThan(0);
    expect(radius(-5)).toBeGreaterThan(0);
  });
});

describe("alsViewBox", () => {
  it("schreibt vier Zahlen in der erwarteten Reihenfolge", () => {
    expect(alsViewBox({ x: -10.55, y: 2, breite: 100, hoehe: 50 })).toBe("-10.6 2.0 100.0 50.0");
  });
});
