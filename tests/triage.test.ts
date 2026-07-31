/**
 * Prüft die Triage der Fragestellung.
 *
 * Der wichtigste Fall steht unten: eine frische Behauptung über einen
 * zurückliegenden Gegenstand. Beide Merkmalsarten sprechen an, und die
 * naheliegende Lösung - eine gewinnt - würde die halbe Frage wegwerfen.
 */
import { describe, it, expect } from "vitest";
import {
  triage,
  zurueckliegendeJahre,
  taktVorschlagGueltig,
  BETRIEBSART_TEXT,
  HISTORISCH_AB_JAHREN,
} from "../src/lib/triage";
import { GROESSTER_TAKT_MINUTEN, KLEINSTER_TAKT_MINUTEN } from "../src/lib/taktung";

const HEUTE = new Date("2026-07-31T00:00:00Z");

describe("Frische Behauptung", () => {
  it("erkennt die Wendungen, mit denen ein Gerücht anfängt", () => {
    const fragen = [
      "Ich habe eben gehört, dass der Verkehrsminister zurücktritt",
      "Stimmt es, dass die Förderung gestrichen wird?",
      "Angeblich soll das Werk geschlossen werden",
      "Vorhin gelesen: die Preise steigen erneut",
      "Seit heute kursiert die Meldung über einen Rückruf",
    ];
    for (const frage of fragen) {
      expect(triage(frage, "", HEUTE).betriebsart, frage).toBe("akut");
    }
  });

  it("taktet eng und blickt kurz zurück", () => {
    const befund = triage("Ich habe eben gehört, dass es einen Rückruf gibt", "", HEUTE);
    expect(befund.taktMinMinuten).toBe(15);
    expect(befund.taktMaxMinuten).toBe(240);
    expect(befund.zeitfensterTage).toBe(14);
  });

  it("nennt im Klartext, welches Merkmal angesprochen hat", () => {
    // Ein Vorschlag, den man nicht nachvollziehen kann, ist nicht prüfbar -
    // und wer ihn nicht prüfen kann, kann ihn auch nicht guten Gewissens
    // übernehmen.
    const befund = triage("Ich habe eben gehört, dass …", "", HEUTE);
    expect(befund.begruendung).toContain("eben gehört");
    expect(befund.merkmale).toContain("eben gehört");
  });
});

describe("Rückblickende Frage", () => {
  it("erkennt zurückblickende Wendungen", () => {
    const fragen = [
      "Wurde damals wirklich vor den Folgen gewarnt?",
      "Seit wann ist das bekannt?",
      "Wer war der Erste, der das behauptet hat?",
      "Was war die ursprüngliche Begründung?",
    ];
    for (const frage of fragen) {
      expect(triage(frage, "", HEUTE).betriebsart, frage).toBe("historisch");
    }
  });

  it("taktet weit und blickt weit zurück", () => {
    const befund = triage("Wurde damals wirklich gewarnt?", "", HEUTE);
    expect(befund.taktMinMinuten).toBe(1440);
    expect(befund.taktMaxMinuten).toBe(GROESSTER_TAKT_MINUTEN);
    expect(befund.zeitfensterTage).toBe(3650);
  });
});

describe("Jahreszahlen", () => {
  it("zählt nur mit Begleitwort", () => {
    expect(zurueckliegendeJahre("seit 1998 gilt die Regel", HEUTE)).toEqual([1998]);
    expect(zurueckliegendeJahre("im Jahre 1815 wurde entschieden", HEUTE)).toEqual([1815]);
    expect(zurueckliegendeJahre("in den 1970ern", HEUTE)).toEqual([1970]);
  });

  it("hält eine nackte Vierstellige NICHT für ein Jahr", () => {
    // Manche Produktfassungen heißen wie Jahreszahlen. Ohne diese Regel
    // landete jeder Auftrag über eine solche Fassung im Rückblick.
    expect(zurueckliegendeJahre("Fehler in Fassung 1809 nach dem Update", HEUTE)).toEqual([]);
    expect(zurueckliegendeJahre("Kennung 1903 betroffen", HEUTE)).toEqual([]);
    expect(triage("Fehler in Fassung 1809 nach dem Update", "", HEUTE).betriebsart).toBe("laufend");
  });

  it("übergeht Jahre, die noch nicht weit genug zurückliegen", () => {
    const knappVorbei = HEUTE.getUTCFullYear() - HISTORISCH_AB_JAHREN + 1;
    expect(zurueckliegendeJahre(`seit ${knappVorbei} läuft das`, HEUTE)).toEqual([]);
    const geradeSo = HEUTE.getUTCFullYear() - HISTORISCH_AB_JAHREN;
    expect(zurueckliegendeJahre(`seit ${geradeSo} läuft das`, HEUTE)).toEqual([geradeSo]);
  });

  it("findet mehrere Jahre und wiederholt sie nicht", () => {
    expect(zurueckliegendeJahre("seit 1998 und im Jahre 1998 und in den 1970ern", HEUTE))
      .toEqual([1970, 1998]);
  });

  it("findet Treffer auch beim zweiten Aufruf noch am Textanfang", () => {
    // Ein g-Flag führt den Suchzeiger über Aufrufe hinweg mit. Ohne eigene
    // Kopie des Musters fände der zweite Aufruf den ersten Treffer nicht mehr.
    const text = "seit 1998 gilt das";
    expect(zurueckliegendeJahre(text, HEUTE)).toEqual([1998]);
    expect(zurueckliegendeJahre(text, HEUTE)).toEqual([1998]);
  });
});

