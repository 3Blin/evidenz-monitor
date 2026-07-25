import { describe, it, expect } from "vitest";
import { inhaltHash, titelAehnlichkeit, findeGruppe, titelWorte } from "../src/lib/dedup";
import { auszugBilden } from "../src/lib/quellen/adapter";

describe("Inhalts-Hash", () => {
  it("erkennt identische Inhalte trotz unterschiedlicher Leerzeichen/Groß-Klein", () => {
    expect(inhaltHash("Titel  A", "Text   B")).toBe(inhaltHash("titel a", "text b"));
  });
  it("unterscheidet verschiedene Inhalte", () => {
    expect(inhaltHash("A", "X")).not.toBe(inhaltHash("A", "Y"));
  });
});

describe("Titelähnlichkeit", () => {
  it("erkennt inhaltsgleiche Meldungen verschiedener Medien", () => {
    const a = "Windows 11 25H2 verursacht WLAN-Abbrüche bei Intel-Adaptern";
    const b = "Intel-Adapter: WLAN-Abbrüche nach Windows 11 25H2 Update";
    expect(titelAehnlichkeit(a, b)).toBeGreaterThan(0.5);
  });
  it("trennt unterschiedliche Themen", () => {
    expect(
      titelAehnlichkeit("WLAN-Abbrüche bei Intel-Adaptern", "Neue Emojis in Windows 11"),
    ).toBeLessThan(0.3);
  });
  it("liefert 0 bei leerem Titel (Fehlerfall)", () => {
    expect(titelAehnlichkeit("", "Windows 11")).toBe(0);
  });
  it("entfernt Füllwörter", () => {
    expect(titelWorte("Das Update für die Geräte")).not.toContain("die");
  });
});

describe("Gruppenzuordnung", () => {
  const kandidaten = [
    { gruppeId: "g1", kanonischerTitel: "WLAN-Abbrüche bei Intel-Adaptern nach 25H2" },
    { gruppeId: "g2", kanonischerTitel: "Druckerprobleme nach Sicherheitsupdate" },
  ];
  it("ordnet eine Wiederveröffentlichung der bestehenden Gruppe zu", () => {
    const g = findeGruppe("Intel-Adapter: WLAN-Abbrüche nach 25H2 Update", kandidaten);
    expect(g?.gruppeId).toBe("g1");
  });
  it("liefert null für ein neues Thema (neue Gruppe nötig)", () => {
    expect(findeGruppe("Startmenü öffnet langsam", kandidaten)).toBeNull();
  });
  it("liefert null ohne Kandidaten (Fehlerfall)", () => {
    expect(findeGruppe("Irgendwas", [])).toBeNull();
  });
});

describe("Auszugsbildung (Urheberrecht)", () => {
  it("kürzt lange Texte und markiert die Kürzung", () => {
    const lang = "Wort ".repeat(500);
    const a = auszugBilden(lang, 100);
    expect(a.length).toBeLessThan(120);
    expect(a).toContain("[…]");
  });
  it("lässt kurze Texte unverändert", () => {
    expect(auszugBilden("Kurzer Text")).toBe("Kurzer Text");
  });
});
