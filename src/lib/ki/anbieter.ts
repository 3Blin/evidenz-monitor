/**
 * Aufruf des Sprachmodells beim jeweiligen Anbieter.
 *
 * Getrennt vom Vorschlagsmodul, weil hier der Netzzugriff steckt: So bleibt
 * die Auswertung der Antwort ohne Netz prüfbar (Modulgrenze 3).
 *
 * Der Schlüssel kommt entschlüsselt herein und wird ausschließlich als
 * Kopfzeile verwendet - er wird nicht mitgeschrieben und erscheint in keiner
 * Fehlermeldung.
 */

export type Anbieter = "anthropic" | "openai" | "kompatibel";

export interface ModellAufruf {
  readonly anbieter: Anbieter;
  readonly schluessel: string;
  readonly endpunktUrl?: string | null;
  readonly anweisung: string;
  /** Abbruch nach dieser Zeit - eine hängende Anfrage blockiert die Seite. */
  readonly zeitgrenzeMs?: number;
}

/** Vorbelegte Modelle. Bewusst sparsam gehalten und an einer Stelle. */
const MODELL: Record<Anbieter, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4.1-mini",
  kompatibel: "gpt-4.1-mini",
};

export async function frageModell(auftrag: ModellAufruf): Promise<string> {
  const abbruch = AbortSignal.timeout(auftrag.zeitgrenzeMs ?? 45_000);

  if (auftrag.anbieter === "anthropic") {
    const antwort = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: abbruch,
      headers: {
        "content-type": "application/json",
        "x-api-key": auftrag.schluessel,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELL.anthropic,
        max_tokens: 2000,
        messages: [{ role: "user", content: auftrag.anweisung }],
      }),
    });
    const roh: unknown = await liesAntwort(antwort, "Anthropic");
    return textAusAnthropic(roh);
  }

  // OpenAI und kompatible Endpunkte teilen sich das Format. Der eigene
  // Endpunkt ist der Grund, aus dem es "kompatibel" gibt: lokale Modelle.
  const basis =
    auftrag.anbieter === "openai"
      ? "https://api.openai.com/v1"
      : (auftrag.endpunktUrl ?? "").replace(/\/+$/, "");
  if (!basis) throw new Error("Für einen kompatiblen Zugang fehlt die Endpunkt-Adresse.");

  const antwort = await fetch(`${basis}/chat/completions`, {
    method: "POST",
    signal: abbruch,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auftrag.schluessel}`,
    },
    body: JSON.stringify({
      model: MODELL[auftrag.anbieter],
      messages: [{ role: "user", content: auftrag.anweisung }],
    }),
  });
  const roh: unknown = await liesAntwort(antwort, "OpenAI");
  return textAusOpenAi(roh);
}

async function liesAntwort(antwort: Response, name: string): Promise<unknown> {
  if (!antwort.ok) {
    // Der Text des Anbieters hilft beim Verstehen (falscher Schlüssel,
    // erschöpftes Guthaben) und enthält den Schlüssel selbst nicht.
    const text = await antwort.text().catch(() => "");
    throw new Error(
      `${name} hat die Anfrage abgelehnt (HTTP ${antwort.status})${
        text ? `: ${text.slice(0, 300)}` : ""
      }`,
    );
  }
  return antwort.json();
}

function textAusAnthropic(roh: unknown): string {
  const inhalt = (roh as { content?: { type?: string; text?: string }[] }).content ?? [];
  const text = inhalt
    .filter((t) => t.type === "text" && typeof t.text === "string")
    .map((t) => t.text ?? "")
    .join("");
  if (!text) throw new Error("Die Antwort von Anthropic enthielt keinen Text.");
  return text;
}

function textAusOpenAi(roh: unknown): string {
  const auswahl = (roh as { choices?: { message?: { content?: string } }[] }).choices ?? [];
  const text = auswahl[0]?.message?.content ?? "";
  if (!text) throw new Error("Die Antwort des Anbieters enthielt keinen Text.");
  return text;
}
