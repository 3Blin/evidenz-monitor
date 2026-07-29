"use client";
/**
 * Quellen aus einer Recherchedatei übernehmen (ADR 0013).
 *
 * Der Gegenpart zum externen Sammler in `sammler/notebooklm/`. Der Sammler
 * läuft auf dem Rechner der Nutzerin - mit ihrem Google-Konto, das auf keinem
 * Server liegen soll - und schreibt eine Datei. Hier wird sie eingefügt.
 *
 * Der Umweg über eine Datei ist Absicht und kein fehlendes Stück: Die
 * Plattform bekommt so nie Zugangsdaten zu einem fremden Dienst zu sehen.
 *
 * Zweite Absicht: Nichts wird von selbst angelegt. Eine Quelle bestimmt, was
 * künftig im Dashboard erscheint - diese Entscheidung trifft ein Mensch, je
 * Eintrag.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseImBrowser } from "@/lib/supabase-browser";
import { leseVorschlagsdatei, type Vorschlagsdatei } from "@/lib/quellen/vorschlagsdatei";

const TYPEN = [
  ["fachmedium", "Fachmedium"],
  ["hersteller_offiziell", "Hersteller (offiziell)"],
  ["status_seite", "Status-Seite"],
  ["forum", "Forum"],
  ["community", "Community"],
  ["rss", "Feed (sonstiges)"],
  ["sonstige", "Sonstiges"],
] as const;

export function QuellenEinfuegen({ auftragId }: { auftragId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [gelesen, setGelesen] = useState<Vorschlagsdatei | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Record<string, boolean>>({});
  const [typen, setTypen] = useState<Record<string, string>>({});
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const [offen, setOffen] = useState(false);

  function pruefen() {
    setMeldung(null);
    try {
      const datei = leseVorschlagsdatei(text);
      setGelesen(datei);
      // Nichts ist vorausgewählt. Wer alles will, wählt alles - aber bewusst.
      setGewaehlt({});
      setTypen(
        Object.fromEntries(datei.quellen.map((q) => [q.url, q.istFeed ? "rss" : "fachmedium"])),
      );
      if (datei.quellen.length === 0) {
        setMeldung({ gut: false, text: "Die Datei enthält keine brauchbaren Adressen." });
      }
    } catch (f) {
      setGelesen(null);
      setMeldung({ gut: false, text: f instanceof Error ? f.message : String(f) });
    }
  }

  async function anlegen() {
    if (!gelesen) return;
    const auswahl = gelesen.quellen.filter((q) => gewaehlt[q.url]);
    if (auswahl.length === 0) {
      setMeldung({ gut: false, text: "Keine Quelle ausgewählt." });
      return;
    }
    setLaeuft(true);
    setMeldung(null);
    try {
      const supabase = supabaseImBrowser();
      const { error } = await supabase.from("quellen").insert(
        auswahl.map((q) => ({
          auftrag_id: auftragId,
          url: q.url,
          herausgeber: q.herausgeber,
          typ: typen[q.url] ?? "fachmedium",
        })),
      );
      if (error) throw new Error(error.message);
      setMeldung({
        gut: true,
        text:
          `${auswahl.length} ${auswahl.length === 1 ? "Quelle" : "Quellen"} angelegt. ` +
          "Ob eine Adresse trägt, zeigt der nächste Sammellauf.",
      });
      setGelesen(null);
      setText("");
      router.refresh();
    } catch (f) {
      setMeldung({ gut: false, text: f instanceof Error ? f.message : String(f) });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="abschnitt">
      <button
        type="button"
        className="aufklapp-kopf"
        aria-expanded={offen}
        onClick={() => setOffen(!offen)}
        style={{ background: "none", padding: 0 }}
      >
        <span aria-hidden="true">{offen ? "▾" : "▸"}</span>
        <span>Quellen aus einer Recherche übernehmen</span>
      </button>

      {offen && (
        <>
          <p className="frage" style={{ marginTop: 12 }}>
            Für die Suche nach passenden Quellen gibt es unter{" "}
            <code>sammler/notebooklm/</code> ein Skript, das auf deinem Rechner
            läuft und eine Datei schreibt. Deren Inhalt fügst du hier ein. Der
            Umweg über die Datei ist Absicht: So kommen deine Zugangsdaten zu
            fremden Diensten nie auf diesen Server.
          </p>

          <label className="feld">
            <span>Inhalt von quellenvorschlaege.json</span>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='{"frage": "…", "quellen": [ … ]}'
            />
          </label>

          <div className="feld-reihe">
            <button type="button" className="knopf knopf-leise" onClick={pruefen} disabled={!text.trim()}>
              Prüfen
            </button>
          </div>

          {gelesen && gelesen.quellen.length > 0 && (
            <>
              <p className="frage" style={{ marginTop: 16 }}>
                {gelesen.quellen.length} Vorschläge
                {gelesen.frage && ` zur Frage „${gelesen.frage}“`}
                {gelesen.werkzeug && ` · gefunden mit ${gelesen.werkzeug}`}. Keine
                davon ist geprüft — wähle aus, was du kennst oder für belastbar hältst.
              </p>
              {gelesen.hinweise.map((h) => (
                <p key={h} className="meldung meldung-schlecht">{h}</p>
              ))}

              <div className="tabelle-rollbar">
                <table className="tabelle">
                  <thead>
                    <tr>
                      <th />
                      <th>QUELLE</th>
                      <th>ART</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gelesen.quellen.map((q) => (
                      <tr key={q.url}>
                        <td>
                          <input
                            type="checkbox"
                            checked={gewaehlt[q.url] ?? false}
                            aria-label={`${q.herausgeber} übernehmen`}
                            onChange={(e) =>
                              setGewaehlt({ ...gewaehlt, [q.url]: e.target.checked })
                            }
                          />
                        </td>
                        <td>
                          <b>{q.herausgeber}</b>
                          {q.istFeed && <span className="marke marke-an" style={{ marginLeft: 8 }}>Feed</span>}
                          <div className="aus">{q.titel}</div>
                          <a className="verweis aus" href={q.url} target="_blank" rel="noopener noreferrer">
                            {q.url}
                          </a>
                        </td>
                        <td>
                          <select
                            value={typen[q.url] ?? "fachmedium"}
                            aria-label={`Art von ${q.herausgeber}`}
                            onChange={(e) => setTypen({ ...typen, [q.url]: e.target.value })}
                          >
                            {TYPEN.map(([wert, beschriftung]) => (
                              <option key={wert} value={wert}>{beschriftung}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="feld-reihe" style={{ marginTop: 14 }}>
                <button type="button" className="knopf" onClick={() => void anlegen()} disabled={laeuft}>
                  {laeuft ? "Wird angelegt …" : "Ausgewählte Quellen anlegen"}
                </button>
                <button
                  type="button"
                  className="knopf knopf-leise"
                  onClick={() =>
                    setGewaehlt(Object.fromEntries(gelesen.quellen.map((q) => [q.url, true])))
                  }
                >
                  Alle auswählen
                </button>
              </div>
            </>
          )}

          {meldung && (
            <p className={meldung.gut ? "meldung meldung-gut" : "meldung meldung-schlecht"}>
              {meldung.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
