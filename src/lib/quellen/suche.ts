/**
 * Such-Adapter für SearXNG (ADR 0014).
 *
 * Zweck: Foren, Nischenblogs und kleine Seiten sind die Frühwarnkanäle - dort
 * taucht eine Behauptung zuerst auf. Sie haben aber meist keinen Feed, und man
 * kennt sie vorher nicht. Ein Feed setzt voraus, dass man die Quelle schon
 * gefunden hat; eine Suche setzt nur voraus, dass man die Frage kennt.
 *
 * SearXNG ist ein selbst betriebener Meta-Sucher: Er fragt fremde Suchmaschinen
 * ab und gibt das Ergebnis als JSON zurück. Wir sprechen also nie unmittelbar
 * mit Google oder Brave, und es fällt kein Schlüssel und keine Gebühr an.
 *
 * Grundsätze wie bei den anderen Adaptern:
 * - Die Antwort ist fremde Eingabe. Sie wird gegen ein Schema geprüft; was
 *   nicht passt, fällt heraus, statt weitergereicht zu werden.
 * - Nur ein zitierfähiger Auszug wird gespeichert (Anforderung 4.2).
 * - Länge der Antwort und Zahl der Treffer sind begrenzt. Beides bestimmt sonst
 *   ein fremder Server.
 */
import { z } from "zod";
import { auszugBilden, begrenztLesen, type QuellenAdapter, type RohInhalt } from "./adapter";

/** Obergrenze der gelesenen Antwort. */
export const MAX_BYTES = 2_000_000;

/**
 * Höchstzahl der Treffer je Abruf.
 *
 * Nicht die Zahl, die die Suchmaschine liefern *könnte*, sondern die, die ein
 * Beobachtungslauf sinnvoll verarbeitet. Wer mehr braucht, stellt einen
 * engeren Takt ein - nicht eine größere Ladung auf einmal.
 */
export const MAX_TREFFER = 50;

const ZEIT_LIMIT_MS = 20_000;

/**
 * Umgebungsvariable mit den Zugangsdaten der eigenen Instanz, Form
 * `benutzer:passwort`. Absichtlich freiwillig: Eine offene Instanz
 * funktioniert ohne, eine abgesicherte funktioniert später ohne Codeänderung.
 */
export const ZUGANGSDATEN_VARIABLE = "SUCHE_ZUGANGSDATEN";

/** Antwortform von SearXNG. Unbekannte Felder werden ignoriert, nicht abgelehnt. */
const trefferSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  publishedDate: z.string().nullish(),
  engine: z.string().optional(),
});

const antwortSchema = z.object({
  results: z.array(z.unknown()).default([]),
});

/**
 * Baut aus der hinterlegten Adresse die Abfrageadresse.
 *
 * Die Suchfrage steht in der Adresse der Quelle (`?q=…`) und nicht in den
 * Suchbegriffen des Auftrags. Grund: Ein Auftrag kann mehrere verschiedene
 * Suchen brauchen - eine weite zum Umsehen, eine enge auf einen Namen - und
 * die Relevanzregeln sieben hinterher ohnehin. Bekäme der Adapter die
 * Suchbegriffe des Auftrags, wäre er an den Auftrag gebunden statt an die
 * Quelle, und der Adapter-Vertrag (nur eine Adresse) wäre gebrochen.
 */
export function baueAbfrage(url: string): URL {
  const ziel = new URL(url);
  if (ziel.protocol !== "https:" && ziel.protocol !== "http:") {
    throw new Error(`Nicht unterstütztes Protokoll: ${ziel.protocol}`);
  }
  if (!ziel.searchParams.get("q")?.trim()) {
    throw new Error(
      "Suchquelle ohne Suchfrage: Die Adresse braucht einen Parameter q, " +
        "etwa https://beispiel.tld/search?q=Kabinett+Merz",
    );
  }
  // Zwingend JSON. Eine Instanz, die HTML zurückgibt, hat das Format nicht
  // freigeschaltet - das soll als Fehler auffallen und nicht als leerer Lauf.
  ziel.searchParams.set("format", "json");
  return ziel;
}

