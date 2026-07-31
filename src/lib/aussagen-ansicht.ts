/**
 * Rechenteil der Aussagenliste (ADR 0016).
 *
 * Als eigene Datei, weil hier drei Dinge stecken, die man prüfen können muss
 * und die in einer Bildschirmkomponente nicht prüfbar wären: welcher Beleg der
 * erste war, in welcher Reihenfolge die Aussagen stehen und wie breit die
 * Balken der Reifegrad-Leiter sind.
 */
import type { Beleg } from "./supabase-daten";

/**
 * Die Stufen, die eine Leiter bilden.
 *
 * Stufe 8 gehört ausdrücklich NICHT dazu: "Widerlegt" ist kein höherer Grad
 * als "Behoben", sondern ein anderer Ausgang. Acht gleich breite Balken
 * nebeneinander lesen sich aber unweigerlich als Steigerung - und dann sähe
 * eine widerlegte Meldung aus wie die bestbelegte von allen. Genau das darf
 * einem System, das Falschmeldungen erkennen soll, nicht passieren.
 */
export const LEITER_STUFEN = [1, 2, 3, 4, 5, 6, 7] as const;
export const STUFE_WIDERLEGT = 8;

export type Sortierung = "stufe" | "neueste" | "belege";

export const SORTIERUNG_TEXT: Record<Sortierung, string> = {
  stufe: "Belastbarkeit",
  neueste: "Neueste zuerst",
  belege: "Meiste Belege",
};

interface AussageAnsicht {
  readonly stufe: number;
  readonly seit: string | null;
  readonly belegAnzahl: number;
  readonly belege?: readonly Beleg[];
}

/** Zeitpunkt eines Belegs als Zahl; ohne Datum = unendlich spät. */
function zeitpunkt(wert: string | null): number {
  if (!wert) return Number.POSITIVE_INFINITY;
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime();
}

/**
 * Der früheste Beleg einer Aussage - die Antwort auf "wer war zuerst?".
 *
 * Das ist die Kernfrage dieses Systems, und sie stand bisher nur im
 * aufgeklappten Zustand und auch dort nur mittelbar. Belege ohne Datum können
 * nicht der erste sein: Sie *könnten* es sein, aber "könnte" ist keine
 * Erstmeldung, und eine geratene Erstmeldung wäre schlimmer als keine.
 */
export function fruehesterBeleg(belege: readonly Beleg[] | undefined): Beleg | null {
  if (!belege || belege.length === 0) return null;
  let bester: Beleg | null = null;
  let bestZeit = Number.POSITIVE_INFINITY;
  for (const b of belege) {
    const z = zeitpunkt(b.veroeffentlichtAm);
    if (z < bestZeit) {
      bestZeit = z;
      bester = b;
    }
  }
  return bestZeit === Number.POSITIVE_INFINITY ? null : bester;
}

/**
 * Sortiert die Aussagen. Immer eine feste Zweitordnung, damit die Liste bei
 * Gleichstand nicht bei jedem Laden anders aussieht.
 */
export function sortiere<T extends AussageAnsicht>(
  aussagen: readonly T[],
  art: Sortierung,
): readonly T[] {
  const kopie = [...aussagen];
  if (art === "neueste") {
    kopie.sort((a, b) => zeitFuerNeueste(b.seit) - zeitFuerNeueste(a.seit) || b.stufe - a.stufe);
  } else if (art === "belege") {
    kopie.sort((a, b) => b.belegAnzahl - a.belegAnzahl || b.stufe - a.stufe);
  } else {
    // Nach Belastbarkeit: die höchste Leiterstufe zuerst. Widerlegtes ans
    // Ende - es ist erledigt, nicht belastbar.
    kopie.sort((a, b) => rang(b.stufe) - rang(a.stufe) || b.belegAnzahl - a.belegAnzahl);
  }
  return kopie;
}

/** Ohne Datum ganz nach hinten, nicht nach vorn (0 wäre 1970). */
function zeitFuerNeueste(wert: string | null): number {
  const z = zeitpunkt(wert);
  return z === Number.POSITIVE_INFINITY ? Number.NEGATIVE_INFINITY : z;
}

/** Rang für die Sortierung nach Belastbarkeit. Widerlegtes zählt als 0. */
function rang(stufe: number): number {
  return stufe === STUFE_WIDERLEGT ? 0 : stufe;
}

export interface LeiterBalken {
  readonly stufe: number;
  readonly anzahl: number;
  /** Anteil an der Gesamtbreite in Prozent. */
  readonly anteil: number;
}

/**
 * Die Balken der Leiter, in der Breite nach Häufigkeit.
 *
 * Vorher waren alle acht gleich breit und die Farbe sagte nur "hier ist
 * überhaupt etwas". Damit beantwortete die Leiter nicht die Frage, für die man
 * hinsieht: Wo liegt das Gewicht? Bei 81 Aussagen auf Stufe 1 und 2 auf Stufe 5
 * ist das ein völlig anderes Bild als umgekehrt.
 *
 * Leere Stufen behalten einen schmalen Rest, damit sie anklickbar bleiben -
 * ein Filter, der verschwindet, sobald er nichts trifft, ist keiner.
 */
export function leiterBalken(
  aussagen: readonly AussageAnsicht[],
  stufen: readonly number[] = LEITER_STUFEN,
  mindestAnteil = 4,
): readonly LeiterBalken[] {
  const anzahlen = stufen.map(
    (s) => aussagen.filter((a) => a.stufe === s).length,
  );
  const gesamt = anzahlen.reduce((a, b) => a + b, 0);
  const rest = 100 - mindestAnteil * stufen.length;

  return stufen.map((stufe, i) => ({
    stufe,
    anzahl: anzahlen[i] ?? 0,
    anteil:
      gesamt === 0
        ? 100 / stufen.length
        : mindestAnteil + ((anzahlen[i] ?? 0) / gesamt) * rest,
  }));
}

/** Datum ohne Uhrzeit - die Stunde einer Meldung hilft beim Lesen nicht. */
export function datumInWorten(wert: string | null): string {
  if (!wert) return "ohne Datum";
  const d = new Date(wert);
  return Number.isNaN(d.getTime())
    ? "ohne Datum"
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Alter in Worten. Die Rückmeldung nannte ausdrücklich das fehlende Alter -
 * bei einer Frühwarnung ist es die wichtigste Angabe überhaupt.
 */
export function alterInWorten(wert: string | null, jetzt: number = Date.now()): string {
  if (!wert) return "";
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "";
  const tage = Math.floor((jetzt - d.getTime()) / 86_400_000);
  if (tage < 0) return "neu";
  if (tage === 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 31) return `vor ${tage} Tagen`;
  const monate = Math.floor(tage / 30);
  return monate < 12 ? `vor ${monate} Monaten` : "vor über einem Jahr";
}
