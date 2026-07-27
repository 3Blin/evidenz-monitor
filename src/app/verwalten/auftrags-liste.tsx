/**
 * Liste der eigenen Aufträge, mit Anlegen eines neuen.
 *
 * Schreibt über die Tabelle, nicht über eine eigene Funktion: Die
 * Zeilen-Sicherheit aus Migration 0002 lässt nur eigene Zeilen zu, sie ist der
 * Schutz. Eine zusätzliche Prüfung hier wäre eine zweite Wahrheit.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseImBrowser } from "@/lib/supabase-browser";

interface AuftragZeile {
  readonly id: string;
  readonly name: string;
  readonly fragestellung: string;
  readonly aktiv: boolean;
  readonly oeffentliche_demo: boolean;
}

export function AuftragsListe({ auftraege }: { auftraege: readonly AuftragZeile[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [frage, setFrage] = useState("");
  const [ziel, setZiel] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function anlegen(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      const supabase = supabaseImBrowser();
      const { data: sitzung } = await supabase.auth.getUser();
      if (!sitzung.user) throw new Error("Nicht angemeldet");

      const { data, error } = await supabase
        .from("auftraege")
        .insert({
          user_id: sitzung.user.id,
          name: name.trim(),
          zielbeschreibung: ziel.trim() || name.trim(),
          fragestellung: frage.trim(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      router.push(`/verwalten/${data.id}`);
    } catch (f) {
      setFehler(f instanceof Error ? f.message : String(f));
      setLaeuft(false);
    }
  }

  return (
    <>
      <div className="abschnitt">
        <h2>Vorhandene Aufträge</h2>
        {auftraege.length === 0 ? (
          <p className="frage">
            Noch kein eigener Auftrag. Leg unten einen an — oder übernimm weiter
            unten einen der freigegebenen Beispielaufträge, um an einem fertig
            eingerichteten Fall zu sehen, wie die Teile zusammenspielen.
          </p>
        ) : (
          <div className="tabelle-rollbar">
            <table className="tabelle">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>FRAGESTELLUNG</th>
                  <th>ZUSTAND</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {auftraege.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td className="aus">{a.fragestellung}</td>
                    <td>
                      <span className={a.aktiv ? "marke marke-an" : "marke"}>
                        {a.aktiv ? "aktiv" : "ruht"}
                      </span>{" "}
                      {a.oeffentliche_demo && <span className="marke">öffentlich</span>}
                    </td>
                    <td>
                      <a href={`/verwalten/${a.id}`} className="verweis">Bearbeiten</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="abschnitt">
        <h2>Neuen Auftrag anlegen</h2>
        <p className="frage">
          Beschreibe in Alltagssprache, was beobachtet werden soll. Quellen und
          Suchbegriffe kommen im nächsten Schritt dazu.
        </p>
        <form onSubmit={anlegen} className="formular" style={{ maxWidth: 640 }}>
          <label className="feld">
            <span>Name</span>
            <input
              required maxLength={120} value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Hochwasserlage Rheinland-Pfalz"
            />
          </label>
          <label className="feld">
            <span>Fragestellung</span>
            <input
              required maxLength={400} value={frage}
              onChange={(e) => setFrage(e.target.value)}
              placeholder="Welche Frage soll das Dashboard beantworten?"
            />
          </label>
          <label className="feld">
            <span>Was genau beobachten? (optional)</span>
            <textarea
              rows={3} maxLength={2000} value={ziel}
              onChange={(e) => setZiel(e.target.value)}
              placeholder="Frei formuliert. Bleibt das Feld leer, wird der Name übernommen."
            />
          </label>
          <div className="feld-reihe">
            <button type="submit" className="knopf" disabled={laeuft}>
              {laeuft ? "Wird angelegt …" : "Auftrag anlegen"}
            </button>
          </div>
        </form>
        {fehler && <p className="meldung meldung-schlecht">Anlegen fehlgeschlagen: {fehler}</p>}
      </div>
    </>
  );
}
