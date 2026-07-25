/**
 * Quellen eines Auftrags verwalten.
 *
 * Der Zugangsweg wird nicht eingestellt: Ob ein Feed oder eine Webseite
 * gelesen wird, erkennt der Sammellauf an der Adresse (ADR 0007). Eine
 * zusätzliche Auswahl hier wäre eine zweite Wahrheit, die auseinanderlaufen kann.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseImBrowser } from "@/lib/supabase-browser";
import { istFeedAdresse } from "@/lib/quellen/registrierung";

export interface QuelleZeile {
  readonly id: string;
  readonly url: string;
  readonly typ: string;
  readonly herausgeber: string;
  readonly sprache: string;
  readonly aktiv: boolean;
  readonly themenspezifisch: boolean;
}

const TYPEN = [
  ["hersteller_offiziell", "Hersteller (offiziell)"],
  ["status_seite", "Status-Seite"],
  ["fachmedium", "Fachmedium"],
  ["forum", "Forum"],
  ["community", "Community"],
  ["rss", "Feed (sonstiges)"],
  ["api", "Schnittstelle"],
  ["nutzer_dokument", "Eigenes Dokument"],
  ["sonstige", "Sonstiges"],
] as const;

export function QuellenVerwaltung({
  auftragId,
  quellen,
}: {
  auftragId: string;
  quellen: readonly QuelleZeile[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [herausgeber, setHerausgeber] = useState("");
  const [typ, setTyp] = useState<string>("fachmedium");
  const [sprache, setSprache] = useState("de");
  const [themenspezifisch, setThemenspezifisch] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);

  async function hinzufuegen(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    setLaeuft(true);
    setMeldung(null);
    try {
      const supabase = supabaseImBrowser();
      const { error } = await supabase.from("quellen").insert({
        auftrag_id: auftragId,
        url: url.trim(),
        typ,
        herausgeber: herausgeber.trim(),
        sprache,
        themenspezifisch,
      });
      if (error) throw new Error(error.message);
      setUrl("");
      setHerausgeber("");
      setThemenspezifisch(false);
      setMeldung({ gut: true, text: "Quelle hinzugefügt." });
      router.refresh();
    } catch (f) {
      setMeldung({ gut: false, text: f instanceof Error ? f.message : String(f) });
    } finally {
      setLaeuft(false);
    }
  }

  async function umschalten(quelle: QuelleZeile, feld: "aktiv" | "themenspezifisch") {
    setMeldung(null);
    try {
      const supabase = supabaseImBrowser();
      const { error } = await supabase
        .from("quellen")
        .update({ [feld]: !quelle[feld] })
        .eq("id", quelle.id);
      if (error) throw new Error(error.message);
      router.refresh();
    } catch (f) {
      setMeldung({ gut: false, text: f instanceof Error ? f.message : String(f) });
    }
  }

  async function entfernen(quelle: QuelleZeile) {
    setMeldung(null);
    try {
      const supabase = supabaseImBrowser();
      const { error } = await supabase.from("quellen").delete().eq("id", quelle.id);
      if (error) throw new Error(error.message);
      setMeldung({ gut: true, text: `${quelle.herausgeber} entfernt.` });
      router.refresh();
    } catch (f) {
      setMeldung({ gut: false, text: f instanceof Error ? f.message : String(f) });
    }
  }

  return (
    <div className="abschnitt">
      <h2>Quellen</h2>
      <p className="frage">
        Abschalten statt löschen erhält die bisherigen Beiträge als Belege — löschen
        entfernt sie mit.
      </p>

      {quellen.length > 0 && (
        <div className="tabelle-rollbar">
          <table className="tabelle">
            <thead>
              <tr>
                <th>HERAUSGEBER</th>
                <th>ADRESSE</th>
                <th>ART</th>
                <th>ZUGANGSWEG</th>
                <th>THEMENSPEZIFISCH</th>
                <th>ZUSTAND</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {quellen.map((q) => (
                <tr key={q.id}>
                  <td>{q.herausgeber}</td>
                  <td className="aus" style={{ maxWidth: 260, overflowWrap: "anywhere" }}>{q.url}</td>
                  <td className="aus">{q.typ}</td>
                  <td className="aus">
                    {q.typ === "extern_agent"
                      ? "eingeliefert"
                      : istFeedAdresse(q.url)
                        ? "Feed"
                        : "Webseite"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={q.themenspezifisch ? "marke marke-an" : "marke"}
                      onClick={() => umschalten(q, "themenspezifisch")}
                      style={{ cursor: "pointer", background: "none" }}
                      title="Umschalten: Quelle ist schon auf das Thema begrenzt"
                    >
                      {q.themenspezifisch ? "ja" : "nein"}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={q.aktiv ? "marke marke-an" : "marke"}
                      onClick={() => umschalten(q, "aktiv")}
                      style={{ cursor: "pointer", background: "none" }}
                      title="Umschalten: wird abgerufen"
                    >
                      {q.aktiv ? "aktiv" : "aus"}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="verweis"
                      onClick={() => entfernen(q)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={hinzufuegen} className="formular" style={{ maxWidth: 640, marginTop: 20 }}>
        <label className="feld">
          <span>Adresse der Quelle</span>
          <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://beispiel.de/feed/" />
          <small>
            {url
              ? istFeedAdresse(url)
                ? "Wird als Feed gelesen."
                : "Wird als einzelne Webseite gelesen."
              : "Feeds erkennt der Sammellauf an der Adresse (.rss, .xml, /feed …)."}
          </small>
        </label>

        <label className="feld">
          <span>Herausgeber</span>
          <input required maxLength={200} value={herausgeber}
            onChange={(e) => setHerausgeber(e.target.value)} placeholder="z. B. heise online" />
        </label>

        <label className="feld">
          <span>Art der Quelle</span>
          <select value={typ} onChange={(e) => setTyp(e.target.value)}>
            {TYPEN.map(([wert, beschriftung]) => (
              <option key={wert} value={wert}>{beschriftung}</option>
            ))}
          </select>
          <small>Bestimmt die Einstufung in der Bewertung, nicht den Zugangsweg.</small>
        </label>

        <label className="feld">
          <span>Sprache</span>
          <select value={sprache} onChange={(e) => setSprache(e.target.value)}>
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
          </select>
        </label>

        <label className="feld feld-schalter">
          <input type="checkbox" checked={themenspezifisch}
            onChange={(e) => setThemenspezifisch(e.target.checked)} />
          <span>Quelle ist schon auf das Thema begrenzt</span>
        </label>
        <small className="frage" style={{ marginTop: -8 }}>
          Bei einem reinen Themenforum oder einem Feed mit Suchabfrage anhaken —
          dann müssen die Pflichtbegriffe nicht noch im Text stehen. Bei breiten
          Quellen (allgemeine Nachrichtenseiten) offen lassen.
        </small>

        <div className="feld-reihe">
          <button type="submit" className="knopf" disabled={laeuft}>
            {laeuft ? "Wird hinzugefügt …" : "Quelle hinzufügen"}
          </button>
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
