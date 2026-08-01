import { describe, it, expect } from "vitest";
import { klassifiziereGruppe, gruppiere, type VorInhalt } from "../src/lib/vorklassifikation";
import { ermittleReifegrad, zaehleUnabhaengigeQuellen } from "../src/lib/reifegrad";

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

  it("behauptet keine Unabhängigkeit, nur weil der Herausgeber ein anderer ist", () => {
    // Umgekehrt zur ersten Fassung, und das ist der Kern: Der Beitrag ist ja
    // gerade deshalb in dieser Gruppe, weil er dieselbe Sache behandelt. Dass
    // er sie anders formuliert, belegt keine eigene Recherche. Sonst würden
    // drei Portale, die dieselbe Herstellermeldung abschreiben, zu "drei
    // unabhängigen Quellen" und die Aussage stiege auf Stufe 5.
    const b = klassifiziereGruppe([
      v({ titel: "Nach Update KB5062 keine Verbindung mit Intel WLAN", herausgeber: "Forum", veroeffentlichtAm: new Date("2026-07-01") }),
      v({ titel: "Intel WLAN Karten verlieren Verbindung, Nutzer berichten von Ausfällen", herausgeber: "Neowin", veroeffentlichtAm: new Date("2026-07-02") }),
    ]);
    expect(b[1]?.beziehung).toBe("uebernahme");
    expect(b[1]?.begruendung).toContain("Unabhängigkeit ist noch nicht belegt");
  });

  it("hält den Reifegrad ohne KI-Analyse bei höchstens Stufe 2", () => {
    // Die Folge der vorsichtigen Vorgabe, hier ausdrücklich festgehalten:
    // Drei Herausgeber über dieselbe Sache ergeben eine unabhängige Quelle
    // (die Primärmeldung), nicht drei.
    const gruppe = [
      v({ titel: "Erstmeldung zum Ausfall", herausgeber: "A", veroeffentlichtAm: new Date("2026-07-01") }),
      v({ titel: "Bericht über denselben Ausfall", herausgeber: "B", veroeffentlichtAm: new Date("2026-07-02") }),
      v({ titel: "Auch dieses Haus meldet den Ausfall", herausgeber: "C", veroeffentlichtAm: new Date("2026-07-03") }),
    ];
    const belege = klassifiziereGruppe(gruppe).map((b) => ({
      inhaltId: b.inhaltId,
      herausgeber: gruppe.find((g) => g.inhaltId === b.inhaltId)?.herausgeber ?? "",
      quellentyp: "fachmedium",
      beziehung: b.beziehung,
      klassifikation: b.klassifikation,
      technischNachvollziehbar: false,
      erfasstAm: new Date(),
    }));
    expect(zaehleUnabhaengigeQuellen(belege)).toBe(1);
    expect(ermittleReifegrad(belege).stufe).toBe(2);
  });

  it("hält einen Beitrag einer Primärquelle NICHT für eine Bestätigung", () => {
    // Der Quellentyp sagt, WER spricht, nicht WAS gesagt wurde. Die vorige
    // Fassung stufte jeden Beitrag einer offiziellen Quelle als
    // "offizielle_bestaetigung" ein - ein Dementi eines Herstellers wäre damit
    // als Bestätigung durchgegangen und hätte die Aussage auf Stufe 6 gehoben.
    const b = klassifiziereGruppe([
      v({ titel: "Bekanntes Problem", herausgeber: "Microsoft", quellentyp: "hersteller_offiziell" }),
    ]);
    expect(b[0]?.klassifikation).toBe("stuetzt");
  });

  it("nennt die Primärquelle aber in der Begründung", () => {
    // Die Angabe geht nicht verloren - sie steht dort, wo sie hingehört: als
    // Hinweis, nicht als Urteil.
    const b = klassifiziereGruppe([
      v({ titel: "Bekanntes Problem", herausgeber: "Microsoft", quellentyp: "hersteller_offiziell" }),
    ]);
    expect(b[0]?.begruendung).toContain("Primärquelle");
    expect(b[0]?.begruendung).toContain("nicht");
  });

  it("erreicht ohne KI-Analyse ausnahmslos höchstens Stufe 2", () => {
    // Auch mit offizieller Quelle, auch bei vielen Herausgebern. Vorher war
    // genau das die Lücke, durch die Stufe 6 ohne inhaltliche Prüfung entstand.
    const gruppe = [
      v({ titel: "Problem X", herausgeber: "Microsoft", quellentyp: "hersteller_offiziell" }),
      v({ titel: "Problem X bei uns auch", herausgeber: "heise" }),
      v({ titel: "Problem X betrifft viele", herausgeber: "Golem" }),
      v({ titel: "Problem X - Statusseite", herausgeber: "MS Status", quellentyp: "status_seite" }),
    ];
    const belege = klassifiziereGruppe(gruppe).map((befund) => ({
      inhaltId: befund.inhaltId,
      herausgeber: gruppe.find((g) => g.inhaltId === befund.inhaltId)?.herausgeber ?? "",
      quellentyp: "fachmedium",
      beziehung: befund.beziehung,
      klassifikation: befund.klassifikation,
      technischNachvollziehbar: true,
      erfasstAm: new Date(),
    }));
    expect(ermittleReifegrad(belege).stufe).toBeLessThanOrEqual(2);
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
