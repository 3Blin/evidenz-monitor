/**
 * Dublettenerkennung. Zweck: Verhindert, dass dieselbe Meldung mehrfach als
 * unabhängige Bestätigung zählt (Anforderung 4.3). Exakte Dubletten werden
 * per Hash erkannt, ähnliche Titel über einen Vergleichswert vorgruppiert;
 * die inhaltliche Einordnung (Übernahme/Zitat/...) macht anschließend die KI.
 */
import { createHash } from "node:crypto";

/** Stabiler Hash über den normalisierten Inhalt - erkennt exakte Dubletten. */
export function inhaltHash(titel: string, auszug: string): string {
  const norm = `${titel}\n${auszug}`.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(norm, "utf8").digest("hex");
}

const FUELLWOERTER = new Set([
  "der","die","das","und","in","im","auf","für","von","mit","bei","zu","ein","eine",
  "the","a","an","of","for","on","in","to","and","is","are","with","after","update",
]);

/** Zerlegt einen Titel in bedeutungstragende Wörter (für Ähnlichkeitsvergleich). */
export function titelWorte(titel: string): readonly string[] {
  return titel
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FUELLWOERTER.has(w));
}

/**
 * Ähnlichkeit zweier Titel (Jaccard-Maß, 0 bis 1).
 * Zweck: Vorgruppierung, damit die KI nur plausible Kandidaten prüfen muss.
 */
export function titelAehnlichkeit(a: string, b: string): number {
  const mengeA = new Set(titelWorte(a));
  const mengeB = new Set(titelWorte(b));
  if (mengeA.size === 0 || mengeB.size === 0) return 0;
  let schnitt = 0;
  for (const w of mengeA) if (mengeB.has(w)) schnitt++;
  return schnitt / (mengeA.size + mengeB.size - schnitt);
}

export const AEHNLICHKEITS_SCHWELLE = 0.5;

export interface GruppenKandidat {
  readonly gruppeId: string;
  readonly kanonischerTitel: string;
}

/** Findet die am besten passende bestehende Gruppe, sonst null (= neue Gruppe). */
export function findeGruppe(
  titel: string,
  kandidaten: readonly GruppenKandidat[],
  schwelle: number = AEHNLICHKEITS_SCHWELLE,
): GruppenKandidat | null {
  let beste: GruppenKandidat | null = null;
  let bester = schwelle;
  for (const k of kandidaten) {
    const wert = titelAehnlichkeit(titel, k.kanonischerTitel);
    if (wert >= bester) {
      bester = wert;
      beste = k;
    }
  }
  return beste;
}
