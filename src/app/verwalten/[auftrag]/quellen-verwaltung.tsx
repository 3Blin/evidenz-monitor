/**
 * Quellen eines Auftrags verwalten.
 *
 * Der Zugangsweg steht auf "Automatisch erkennen" und muss im Regelfall nicht
 * angefasst werden: Ob ein Feed oder eine Webseite gelesen wird, erkennt der
 * Sammellauf an der Adresse (ADR 0007). Umstellen muss man ihn nur für Wege,
 * die man einer Adresse nicht ansieht - Suche und GDELT (ADR 0014).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseImBrowser } from "@/lib/supabase-browser";
import {
  istFeedAdresse,
  istZugangsweg,
  ZUGANGSWEGE,
  ZUGANGSWEG_TEXT,
  ZUGANGSWEG_VORGABE,
  type Zugangsweg,
} from "@/lib/quellen/registrierung";

export interface QuelleZeile {
  readonly id: string;
  readonly url: string;
  readonly typ: string;
  readonly herausgeber: string;
  readonly sprache: string;
  readonly aktiv: boolean;
  readonly themenspezifisch: boolean;
  readonly zugangsweg?: string | null;
}

/** Was in der Adresszeile stehen soll, je Zugangsweg. */
const ADRESS_BEISPIEL: Record<Zugangsweg, string> = {
  automatisch: "https://beispiel.de/feed/",
  feed: "https://beispiel.de/feed/",
  web: "https://beispiel.de/status",
  suche: "https://search.n0de.online/search?q=Suchfrage",
  gdelt: "https://api.gdeltproject.org/api/v2/doc/doc?query=Suchfrage sourcelang:german",
};

/** Ein Satz zu jedem Zugangsweg. Ohne ihn ist die Auswahl nicht zu beantworten. */
const ZUGANGSWEG_HINWEIS: Record<Zugangsweg, string> = {
  automatisch:
    "Feeds erkennt der Sammellauf an der Adresse (.rss, .xml, /feed …), alles andere liest er als einzelne Webseite.",
  feed: "Erzwingt die Feed-Lesart, auch wenn die Adresse nicht danach aussieht.",
  web: "Erzwingt die Webseiten-Lesart, auch wenn die Adresse nach Feed aussieht.",
  suche:
    "Fragt bei jedem Lauf deine SearXNG-Instanz ab. Die Suchfrage gehört in den Parameter q der Adresse. So kommen Foren und Blogs herein, die keinen Feed haben.",
  gdelt:
    "Durchsucht weltweit Nachrichtenseiten, kostenlos und ohne Schlüssel. Liefert zu jedem Treffer den Zeitpunkt der ersten Sichtung — hilfreich für die Frage, wer zuerst berichtet hat.",
};

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

/** Was in der Spalte ZUGANGSWEG steht — der gespeicherte Wert allein sagt zu wenig. */
function zugangswegText(q: QuelleZeile): string {
  if (q.typ === "extern_agent") return "eingeliefert";
  const weg = istZugangsweg(q.zugangsweg) ? q.zugangsweg : ZUGANGSWEG_VORGABE;
  if (weg === "automatisch") {
    // Bei "automatisch" ist die Angabe erst nützlich, wenn sie das Ergebnis
    // nennt: Man will wissen, was tatsächlich passiert, nicht wie entschieden
    // wurde.
    return istFeedAdresse(q.url) ? "Feed (erkannt)" : "Webseite (erkannt)";
  }
  return ZUGANGSWEG_TEXT[weg];
}

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
  const [zugangsweg, setZugangsweg] = useState<Zugangsweg>(ZUGANGSWEG_VORGABE);
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
        zugangsweg,
      });
      if (error) throw new Error(error.message);
      setUrl("");
      setHerausgeber("");
      setThemenspezifisch(false);
      setZugangsweg(ZUGANGSWEG_VORGABE);
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
                  <td className="aus">{zugangswegText(q)}</td>
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
          <span>Zugangsweg</span>
          <select
            value={zugangsweg}
            onChange={(e) => setZugangsweg(e.target.value as Zugangsweg)}
          >
            {ZUGANGSWEGE.map((wert) => (
              <option key={wert} value={wert}>{ZUGANGSWEG_TEXT[wert]}</option>
            ))}
          </select>
          <small>{ZUGANGSWEG_HINWEIS[zugangsweg]}</small>
        </label>

        <label className="feld">
          <span>Adresse der Quelle</span>
          <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder={ADRESS_BEISPIEL[zugangsweg]} />
          <small>
            {zugangsweg !== "automatisch"
              ? `Beispiel: ${ADRESS_BEISPIEL[zugangsweg]}`
              : url
                ? istFeedAdresse(url)
                  ? "Wird als Feed gelesen."
                  : "Wird als einzelne Webseite gelesen."
                : ZUGANGSWEG_HINWEIS.automatisch}
          </small>
        </label>

        {(zugangsweg === "suche" || zugangsweg === "gdelt") && !/[?&](q|query)=[^&]/.test(url) && url !== "" && (
          <p className="meldung meldung-schlecht" style={{ marginTop: -8 }}>
            In der Adresse fehlt die Suchfrage
            {zugangsweg === "suche" ? " (Parameter q)" : " (Parameter query)"} — der
            Abruf würde bei jedem Lauf mit einem Fehler enden.
          </p>
        )}

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
