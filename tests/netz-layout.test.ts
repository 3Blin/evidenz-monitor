/**
 * Prüft die Anordnung des Quellennetzes.
 *
 * Anlass: Beim ersten Gebrauch waren von sieben Quellen nur zwei zu sehen,
 * am Telefon eine. Die entscheidende Zusage dieses Moduls ist deshalb: Jeder
 * Knoten liegt im gelieferten Ausschnitt - bei jeder Knotenzahl.
 */
import { describe, expect, it } from "vitest";
import {
  alsViewBox, feldBreite, felderPassen, gekuerzt, gruppenNummern, kantenMitte, kantenPfad,
  NAME_HOECHSTLAENGE,
  OHNE_GRUPPE, ordneAn, passendeAnsicht, radius, verschobeneAnsicht, zusammenhangskomponenten,
  type NetzKante, type NetzKnoten,
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

describe("Gruppennummern für die Einfärbung (ADR 0016)", () => {
  const k = (id: string): NetzKnoten => ({
    id, label: id.toUpperCase(), quellentyp: "fachmedium", gewicht: 3, offiziell: false,
  });

  it("gibt verbundenen Knoten dieselbe Nummer", () => {
    const nummern = gruppenNummern(
      [k("a"), k("b"), k("c")],
      [{ von: "a", nach: "b", art: "uebernahme" }],
    );
    expect(nummern.get("a")).toBe(nummern.get("b"));
    expect(nummern.get("c")).not.toBe(nummern.get("a"));
  });

  it("gibt einem Knoten ohne Verbindung KEINE eigene Gruppe", () => {
    // Er bildet keine Gruppe, er steht allein. Vier Einzelgaenger in vier
    // Farben saehen aus wie vier Befunde, obwohl es keiner ist - und sie
    // uebertoenten die eine Gruppe, um die es geht.
    const nummern = gruppenNummern(
      [k("a"), k("b"), k("allein1"), k("allein2")],
      [{ von: "a", nach: "b", art: "uebernahme" }],
    );
    expect(nummern.get("allein1")).toBe(OHNE_GRUPPE);
    expect(nummern.get("allein2")).toBe(OHNE_GRUPPE);
    expect(nummern.get("a")).toBe(0);
  });

  it("nummeriert Gruppen luecklos, auch wenn Einzelne dazwischenliegen", () => {
    // Ohne eigenen Zaehler wuerde eine Gruppe hinter mehreren Einzelnen eine
    // hohe Nummer bekommen und im Farbkreis wieder bei vorn landen.
    const nummern = gruppenNummern(
      [k("a"), k("b"), k("allein"), k("c"), k("d")],
      [
        { von: "a", nach: "b", art: "uebernahme" },
        { von: "c", nach: "d", art: "uebernahme" },
      ],
    );
    expect([nummern.get("a"), nummern.get("c")].sort()).toEqual([0, 1]);
  });

  it("nummeriert die größte Gruppe als erste", () => {
    // Die erste Farbe ist die auffälligste; sie gehört an das dichteste
    // Geflecht.
    const nummern = gruppenNummern(
      [k("x"), k("y"), k("a"), k("b"), k("c")],
      [
        { von: "a", nach: "b", art: "uebernahme" },
        { von: "b", nach: "c", art: "uebernahme" },
        { von: "x", nach: "y", art: "uebernahme" },
      ],
    );
    expect(nummern.get("a")).toBe(0);
    expect(nummern.get("x")).toBe(1);
  });

  it("vergibt bei gleicher Größe stabile Nummern", () => {
    // Ohne feste Reihenfolge wechselten die Farben bei jedem Laden der Seite.
    const knoten = [k("y"), k("x"), k("b"), k("a")];
    const kanten = [
      { von: "x", nach: "y", art: "uebernahme" },
      { von: "a", nach: "b", art: "uebernahme" },
    ];
    const einmal = gruppenNummern(knoten, kanten);
    const nochmal = gruppenNummern([...knoten].reverse(), kanten);
    expect(einmal.get("x")).toBe(nochmal.get("x"));
    expect(einmal.get("a")).toBe(nochmal.get("a"));
  });

  it("verträgt ein leeres Netz", () => {
    expect(gruppenNummern([], []).size).toBe(0);
  });
});

describe("Gebogene Kanten", () => {
  it("beginnt und endet an den Knotenmitten", () => {
    const pfad = kantenPfad(0, 0, 100, 0);
    expect(pfad.startsWith("M 0.0 0.0")).toBe(true);
    expect(pfad.endsWith("100.0 0.0")).toBe(true);
  });

  it("weicht seitlich aus, damit sich Kanten nicht überdecken", () => {
    const mitte = kantenMitte(0, 0, 100, 0);
    expect(mitte.x).toBeCloseTo(50, 1);
    expect(Math.abs(mitte.y)).toBeGreaterThan(2);
  });

  it("kommt mit zwei gleichen Punkten zurecht, statt durch Null zu teilen", () => {
    expect(Number.isNaN(kantenMitte(5, 5, 5, 5).x)).toBe(false);
    expect(kantenPfad(5, 5, 5, 5)).toContain("M 5.0 5.0");
  });
});

describe("Dichte der Anordnung (ADR 0016)", () => {
  it("hält verbundene Quellen enger zusammen als der Ring der Unverbundenen", () => {
    // Der Fall, an dem es sich zeigte: eine Zweiergruppe. Ihre Mitglieder
    // liegen einander gegenüber, ihr Abstand ist also der Durchmesser des
    // Gruppenkreises. War dessen Untergrenze fest, wurde er größer als der
    // Ring darum - und das Bild sagte das Gegenteil dessen, was gemeint war.
    for (const menge of [1, 2, 3, 5, 9]) {
      const k = [
        knoten("a"), knoten("b"),
        ...Array.from({ length: menge }, (_, i) => knoten(`allein${i}`)),
      ];
      const p = ordneAn(k, [{ von: "a", nach: "b", art: "uebernahme" }]);
      const a = p.find((x) => x.id === "a");
      const b = p.find((x) => x.id === "b");
      if (!a || !b) throw new Error("Knoten fehlt");
      const innen = Math.hypot(a.x - b.x, a.y - b.y);
      for (const einzeln of p.filter((x) => x.id.startsWith("allein"))) {
        expect(
          Math.hypot(a.x - einzeln.x, a.y - einzeln.y),
          `${menge} Unverbundene`,
        ).toBeGreaterThan(innen);
      }
    }
  });

  it("legt sich quer, weil die Karte quer ist", () => {
    // Ein kreisrundes Bild in einer Karte im Verhaeltnis 3:2 laesst links und
    // rechts je ein Viertel leer. Schlimmer noch: Bei zwei Elementen auf einem
    // Ring standen diese uebereinander, und das Bild wurde eine schmale Saeule
    // in einer weiten Karte. Genau dieser Zuschnitt kam im Betrieb vor.
    const faelle: readonly (readonly [string, readonly NetzKante[]])[] = [
      ["zwei Einzelne, zwei Gruppen", [
        { von: "0", nach: "1", art: "uebernahme" },
        { von: "2", nach: "3", art: "uebernahme" },
      ]],
      ["eine Dreiergruppe", [
        { von: "0", nach: "1", art: "uebernahme" },
        { von: "1", nach: "2", art: "uebernahme" },
      ]],
      ["gar keine Verknuepfung", []],
    ];
    for (const [name, kanten] of faelle) {
      const k = Array.from({ length: 7 }, (_, i) => knoten(String(i), 30));
      const a = passendeAnsicht(ordneAn(k, kanten, 1.7));
      expect(a.breite / a.hoehe, name).toBeGreaterThan(1);
    }
  });

  it("legt sich hochkant, wenn die Fläche hochkant ist", () => {
    // Am Telefon ist die Karte höher als breit. Ein waagerecht gedehntes Bild
    // passte dort nur, indem es klein wird - und genau das war die erste
    // Rückmeldung ("am Handy sehe ich einen").
    for (const kanten of [
      [] as readonly NetzKante[],
      [{ von: "0", nach: "1", art: "uebernahme" }] as readonly NetzKante[],
    ]) {
      const k = Array.from({ length: 7 }, (_, i) => knoten(String(i), 30));
      const a = passendeAnsicht(ordneAn(k, kanten, 0.8));
      expect(a.breite / a.hoehe).toBeLessThan(1);
    }
  });

  it("lässt Knoten auch nach dem Dehnen einander nicht überdecken", () => {
    // Gedehnt wird nur die längere Achse, nie die kürzere gestaucht - sonst
    // rückten Knoten zusammen und könnten sich überlagern.
    for (const verhaeltnis of [0.4, 0.8, 1, 1.7, 3, 12]) {
      const k = Array.from({ length: 9 }, (_, i) => knoten(String(i), 40));
      const platziert = ordneAn(k, [{ von: "0", nach: "1", art: "uebernahme" }], verhaeltnis);
      for (const a of platziert) {
        for (const b of platziert) {
          if (a.id === b.id) continue;
          expect(
            Math.hypot(a.x - b.x, a.y - b.y),
            `${verhaeltnis}: ${a.id}/${b.id}`,
          ).toBeGreaterThan(a.radius + b.radius);
        }
      }
    }
  });

  it("verträgt ein unbrauchbares Seitenverhältnis", () => {
    const k = [knoten("a"), knoten("b")];
    for (const kaputt of [0, -1, Number.NaN]) {
      expect(ordneAn(k, [], kaputt).every((p) => Number.isFinite(p.x))).toBe(true);
    }
  });
});

describe("Ausschnitt an die Zeichenfläche angleichen (ADR 0016)", () => {
  const k = [knoten("a", 10), knoten("b", 10), knoten("c", 10)];

  it("trifft das gewünschte Seitenverhältnis", () => {
    for (const ziel of [0.6, 1, 1.9, 3]) {
      const a = passendeAnsicht(ordneAn(k, []), undefined, ziel);
      expect(a.breite / a.hoehe, `Ziel ${ziel}`).toBeCloseTo(ziel, 5);
    }
  });

  it("weitet nur, beschneidet nie", () => {
    // Sonst verschwaenden Knoten am Rand - genau der Mangel, den diese
    // Funktion beheben soll.
    const platziert = ordneAn(k, []);
    const ohne = passendeAnsicht(platziert);
    for (const ziel of [0.5, 1.2, 4]) {
      const mit = passendeAnsicht(platziert, undefined, ziel);
      expect(mit.breite, `Ziel ${ziel}`).toBeGreaterThanOrEqual(ohne.breite - 0.001);
      expect(mit.hoehe, `Ziel ${ziel}`).toBeGreaterThanOrEqual(ohne.hoehe - 0.001);
      expect(mit.x).toBeLessThanOrEqual(ohne.x + 0.001);
      expect(mit.y).toBeLessThanOrEqual(ohne.y + 0.001);
    }
  });

  it("behält die Mitte", () => {
    const ohne = passendeAnsicht(ordneAn(k, []));
    const mit = passendeAnsicht(ordneAn(k, []), undefined, 3);
    expect(mit.x + mit.breite / 2).toBeCloseTo(ohne.x + ohne.breite / 2, 5);
    expect(mit.y + mit.hoehe / 2).toBeCloseTo(ohne.y + ohne.hoehe / 2, 5);
  });

  it("übergeht unbrauchbare Angaben, statt daran zu zerbrechen", () => {
    for (const kaputt of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const a = passendeAnsicht(ordneAn(k, []), undefined, kaputt);
      expect(Number.isFinite(a.breite) && a.breite > 0, String(kaputt)).toBe(true);
    }
  });
});

describe("Namensfeld unter dem Knoten (ADR 0017)", () => {
  it("wächst mit der Länge des Namens", () => {
    expect(feldBreite("MSRC")).toBeLessThan(feldBreite("heise online"));
  });

  it("hat auch bei leerem Namen eine Breite", () => {
    expect(feldBreite("")).toBeGreaterThan(0);
  });

  it("kürzt lange Namen und zeigt das an", () => {
    const lang = "Bundesministerium für Digitales und Verkehr";
    const kurz = gekuerzt(lang);
    expect(kurz.length).toBeLessThanOrEqual(NAME_HOECHSTLAENGE);
    expect(kurz.endsWith("…")).toBe(true);
  });

  it("lässt kurze Namen unangetastet", () => {
    expect(gekuerzt("MSRC")).toBe("MSRC");
    expect(gekuerzt("  heise online  ")).toBe("heise online");
  });
});

describe("Passen die Namensfelder? (ADR 0017)", () => {
  const platziert = [
    { id: "a", label: "heise online", quellentyp: "fachmedium", gewicht: 5, offiziell: false,
      x: -100, y: 0, radius: 20 },
    { id: "b", label: "MSRC", quellentyp: "fachmedium", gewicht: 5, offiziell: false,
      x: 100, y: 0, radius: 20 },
  ];

  it("passt auf einer großen Fläche", () => {
    // Maßstab 1 heißt: ein Bildschirmpunkt ist eine Zeichnungseinheit.
    expect(felderPassen(platziert, 1)).toBe(true);
  });

  it("passt nicht mehr, wenn die Fläche klein ist", () => {
    // Am Telefon ist ein Punkt mehrere Einheiten breit - dann werden aus
    // lesbaren Feldern Balken, die einander überdecken.
    expect(felderPassen(platziert, 4)).toBe(false);
  });

  it("stört sich nicht an Knoten, die übereinanderstehen", () => {
    // Felder stehen nebeneinander, nicht übereinander.
    const uebereinander = [
      { ...platziert[0]!, x: 0, y: -300 },
      { ...platziert[1]!, x: 0, y: 300 },
    ];
    expect(felderPassen(uebereinander, 4)).toBe(true);
  });

  it("verträgt einen einzelnen Knoten und unbrauchbare Maßstäbe", () => {
    expect(felderPassen([platziert[0]!], 99)).toBe(true);
    expect(felderPassen(platziert, 0)).toBe(true);
    expect(felderPassen(platziert, Number.NaN)).toBe(true);
  });
});
