/**
 * GDELT-Adapter (ADR 0014).
 *
 * Zweck: GDELT liest weltweit Nachrichtenseiten in über 100 Sprachen und macht
 * sie über eine offene Schnittstelle durchsuchbar - ohne Schlüssel, ohne
 * Vertrag, ohne Kosten. Für die Kernfrage dieses Systems ist das genau der
 * fehlende Baustein: "Wer hat das zuerst gesagt und wo wurde es abgeschrieben?"
 * lässt sich nicht beantworten, wenn man nur die sieben Quellen sieht, die man
 * selbst eingetragen hat.
 *
 * Was GDELT NICHT ist: eine Bestätigung. Ein Treffer heißt "irgendwo stand
 * das", nicht "es stimmt". Die Einordnung bleibt beim Regelwerk (ADR 0011).
 *
 * Abgrenzung zur Suche (suche.ts): SearXNG durchsucht das ganze Netz und
 * findet auch Foren und Blogs, hat aber kein verlässliches Datum. GDELT deckt
 * nur Nachrichtenseiten ab, liefert dafür aber zu jedem Treffer den Zeitpunkt
 * der ersten Sichtung - und damit das, was für die Frage nach dem Ursprung
 * zählt. Sie ergänzen einander und ersetzen einander nicht.
 */
import { z } from "zod";
import { auszugBilden, begrenztLesen, type QuellenAdapter, type RohInhalt } from "./adapter";

export const BASIS_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
export const MAX_BYTES = 4_000_000;

/** Höchstzahl je Abruf. GDELT selbst erlaubt 250; das ist für einen Lauf zu viel. */
export const MAX_TREFFER = 75;

/** Vorgabe des Zeitraums, wenn die Adresse keinen nennt. */
export const VORGABE_ZEITRAUM = "1d";

const ZEIT_LIMIT_MS = 30_000;

const artikelSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  seendate: z.string().optional(),
  domain: z.string().optional(),
  language: z.string().optional(),
});

const antwortSchema = z.object({
  articles: z.array(z.unknown()).default([]),
});

/**
 * Wandelt GDELTs Zeitform `20260730T121500Z` in ein Datum.
 *
 * Eigene Funktion, weil `new Date()` diese Form nicht versteht und stillzu
 * einem ungültigen Datum führt - ein Fehler, der erst im Dashboard auffiele.
 */
export function seendateLesen(wert: string | undefined): Date | null {
  if (!wert) return null;
  const t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(wert.trim());
  if (!t) {
    const frei = new Date(wert);
    return Number.isNaN(frei.getTime()) ? null : frei;
  }
  const datum = new Date(
    `${t[1]}-${t[2]}-${t[3]}T${t[4]}:${t[5]}:${t[6]}Z`,
  );
  return Number.isNaN(datum.getTime()) ? null : datum;
}

/**
 * Baut die Abfrageadresse.
 *
 * Angegeben wird in der Quelle entweder die volle GDELT-Adresse oder nur die
 * Suchfrage als `?query=…`; beides landet hier. Feste Werte sind das Format
 * (json), die Betriebsart (artlist - Artikel statt Kennzahlen) und die
 * Obergrenze. Der Zeitraum ist einstellbar, hat aber eine Vorgabe: Ohne ihn
 * liefert GDELT die letzten drei Monate, was bei jedem Lauf dieselben alten
 * Meldungen brächte.
 */
export function baueAbfrage(url: string): URL {
  const eingabe = new URL(url);
  if (eingabe.protocol !== "https:" && eingabe.protocol !== "http:") {
    throw new Error(`Nicht unterstütztes Protokoll: ${eingabe.protocol}`);
  }
  const frage = eingabe.searchParams.get("query")?.trim() || eingabe.searchParams.get("q")?.trim();
  if (!frage) {
    throw new Error(
      "GDELT-Quelle ohne Suchfrage: Die Adresse braucht einen Parameter query, " +
        'etwa https://api.gdeltproject.org/api/v2/doc/doc?query=Kabinett Merz sourcelang:german',
    );
  }

  const ziel = new URL(BASIS_URL);
  ziel.searchParams.set("query", frage);
  ziel.searchParams.set("mode", "artlist");
  ziel.searchParams.set("format", "json");
  ziel.searchParams.set("maxrecords", String(MAX_TREFFER));
  ziel.searchParams.set("sort", "datedesc");
  ziel.searchParams.set(
    "timespan",
    eingabe.searchParams.get("timespan")?.trim() || VORGABE_ZEITRAUM,
  );
  return ziel;
}

/** Wandelt die geprüfte Antwort in Rohinhalte. Ohne Netzzugriff prüfbar. */
export function artikelAuswerten(daten: unknown): readonly RohInhalt[] {
  const geprueft = antwortSchema.safeParse(daten);
  if (!geprueft.success) {
    throw new Error("Antwort von GDELT hat kein Feld articles");
  }

  const inhalte: RohInhalt[] = [];
  for (const roh of geprueft.data.articles) {
    const artikel = artikelSchema.safeParse(roh);
    if (!artikel.success) continue;

    let adresse: URL;
    try {
      adresse = new URL(artikel.data.url);
    } catch {
      continue;
    }
    if (adresse.protocol !== "https:" && adresse.protocol !== "http:") continue;

    const titel = artikel.data.title?.trim() || adresse.href;
    inhalte.push({
      url: adresse.href,
      titel: auszugBilden(titel, 300),
      autor: null,
      veroeffentlichtAm: seendateLesen(artikel.data.seendate),
      // GDELT liefert keinen Textauszug, nur den Titel. Das ist wenig, aber
      // es ist ehrlich: Wir erfinden keinen Inhalt, den wir nicht gelesen
      // haben. Für die Zusammenführung reichen Titel, Adresse und Zeitpunkt.
      auszug: auszugBilden(
        artikel.data.domain ? `${titel} (${artikel.data.domain})` : titel,
      ),
    });

    if (inhalte.length >= MAX_TREFFER) break;
  }
  return inhalte;
}

export const gdeltAdapter: QuellenAdapter = {
  name: "gdelt",
  async abrufen(url: string, signal?: AbortSignal): Promise<readonly RohInhalt[]> {
    const ziel = baueAbfrage(url);
    const abbruch = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(ZEIT_LIMIT_MS)])
      : AbortSignal.timeout(ZEIT_LIMIT_MS);

    const antwort = await fetch(ziel, {
      signal: abbruch,
      redirect: "follow",
      headers: {
        "User-Agent": "EvidenzMonitor/0.1 (+Beobachtungsauftrag)",
        Accept: "application/json",
      },
    });

    if (antwort.status === 429) {
      throw new Error("GDELT drosselt den Zugriff (429) - der Takt ist zu eng gestellt");
    }
    if (!antwort.ok) {
      throw new Error(`Status code ${antwort.status} für ${ziel.href}`);
    }

    const rohtext = await begrenztLesen(antwort, MAX_BYTES);
    // GDELT antwortet auf eine fehlerhafte Suchfrage mit Klartext und Status
    // 200. Ohne diese Prüfung sähe das aus wie ein Lauf ohne Treffer, und man
    // suchte den Fehler wochenlang an der falschen Stelle.
    if (!rohtext.trimStart().startsWith("{")) {
      throw new Error(
        `GDELT hat die Suchfrage abgelehnt: ${auszugBilden(rohtext, 200) || "leere Antwort"}`,
      );
    }
    let daten: unknown;
    try {
      daten = JSON.parse(rohtext);
    } catch {
      throw new Error("Antwort von GDELT ist kein gültiges JSON");
    }
    return artikelAuswerten(daten);
  },
};
