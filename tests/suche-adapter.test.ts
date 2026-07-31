/**
 * Prüft den Such-Adapter (SearXNG).
 *
 * Geprüft wird gegen nachgebildete Antworten, nicht gegen eine laufende
 * Instanz: Ein Test, der ein fremdes Netz braucht, prüft am Ende dessen
 * Erreichbarkeit und nicht unseren Code.
 */
import { describe, it, expect } from "vitest";
import {
  baueAbfrage,
  trefferAuswerten,
  zugangsKopf,
  MAX_TREFFER,
  ZUGANGSDATEN_VARIABLE,
} from "../src/lib/quellen/suche";

describe("Abfrageadresse bauen", () => {
  it("erzwingt format=json und lässt die übrigen Einstellungen stehen", () => {
    const ziel = baueAbfrage(
      "https://such.beispiel.tld/search?q=Kabinett+Merz&language=de&time_range=day",
    );
    expect(ziel.searchParams.get("format")).toBe("json");
    expect(ziel.searchParams.get("q")).toBe("Kabinett Merz");
    expect(ziel.searchParams.get("language")).toBe("de");
    expect(ziel.searchParams.get("time_range")).toBe("day");
  });

  it("überschreibt ein bereits gesetztes Format", () => {
    const ziel = baueAbfrage("https://such.beispiel.tld/search?q=test&format=rss");
    expect(ziel.searchParams.get("format")).toBe("json");
  });

  it("weist eine Adresse ohne Suchfrage ab, statt leer abzurufen", () => {
    expect(() => baueAbfrage("https://such.beispiel.tld/search")).toThrow(/Suchfrage/);
    expect(() => baueAbfrage("https://such.beispiel.tld/search?q=%20%20")).toThrow(/Suchfrage/);
  });

  it("weist fremde Protokolle ab", () => {
    expect(() => baueAbfrage("javascript:alert(1)")).toThrow(/Protokoll/);
  });
});

describe("Zugangsdaten", () => {
  it("schickt ohne hinterlegte Daten keinen Kopf mit", () => {
    expect(zugangsKopf(new URL("https://such.beispiel.tld/"), undefined)).toEqual({});
    expect(zugangsKopf(new URL("https://such.beispiel.tld/"), "   ")).toEqual({});
  });

  it("baut den Basic-Kopf aus benutzer:passwort", () => {
    const kopf = zugangsKopf(new URL("https://such.beispiel.tld/"), "anna:geheim");
    expect(kopf.Authorization).toBe(`Basic ${Buffer.from("anna:geheim").toString("base64")}`);
  });

  it("sendet Zugangsdaten NIE über unverschlüsseltes http", () => {
    expect(() => zugangsKopf(new URL("http://such.beispiel.tld/"), "anna:geheim")).toThrow(
      new RegExp(ZUGANGSDATEN_VARIABLE),
    );
  });

  it("meldet eine unbrauchbare Form, statt sie zu verschicken", () => {
    expect(() => zugangsKopf(new URL("https://such.beispiel.tld/"), "nurbenutzer")).toThrow(
      /benutzer:passwort/,
    );
  });
});

describe("Treffer auswerten", () => {
  const antwort = {
    query: "Kabinett Merz",
    number_of_results: 2,
    results: [
      {
        url: "https://forum.beispiel.tld/thema/123",
        title: "Gerücht um Neubesetzung",
        content: "Im Forum wird seit gestern über eine Neubesetzung gesprochen.",
        publishedDate: "2026-07-30T08:15:00",
        engine: "duckduckgo",
      },
      {
        url: "https://blog.beispiel.tld/beitrag",
        title: "Was dran ist",
        content: "Ein Blogbeitrag dazu.",
        publishedDate: null,
      },
    ],
  };

  it("übernimmt Adresse, Titel, Auszug und Datum", () => {
    const inhalte = trefferAuswerten(antwort);
    expect(inhalte).toHaveLength(2);
    expect(inhalte[0]!.url).toBe("https://forum.beispiel.tld/thema/123");
    expect(inhalte[0]!.titel).toBe("Gerücht um Neubesetzung");
    expect(inhalte[0]!.auszug).toContain("Neubesetzung gesprochen");
    expect(inhalte[0]!.veroeffentlichtAm?.toISOString()).toContain("2026-07-30");
    expect(inhalte[1]!.veroeffentlichtAm).toBeNull();
  });

  it("nennt nie die Suchmaschine als Verfasser", () => {
    // Der Suchtreffer weiß nicht, wer den Beitrag geschrieben hat. Eine
    // erfundene Angabe wäre schlimmer als gar keine.
    for (const inhalt of trefferAuswerten(antwort)) {
      expect(inhalt.autor).toBeNull();
    }
  });

  it("übergeht unbrauchbare Treffer, statt den Abruf zu verlieren", () => {
    const inhalte = trefferAuswerten({
      results: [
        { url: "javascript:alert(1)", title: "böse" },
        { url: "keine-adresse", title: "kaputt" },
        { titel: "falsches Feld" },
        { url: "https://gut.beispiel.tld/x", title: "brauchbar" },
      ],
    });
    expect(inhalte).toHaveLength(1);
    expect(inhalte[0]!.url).toBe("https://gut.beispiel.tld/x");
  });

  it("nimmt die Adresse als Titel, wenn keiner geliefert wird", () => {
    const inhalte = trefferAuswerten({ results: [{ url: "https://x.beispiel.tld/y" }] });
    expect(inhalte[0]!.titel).toBe("https://x.beispiel.tld/y");
  });

  it("begrenzt die Zahl der Treffer je Abruf", () => {
    const viele = Array.from({ length: MAX_TREFFER + 25 }, (_, i) => ({
      url: `https://x.beispiel.tld/${i}`,
      title: `Treffer ${i}`,
    }));
    expect(trefferAuswerten({ results: viele })).toHaveLength(MAX_TREFFER);
  });

  it("verträgt eine Antwort ohne Treffer", () => {
    expect(trefferAuswerten({ results: [] })).toEqual([]);
    expect(trefferAuswerten({})).toEqual([]);
  });

  it("meldet eine Antwort, die gar keine Suchantwort ist", () => {
    expect(() => trefferAuswerten({ results: "keine Liste" })).toThrow(/results/);
    expect(() => trefferAuswerten("<html>")).toThrow(/results/);
  });
});
