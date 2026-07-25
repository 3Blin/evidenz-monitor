/**
 * Auftrag bearbeiten: Fragestellung, Relevanzregeln, Takt, Freigabe.
 *
 * Die Relevanzregeln sind der Grund, aus dem es dieses Formular gibt: Vorher
 * ließen sie sich nur über die Datenbank ändern, obwohl gerade sie regelmäßig
 * nachgezogen werden müssen (ADR 0008).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseImBrowser } from "@/lib/supabase-browser";
import { begriffslisteAusEingabe } from "@/lib/relevanz";

export interface AuftragVollstaendig {
  readonly id: string;
  readonly name: string;
  readonly zielbeschreibung: string;
  readonly fragestellung: string;
  readonly suchbegriffe: string[];
  readonly pflichtbegriffe: string[];
  readonly ausschlussbegriffe: string[];
  readonly mindest_treffer: number;
  readonly intervall_minuten: number;
  readonly aktiv: boolean;
  readonly oeffentliche_demo: boolean;
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
  const [takt, setTakt] = useState(String(auftrag.intervall_minuten));
  const [aktiv, setAktiv] = useState(auftrag.aktiv);
  const [demo, setDemo] = useState(auftrag.oeffentliche_demo);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);

  async function speichern(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    setLaeuft(true);
    setMeldung(null);
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
          intervall_minuten: Math.max(15, Number.parseInt(takt, 10) || 360),
          aktiv,
          oeffentliche_demo: demo,
        })
        .eq("id", auftrag.id);
      if (error) throw new Error(error.message);
      setMeldung({
        gut: true,
        text: "Gespeichert. Wirksam wird es beim nächsten Auswertungslauf (npm run auswerten).",
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
      <h2>Auftrag und Relevanzregeln</h2>
      <p className="frage">
        Begriffe durch Komma trennen. Sie treffen am Wortanfang: „KB" findet
        „KB5000001", trifft aber nicht mitten in einem fremden Wort.
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

        <label className="feld">
          <span>Suchbegriffe</span>
          <textarea rows={2} value={suche} onChange={(e) => setSuche(e.target.value)}
            placeholder="Windows 11, 25H2, Update, KB, Treiber, Bluescreen" />
          <small>Davon müssen mindestens so viele treffen, wie unten eingestellt ist.</small>
        </label>

        <label className="feld">
          <span>Pflichtbegriffe</span>
          <textarea rows={2} value={pflicht} onChange={(e) => setPflicht(e.target.value)}
            placeholder="Windows" />
          <small>
            <b>Alle</b> müssen vorkommen. Der wirksamste Hebel gegen unpassende
            Meldungen. Quellen, die unten als themenspezifisch markiert sind,
            erfüllen diese Begriffe durch ihre Herkunft.
          </small>
        </label>

        <label className="feld">
          <span>Ausschlussbegriffe</span>
          <textarea rows={2} value={ausschluss} onChange={(e) => setAusschluss(e.target.value)}
            placeholder="Anzeige, Werbung" />
          <small>Kommt einer vor, ist der Beitrag draußen — egal was sonst passt.</small>
        </label>

        <label className="feld">
          <span>Nötige Treffer bei den Suchbegriffen</span>
          <input type="number" min={1} max={20} value={mindest}
            onChange={(e) => setMindest(e.target.value)} style={{ maxWidth: 120 }} />
          <small>Höher setzen, wenn einzelne allgemeine Begriffe zu viel hereinlassen.</small>
        </label>

        <label className="feld">
          <span>Abstand zwischen Abrufen (Minuten)</span>
          <input type="number" min={15} max={10080} value={takt}
            onChange={(e) => setTakt(e.target.value)} style={{ maxWidth: 120 }} />
        </label>

        <label className="feld feld-schalter">
          <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
          <span>Auftrag ist aktiv (Quellen werden abgerufen)</span>
        </label>

        <label className="feld feld-schalter">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span>Ohne Anmeldung lesbar (als Demo freigeben)</span>
        </label>
        <small className="frage" style={{ marginTop: -8 }}>
          Freigegebene Aufträge erscheinen für alle in der Auswahl. Nur Aufträge
          freigeben, die keine persönlichen Angaben enthalten.
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
