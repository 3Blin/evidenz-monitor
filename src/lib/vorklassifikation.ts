/**
 * Deterministische Vorklassifikation.
 *
 * Zweck: Auch ohne hinterlegten KI-Schlüssel liefert das System eine
 * nachvollziehbare Grundeinordnung. Sie beruht ausschließlich auf Fakten,
 * die ohne Sprachverständnis feststellbar sind: Quellentyp, Zeitpunkt und
 * Titelähnlichkeit. Die KI-Analyse verfeinert diese Einordnung später und
 * darf sie überschreiben - der Reifegrad selbst bleibt regelbasiert.
 */
import type { Beziehung, Klassifikation } from "./reifegrad";
import { titelAehnlichkeit, AEHNLICHKEITS_SCHWELLE } from "./dedup";

export interface VorInhalt {
  readonly inhaltId: string;
  readonly titel: string;
  readonly quellentyp: string;
  readonly herausgeber: string;
  readonly veroeffentlichtAm: Date | null;
}

export interface Vorbefund {
  readonly inhaltId: string;
  readonly beziehung: Beziehung;
  readonly klassifikation: Klassifikation;
  readonly begruendung: string;
}

const OFFIZIELL = new Set(["hersteller_offiziell", "status_seite"]);

/**
 * Ordnet eine Gruppe inhaltsgleicher Beiträge ein.
 * Der früheste Beitrag gilt als Primärmeldung; spätere Beiträge mit hoher
 * Titelähnlichkeit gelten als Übernahme, abweichende als unabhängige
 * Bestätigung.
 */
export function klassifiziereGruppe(gruppe: readonly VorInhalt[]): readonly Vorbefund[] {
  if (gruppe.length === 0) return [];
  const sortiert = [...gruppe].sort(
    (a, b) => (a.veroeffentlichtAm?.getTime() ?? 0) - (b.veroeffentlichtAm?.getTime() ?? 0),
  );
  const primaer = sortiert[0];
  if (!primaer) return [];

  return sortiert.map((inhalt, index) => {
    const klassifikation: Klassifikation = OFFIZIELL.has(inhalt.quellentyp)
      ? "offizielle_bestaetigung"
      : "stuetzt";
    if (index === 0) {
      return {
        inhaltId: inhalt.inhaltId,
        beziehung: "primaer",
        klassifikation,
        begruendung: "Früheste Veröffentlichung dieser Meldung",
      };
    }
    const aehnlich = titelAehnlichkeit(primaer.titel, inhalt.titel);
    const gleicherHerausgeber =
      primaer.herausgeber.toLowerCase() === inhalt.herausgeber.toLowerCase();
    if (aehnlich >= 0.8 || gleicherHerausgeber) {
      return {
        inhaltId: inhalt.inhaltId,
        beziehung: "uebernahme",
        klassifikation,
        begruendung: gleicherHerausgeber
          ? "Selber Herausgeber wie die Primärmeldung"
          : `Titel nahezu identisch zur Primärmeldung (Ähnlichkeit ${aehnlich.toFixed(2)})`,
      };
    }
    return {
      inhaltId: inhalt.inhaltId,
      beziehung: "unabhaengige_bestaetigung",
      klassifikation,
      begruendung: `Eigenständige Meldung eines anderen Herausgebers (Ähnlichkeit ${aehnlich.toFixed(2)})`,
    };
  });
}

/** Gruppiert Beiträge nach Titelähnlichkeit (Vorstufe zur KI-Prüfung). */
export function gruppiere(inhalte: readonly VorInhalt[]): readonly (readonly VorInhalt[])[] {
  const gruppen: VorInhalt[][] = [];
  for (const inhalt of inhalte) {
    const treffer = gruppen.find(
      (g) => g[0] && titelAehnlichkeit(g[0].titel, inhalt.titel) >= AEHNLICHKEITS_SCHWELLE,
    );
    if (treffer) treffer.push(inhalt);
    else gruppen.push([inhalt]);
  }
  return gruppen;
}
