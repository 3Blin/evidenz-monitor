/**
 * Quellenvorschläge aus einer Recherchedatei lesen.
 *
 * Die Datei stammt von einem externen Sammler (ADR 0002/0013), etwa
 * `sammler/notebooklm/quellen_finden.py`. Sie ist damit **fremde Eingabe** und
 * wird wie solche behandelt: geprüft, begrenzt, und nichts davon wird
 * ungefragt angelegt.
 *
 * Warum ein eigenes Modul und nicht im Formular: Diese Prüfung entscheidet,
 * was in die Quellenliste eines Auftrags gelangen darf. Sie gehört an eine
 * Stelle, an der sie belegt werden kann (Modulgrenze 3).
 */
import { z } from "zod";
import { istFeedAdresse } from "./registrierung";

/** Mehr als das nimmt niemand von Hand durch. */
const HOECHSTZAHL = 50;

const eintragSchema = z.object({
  url: z.string().url(),
  titel: z.string().max(300).optional(),
  herausgeber: z.string().max(120).optional(),
});

const dateiSchema = z.object({
  frage: z.string().max(500).optional(),
  werkzeug: z.string().max(200).optional(),
  erzeugtAm: z.string().max(60).optional(),
  zusammenfassung: z.string().max(4000).optional(),
  quellen: z.array(eintragSchema).max(HOECHSTZAHL * 4),
});

export interface Quellenvorschlag {
  readonly url: string;
  readonly titel: string;
  readonly herausgeber: string;
  /** Feed oder Einzelseite - entschieden an der Adresse, wie im Sammellauf. */
  readonly istFeed: boolean;
}

export interface Vorschlagsdatei {
  readonly frage: string | null;
  readonly werkzeug: string | null;
  readonly quellen: readonly Quellenvorschlag[];
  /** Was beim Einlesen aussortiert wurde, im Klartext. */
  readonly hinweise: readonly string[];
}

/**
 * Liest eine Vorschlagsdatei.
 *
 * Wirft bei unbrauchbarem Aufbau; alles andere wird still bereinigt und im
 * Feld `hinweise` benannt. Eine Datei wegen eines einzigen krummen Eintrags
 * ganz abzulehnen wäre unfreundlich - aber stillschweigend zu schlucken, was
 * fehlte, wäre schlimmer.
 */
export function leseVorschlagsdatei(roh: string): Vorschlagsdatei {
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    throw new Error(
      "Das ist kein gültiges JSON. Erwartet wird der vollständige Inhalt der " +
        "Datei quellenvorschlaege.json.",
    );
  }

  const geprueft = dateiSchema.safeParse(daten);
  if (!geprueft.success) {
    throw new Error(
      `Die Datei hat nicht den erwarteten Aufbau: ${geprueft.error.issues
        .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
        .slice(0, 3)
        .join("; ")}`,
    );
  }

  const hinweise: string[] = [];
  const quellen: Quellenvorschlag[] = [];
  const gesehen = new Set<string>();
  let uebersprungen = 0;

  for (const eintrag of geprueft.data.quellen) {
    const adresse = normalisiere(eintrag.url);
    if (!adresse) {
      uebersprungen++;
      continue;
    }
    if (gesehen.has(adresse)) continue;
    gesehen.add(adresse);

    if (quellen.length >= HOECHSTZAHL) {
      hinweise.push(`Nur die ersten ${HOECHSTZAHL} Vorschläge werden angezeigt.`);
      break;
    }

    quellen.push({
      url: adresse,
      titel: eintrag.titel?.trim() || adresse,
      herausgeber: eintrag.herausgeber?.trim() || rechnerName(adresse),
      istFeed: istFeedAdresse(adresse),
    });
  }

  if (uebersprungen > 0) {
    hinweise.push(
      `${uebersprungen} Einträge übergangen, weil ihre Adresse nicht http oder https war.`,
    );
  }

  return {
    frage: geprueft.data.frage?.trim() || null,
    werkzeug: geprueft.data.werkzeug?.trim() || null,
    quellen,
    hinweise,
  };
}

/**
 * Nur http und https. Ein `javascript:`- oder `data:`-Verweis in einer
 * Quellenliste hat keinen Zweck, den man wohlwollend deuten könnte.
 */
function normalisiere(roh: string): string | null {
  try {
    const adresse = new URL(roh.trim());
    if (adresse.protocol !== "http:" && adresse.protocol !== "https:") return null;
    adresse.hash = "";
    return adresse.toString();
  } catch {
    return null;
  }
}

function rechnerName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./iu, "") || "Unbekannt";
  } catch {
    return "Unbekannt";
  }
}
