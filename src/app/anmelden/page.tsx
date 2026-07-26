/**
 * Anmeldeseite: Magic Link per E-Mail (ADR 0009).
 *
 * Kein Passwort - der Nutzer bekommt einen Anmeldelink zugeschickt. Damit gibt
 * es kein Passwort, das schlecht gewählt, wiederverwendet oder gestohlen werden
 * kann, und kein Zurücksetzen-Verfahren, das selbst zur Schwachstelle wird.
 */
"use client";

import { useState } from "react";
import { supabaseImBrowser } from "@/lib/supabase-browser";

type Zustand = { art: "ruht" } | { art: "sendet" } | { art: "gesendet" } | { art: "fehler"; text: string };

export default function Anmelden() {
  const [email, setEmail] = useState("");
  const [zustand, setZustand] = useState<Zustand>({ art: "ruht" });

  async function absenden(ereignis: React.FormEvent) {
    ereignis.preventDefault();
    setZustand({ art: "sendet" });
    try {
      const supabase = supabaseImBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/bestaetigen` },
      });
      if (error) throw new Error(error.message);
      setZustand({ art: "gesendet" });
    } catch (fehler) {
      setZustand({
        art: "fehler",
        text: fehler instanceof Error ? fehler.message : "Unbekannter Fehler",
      });
    }
  }

  return (
    <main className="huelle">
      <p className="eyebrow">EVIDENZ-MONITOR</p>
      <h1>Anmelden</h1>

      {zustand.art === "gesendet" ? (
        <>
          <p className="frage">
            Der Anmeldelink ist an <b>{email}</b> unterwegs. Er gilt für kurze Zeit
            und funktioniert nur einmal.
          </p>
          <p className="frage" style={{ marginTop: 12 }}>
            Kein Link angekommen? Auch den Spam-Ordner ansehen — und prüfen, ob die
            Adresse stimmt.
          </p>
        </>
      ) : (
        <>
          <p className="frage">
            Wir schicken einen Anmeldelink per E-Mail. Ein Passwort brauchst du nicht.
          </p>
          <form onSubmit={absenden} className="formular" style={{ marginTop: 20, maxWidth: 420 }}>
            <label className="feld">
              <span>E-Mail-Adresse</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@beispiel.de"
              />
            </label>
            <button type="submit" className="knopf" disabled={zustand.art === "sendet"}>
              {zustand.art === "sendet" ? "Wird gesendet …" : "Anmeldelink schicken"}
            </button>
          </form>
          {zustand.art === "fehler" && (
            <p className="frage warnung" style={{ marginTop: 14 }}>
              Anmeldung nicht möglich: {zustand.text}
            </p>
          )}
        </>
      )}

      <p className="frage" style={{ marginTop: 28 }}>
        <a href="/" className="verweis">Zurück zur Übersicht</a>
      </p>
    </main>
  );
}
