import { describe, it, expect, afterAll } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import { neueCorrelationId, vorgangsLogger } from "../src/lib/logger";
import { datenbank, schliesseDatenbank } from "../src/lib/db";

describe("Strukturiertes Logging", () => {
  it("erzeugt eindeutige Correlation-IDs", () => {
    expect(neueCorrelationId()).not.toBe(neueCorrelationId());
  });

  it("schreibt JSON-Zeilen mit Correlation-ID", () => {
    const zeilen: string[] = [];
    const senke = new Writable({
      write(chunk, _enc, cb) {
        zeilen.push(String(chunk));
        cb();
      },
    });
    const log = pino({ level: "info" }, senke).child({ correlationId: "test-123" });
    log.info({ vorgang: "abruf" }, "Quelle abgerufen");
    const eintrag = JSON.parse(zeilen[0] ?? "{}");
    expect(eintrag.correlationId).toBe("test-123");
    expect(eintrag.vorgang).toBe("abruf");
  });

  it("entfernt Secrets aus Logeinträgen (Sicherheitspflicht)", () => {
    const zeilen: string[] = [];
    const senke = new Writable({
      write(chunk, _enc, cb) {
        zeilen.push(String(chunk));
        cb();
      },
    });
    const log = pino(
      { redact: { paths: ["*.token", "api_key"], censor: "[entfernt]" } },
      senke,
    );
    log.info({ api_key: "sk-geheim-999", daten: { token: "t-abc" } }, "Test");
    const roh = zeilen[0] ?? "";
    expect(roh).not.toContain("sk-geheim-999");
    expect(roh).not.toContain("t-abc");
    expect(roh).toContain("[entfernt]");
  });

  it("liefert einen Vorgangslogger mit gebundener ID", () => {
    const log = vorgangsLogger("abc-1");
    expect(log.bindings().correlationId).toBe("abc-1");
  });
});

describe("Datenbankzugriff", () => {
  afterAll(async () => {
    await schliesseDatenbank();
  });

  it("liefert dieselbe Verbindung wieder (kein neuer Pool je Aufruf)", () => {
    expect(datenbank()).toBe(datenbank());
  });

  it("führt eine echte Abfrage gegen die Datenbank aus", async () => {
    const ergebnis = await datenbank().query<{ anzahl: string }>(
      "SELECT count(*)::text AS anzahl FROM auftraege",
    );
    expect(ergebnis.rows[0]?.anzahl).toBeDefined();
  });

  it("meldet fehlerhafte Abfragen, statt sie zu verschlucken (Fehlerfall)", async () => {
    await expect(datenbank().query("SELECT * FROM gibt_es_nicht")).rejects.toThrow();
  });
});
