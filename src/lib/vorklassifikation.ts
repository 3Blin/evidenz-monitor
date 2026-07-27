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
import { gemeinsameKennungen, kennungen } from "./kennungen";

export interface VorInhalt {
  readonly inhaltId: string;
  readonly titel: string;
  readonly quellentyp: string;
  readonly herausgeber: string;
  readonly veroeffentlichtAm: Date | null;
  /** Auszug, sofern vorhanden - Kennungen stehen oft erst im Text. */
  readonly auszug?: string;
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

/** Warum zwei Beiträge in derselben Gruppe gelandet sind. */
export interface Gruppenbefund {
  readonly inhalte: readonly VorInhalt[];
  readonly begruendung: string;
}

/**
 * Gruppiert Beiträge, die dieselbe Meldung behandeln.
 *
 * Zwei Wege führen in dieselbe Gruppe:
 *
 * 1. **Gemeinsame Kennung.** KB5094126 in zwei Beiträgen heißt: beide handeln
 *    von diesem Update. Das gilt auch dann, wenn die Titel sonst nichts
 *    gemeinsam haben - und genau das ist der häufige Fall zwischen zwei
 *    Herausgebern.
 * 2. **Ähnlicher Titel.** Der bisherige Weg, unverändert in seiner Schwelle.
 *
 * Geändert gegenüber der ersten Fassung ist außerdem, dass die *beste*
 * passende Gruppe gewählt wird und nicht die erste gefundene. Bei der ersten
 * Fassung entschied die Reihenfolge der Beiträge über das Ergebnis.
 *
 * Bewusst nicht gesenkt wurde die Ähnlichkeitsschwelle. Eine niedrigere
 * Schwelle bringt zwar mehr Verknüpfungen, aber falsche: Aus zwei
 * unabhängigen Meldungen würde eine "unabhängige Bestätigung", und der
 * Reifegrad stiege ohne Grund. Ein zu niedriger Reifegrad ist ein Mangel,
 * ein zu hoher ist eine Falschaussage.
 */
export function gruppiereMitBegruendung(
  inhalte: readonly VorInhalt[],
): readonly Gruppenbefund[] {
  interface Sammler {
    readonly inhalte: VorInhalt[];
    readonly kennungen: Set<string>;
    begruendung: string;
  }
  const gruppen: Sammler[] = [];

  for (const inhalt of inhalte) {
    const eigene = kennungen(inhalt.titel, inhalt.auszug ?? "");

    let beste: Sammler | null = null;
    let besterWert = 0;
    let besteBegruendung = "";

    for (const gruppe of gruppen) {
      const erster = gruppe.inhalte[0];
      if (!erster) continue;

      // Eine gemeinsame Kennung schlägt jede Titelähnlichkeit: Sie benennt
      // den Gegenstand, während der Titel ihn nur umschreibt.
      const geteilt = gemeinsameKennungen(eigene, [...gruppe.kennungen]);
      const ersteGeteilte = geteilt[0];
      if (ersteGeteilte !== undefined) {
        beste = gruppe;
        besterWert = Number.POSITIVE_INFINITY;
        besteBegruendung = `Gemeinsame Kennung ${geteilt.join(", ")}`;
        break;
      }

      const wert = titelAehnlichkeit(erster.titel, inhalt.titel);
      if (wert >= AEHNLICHKEITS_SCHWELLE && wert > besterWert) {
        beste = gruppe;
        besterWert = wert;
        besteBegruendung = `Titelähnlichkeit ${wert.toFixed(2)}`;
      }
    }

    if (beste) {
      beste.inhalte.push(inhalt);
      for (const k of eigene) beste.kennungen.add(k);
      // Die Begründung der Gruppe nennt den Grund der ersten Zusammenführung.
      if (beste.inhalte.length === 2) beste.begruendung = besteBegruendung;
    } else {
      gruppen.push({
        inhalte: [inhalt],
        kennungen: new Set(eigene),
        begruendung: "Einzelmeldung ohne Entsprechung",
      });
    }
  }

  return gruppen.map((g) => ({ inhalte: g.inhalte, begruendung: g.begruendung }));
}

/** Gruppiert Beiträge, die dieselbe Meldung behandeln (ohne Begründung). */
export function gruppiere(inhalte: readonly VorInhalt[]): readonly (readonly VorInhalt[])[] {
  return gruppiereMitBegruendung(inhalte).map((g) => g.inhalte);
}
