import { describe, it, expect } from "vitest";
import { ladeKonfiguration } from "../src/lib/config";
import { verschluessle, entschluessle } from "../src/lib/krypto";
import { randomBytes } from "node:crypto";

const testKey = randomBytes(32).toString("base64");

describe("Konfigurationsprüfung", () => {
  it("akzeptiert vollständige Konfiguration", () => {
    const c = ladeKonfiguration({
      DATABASE_URL: "postgres://x",
      BYOK_ENCRYPTION_KEY: testKey,
      LOG_LEVEL: "info",
    } as unknown as NodeJS.ProcessEnv);
    expect(c.LOG_LEVEL).toBe("info");
  });

  it("bricht mit klarer Meldung ab, wenn DATABASE_URL fehlt (Fehlerfall)", () => {
    expect(() =>
      ladeKonfiguration({ BYOK_ENCRYPTION_KEY: testKey } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/DATABASE_URL/);
  });

  it("setzt LOG_LEVEL auf info, wenn nicht angegeben", () => {
    const c = ladeKonfiguration({
      DATABASE_URL: "postgres://x",
      BYOK_ENCRYPTION_KEY: testKey,
    } as unknown as NodeJS.ProcessEnv);
    expect(c.LOG_LEVEL).toBe("info");
  });
});

describe("BYOK-Schlüsselverschlüsselung", () => {
  it("verschlüsselt und entschlüsselt verlustfrei", () => {
    const geheim = "sk-ant-test-1234567890";
    const gespeichert = verschluessle(geheim, testKey);
    expect(gespeichert).not.toContain(geheim);
    expect(entschluessle(gespeichert, testKey)).toBe(geheim);
  });

  it("erzeugt bei gleichem Klartext unterschiedliche Chiffren (eigener IV)", () => {
    expect(verschluessle("abc", testKey)).not.toBe(verschluessle("abc", testKey));
  });

  it("scheitert bei manipulierten Daten (Fehlerfall, kein stilles Durchwinken)", () => {
    const gespeichert = verschluessle("abc", testKey);
    const teile = gespeichert.split(".");
    const manipuliert = `${teile[0]}.${teile[1]}.${Buffer.from("boese").toString("base64")}`;
    expect(() => entschluessle(manipuliert, testKey)).toThrow();
  });

  it("lehnt zu kurzen Schlüssel ab (Fehlerfall)", () => {
    expect(() => verschluessle("abc", Buffer.from("kurz").toString("base64"))).toThrow(
      /32 Bytes/,
    );
  });

  it("lehnt falsches Speicherformat ab (Fehlerfall)", () => {
    expect(() => entschluessle("kaputt", testKey)).toThrow(/ungültiges Format/);
  });
});
