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
  EINGELIEFERTER_TYP,
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
