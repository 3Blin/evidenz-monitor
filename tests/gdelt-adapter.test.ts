/**
 * Prüft den GDELT-Adapter.
 *
 * Der Schwerpunkt liegt auf dem Datum: GDELT liefert `20260730T121500Z`, eine
 * Form, die `new Date()` nicht versteht. Ohne eigene Auswertung entstünde
 * stillschweigend ein ungültiges Datum - und der Zeitpunkt ist bei diesem
 * Adapter gerade das, wofür er da ist.
 */
import { describe, it, expect } from "vitest";
import {
  baueAbfrage,
  artikelAuswerten,
  seendateLesen,
  BASIS_URL,
  MAX_TREFFER,
  VORGABE_ZEITRAUM,
} from "../src/lib/quellen/gdelt";

describe("Abfrageadresse bauen", () => {
  it("setzt Betriebsart, Format, Obergrenze und Zeitraum", () => {
    const ziel = baueAbfrage(`${BASIS_URL}?query=Kabinett Merz`);
    expect(ziel.origin + ziel.pathname).toBe(BASIS_URL);
    expect(ziel.searchParams.get("query")).toBe("Kabinett Merz");
    expect(ziel.searchParams.get("mode")).toBe("artlist");
    expect(ziel.searchParams.get("format")).toBe("json");
    expect(ziel.searchParams.get("maxrecords")).toBe(String(MAX_TREFFER));
    expect(ziel.searchParams.get("timespan")).toBe(VORGABE_ZEITRAUM);
  });

  it("übernimmt einen eigenen Zeitraum", () => {
    const ziel = baueAbfrage(`${BASIS_URL}?query=test&timespan=7d`);
    expect(ziel.searchParams.get("timespan")).toBe("7d");
  });

  it("nimmt auch q als Suchfrage an", () => {
    expect(baueAbfrage("https://api.gdeltproject.org/x?q=test").searchParams.get("query")).toBe(
      "test",
    );
  });

  it("weist eine Adresse ohne Suchfrage ab", () => {
    expect(() => baueAbfrage(BASIS_URL)).toThrow(/Suchfrage/);
  });
});

describe("Zeitform von GDELT", () => {
  it("liest 20260730T121500Z als UTC", () => {
    expect(seendateLesen("20260730T121500Z")?.toISOString()).toBe("2026-07-30T12:15:00.000Z");
  });

  it("kommt auch ohne abschließendes Z zurecht", () => {
    expect(seendateLesen("20260730T121500")?.toISOString()).toBe("2026-07-30T12:15:00.000Z");
  });

  it("gibt bei fehlender oder unlesbarer Angabe null zurück, statt zu raten", () => {
    expect(seendateLesen(undefined)).toBeNull();
    expect(seendateLesen("gestern")).toBeNull();
    expect(seendateLesen("")).toBeNull();
  });
});

describe("Artikel auswerten", () => {
  const antwort = {
    articles: [
      {
        url: "https://nachrichten.beispiel.tld/artikel-1",
        url_mobile: "",
        title: "Erste Meldung zur Neubesetzung",
        seendate: "20260730T121500Z",
        domain: "nachrichten.beispiel.tld",
        language: "German",
        sourcecountry: "Germany",
      },
      {
        url: "https://andere.beispiel.tld/artikel-2",
        title: "Übernahme derselben Meldung",
        seendate: "20260730T140000Z",
        domain: "andere.beispiel.tld",
      },
    ],
  };

  it("übernimmt Adresse, Titel und Sichtungszeitpunkt", () => {
    const inhalte = artikelAuswerten(antwort);
    expect(inhalte).toHaveLength(2);
    expect(inhalte[0]!.url).toBe("https://nachrichten.beispiel.tld/artikel-1");
    expect(inhalte[0]!.titel).toBe("Erste Meldung zur Neubesetzung");
    expect(inhalte[0]!.veroeffentlichtAm?.toISOString()).toBe("2026-07-30T12:15:00.000Z");
    expect(inhalte[0]!.auszug).toContain("nachrichten.beispiel.tld");
    expect(inhalte[0]!.autor).toBeNull();
  });

  it("übergeht unbrauchbare Einträge", () => {
    const inhalte = artikelAuswerten({
      articles: [
        { url: "ftp://x.tld/y", title: "falsches Protokoll" },
        { title: "ohne Adresse" },
        { url: "https://gut.beispiel.tld/z", title: "brauchbar" },
      ],
    });
    expect(inhalte).toHaveLength(1);
  });

  it("begrenzt die Zahl der Treffer je Abruf", () => {
    const viele = Array.from({ length: MAX_TREFFER + 40 }, (_, i) => ({
      url: `https://x.beispiel.tld/${i}`,
      title: `Artikel ${i}`,
    }));
    expect(artikelAuswerten({ articles: viele })).toHaveLength(MAX_TREFFER);
  });

  it("verträgt eine Antwort ohne Treffer", () => {
    // GDELT lässt das Feld bei null Treffern ganz weg - kein Fehlerfall.
    expect(artikelAuswerten({})).toEqual([]);
    expect(artikelAuswerten({ articles: [] })).toEqual([]);
  });

  it("meldet eine Antwort, die keine Artikelliste ist", () => {
    expect(() => artikelAuswerten({ articles: "nichts" })).toThrow(/articles/);
  });
});