describe("Frische Behauptung über einen alten Gegenstand", () => {
  const befund = triage(
    "Ich habe eben gehört, dass schon in den 1970ern davor gewarnt wurde",
    "",
    HEUTE,
  );

  it("bleibt akut, weil die Behauptung frisch ist", () => {
    expect(befund.betriebsart).toBe("akut");
    expect(befund.taktMinMinuten).toBe(15);
  });

  it("blickt trotzdem weit zurück, weil der Gegenstand alt ist", () => {
    // Der Kern: Ein enger Takt beobachtet die Behauptung, ein weiter
    // Rückblick findet, was es dazu schon gab. Sich für eines zu entscheiden,
    // hieße die halbe Frage wegzuwerfen.
    expect(befund.zeitfensterTage).toBe(3650);
  });

  it("sagt beides in der Begründung", () => {
    expect(befund.begruendung).toContain("eben gehört");
    expect(befund.begruendung).toContain("1970");
  });
});

describe("Vorgabe und Grenzen", () => {
  it("nimmt ohne Merkmale die laufende Beobachtung", () => {
    const befund = triage("Wie entwickelt sich die Lage im Verkehrssektor?", "", HEUTE);
    expect(befund.betriebsart).toBe("laufend");
    expect(befund.merkmale).toEqual([]);
    expect(befund.taktMinMinuten).toBe(60);
    expect(befund.taktMaxMinuten).toBe(1440);
  });

  it("verträgt eine leere Eingabe", () => {
    expect(triage("", "", HEUTE).betriebsart).toBe("laufend");
  });

  it("liest auch die Beobachtungsbeschreibung mit", () => {
    const befund = triage("Rückrufe im Fuhrpark", "Stimmt es, dass es eine Warnung gab?", HEUTE);
    expect(befund.betriebsart).toBe("akut");
  });

  it("hält jeder Vorschlag die harten Taktgrenzen ein", () => {
    for (const frage of [
      "Ich habe eben gehört, dass …",
      "Wurde damals gewarnt?",
      "Wie entwickelt sich das?",
    ]) {
      const befund = triage(frage, "", HEUTE);
      expect(taktVorschlagGueltig(befund), frage).toBe(true);
      expect(befund.taktMinMinuten).toBeGreaterThanOrEqual(KLEINSTER_TAKT_MINUTEN);
      expect(BETRIEBSART_TEXT[befund.betriebsart]).toBeTruthy();
    }
  });

  it("gibt zu jeder Betriebsart einen Hinweis, was sie bedeutet", () => {
    for (const frage of ["eben gehört", "damals", "irgendwas"]) {
      expect(triage(frage, "", HEUTE).hinweis.length).toBeGreaterThan(40);
    }
  });
});

describe("Gleichlauf mit der Zusammenführung", () => {
  it("nimmt bei laufender Beobachtung genau das Vorgabefenster", async () => {
    // triage.ts wiederholt diesen Wert, statt ihn zu importieren - sonst zöge
    // die Oberfläche die gesamte Zusammenführungslogik ins Auslieferpaket.
    // Dieser Test ist der Preis dafür und hält beide Stellen zusammen.
    const { ZEITFENSTER_TAGE } = await import("../src/lib/vorklassifikation");
    expect(triage("Wie entwickelt sich das?", "", HEUTE).zeitfensterTage).toBe(ZEITFENSTER_TAGE);
  });
});
