/**
 * Eigenen KI-Zugang hinterlegen (BYOK).
 *
 * Der Klartext des Schlüssels geht genau einmal an den eigenen Server, wird
 * dort verschlüsselt und nur verschlüsselt gespeichert. Er wird nie
 * zurückgegeben — auch dieses Formular kann ihn nicht anzeigen, sondern nur
 * ersetzen. Genau deshalb steht hier ein Hinweis statt eines gefüllten Feldes.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SchluesselZustand {
  readonly hinterlegt: boolean;
  readonly anbieter?: string | null;
  readonly endpunktUrl?: string | null;
  readonly aktualisiertAm?: string | null;
}

type Anbieter = "anthropic" | "openai" | "kompatibel";

export function SchluesselFormular({ zustand }: { zustand: SchluesselZustand }) {
  const router = useRouter();
  const [anbieter, setAnbieter] = useState<Anbieter>(
    (zustand.anbieter as Anbieter | undefined) ?? "anthropic",
  );
  const [endpunkt, setEndpunkt] = useState(zustand.endpunktUrl ?? "");
  const [schluessel, setSchluessel] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);

  async function speichern(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    setLaeuft(true);
    setMeldung(null);
    try {
      const antwort = await fetch("/api/v1/ki-schluessel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anbieter,
          endpunktUrl: anbieter === "kompatibel" && endpunkt ? endpunkt : null,
          schluessel,
        }),
      });
      if (!antwort.ok) {
        const koerper: unknown = await antwort.json().catch(() => ({}));
        const grund =
          typeof koerper === "object" && koerper && "fehler" in koerper
            ? String((koerper as { fehler: unknown }).fehler)
            : `HTTP ${antwort.status}`;
        throw new Error(grund);
      }
      setSchluessel("");
      setMeldung({ gut: true, text: "Schlüssel verschlüsselt gespeichert." });
      router.refresh();
    } catch (f) {
      setMeldung({ gut: false, text: f instanceof Error ? f.message : String(f) });
    } finally {
      setLaeuft(false);
    }
  }

  async function entfernen() {
    setLaeuft(true);
    setMeldung(null);
    try {
      const antwort = await fetch("/api/v1/ki-schluessel", { method: "DELETE" });
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      setMeldung({ gut: true, text: "Schlüssel entfernt." });
      router.refresh();
    } catch (f) {
      setMeldung({ gut: false, text: f instanceof Error ? f.message : String(f) });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="abschnitt">
      <h2>Eigener KI-Zugang</h2>
      <p className="frage">
        Die KI-Analyse läuft mit deinem eigenen Schlüssel — die Kosten bleiben bei
        dir, und niemand teilt sich einen Zugang. Der Schlüssel wird verschlüsselt
        gespeichert, nie protokolliert und nie wieder herausgegeben.
      </p>

      {zustand.hinterlegt ? (
        <p className="frage">
          Hinterlegt für <b>{zustand.anbieter}</b>
          {zustand.endpunktUrl ? ` (${zustand.endpunktUrl})` : ""}
          {zustand.aktualisiertAm
            ? `, geändert am ${new Date(zustand.aktualisiertAm).toLocaleDateString("de-DE")}`
            : ""}
          . Ein neuer Eintrag ersetzt den alten.
        </p>
      ) : (
        <p className="frage">
          Noch kein Schlüssel hinterlegt. Bis dahin arbeitet die deterministische
          Vorklassifikation — das Dashboard funktioniert also auch ohne.
        </p>
      )}

      <form onSubmit={speichern} className="formular" style={{ maxWidth: 520, marginTop: 16 }}>
        <label className="feld">
          <span>Anbieter</span>
          <select value={anbieter} onChange={(e) => setAnbieter(e.target.value as Anbieter)}>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="kompatibel">Eigener oder kompatibler Endpunkt</option>
          </select>
        </label>

        {anbieter === "kompatibel" && (
          <label className="feld">
            <span>Adresse des Endpunkts</span>
            <input
              type="url" value={endpunkt} onChange={(e) => setEndpunkt(e.target.value)}
              placeholder="https://mein-server.heimnetz/v1"
            />
          </label>
        )}

        <label className="feld">
          <span>Schlüssel</span>
          <input
            type="password" required minLength={8} autoComplete="off"
            value={schluessel} onChange={(e) => setSchluessel(e.target.value)}
            placeholder={zustand.hinterlegt ? "Neuen Schlüssel eingeben zum Ersetzen" : "sk-…"}
          />
          <small>
            Wird nur zum Verschlüsseln an den Server geschickt und dort nicht
            protokolliert.
          </small>
        </label>

        <div className="feld-reihe">
          <button type="submit" className="knopf" disabled={laeuft}>
            {laeuft ? "Wird gespeichert …" : zustand.hinterlegt ? "Ersetzen" : "Speichern"}
          </button>
          {zustand.hinterlegt && (
            <button type="button" className="knopf knopf-warnung" onClick={entfernen} disabled={laeuft}>
              Entfernen
            </button>
          )}
        </div>
      </form>

      {meldung && (
        <p className={meldung.gut ? "meldung meldung-gut" : "meldung meldung-schlecht"}>
          {meldung.text}
        </p>
      )}
    </div>
  );
}
