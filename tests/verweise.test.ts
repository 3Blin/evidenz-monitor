/**
 * Prüft das Lesen von Verweisen.
 *
 * Zweck: Eine Übernahme verlinkt fast immer das Original. Damit dieses Signal
 * trägt, müssen zwei Schreibweisen derselben Adresse als dieselbe gelten - und
 * Verweise auf die eigene Plattform dürfen es nicht auslösen, sonst verbindet
 * jeder Kommentarverweis eines Aggregators alle seine Beiträge miteinander.
 */
import { describe, expect, it } from "vitest";
import { gemeinsameVerweise, verweise } from "../src/lib/verweise";

describe("verweise", () => {
  it("findet eine Adresse im Fließtext", () => {
    expect(verweise("Article URL: https://arstechnica.com/gadgets/2026/07/vorgang/"))
      .toEqual(["https://arstechnica.com/gadgets/2026/07/vorgang"]);
  });

  it("hält verschiedene Schreibweisen derselben Adresse zusammen", () => {
    const a = verweise("https://www.arstechnica.com/x/y/");
    const b = verweise("http://arstechnica.com/x/y?utm_source=rss#kommentare");
    expect(gemeinsameVerweise(a, b)).toHaveLength(1);
  });

  it("entfernt Satzzeichen am Ende", () => {
    expect(verweise("Mehr dazu unter https://example.org/bericht.")).toEqual([
      "https://example.org/bericht",
    ]);
  });

  it("übergeht Verweise auf die eigene Plattform", () => {
    expect(
      verweise("Comments: https://news.ycombinator.com/item?id=49031099", "https://news.ycombinator.com/x"),
    ).toEqual([]);
  });

  it("übergeht Kommentar- und Nutzerwege auch ohne eigene Adresse", () => {
    // Ohne diese Regel verbände ein Kommentarverweis jeden Beitrag eines
    // Aggregators mit jedem anderen - ein Zusammenhang aus Technik statt aus
    // Inhalt.
    expect(verweise("Comments URL: https://news.ycombinator.com/item?id=49031099")).toEqual([]);
  });

  it("behält den Verweis nach außen, wenn nur der eigene Weg gefiltert wird", () => {
    const gefunden = verweise(
      "Article URL: https://korben.info/en/gdid.html Comments URL: https://news.ycombinator.com/item?id=1",
      "https://news.ycombinator.com/x",
    );
    expect(gefunden).toEqual(["https://korben.info/en/gdid.html"]);
  });

  it("liefert jede Adresse nur einmal", () => {
    expect(verweise("https://a.example/x und nochmal https://a.example/x")).toHaveLength(1);
  });

  it("kommt mit Text ohne Adressen zurecht", () => {
    expect(verweise("Kein Verweis weit und breit")).toEqual([]);
    expect(verweise("")).toEqual([]);
  });

  it("übergeht unbrauchbare Adressen, statt daran zu scheitern", () => {
    expect(() => verweise("https://")).not.toThrow();
  });
});

describe("gemeinsameVerweise", () => {
  it("findet die Schnittmenge", () => {
    expect(gemeinsameVerweise(["https://a.example/1"], ["https://a.example/1"]))
      .toEqual(["https://a.example/1"]);
  });

  it("unterscheidet verschiedene Seiten desselben Rechners", () => {
    expect(gemeinsameVerweise(["https://a.example/1"], ["https://a.example/2"])).toEqual([]);
  });
});
