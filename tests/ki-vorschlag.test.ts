/**
 * Prüft das Auswerten eines KI-Vorschlags.
 *
 * Der Schwerpunkt liegt auf unbrauchbaren Antworten. Ein Sprachmodell hält
 * sich nicht zuverlässig an ein Format; wenn eine krumme Antwort ungeprüft in
 * die Datenbank liefe, entstünden Regeln, die niemand geschrieben hat.
 */
import { describe, expect, it } from "vitest";
import { baueAnweisung, leseVorschlag, schaeleJson } from "../src/lib/ki/vorschlag";

const gueltig = {
  suchbegriffe: ["Kabinett", "Minister", "Rücktritt"],
  pflichtbegriffe: ["Kabinett"],
  ausschlussbegriffe: ["Werbung"],
  mindestTreffer: 1,
  quellen: [
    {
      url: "https://www.bundesregierung.de/service/rss",
      herausgeber: "Bundesregierung",
      typ: "hersteller_offiziell",
      themenspezifisch: true,
      begruendung: "Amtliche Mitteilungen",
    },
  ],
  begruendung: "Die Begriffe decken das Thema ab.",
};

describe("leseVorschlag", () => {
  it("liest einen gültigen Vorschlag", () => {
    const v = leseVorschlag(JSON.stringify(gueltig));
    expect(v.suchbegriffe).toEqual(["Kabinett", "Minister", "Rücktritt"]);
    expect(v.quellen[0]?.herausgeber).toBe("Bundesregierung");
  });

  it("kommt mit einem Antwortrahmen aus Backticks zurecht", () => {
    const roh = "Gern! Hier das Ergebnis:\n```json\n" + JSON.stringify(gueltig) + "\n```\nViel Erfolg.";
    expect(leseVorschlag(roh).mindestTreffer).toBe(1);
  });

  it("entfernt doppelte Begriffe unabhängig von der Schreibweise", () => {
    const v = leseVorschlag(
      JSON.stringify({ ...gueltig, suchbegriffe: ["Kabinett", "kabinett", " Kabinett ", "Minister"] }),
    );
    expect(v.suchbegriffe).toEqual(["Kabinett", "Minister"]);
  });

  it("verhindert eine Regel, die kein Beitrag erfüllen kann", () => {
    // Drei nötige Treffer bei zwei Suchbegriffen hieße: dauerhaft leeres
    // Dashboard, ohne erkennbaren Grund.
    const v = leseVorschlag(
      JSON.stringify({ ...gueltig, suchbegriffe: ["Kabinett", "Minister"], mindestTreffer: 3 }),
    );
    expect(v.mindestTreffer).toBe(2);
  });

  it("weist eine Antwort ohne JSON zurück", () => {
    expect(() => leseVorschlag("Dazu kann ich leider nichts sagen.")).toThrow(/JSON/);
  });

  it("weist fehlende Felder zurück", () => {
    expect(() => leseVorschlag(JSON.stringify({ suchbegriffe: ["a"] }))).toThrow(/Aufbau/);
  });

  it("weist einen unbekannten Quellentyp zurück", () => {
    const krumm = { ...gueltig, quellen: [{ ...gueltig.quellen[0], typ: "zeitungskiosk" }] };
    expect(() => leseVorschlag(JSON.stringify(krumm))).toThrow(/Aufbau/);
  });

  it("weist eine Quelle ohne gültige Adresse zurück", () => {
    const krumm = { ...gueltig, quellen: [{ ...gueltig.quellen[0], url: "irgendwas" }] };
    expect(() => leseVorschlag(JSON.stringify(krumm))).toThrow(/Aufbau/);
  });

  it("weist eine unsinnige Trefferzahl zurück", () => {
    expect(() => leseVorschlag(JSON.stringify({ ...gueltig, mindestTreffer: 0 }))).toThrow(/Aufbau/);
  });

  it("kommt ohne Quellenvorschläge aus", () => {
    const ohne: Record<string, unknown> = { ...gueltig };
    delete ohne["quellen"];
    expect(leseVorschlag(JSON.stringify(ohne)).quellen).toEqual([]);
  });

  it("begrenzt übermäßig lange Listen", () => {
    const viele = Array.from({ length: 40 }, (_, i) => `Begriff${i}`);
    expect(() => leseVorschlag(JSON.stringify({ ...gueltig, suchbegriffe: viele }))).toThrow();
  });
});

describe("schaeleJson", () => {
  it("holt das Objekt aus einer Antwort mit Vorrede", () => {
    expect(schaeleJson('Klar: {"a":1} - fertig')).toBe('{"a":1}');
  });

  it("lässt reines JSON unverändert", () => {
    expect(schaeleJson('{"a":1}')).toBe('{"a":1}');
  });
});

describe("baueAnweisung", () => {
  it("nennt Name und Fragestellung", () => {
    const text = baueAnweisung({ name: "Kabinett", fragestellung: "Wer folgt nach?" });
    expect(text).toContain("Kabinett");
    expect(text).toContain("Wer folgt nach?");
  });

  it("nimmt die Beobachtungsbeschreibung auf, wenn es sie gibt", () => {
    const text = baueAnweisung({
      name: "A", fragestellung: "B", zielbeschreibung: "Namen der Nachfolger",
    });
    expect(text).toContain("Namen der Nachfolger");
  });

  it("bleibt themenneutral - kein Beispiel aus einem Sachgebiet", () => {
    // Ein Beispiel mit Windows-Bezug würde das Modell auf Technikthemen
    // ziehen und widerspräche der verbindlichen Themenneutralität.
    const text = baueAnweisung({ name: "Irgendein Thema", fragestellung: "Irgendeine Frage" });
    for (const wort of ["Windows", "Microsoft", "KB5", "CVE"]) {
      expect(text).not.toContain(wort);
    }
  });

  it("verlangt ausdrücklich, keine Adressen zu erfinden", () => {
    const text = baueAnweisung({ name: "A", fragestellung: "B" });
    expect(text).toContain("Erfinde keine Adressen");
  });
});
