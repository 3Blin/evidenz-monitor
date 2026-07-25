import { describe, it, expect } from "vitest";
import { klassifiziereGruppe, gruppiere, type VorInhalt } from "../src/lib/vorklassifikation";

function v(p: Partial<VorInhalt> & { titel: string; herausgeber: string }): VorInhalt {
  return {
    inhaltId: crypto.randomUUID(),
    quellentyp: "fachmedium",
    veroeffentlichtAm: new Date("2026-07-01T10:00:00Z"),
    ...p,
  };
}

describe("Vorklassifikation", () => {
  it("erklärt den frühesten Beitrag zur Primärmeldung", () => {
    const b = klassifiziereGruppe([
      v({ titel: "A", herausgeber: "Spät", veroeffentlichtAm: new Date("2026-07-02") }),
      v({ titel: "A", herausgeber: "Früh", veroeffentlichtAm: new Date("2026-07-01") }),
    ]);
    expect(b[0]?.beziehung).toBe("primaer");
  });

  it("erkennt eine nahezu identische spätere Meldung als Übernahme", () => {
    const b = klassifiziereGruppe([
      v({ titel: "WLAN-Abbrüche bei Intel-Adaptern nach 25H2", herausgeber: "A", veroeffentlichtAm: new Date("2026-07-01") }),
      v({ titel: "WLAN-Abbrüche bei Intel-Adaptern nach 25H2", herausgeber: "B", veroeffentlichtAm: new Date("2026-07-02") }),
    ]);
    expect(b[1]?.beziehung).toBe("uebernahme");
  });

  it("wertet mehrere Beiträge desselben Herausgebers nicht als unabhängig", () => {
    const b = klassifiziereGruppe([
      v({ titel: "Problem X tritt auf", herausgeber: "heise", veroeffentlichtAm: new Date("2026-07-01") }),
      v({ titel: "Problem X: neue Details zum Fehlerbild", herausgeber: "heise", veroeffentlichtAm: new Date("2026-07-03") }),
    ]);
    expect(b[1]?.beziehung).toBe("uebernahme");
  });

  it("wertet eine eigenständige Meldung als unabhängige Bestätigung", () => {
    const b = klassifiziereGruppe([
      v({ titel: "Nach Update KB5062 keine Verbindung mit Intel WLAN", herausgeber: "Forum", veroeffentlichtAm: new Date("2026-07-01") }),
      v({ titel: "Intel WLAN Karten verlieren Verbindung, Nutzer berichten von Ausfällen", herausgeber: "Neowin", veroeffentlichtAm: new Date("2026-07-02") }),
    ]);
    expect(b[1]?.beziehung).toBe("unabhaengige_bestaetigung");
  });

  it("markiert Herstellerquellen als offizielle Bestätigung", () => {
    const b = klassifiziereGruppe([
      v({ titel: "Bekanntes Problem", herausgeber: "Microsoft", quellentyp: "hersteller_offiziell" }),
    ]);
    expect(b[0]?.klassifikation).toBe("offizielle_bestaetigung");
  });

  it("liefert für jeden Befund eine Begründung", () => {
    const b = klassifiziereGruppe([v({ titel: "A", herausgeber: "X" })]);
    expect(b[0]?.begruendung.length).toBeGreaterThan(10);
  });

  it("kommt mit leerer Gruppe zurecht (Fehlerfall)", () => {
    expect(klassifiziereGruppe([])).toEqual([]);
  });
});

describe("Gruppierung", () => {
  it("fasst inhaltsgleiche Meldungen zusammen", () => {
    const g = gruppiere([
      v({ titel: "WLAN-Abbrüche bei Intel-Adaptern nach 25H2 Update", herausgeber: "A" }),
      v({ titel: "Intel-Adapter: WLAN-Abbrüche nach dem 25H2 Update", herausgeber: "B" }),
      v({ titel: "Neues Startmenü im Insider-Build", herausgeber: "C" }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]).toHaveLength(2);
  });

  it("liefert leere Liste bei leerer Eingabe (Fehlerfall)", () => {
    expect(gruppiere([])).toEqual([]);
  });
});

describe("Vorklassifikation: Randfälle", () => {
  it("behandelt fehlende Veröffentlichungsdaten ohne Absturz", () => {
    const b = klassifiziereGruppe([
      v({ titel: "Meldung ohne Datum", herausgeber: "A", veroeffentlichtAm: null }),
      v({ titel: "Andere Sicht auf dasselbe Ereignis", herausgeber: "B", veroeffentlichtAm: null }),
    ]);
    expect(b).toHaveLength(2);
    expect(b[0]?.beziehung).toBe("primaer");
  });
});
