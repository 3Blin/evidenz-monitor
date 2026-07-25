/**
 * Prüft beide Kern-Adapter aus ADR 0002: RSS/Atom und Web-Abruf.
 *
 * Die Abrufe laufen gegen einen kleinen Server im Testprozess. Damit wird der
 * echte Weg geprüft - Netzaufruf, Fehlerbehandlung, Inhaltstypen - ohne von
 * fremden Seiten im Internet abhängig zu sein.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { rssAdapter } from "../src/lib/quellen/rss";
import { webAdapter, extrahiereAusHtml, entitaetenAufloesen, MAX_BYTES } from "../src/lib/quellen/web";

let server: Server;
let basis = "";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Testfeed</title>
  <item>
    <title>Treiberproblem nach Update</title>
    <link>https://test.example/eins</link>
    <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Redaktion</dc:creator>
    <pubDate>Tue, 21 Jul 2026 08:00:00 GMT</pubDate>
    <description>Nach dem Update treten Abst&#252;rze auf.</description>
  </item>
  <item>
    <title>Zweite Meldung</title>
    <link>https://test.example/zwei</link>
    <description>Kurzer Hinweis.</description>
  </item>
  <item>
    <title>Ohne Verweis, wird verworfen</title>
    <description>Kein link-Element.</description>
  </item>
</channel></rss>`;

const SEITE = `<!doctype html>
<html><head>
  <title>Titel aus title-Marke</title>
  <meta property="og:title" content="Offizieller Hinweis zu KB5000000">
  <meta name="author" content="Herstellerredaktion">
  <meta property="article:published_time" content="2026-07-20T10:30:00Z">
  <style>.rot{color:red}</style>
  <script>window.boesartig = "darf nicht im Auszug landen";</script>
</head>
<body>
  <h1>&Uuml;berschrift</h1>
  <p>Betroffen sind Ger&auml;te mit Treiber X &amp; Y.</p>
  <noscript>Bitte Skripte aktivieren</noscript>
  <p>Ein Neustart behebt das Problem&#46;</p>
</body></html>`;

beforeAll(async () => {
  server = createServer((anfrage, antwort) => {
    const pfad = anfrage.url ?? "/";
    if (pfad === "/feed.xml") {
      antwort.writeHead(200, { "content-type": "application/rss+xml" });
      antwort.end(FEED);
    } else if (pfad === "/seite.html") {
      antwort.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "last-modified": "Mon, 13 Jul 2026 12:00:00 GMT",
      });
      antwort.end(SEITE);
    } else if (pfad === "/ohne-metadaten.html") {
      antwort.writeHead(200, {
        "content-type": "text/html",
        "last-modified": "Mon, 13 Jul 2026 12:00:00 GMT",
      });
      antwort.end("<html><body><p>Nur Fließtext, kein Titel.</p></body></html>");
    } else if (pfad === "/kaputt") {
      antwort.writeHead(503, { "content-type": "text/html" });
      antwort.end("Dienst nicht verfügbar");
    } else if (pfad === "/binaer") {
      antwort.writeHead(200, { "content-type": "application/pdf" });
      antwort.end("%PDF-1.7");
    } else if (pfad === "/gross") {
      antwort.writeHead(200, { "content-type": "text/html" });
      antwort.end(`<html><body><p>${"Sehr viel Text. ".repeat(250_000)}</p></body></html>`);
    } else {
      antwort.writeHead(404, { "content-type": "text/html" });
      antwort.end("nicht gefunden");
    }
  });
  await new Promise<void>((fertig) => server.listen(0, "127.0.0.1", fertig));
  const adresse = server.address();
  if (!adresse || typeof adresse === "string") throw new Error("Testserver ohne Port");
  basis = `http://127.0.0.1:${adresse.port}`;
});

afterAll(async () => {
  await new Promise<void>((fertig) => server.close(() => fertig()));
});

describe("RSS-Adapter", () => {
  it("liest Titel, Verweis, Autor, Datum und Auszug aus einem Feed", async () => {
    const inhalte = await rssAdapter.abrufen(`${basis}/feed.xml`);
    const erster = inhalte[0]!;
    expect(erster.titel).toBe("Treiberproblem nach Update");
    expect(erster.url).toBe("https://test.example/eins");
    expect(erster.autor).toBe("Redaktion");
    expect(erster.veroeffentlichtAm?.toISOString()).toBe("2026-07-21T08:00:00.000Z");
    expect(erster.auszug).toContain("Abstürze");
  });

  it("verwirft Einträge ohne Verweis oder Titel", async () => {
    const inhalte = await rssAdapter.abrufen(`${basis}/feed.xml`);
    expect(inhalte).toHaveLength(2);
    expect(inhalte.some((i) => i.titel.includes("verworfen"))).toBe(false);
  });

  it("lässt fehlende Angaben leer, statt sie zu erfinden", async () => {
    const inhalte = await rssAdapter.abrufen(`${basis}/feed.xml`);
    const zweiter = inhalte[1]!;
    expect(zweiter.autor).toBeNull();
    expect(zweiter.veroeffentlichtAm).toBeNull();
  });

  it("meldet einen fehlerhaften Abruf, statt ihn zu verschlucken (Fehlerfall)", async () => {
    await expect(rssAdapter.abrufen(`${basis}/kaputt`)).rejects.toThrow();
  });
});

describe("Web-Adapter", () => {
  it("liefert genau einen Beitrag je Seite", async () => {
    const inhalte = await webAdapter.abrufen(`${basis}/seite.html`);
    expect(inhalte).toHaveLength(1);
  });

  it("bevorzugt den og:title vor der title-Marke", async () => {
    const [seite] = await webAdapter.abrufen(`${basis}/seite.html`);
    expect(seite!.titel).toBe("Offizieller Hinweis zu KB5000000");
  });

  it("übernimmt Autor und Veröffentlichungsdatum aus den Metadaten", async () => {
    const [seite] = await webAdapter.abrufen(`${basis}/seite.html`);
    expect(seite!.autor).toBe("Herstellerredaktion");
    expect(seite!.veroeffentlichtAm?.toISOString()).toBe("2026-07-20T10:30:00.000Z");
  });

  it("nimmt das Datum aus dem Kopf der Antwort, wenn die Seite keins nennt", async () => {
    const [seite] = await webAdapter.abrufen(`${basis}/ohne-metadaten.html`);
    expect(seite!.veroeffentlichtAm?.toISOString()).toBe("2026-07-13T12:00:00.000Z");
  });

  it("nimmt niemals Skript- oder Stilinhalte in den Auszug auf", async () => {
    const [seite] = await webAdapter.abrufen(`${basis}/seite.html`);
    expect(seite!.auszug).not.toContain("boesartig");
    expect(seite!.auszug).not.toContain("color:red");
    expect(seite!.auszug).not.toContain("Skripte aktivieren");
    expect(seite!.auszug).toContain("Treiber X & Y");
  });

  it("meldet einen Fehlerstatus mit Nummer weiter (Fehlerfall)", async () => {
    await expect(webAdapter.abrufen(`${basis}/kaputt`)).rejects.toThrow(/Status code 503/);
  });

  it("verweigert Antworten, die kein Text sind (Fehlerfall)", async () => {
    await expect(webAdapter.abrufen(`${basis}/binaer`)).rejects.toThrow(/Inhaltstyp/);
  });

  it("verweigert Adressen, die nicht über das Netz abrufbar sind (Fehlerfall)", async () => {
    await expect(webAdapter.abrufen("file:///etc/passwd")).rejects.toThrow(/Protokoll/);
  });

  it("liest überlange Seiten nur bis zur Obergrenze", async () => {
    const [seite] = await webAdapter.abrufen(`${basis}/gross`);
    expect(seite!.auszug.length).toBeLessThan(1300);
    expect(MAX_BYTES).toBeLessThan(10_000_000);
  });
});

describe("HTML-Auswertung (ohne Netzzugriff)", () => {
  it("löst benannte und numerische Ersatzschreibweisen auf", () => {
    expect(entitaetenAufloesen("A &amp; B &#66; &#x43; &quot;x&quot;")).toBe('A & B B C "x"');
  });

  it("lässt unbekannte Ersatzschreibweisen unverändert stehen", () => {
    expect(entitaetenAufloesen("&sowasgibtsnicht;")).toBe("&sowasgibtsnicht;");
  });

  it("nimmt die Adresse als Titel, wenn die Seite keinen nennt", () => {
    const roh = extrahiereAusHtml("<html><body>Text</body></html>", "https://test.example/x");
    expect(roh.titel).toBe("https://test.example/x");
    expect(roh.auszug).toBe("Text");
  });

  it("verwirft ein unlesbares Datum, statt zu raten", () => {
    const roh = extrahiereAusHtml(
      `<html><head><meta name="date" content="irgendwann"></head><body>Text</body></html>`,
      "https://test.example/x",
    );
    expect(roh.veroeffentlichtAm).toBeNull();
  });

  it("kürzt sehr lange Titel", () => {
    const roh = extrahiereAusHtml(
      `<html><head><title>${"T".repeat(500)}</title></head><body>Text</body></html>`,
      "https://test.example/x",
    );
    expect(roh.titel.length).toBeLessThanOrEqual(310);
    expect(roh.titel.endsWith("[…]")).toBe(true);
  });

  it("nimmt den Titel nicht zusätzlich in den Auszug auf", () => {
    const roh = extrahiereAusHtml(
      "<html><head><title>Kopfzeile</title></head><body><p>Nur der Fließtext</p></body></html>",
      "https://test.example/x",
    );
    expect(roh.titel).toBe("Kopfzeile");
    expect(roh.auszug).toBe("Nur der Fließtext");
  });
});
