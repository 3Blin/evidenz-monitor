/**
 * Auftrag bearbeiten: Fragestellung, Relevanzregeln, Takt, Freigabe.
 *
 * Aufbau nach der ersten Rückmeldung geändert. Vorher standen sieben Felder
 * gleichrangig untereinander, beginnend mit einem Hinweis auf Wortanfänge und
 * einer Herstellerkennung - wer das System nicht kennt, sieht dort eine
 * Fachmaske und keine Aufgabe. Jetzt gilt:
 *
 * 1. Zuerst das, was jeder beantworten kann: Name, Frage, Beobachtungsziel.
 * 2. Die Filterregeln sind eingeklappt und nur bei Bedarf zu öffnen.
 * 3. Ein KI-Vorschlag füllt sie auf Wunsch aus und begründet die Wahl.
 *
 * Bewusst nicht versteckt bleiben die Regeln selbst: Sie entscheiden über die
 * Güte des Ergebnisses. Wer sie nie sieht, kann ein schlechtes Ergebnis nicht
 * verbessern - und genau das war der Anlass für ADR 0008.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseImBrowser } from "@/lib/supabase-browser";
import { begriffslisteAusEingabe } from "@/lib/relevanz";
import {
  GROESSTER_TAKT_MINUTEN, KLEINSTER_TAKT_MINUTEN, pruefeBereich, taktInWorten,
} from "@/lib/taktung";

export interface AuftragVollstaendig {
  readonly id: string;
  readonly name: string;
  readonly zielbeschreibung: string;
  readonly fragestellung: string;
  readonly suchbegriffe: string[];
  readonly pflichtbegriffe: string[];
  readonly ausschlussbegriffe: string[];
  readonly mindest_treffer: number;
  readonly intervall_min_minuten: number;
  readonly intervall_max_minuten: number;
  readonly aktueller_takt_minuten: number | null;
  readonly naechster_lauf_am: string | null;
  readonly aktiv: boolean;
  readonly oeffentliche_demo: boolean;
}

interface Quellenvorschlag {
  readonly url: string;
  readonly herausgeber: string;
  readonly typ: string;
  readonly themenspezifisch: boolean;
  readonly begruendung: string;
}

export function AuftragsFormular({ auftrag }: { auftrag: AuftragVollstaendig }) {
  const router = useRouter();
  const [name, setName] = useState(auftrag.name);
  const [frage, setFrage] = useState(auftrag.fragestellung);
  const [ziel, setZiel] = useState(auftrag.zielbeschreibung);
  const [suche, setSuche] = useState(auftrag.suchbegriffe.join(", "));
  const [pflicht, setPflicht] = useState(auftrag.pflichtbegriffe.join(", "));
  const [ausschluss, setAusschluss] = useState(auftrag.ausschlussbegriffe.join(", "));
  const [mindest, setMindest] = useState(String(auftrag.mindest_treffer));
  const [taktMin, setTaktMin] = useState(String(auftrag.intervall_min_minuten));
  const [taktMax, setTaktMax] = useState(String(auftrag.intervall_max_minuten));
  const [aktiv, setAktiv] = useState(auftrag.aktiv);
  const [demo, setDemo] = useState(auftrag.oeffentliche_demo);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);

  // Regeln offen zeigen, sobald welche gesetzt sind - dann sind sie relevant.
  const [regelnOffen, setRegelnOffen] = useState(
    auftrag.suchbegriffe.length + auftrag.pflichtbegriffe.length > 0,
  );
  const [kiLaeuft, setKiLaeuft] = useState(false);
  const [kiBegruendung, setKiBegruendung] = useState<string | null>(null);
  const [kiQuellen, setKiQuellen] = useState<readonly Quellenvorschlag[]>([]);
  const [kiFehler, setKiFehler] = useState<string | null>(null);

  async function vorschlagHolen() {
    setKiLaeuft(true);
    setKiFehler(null);
    setKiBegruendung(null);
    try {
      const antwort = await fetch("/api/v1/ki-vorschlag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, fragestellung: frage, zielbeschreibung: ziel }),
      });
      const daten: unknown = await antwort.json();
      if (!antwort.ok) {
        throw new Error(
          (daten as { fehler?: string }).fehler ?? `Vorschlag fehlgeschlagen (HTTP ${antwort.status})`,
        );
      }
      const v = daten as {
        suchbegriffe: string[]; pflichtbegriffe: string[]; ausschlussbegriffe: string[];
        mindestTreffer: number; begruendung: string; quellen?: Quellenvorschlag[];
      };
      setSuche(v.suchbegriffe.join(", "));
      setPflicht(v.pflichtbegriffe.join(", "));
      setAusschluss(v.ausschlussbegriffe.join(", "));
      setMindest(String(v.mindestTreffer));
      setKiBegruendung(v.begruendung);
      setKiQuellen(v.quellen ?? []);
      setRegelnOffen(true);
    } catch (f) {
      setKiFehler(f instanceof Error ? f.message : String(f));
    } finally {
      setKiLaeuft(false);
    }
  }

  async function quelleUebernehmen(q: Quellenvorschlag) {
    try {
      const supabase = supabaseImBrowser();
      const { error } = await supabase.from("quellen").insert({
        auftrag_id: auftrag.id,
        url: q.url,
        typ: q.typ,
        herausgeber: q.herausgeber,
        themenspezifisch: q.themenspezifisch,
      });
      if (error) throw new Error(error.message);
      setKiQuellen((bisher) => bisher.filter((x) => x.url !== q.url));
      router.refresh();
    } catch (f) {
      setKiFehler(f instanceof Error ? f.message : String(f));
    }
  }

  async function speichern(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    setLaeuft(true);
    setMeldung(null);
    // Vertauschte oder unsinnige Grenzen werden zurechtgerückt, nicht
    // abgewiesen - was gemeint war, ist offensichtlich.
    const bereich = pruefeBereich(
      Number.parseInt(taktMin, 10),
      Number.parseInt(taktMax, 10),
    );
    try {
      const supabase = supabaseImBrowser();
      const { error } = await supabase
        .from("auftraege")
        .update({
          name: name.trim(),
          fragestellung: frage.trim(),
          zielbeschreibung: ziel.trim() || name.trim(),
          suchbegriffe: begriffslisteAusEingabe(suche),
          pflichtbegriffe: begriffslisteAusEingabe(pflicht),
          ausschlussbegriffe: begriffslisteAusEingabe(ausschluss),
          mindest_treffer: Math.max(1, Number.parseInt(mindest, 10) || 1),
          intervall_min_minuten: bereich.minMinuten,
          intervall_max_minuten: bereich.maxMinuten,
          aktiv,
          oeffentliche_demo: demo,
        })
        .eq("id", auftrag.id);
      if (error) throw new Error(error.message);
      setTaktMin(String(bereich.minMinuten));
      setTaktMax(String(bereich.maxMinuten));
      setMeldung({
        gut: true,
        text:
          `Gespeichert. Abruf künftig zwischen alle ${taktInWorten(bereich.minMinuten)}` +
          ` und alle ${taktInWorten(bereich.maxMinuten)}.`,
      });
      router.refresh();
    } catch (f) {
      setMeldung({ gut: false, text: f instanceof Error ? f.message : String(f) });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="abschnitt">
      <h2>Auftrag</h2>
      <p className="frage">
        Beschreibe in Alltagssprache, was beobachtet werden soll. Die
        Filterregeln darunter sind Feinarbeit — sie lassen sich jederzeit
        nachziehen, wenn im Dashboard Unpassendes auftaucht.
      </p>

      <form onSubmit={speichern} className="formular" style={{ maxWidth: 720 }}>
        <label className="feld">
          <span>Name</span>
          <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="feld">
          <span>Fragestellung</span>
          <input required maxLength={400} value={frage} onChange={(e) => setFrage(e.target.value)} />
        </label>

        <label className="feld">
          <span>Was genau beobachten?</span>
          <textarea rows={3} maxLength={2000} value={ziel} onChange={(e) => setZiel(e.target.value)} />
        </label>

        <div className="aufklappbar">
          <button
            type="button"
            className="aufklapp-kopf"
            aria-expanded={regelnOffen}
            onClick={() => setRegelnOffen(!regelnOffen)}
          >
            <span aria-hidden="true">{regelnOffen ? "▾" : "▸"}</span>
            <span>Filterregeln — entscheiden, welche Beiträge einschlägig sind</span>
          </button>

          {regelnOffen && (
            <div className="aufklapp-inhalt">
              <div className="ki-kasten">
                <p>
                  Du musst die Regeln nicht selbst herleiten. Mit einem
                  hinterlegten KI-Zugang entsteht aus Name und Fragestellung ein
                  Vorschlag samt Begründung, den du anschließend änderst.
                </p>
                <button
                  type="button"
                  className="knopf knopf-leise"
                  disabled={kiLaeuft || !name.trim() || !frage.trim()}
                  onClick={() => void vorschlagHolen()}
                >
                  {kiLaeuft ? "KI denkt nach …" : "Vorschlag von der KI"}
                </button>
                {kiFehler && <p className="meldung meldung-schlecht">{kiFehler}</p>}
                {kiBegruendung && (
                  <p className="ki-begruendung">
                    <b>Begründung der KI:</b> {kiBegruendung} — Vorschlag geprüft?
                    Dann unten speichern.
                  </p>
                )}
                {kiQuellen.length > 0 && (
                  <div className="ki-quellen">
                    <p>
                      <b>Vorgeschlagene Quellen.</b> Ungeprüft — die KI kann
                      Adressen erfinden. Übernimm nur, was du kennst; ob eine
                      Adresse trägt, zeigt der nächste Sammellauf.
                    </p>
                    <ul>
                      {kiQuellen.map((q) => (
                        <li key={q.url}>
                          <a className="verweis" href={q.url} target="_blank" rel="noopener noreferrer">
                            {q.herausgeber}
                          </a>{" "}
                          <span className="aus">{q.url}</span>
                          {q.begruendung && <div className="aus">{q.begruendung}</div>}
                          <button
                            type="button"
                            className="knopf knopf-leise knopf-klein"
                            onClick={() => void quelleUebernehmen(q)}
                          >
                            Als Quelle anlegen
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <label className="feld">
                <span>Suchbegriffe</span>
                <textarea rows={2} value={suche} onChange={(e) => setSuche(e.target.value)} />
                <small>
                  Wörter, die in einem einschlägigen Beitrag vorkommen können.
                  Mehrere durch Komma trennen. Es genügt, wenn so viele davon
                  vorkommen, wie unten eingestellt ist.
                </small>
              </label>

              <label className="feld">
                <span>Pflichtbegriffe</span>
                <textarea rows={2} value={pflicht} onChange={(e) => setPflicht(e.target.value)} />
                <small>
                  <b>Alle</b> müssen vorkommen — das wirksamste Mittel gegen
                  Beiträge, die nichts mit dem Thema zu tun haben. Sparsam
                  einsetzen: Jeder zusätzliche Pflichtbegriff sortiert auch
                  richtige Beiträge aus. Quellen, die in der Quellenliste als
                  themenspezifisch markiert sind, erfüllen sie durch ihre Herkunft.
                </small>
              </label>

              <label className="feld">
                <span>Ausschlussbegriffe</span>
                <textarea rows={2} value={ausschluss} onChange={(e) => setAusschluss(e.target.value)} />
                <small>Kommt einer davon vor, ist der Beitrag draußen — egal was sonst passt.</small>
              </label>

              <label className="feld">
                <span>Nötige Treffer bei den Suchbegriffen</span>
                <input type="number" min={1} max={20} value={mindest}
                  onChange={(e) => setMindest(e.target.value)} style={{ maxWidth: 120 }} />
                <small>
                  Erhöhen, wenn einzelne allgemeine Begriffe zu viel hereinlassen.
                </small>
              </label>

              <p className="feld-hinweis">
                Begriffe treffen am Wortanfang: Ein kurzer Wortstamm findet auch
                seine längeren Formen, mitten in einem fremden Wort trifft er nicht.
              </p>
            </div>
          )}
        </div>

        <fieldset className="feld-gruppe">
          <legend>Wie oft abrufen?</legend>
          <p className="feld-hinweis">
            Kein fester Wert, sondern ein Bereich: Bringt ein Abruf neue
            Beiträge, rückt der Takt zur Untergrenze; bleibt er leer, zur
            Obergrenze. So bekommt ein schnelllebiges Thema von selbst mehr
            Aufmerksamkeit als ein ruhiges — ohne dass du nachstellen musst.
          </p>
          <div className="feld-paar">
            <label className="feld">
              <span>Mindestens alle … Minuten</span>
              <input type="number" min={KLEINSTER_TAKT_MINUTEN} max={GROESSTER_TAKT_MINUTEN}
                value={taktMin} onChange={(e) => setTaktMin(e.target.value)} />
              <small>Schnellster Takt. Unter {KLEINSTER_TAKT_MINUTEN} Minuten nicht möglich.</small>
            </label>
            <label className="feld">
              <span>Höchstens alle … Minuten</span>
              <input type="number" min={KLEINSTER_TAKT_MINUTEN} max={GROESSTER_TAKT_MINUTEN}
                value={taktMax} onChange={(e) => setTaktMax(e.target.value)} />
              <small>Langsamster Takt bei anhaltendem Leerlauf.</small>
            </label>
          </div>
          <p className="feld-hinweis">
            {auftrag.aktueller_takt_minuten
              ? `Derzeit: alle ${taktInWorten(auftrag.aktueller_takt_minuten)}.`
              : "Noch nie abgerufen — der erste Lauf erfolgt an der Untergrenze."}
            {auftrag.naechster_lauf_am &&
              ` Nächster Abruf frühestens ${new Date(auftrag.naechster_lauf_am).toLocaleString("de-DE")}.`}
          </p>
        </fieldset>

        <label className="feld feld-schalter">
          <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
          <span>Auftrag ist aktiv (Quellen werden abgerufen)</span>
        </label>

        <label className="feld feld-schalter">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span>Ohne Anmeldung lesbar (als Demo freigeben)</span>
        </label>
        <small className="frage" style={{ marginTop: -8 }}>
          Freigegebene Aufträge erscheinen für alle in der Auswahl und lassen sich
          von anderen übernehmen. Nur freigeben, was keine persönlichen Angaben
          enthält.
        </small>

        <div className="feld-reihe">
          <button type="submit" className="knopf" disabled={laeuft}>
            {laeuft ? "Wird gespeichert …" : "Speichern"}
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
