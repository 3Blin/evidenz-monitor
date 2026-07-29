/**
 * Prüft die Taktung der Sammelläufe.
 *
 * Anlass: `intervall_minuten` stand seit Migration 0001 im Schema und wurde
 * von keinem Lauf gelesen. Damit diese Einstellung nicht wieder zur Attrappe
 * wird, ist hier festgehalten, was sie leisten muss.
 */
import { describe, expect, it } from "vitest";
import {
  GROESSTER_TAKT_MINUTEN, KLEINSTER_TAKT_MINUTEN, istFaellig, naechsterLauf,
  naechsterTakt, pruefeBereich, taktInWorten,
} from "../src/lib/taktung";

const bereich = { minMinuten: 30, maxMinuten: 480 };

describe("naechsterTakt", () => {
  it("beginnt ohne Vorgeschichte an der Untergrenze", () => {
    // Ein neuer Auftrag soll zügig erste Ergebnisse zeigen.
    expect(naechsterTakt(bereich, null, false)).toBe(30);
  });

  it("beschleunigt, wenn ein Lauf neue Beiträge bringt", () => {
    expect(naechsterTakt(bereich, 240, true)).toBe(120);
  });

  it("bremst, wenn ein Lauf leer bleibt", () => {
    expect(naechsterTakt(bereich, 60, false)).toBe(120);
  });

  it("geht nie unter die Untergrenze", () => {
    expect(naechsterTakt(bereich, 30, true)).toBe(30);
    expect(naechsterTakt(bereich, 31, true)).toBe(30);
  });

  it("geht nie über die Obergrenze", () => {
    expect(naechsterTakt(bereich, 480, false)).toBe(480);
    expect(naechsterTakt(bereich, 400, false)).toBe(480);
  });

  it("erreicht die Obergrenze in wenigen Leerläufen", () => {
    let takt = naechsterTakt(bereich, null, false);
    const schritte = [takt];
    for (let i = 0; i < 6; i++) {
      takt = naechsterTakt(bereich, takt, false);
      schritte.push(takt);
    }
    expect(schritte).toEqual([30, 60, 120, 240, 480, 480, 480]);
  });

  it("kehrt bei Ertrag ebenso zügig zurück", () => {
    let takt = 480;
    const schritte = [takt];
    for (let i = 0; i < 4; i++) {
      takt = naechsterTakt(bereich, takt, true);
      schritte.push(takt);
    }
    expect(schritte).toEqual([480, 240, 120, 60, 30]);
  });

  it("bleibt bei gleicher Unter- und Obergrenze bei diesem Wert", () => {
    const fest = { minMinuten: 90, maxMinuten: 90 };
    expect(naechsterTakt(fest, 90, true)).toBe(90);
    expect(naechsterTakt(fest, 90, false)).toBe(90);
  });

  it("holt einen Takt außerhalb des Bereichs zurück", () => {
    // Etwa nachdem die Nutzerin die Grenzen enger gezogen hat.
    expect(naechsterTakt(bereich, 5000, false)).toBe(480);
    expect(naechsterTakt(bereich, 1, false)).toBe(60);
  });
});

describe("pruefeBereich", () => {
  it("übernimmt sinnvolle Werte unverändert", () => {
    expect(pruefeBereich(30, 480)).toEqual({ minMinuten: 30, maxMinuten: 480 });
  });

  it("tauscht vertauschte Grenzen, statt abzuweisen", () => {
    // Was gemeint war, ist offensichtlich; eine Fehlermeldung wäre Schikane.
    expect(pruefeBereich(480, 30)).toEqual({ minMinuten: 30, maxMinuten: 480 });
  });

  it("hält die harten Grenzen ein", () => {
    expect(pruefeBereich(1, 999_999)).toEqual({
      minMinuten: KLEINSTER_TAKT_MINUTEN,
      maxMinuten: GROESSTER_TAKT_MINUTEN,
    });
  });

  it("fängt unbrauchbare Eingaben ab", () => {
    expect(pruefeBereich(Number.NaN, Number.NaN)).toEqual({ minMinuten: 60, maxMinuten: 1440 });
  });

  it("rundet Kommazahlen", () => {
    expect(pruefeBereich(30.4, 60.6)).toEqual({ minMinuten: 30, maxMinuten: 61 });
  });
});

describe("istFaellig", () => {
  const jetzt = new Date("2026-07-28T12:00:00Z");

  it("hält einen Auftrag ohne Zeitpunkt für sofort fällig", () => {
    expect(istFaellig(null, jetzt)).toBe(true);
  });

  it("erkennt einen abgelaufenen Zeitpunkt", () => {
    expect(istFaellig(new Date("2026-07-28T11:59:00Z"), jetzt)).toBe(true);
  });

  it("wartet bei einem künftigen Zeitpunkt", () => {
    expect(istFaellig(new Date("2026-07-28T12:01:00Z"), jetzt)).toBe(false);
  });

  it("zählt den genauen Zeitpunkt als fällig", () => {
    expect(istFaellig(jetzt, jetzt)).toBe(true);
  });
});

describe("naechsterLauf", () => {
  it("addiert den Takt", () => {
    expect(naechsterLauf(new Date("2026-07-28T12:00:00Z"), 90).toISOString())
      .toBe("2026-07-28T13:30:00.000Z");
  });

  it("rückt auch bei unsinnigem Takt vorwärts", () => {
    const jetzt = new Date("2026-07-28T12:00:00Z");
    expect(naechsterLauf(jetzt, 0).getTime()).toBeGreaterThan(jetzt.getTime());
  });
});

describe("taktInWorten", () => {
  it("nennt Minuten, Stunden und Tage je nach Größe", () => {
    expect(taktInWorten(45)).toBe("45 Minuten");
    expect(taktInWorten(120)).toBe("2 Stunden");
    expect(taktInWorten(90)).toBe("1,5 Stunden");
    expect(taktInWorten(4320)).toBe("3 Tage");
  });
});
