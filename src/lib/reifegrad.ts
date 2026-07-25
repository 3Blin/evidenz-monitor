/**
 * Reifegrad-Regelwerk (deterministisch, ohne Netz- und KI-Zugriff).
 *
 * Zweck: Aus den gespeicherten Belegen und deren Klassifikationen wird die
 * Reifegrad-Stufe 1-8 nach festen Regeln berechnet - reproduzierbar und
 * begründet. Die KI liefert nur die Klassifikationen, vergibt niemals die
 * Stufe selbst (Vertrag: ARCHITEKTUR.md).
 */

export const REGEL_VERSION = "1.0.0";

/** Beziehung eines Inhalts innerhalb seiner Meldungsgruppe (Dedup-Ergebnis). */
export type Beziehung =
  | "primaer"
  | "uebernahme"
  | "zusammenfassung"
  | "zitat"
  | "unabhaengige_bestaetigung"
  | "verdaechtig_automatisiert";

/** Art des Belegs, den ein Inhalt für eine Aussage darstellt. */
export type Klassifikation =
  | "stuetzt"
  | "widerspricht"
  | "offizielle_bestaetigung"
  | "offizielle_widerlegung"
  | "workaround"
  | "korrektur";

export interface Beleg {
  readonly inhaltId: string;
  readonly herausgeber: string;
  readonly quellentyp: string;
  readonly beziehung: Beziehung;
  readonly klassifikation: Klassifikation;
  /** Technisch nachvollziehbar (Logs, Builds, Reproduktionsschritte genannt). */
  readonly technischNachvollziehbar: boolean;
  readonly erfasstAm: Date;
}

export const STUFEN = {
  EINZELHINWEIS: 1,
  MEHRFACH_BEOBACHTET: 2,
  TREND: 3,
  TECHNISCH_PLAUSIBEL: 4,
  UNABHAENGIG_BESTAETIGT: 5,
  OFFIZIELL_BESTAETIGT: 6,
  BEHOBEN: 7,
  WIDERLEGT: 8,
} as const;

export type Stufe = (typeof STUFEN)[keyof typeof STUFEN];

export interface Bewertung {
  readonly stufe: Stufe;
  readonly ausloeser: string;
  readonly regelVersion: string;
  readonly unabhaengigeQuellen: number;
  readonly widersprueche: number;
}

/**
 * Zählt unabhängige Quellen. Übernahmen, Zitate und Zusammenfassungen zählen
 * NICHT (Anforderung 4.3), ebenso wenig mehrere Belege desselben Herausgebers.
 */
export function zaehleUnabhaengigeQuellen(belege: readonly Beleg[]): number {
  const unabhaengig = belege.filter(
    (b) =>
      (b.beziehung === "primaer" || b.beziehung === "unabhaengige_bestaetigung") &&
      b.klassifikation !== "widerspricht" &&
      b.klassifikation !== "offizielle_widerlegung",
  );
  return new Set(unabhaengig.map((b) => b.herausgeber.toLowerCase())).size;
}

/**
 * Ermittelt die Reifegrad-Stufe. Höhere Stufen haben Vorrang; die Reihenfolge
 * der Prüfungen ist die Regelkaskade und wird im Auslöser dokumentiert.
 */
export function ermittleReifegrad(belege: readonly Beleg[]): Bewertung {
  const unabhaengigeQuellen = zaehleUnabhaengigeQuellen(belege);
  const widersprueche = belege.filter(
    (b) => b.klassifikation === "widerspricht" || b.klassifikation === "offizielle_widerlegung",
  ).length;

  const basis = { regelVersion: REGEL_VERSION, unabhaengigeQuellen, widersprueche };

  if (belege.length === 0) {
    return { ...basis, stufe: STUFEN.EINZELHINWEIS, ausloeser: "Keine Belege erfasst" };
  }
  if (belege.some((b) => b.klassifikation === "offizielle_widerlegung")) {
    return { ...basis, stufe: STUFEN.WIDERLEGT, ausloeser: "Offizielle Widerlegung liegt vor" };
  }
  if (belege.some((b) => b.klassifikation === "korrektur")) {
    return { ...basis, stufe: STUFEN.BEHOBEN, ausloeser: "Korrektur/Behebung veröffentlicht" };
  }
  if (belege.some((b) => b.klassifikation === "offizielle_bestaetigung")) {
    return {
      ...basis,
      stufe: STUFEN.OFFIZIELL_BESTAETIGT,
      ausloeser: "Bestätigung durch offizielle Primärquelle",
    };
  }
  if (unabhaengigeQuellen >= 3) {
    return {
      ...basis,
      stufe: STUFEN.UNABHAENGIG_BESTAETIGT,
      ausloeser: `${unabhaengigeQuellen} unabhängige Quellen bestätigen den Sachverhalt`,
    };
  }
  if (belege.some((b) => b.technischNachvollziehbar) && unabhaengigeQuellen >= 2) {
    return {
      ...basis,
      stufe: STUFEN.TECHNISCH_PLAUSIBEL,
      ausloeser: "Technisch nachvollziehbar belegt (Logs/Reproduktion) bei mehreren Quellen",
    };
  }
  if (unabhaengigeQuellen >= 2) {
    return {
      ...basis,
      stufe: STUFEN.TREND,
      ausloeser: `${unabhaengigeQuellen} unabhängige Quellen weisen auf ein Muster hin`,
    };
  }
  if (belege.length >= 2) {
    return {
      ...basis,
      stufe: STUFEN.MEHRFACH_BEOBACHTET,
      ausloeser: `${belege.length} Meldungen, aber nur ${unabhaengigeQuellen} unabhängige Quelle(n)`,
    };
  }
  return {
    ...basis,
    stufe: STUFEN.EINZELHINWEIS,
    ausloeser: "Einzelne, noch nicht verifizierte Meldung",
  };
}

/** Klartext-Bezeichnung einer Stufe (für Oberfläche und Doku). */
export function stufenName(stufe: Stufe): string {
  const namen: Record<Stufe, string> = {
    1: "Unbestätigter Einzelhinweis",
    2: "Mehrfach beobachtet",
    3: "Erkennbarer Trend",
    4: "Technisch plausibel",
    5: "Unabhängig bestätigt",
    6: "Offiziell bestätigt",
    7: "Behoben oder abgeschlossen",
    8: "Widerlegt",
  };
  return namen[stufe];
}
