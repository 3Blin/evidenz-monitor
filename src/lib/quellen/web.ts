/**
 * Web-Abruf-Adapter (zweiter Kern-Adapter aus ADR 0002).
 *
 * Zweck: Viele wichtige Bestätigungskanäle - Status-Seiten der Hersteller,
 * Support-Artikel, Herstellermeldungen - haben keinen Feed. Sie sind eine
 * einzelne Seite, die sich verändert.
 *
 * Grundsätze, die hier bewusst umgesetzt sind:
 * - Fremde Inhalte gelten als nicht vertrauenswürdig (ARCHITEKTUR): Es wird
 *   ausschließlich Text herausgelöst, nie etwas ausgeführt. Skripte, Stile und
 *   eingebettete Inhalte fliegen vor der Auswertung heraus.
 * - Nur ein zitierfähiger Auszug wird gespeichert, nie der ganze Text
 *   (Urheberrecht, Anforderung 4.2) - dieselbe Regel wie beim RSS-Adapter.
 * - Ohne neue Abhängigkeit: eine HTML-Bibliothek wäre für das Herauslösen von
 *   Titel und Fließtext zusätzliche Angriffsfläche ohne echten Gewinn
 *   (Haltung aus ADR 0003).
 */
import { auszugBilden, begrenztLesen, type QuellenAdapter, type RohInhalt } from "./adapter";

/** Obergrenze der gelesenen Antwort. Schützt vor überlangen Seiten. */
export const MAX_BYTES = 2_000_000;

const ZEIT_LIMIT_MS = 10_000;

const ENTITAETEN: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "",
};

/** Löst die gängigen HTML-Ersatzschreibweisen auf (&amp;, &#39;, &#x2F; ...). */
export function entitaetenAufloesen(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (ganz, kern: string) => {
    if (kern.startsWith("#")) {
      const zahl = kern[1] === "x" || kern[1] === "X"
        ? Number.parseInt(kern.slice(2), 16)
        : Number.parseInt(kern.slice(1), 10);
      // Steuerzeichen und ungültige Werte werden verworfen, nicht geraten.
      if (!Number.isFinite(zahl) || zahl < 32 || zahl > 0x10ffff) return "";
      return String.fromCodePoint(zahl);
    }
    return ENTITAETEN[kern.toLowerCase()] ?? ganz;
  });
}

function ersterTreffer(html: string, muster: readonly RegExp[]): string | null {
  for (const m of muster) {
    const treffer = m.exec(html);
    const wert = treffer?.[1]?.trim();
    if (wert) return entitaetenAufloesen(wert).trim() || null;
  }
  return null;
}

/**
 * Holt Titel, Autor, Datum und Fließtext aus einer HTML-Seite.
 *
 * Als eigene Funktion, damit die Auswertung ohne Netzzugriff prüfbar ist -
 * der Abruf selbst hat keine Logik mehr, die schiefgehen könnte.
 */
export function extrahiereAusHtml(
  html: string,
  url: string,
  ersatzDatum: Date | null = null,
): RohInhalt {
  // Alles entfernen, was kein Fließtext ist. Reihenfolge ist wichtig: erst die
  // Blöcke mitsamt Inhalt, dann die restlichen Marken.
  const ohneBloecke = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");

  const titel =
    ersterTreffer(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    ]) ?? url;

  const autor = ersterTreffer(html, [
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i,
    /<meta[^>]+property=["']article:author["'][^>]+content=["']([^"']+)["']/i,
  ]);

  const datumText = ersterTreffer(html, [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ]);
  let veroeffentlichtAm = ersatzDatum;
  if (datumText) {
    const geparst = new Date(datumText);
    // Ein unlesbares Datum wird verworfen, nicht geraten - lieber keine
    // Angabe als eine falsche.
    if (!Number.isNaN(geparst.getTime())) veroeffentlichtAm = geparst;
  }

  // Titel steht schon im eigenen Feld; im Auszug soll der Fließtext stehen.
  const textOhneTitel = ohneBloecke.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, " ");
  const fliesstext = entitaetenAufloesen(textOhneTitel.replace(/<[^>]*>/g, " "));

  return {
    url,
    titel: auszugBilden(titel, 300),
    autor,
    veroeffentlichtAm,
    auszug: auszugBilden(fliesstext.trim() || titel),
  };
}

export const webAdapter: QuellenAdapter = {
  name: "web",
  async abrufen(url: string, signal?: AbortSignal): Promise<readonly RohInhalt[]> {
    const ziel = new URL(url);
    if (ziel.protocol !== "https:" && ziel.protocol !== "http:") {
      throw new Error(`Nicht unterstütztes Protokoll: ${ziel.protocol}`);
    }

    const abbruch = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(ZEIT_LIMIT_MS)])
      : AbortSignal.timeout(ZEIT_LIMIT_MS);

    const antwort = await fetch(ziel, {
      signal: abbruch,
      redirect: "follow",
      headers: {
        "User-Agent": "EvidenzMonitor/0.1 (+Beobachtungsauftrag)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
    });

    // Wie beim RSS-Adapter: Fehler werden nie verschluckt. Der Quellen-Abrufer
    // schreibt sie ins Abruf-Protokoll und macht mit der nächsten Quelle weiter.
    if (!antwort.ok) {
      throw new Error(`Status code ${antwort.status} für ${ziel.href}`);
    }

    const art = antwort.headers.get("content-type") ?? "";
    if (art && !/text\/html|application\/xhtml|text\/plain/i.test(art)) {
      throw new Error(`Unerwarteter Inhaltstyp: ${art}`);
    }

    const kopfDatum = antwort.headers.get("last-modified");
    const ersatzDatum = kopfDatum && !Number.isNaN(new Date(kopfDatum).getTime())
      ? new Date(kopfDatum)
      : null;

    return [extrahiereAusHtml(await begrenztLesen(antwort, MAX_BYTES), ziel.href, ersatzDatum)];
  },
};
