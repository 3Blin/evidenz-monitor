/**
 * Prüft die Zuordnung Quelle -> Zugangsweg.
 *
 * Diese Zuordnung entscheidet, ob eine Quelle als Feed oder als Webseite
 * gelesen wird. Ein Fehler hier fällt im Betrieb nur als "Quelle nicht
 * erreichbar" auf und wäre schwer zu finden - deshalb ist sie eigens geprüft.
 */
import { describe, it, expect } from "vitest";
import {
  adapterFuerQuelle,
  istFeedAdresse,
  istZugangsweg,
  EINGELIEFERTER_TYP,
  ZUGANGSWEGE,
  ZUGANGSWEG_TEXT,
} from "../src/lib/quellen/registrierung";

describe("Zuordnung des Zugangswegs", () => {
  it("erkennt die Feeds der ersten Ausbaustufe", () => {
    const feeds = [
      "https://www.reddit.com/r/Windows11/new/.rss",
      "https://www.elevenforum.com/whats-new/posts/index.rss",
      "https://www.heise.de/rss/heise-atom.xml",
      "https://www.bleepingcomputer.com/feed/",
      "https://api.msrc.microsoft.com/update-guide/rss",
    ];
    for (const url of feeds) {
      expect(istFeedAdresse(url), url).toBe(true);
      expect(adapterFuerQuelle({ url, typ: "community" }).name).toBe("rss");
    }
  });

  it("behandelt Status- und Supportseiten als Webseiten", () => {
    const seiten = [
      "https://learn.microsoft.com/windows/release-health/status-windows-11-25h2",
      "https://support.microsoft.com/help/5000000",
      "https://www.hersteller.example/treiber/hinweise",
    ];
    for (const url of seiten) {
      expect(istFeedAdresse(url), url).toBe(false);
      expect(adapterFuerQuelle({ url, typ: "status_seite" }).name).toBe("web");
    }
  });

  it("richtet sich nach der Adresse, nicht nach dem Herausgebertyp", () => {
    // Derselbe Typ, zwei Zugangswege - genau der Fall, an dem eine Zuordnung
    // über den Typ scheitern würde.
    expect(adapterFuerQuelle({ url: "https://x.example/feed/", typ: "fachmedium" }).name).toBe("rss");
    expect(adapterFuerQuelle({ url: "https://x.example/artikel/1", typ: "fachmedium" }).name).toBe("web");
  });

  it("weist eingelieferte Quellen ausdrücklich ab (Fehlerfall)", () => {
    expect(() =>
      adapterFuerQuelle({ url: "https://sammler.example/hermes", typ: EINGELIEFERTER_TYP }),
    ).toThrow(/eingeliefert/);
  });
});

describe("Zugangsweg als gespeicherte Angabe (ADR 0014)", () => {
  it("verhält sich ohne Angabe wie bisher", () => {
    // Rückwärtsverträglichkeit: Zeilen, die vor Migration 0008 entstanden
    // sind, kommen ohne diesen Wert an.
    expect(adapterFuerQuelle({ url: "https://x.example/feed/", typ: "fachmedium" }).name).toBe("rss");
    expect(
      adapterFuerQuelle({ url: "https://x.example/feed/", typ: "fachmedium", zugangsweg: null }).name,
    ).toBe("rss");
    expect(
      adapterFuerQuelle({ url: "https://x.example/a", typ: "fachmedium", zugangsweg: "automatisch" }).name,
    ).toBe("web");
  });

  it("wählt Suche und GDELT, die man der Adresse nicht ansieht", () => {
    // Genau der Fall, an dem die Erkennung an der Adresse scheitert: Eine
    // Suchadresse sieht aus wie eine gewöhnliche Webseite.
    const suchadresse = "https://search.n0de.online/search?q=Kabinett+Merz";
    expect(adapterFuerQuelle({ url: suchadresse, typ: "api" }).name).toBe("web");
    expect(adapterFuerQuelle({ url: suchadresse, typ: "api", zugangsweg: "suche" }).name).toBe("suche");
    expect(
      adapterFuerQuelle({
        url: "https://api.gdeltproject.org/api/v2/doc/doc?query=test",
        typ: "api",
        zugangsweg: "gdelt",
      }).name,
    ).toBe("gdelt");
  });

  it("erzwingt Feed und Webseite gegen die Erkennung", () => {
    expect(adapterFuerQuelle({ url: "https://x.example/a", typ: "fachmedium", zugangsweg: "feed" }).name)
      .toBe("rss");
    expect(adapterFuerQuelle({ url: "https://x.example/feed/", typ: "fachmedium", zugangsweg: "web" }).name)
      .toBe("web");
  });

  it("deutet einen unbekannten Wert nicht, sondern meldet ihn", () => {
    expect(() =>
      adapterFuerQuelle({ url: "https://x.example/a", typ: "fachmedium", zugangsweg: "telepathie" }),
    ).toThrow(/Unbekannter Zugangsweg/);
  });

  it("hat für jeden erlaubten Wert einen Klartext und eine Erkennung", () => {
    for (const weg of ZUGANGSWEGE) {
      expect(ZUGANGSWEG_TEXT[weg], weg).toBeTruthy();
      expect(istZugangsweg(weg), weg).toBe(true);
    }
    expect(istZugangsweg("telepathie")).toBe(false);
    expect(istZugangsweg(null)).toBe(false);
  });
});
