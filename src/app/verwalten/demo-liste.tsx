"use client";
/**
 * Freigegebene Aufträge anderer Konten.
 *
 * Anlass: Die Verwaltung verwies auf einen Beispielfall, der in der Liste gar
 * nicht auftauchte - er gehört einem anderen Konto, die Zeilen-Sicherheit
 * sperrt ihn also zu Recht. Sichtbar war damit nur der Widerspruch.
 *
 * Statt den Verweis zu streichen, wird der Fall benutzbar: Ein freigegebener
 * Auftrag lässt sich mit einem Klick ins eigene Konto übernehmen - samt
 * Quellen und Relevanzregeln, aber ohne fremde Inhalte. Danach ist er ein
 * eigener Auftrag wie jeder andere.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseImBrowser } from "@/lib/supabase-browser";

export interface DemoAuftrag {
  readonly id: string;
  readonly name: string;
  readonly fragestellung: string;
}

export function DemoListe({
  auftraege,
  bereitsUebernommen,
}: {
  auftraege: readonly DemoAuftrag[];
  /** Namen eigener Aufträge - für den Hinweis auf eine vorhandene Kopie. */
  bereitsUebernommen: readonly string[];
}) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function uebernehmen(id: string) {
    setLaeuft(id);
    setFehler(null);
    try {
      const supabase = supabaseImBrowser();
      const { data, error } = await supabase.rpc("auftrag_uebernehmen", { p_auftrag: id });
      if (error) throw new Error(error.message);
      router.push(`/verwalten/${String(data)}`);
    } catch (f) {
      setFehler(f instanceof Error ? f.message : String(f));
      setLaeuft(null);
    }
  }

  if (auftraege.length === 0) return null;

  return (
    <div className="abschnitt">
      <h2>Freigegebene Beispiele</h2>
      <p className="frage">
        Diese Aufträge gehören einem anderen Konto und sind nur lesbar. Übernimm
        einen, um ihn mit seinen Quellen und Regeln als eigenen Auftrag
        weiterzuführen — die gesammelten Beiträge des Originals bleiben dort.
      </p>

      <div className="tabelle-rollbar">
        <table className="tabelle">
          <thead>
            <tr>
              <th>NAME</th>
              <th>FRAGESTELLUNG</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {auftraege.map((a) => {
              const kopieDa = bereitsUebernommen.some((n) => n.startsWith(a.name));
              return (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="aus">{a.fragestellung}</td>
                  <td>
                    <div className="feld-reihe">
                      <a href={`/?auftrag=${a.id}`} className="verweis">Ansehen</a>
                      <button
                        type="button"
                        className="knopf knopf-leise knopf-klein"
                        disabled={laeuft !== null}
                        onClick={() => void uebernehmen(a.id)}
                      >
                        {laeuft === a.id ? "Wird übernommen …" : "Übernehmen"}
                      </button>
                    </div>
                    {kopieDa && <small className="aus">bereits übernommen</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {fehler && <p className="meldung meldung-schlecht">Übernehmen fehlgeschlagen: {fehler}</p>}
    </div>
  );
}
