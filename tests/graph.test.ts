import { describe, it, expect } from "vitest";
import { baueGraph, type InhaltMitQuelle } from "../src/lib/graph";

function i(p: Partial<InhaltMitQuelle> & { quelleId: string; herausgeber: string }): InhaltMitQuelle {
  return {
    inhaltId: crypto.randomUUID(),
    quellentyp: "community",
    gruppeId: null,
    beziehung: null,
    ...p,
  };
}

describe("Graph-Aufbau", () => {
  it("erzeugt je Quelle genau einen Punkt mit Gewicht", () => {
    const { knoten } = baueGraph([
      i({ quelleId: "q1", herausgeber: "Reddit" }),
      i({ quelleId: "q1", herausgeber: "Reddit" }),
      i({ quelleId: "q2", herausgeber: "Heise" }),
    ]);
    expect(knoten).toHaveLength(2);
    expect(knoten.find((k) => k.id === "q1")?.gewicht).toBe(2);
  });

  it("markiert offizielle Primärquellen", () => {
    const { knoten } = baueGraph([
      i({ quelleId: "q1", herausgeber: "Microsoft", quellentyp: "hersteller_offiziell" }),
      i({ quelleId: "q2", herausgeber: "Reddit" }),
    ]);
    expect(knoten.find((k) => k.id === "q1")?.offiziell).toBe(true);
    expect(knoten.find((k) => k.id === "q2")?.offiziell).toBe(false);
  });

  it("zeichnet eine Kante von der Primärquelle zur Übernahme", () => {
    const { kanten } = baueGraph([
      i({ quelleId: "q1", herausgeber: "Reddit", gruppeId: "g1", beziehung: "primaer" }),
      i({ quelleId: "q2", herausgeber: "Newsblog", gruppeId: "g1", beziehung: "uebernahme" }),
    ]);
    expect(kanten).toEqual([{ von: "q1", nach: "q2", art: "uebernahme" }]);
  });

  it("zeichnet keine Kante ohne Gruppenzuordnung", () => {
    const { kanten } = baueGraph([
      i({ quelleId: "q1", herausgeber: "A" }),
      i({ quelleId: "q2", herausgeber: "B" }),
    ]);
    expect(kanten).toHaveLength(0);
  });

  it("vermeidet doppelte Kanten zwischen denselben Quellen", () => {
    const { kanten } = baueGraph([
      i({ quelleId: "q1", herausgeber: "A", gruppeId: "g1", beziehung: "primaer" }),
      i({ quelleId: "q2", herausgeber: "B", gruppeId: "g1", beziehung: "uebernahme" }),
      i({ quelleId: "q2", herausgeber: "B", gruppeId: "g1", beziehung: "uebernahme" }),
    ]);
    expect(kanten).toHaveLength(1);
  });

  it("zeichnet keine Kante auf sich selbst (Fehlerfall)", () => {
    const { kanten } = baueGraph([
      i({ quelleId: "q1", herausgeber: "A", gruppeId: "g1", beziehung: "primaer" }),
      i({ quelleId: "q1", herausgeber: "A", gruppeId: "g1", beziehung: "zitat" }),
    ]);
    expect(kanten).toHaveLength(0);
  });

  it("liefert leere Daten bei leerer Eingabe (Fehlerfall)", () => {
    expect(baueGraph([])).toEqual({ knoten: [], kanten: [] });
  });
});
