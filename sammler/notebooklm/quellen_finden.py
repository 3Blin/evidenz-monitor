#!/usr/bin/env python3
"""Quellen zu einer Fragestellung finden - mit NotebookLM.

Dies ist ein *externer Sammler* im Sinne von ADR 0002: Er läuft auf deinem
Rechner, nicht auf der Plattform, und die Plattform weiß nichts von ihm. Der
Grund steht in ADR 0013, kurz gefasst:

  Dieses Werkzeug meldet sich mit deinem **Google-Konto** an, nicht mit einem
  eng begrenzten Schlüssel. Ein solches Geheimnis gehört nicht auf einen
  Server, den du nicht selbst in der Hand hast.

Was das Skript tut:

  1. Legt in deinem NotebookLM ein Notizbuch an (oder benutzt ein vorhandenes).
  2. Startet dort eine Web-Recherche zu deiner Fragestellung.
  3. Wartet, bis sie fertig ist, und schreibt die **gefundenen Adressen** in
     eine Datei.

Was es ausdrücklich NICHT tut: nichts in deinen Beobachtungsauftrag eintragen.
Die Datei ist ein Vorschlag. Übernommen wird in der Verwaltung, von Hand, Stück
für Stück - denn eine Quelle bestimmt, was du künftig zu sehen bekommst.

Aufruf:

    python quellen_finden.py --frage "Wer wird nächster Bundesverkehrsminister?"

Vollständige Anleitung: siehe README.md in diesem Verzeichnis.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

try:
    from notebooklm import NotebookLMClient
except ImportError:  # pragma: no cover - nur ohne Installation erreichbar
    sys.exit(
        "Das Paket notebooklm-py fehlt.\n"
        "  python -m venv .venv && . .venv/bin/activate\n"
        "  pip install -r requirements.txt"
    )

# Gegen diese Fassung ist das Skript geschrieben und geprüft. Die Bibliothek
# spricht eine undokumentierte Schnittstelle von Google; ändert Google etwas,
# ändert sich auch sie. Steht hier, damit im Fehlerfall klar ist, wogegen
# geprüft wurde.
GEPRUEFT_GEGEN = "notebooklm-py 0.7.3"


def herausgeber_aus_adresse(url: str) -> str:
    """Ein brauchbarer Name für die Quelle, abgeleitet aus ihrer Adresse."""
    try:
        rechner = urlparse(url).hostname or ""
    except ValueError:
        return "Unbekannt"
    rechner = rechner.removeprefix("www.")
    return rechner or "Unbekannt"


async def finde_quellen(
    frage: str,
    *,
    notizbuch_titel: str,
    modus: str,
    zeitgrenze: float,
) -> dict:
    """Führt die Recherche aus und gibt die Fundstellen zurück."""
    async with await NotebookLMClient.from_storage() as client:
        notizbuch = await client.notebooks.create(notizbuch_titel)
        print(f"Notizbuch angelegt: {notizbuch_titel}", file=sys.stderr)

        start = await client.research.start(notizbuch.id, frage, source="web", mode=modus)
        if start is None:
            raise RuntimeError(
                "NotebookLM hat keine Recherche gestartet. "
                "Meist heißt das: Die Fragestellung war zu unbestimmt."
            )
        print(f"Recherche laeuft (Modus {modus}) …", file=sys.stderr)

        aufgabe = await client.research.wait_for_completion(
            notizbuch.id, start.task_id, timeout=zeitgrenze, interval=5
        )

        if aufgabe.status != "COMPLETED":
            raise RuntimeError(
                f"Die Recherche endete mit dem Zustand {aufgabe.status}. "
                "Bei FAILED hilft meist eine anders formulierte Frage."
            )

        gefunden: list[dict[str, str]] = []
        gesehen: set[str] = set()
        for quelle in aufgabe.sources:
            adresse = (quelle.url or "").strip()
            if not adresse or adresse in gesehen:
                continue
            gesehen.add(adresse)
            gefunden.append(
                {
                    "url": adresse,
                    "titel": (quelle.title or "").strip() or adresse,
                    "herausgeber": herausgeber_aus_adresse(adresse),
                }
            )

        return {
            "erzeugtAm": datetime.now(timezone.utc).isoformat(),
            "frage": frage,
            "werkzeug": f"{GEPRUEFT_GEGEN} · Research/web · Modus {modus}",
            "notizbuch": notizbuch.id,
            "zusammenfassung": (aufgabe.summary or "").strip(),
            "quellen": gefunden,
        }


def main() -> int:
    zerleger = argparse.ArgumentParser(
        description="Findet über NotebookLM Quellen zu einer Fragestellung.",
    )
    zerleger.add_argument("--frage", required=True, help="Die Fragestellung des Auftrags")
    zerleger.add_argument(
        "--notizbuch",
        default=None,
        help="Titel des NotebookLM-Notizbuchs (Vorgabe: aus der Frage gebildet)",
    )
    zerleger.add_argument(
        "--modus",
        choices=["fast", "deep"],
        default="fast",
        help="fast: rund eine Minute. deep: gruendlicher, dauert deutlich laenger.",
    )
    zerleger.add_argument(
        "--zeitgrenze",
        type=float,
        default=1800.0,
        help="Abbruch nach so vielen Sekunden (Vorgabe: 1800)",
    )
    zerleger.add_argument(
        "--ausgabe",
        default="quellenvorschlaege.json",
        help="Zieldatei (Vorgabe: quellenvorschlaege.json)",
    )
    argumente = zerleger.parse_args()

    titel = argumente.notizbuch or f"Evidenz-Monitor: {argumente.frage[:80]}"

    try:
        ergebnis = asyncio.run(
            finde_quellen(
                argumente.frage,
                notizbuch_titel=titel,
                modus=argumente.modus,
                zeitgrenze=argumente.zeitgrenze,
            )
        )
    except KeyboardInterrupt:
        print("Abgebrochen.", file=sys.stderr)
        return 130
    except Exception as fehler:  # noqa: BLE001 - die Ursache soll lesbar sein
        print(f"\nFehlgeschlagen: {fehler}", file=sys.stderr)
        print(
            "\nHaeufige Ursachen:\n"
            "  * Nicht angemeldet - zuerst 'notebooklm login' ausfuehren.\n"
            f"  * Google hat die Schnittstelle geaendert (geprueft gegen {GEPRUEFT_GEGEN}).\n"
            "  * Zeitgrenze zu knapp - mit --zeitgrenze erhoehen.",
            file=sys.stderr,
        )
        return 1

    ziel = Path(argumente.ausgabe)
    ziel.write_text(json.dumps(ergebnis, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{len(ergebnis['quellen'])} Quellen gefunden:\n")
    for quelle in ergebnis["quellen"]:
        print(f"  {quelle['herausgeber']:<28} {quelle['titel'][:60]}")
        print(f"  {'':<28} {quelle['url']}")
    print(f"\nGeschrieben nach: {ziel.resolve()}")
    print(
        "\nSo geht es weiter: Den Inhalt dieser Datei in der Verwaltung unter\n"
        "'Quellen aus einer Recherche uebernehmen' einfuegen und dort auswaehlen,\n"
        "welche Quellen tatsaechlich angelegt werden sollen."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
