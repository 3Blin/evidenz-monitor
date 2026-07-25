/**
 * Kopfzeile mit Auftragsauswahl und Anmeldezustand.
 *
 * Bewusst eine reine Anzeige: Sie trifft keine Zugriffsentscheidung, sondern
 * zeigt nur, was die Datenbank herausgegeben hat.
 */
import type { AuftragsEintrag } from "@/lib/auftragsliste";

interface Eigenschaften {
  readonly auftraege: readonly AuftragsEintrag[];
  readonly aktiv: string;
  readonly nutzer: { readonly email: string } | null;
}

export function Kopfzeile({ auftraege, aktiv, nutzer }: Eigenschaften) {
  return (
    <div className="kopfzeile">
      <nav className="auftragswahl" aria-label="Beobachtungsauftrag wählen">
        {auftraege.length > 1 && <span className="auftragswahl-titel">Aufträge</span>}
        {auftraege.map((a) => (
          <a
            key={a.id}
            href={`/?auftrag=${a.id}`}
            className={a.id === aktiv ? "reiter reiter-aktiv" : "reiter"}
            title={a.fragestellung}
          >
            {a.name}
          </a>
        ))}
      </nav>

      <div className="anmeldezustand">
        {nutzer ? (
          <>
            <a href="/verwalten" className="verweis">Verwalten</a>
            <span className="anmelde-email" title={nutzer.email}>{nutzer.email}</span>
            <form action="/abmelden" method="post">
              <button type="submit" className="knopf knopf-leise">Abmelden</button>
            </form>
          </>
        ) : (
          <a href="/anmelden" className="knopf knopf-leise">Anmelden</a>
        )}
      </div>
    </div>
  );
}