/**
 * Baut den Kopf mit Zugangsdaten, falls hinterlegt.
 *
 * Über unverschlüsseltes http werden sie NICHT mitgeschickt. Ein Passwort im
 * Klartext über das Netz zu schicken ist schlimmer als der Fehlschlag, den es
 * verhindern soll - deshalb bricht der Abruf hier ab, statt es zu tun.
 */
export function zugangsKopf(
  ziel: URL,
  zugangsdaten: string | undefined,
): Record<string, string> {
  const wert = zugangsdaten?.trim();
  if (!wert) return {};
  if (ziel.protocol !== "https:") {
    throw new Error(
      `Zugangsdaten aus ${ZUGANGSDATEN_VARIABLE} werden nur über https gesendet, ` +
        `die Quelle ist aber ${ziel.protocol}//`,
    );
  }
  if (!wert.includes(":")) {
    throw new Error(`${ZUGANGSDATEN_VARIABLE} muss die Form benutzer:passwort haben`);
  }
  return { Authorization: `Basic ${Buffer.from(wert, "utf-8").toString("base64")}` };
}

/** Wandelt die geprüfte Antwort in Rohinhalte. Ohne Netzzugriff prüfbar. */
export function trefferAuswerten(daten: unknown): readonly RohInhalt[] {
  const geprueft = antwortSchema.safeParse(daten);
  if (!geprueft.success) {
    throw new Error("Antwort der Suche hat kein Feld results - ist format=json freigeschaltet?");
  }

  const inhalte: RohInhalt[] = [];
  for (const roh of geprueft.data.results) {
    const treffer = trefferSchema.safeParse(roh);
    // Einzelne unbrauchbare Treffer werden übergangen. Ein Meta-Sucher fasst
    // viele Maschinen zusammen; dass eine davon Unsinn liefert, darf nicht den
    // ganzen Abruf kosten.
    if (!treffer.success) continue;

    let adresse: URL;
    try {
      adresse = new URL(treffer.data.url);
    } catch {
      continue;
    }
    if (adresse.protocol !== "https:" && adresse.protocol !== "http:") continue;

    const titel = treffer.data.title?.trim() || adresse.href;
    const datum = treffer.data.publishedDate ? new Date(treffer.data.publishedDate) : null;

    inhalte.push({
      url: adresse.href,
      titel: auszugBilden(titel, 300),
      // Bewusst null: Verfasser des Fundes ist nicht die Suchmaschine, und der
      // Verfasser des Beitrags steht im Suchergebnis nicht. Lieber keine
      // Angabe als eine falsche.
      autor: null,
      veroeffentlichtAm: datum && !Number.isNaN(datum.getTime()) ? datum : null,
      auszug: auszugBilden(treffer.data.content?.trim() || titel),
    });

    if (inhalte.length >= MAX_TREFFER) break;
  }
  return inhalte;
}

export const sucheAdapter: QuellenAdapter = {
  name: "suche",
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
        ...zugangsKopf(ziel, process.env[ZUGANGSDATEN_VARIABLE]),
      },
    });

    if (antwort.status === 401 || antwort.status === 403) {
      throw new Error(
        `Suche verweigert den Zugriff (${antwort.status}). Ist die Instanz abgesichert, ` +
          `gehören die Zugangsdaten in ${ZUGANGSDATEN_VARIABLE}.`,
      );
    }
    if (antwort.status === 429) {
      throw new Error("Suche drosselt den Zugriff (429) - der Takt ist zu eng gestellt");
    }
    if (!antwort.ok) {
      throw new Error(`Status code ${antwort.status} für ${ziel.href}`);
    }

    const rohtext = await begrenztLesen(antwort, MAX_BYTES);
    let daten: unknown;
    try {
      daten = JSON.parse(rohtext);
    } catch {
      throw new Error(
        "Antwort der Suche ist kein JSON. Bei SearXNG muss das Format json in " +
          "settings.yml unter search.formats freigeschaltet sein.",
      );
    }
    return trefferAuswerten(daten);
  },
};
