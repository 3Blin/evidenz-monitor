/**
 * Anordnung des Quellennetzes.
 *
 * Anlass: In der ersten Fassung lief eine Kräftesimulation ohne Begrenzung.
 * Die Knoten stießen sich gegenseitig ab, trieben aus der Zeichenfläche und
 * am Ende war nur noch ein Teil von ihnen zu sehen - am Telefon einer. Die
 * Fläche war fest, die Anordnung nicht.
 *
 * Die Umkehrung behebt das dauerhaft: Die Anordnung entsteht frei, danach
 * wird der *Ausschnitt* auf das Ergebnis gelegt. Damit ist jeder Knoten immer
 * sichtbar, unabhängig von Bildschirmgröße und Knotenzahl.
 *
 * Bewusst ohne Zufall: Gleiche Eingabe, gleiche Anordnung. Sonst sprängen die
 * Knoten bei jedem Laden der Seite an eine andere Stelle und die Ansicht
 * ließe sich nicht wiedererkennen.
 */

export interface NetzKnoten {
  readonly id: string;
  readonly label: string;
  readonly quellentyp: string;
  readonly gewicht: number;
  readonly offiziell: boolean;
}

export interface NetzKante {
  readonly von: string;
  readonly nach: string;
  readonly art: string;
}

export interface PlatzierterKnoten extends NetzKnoten {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface Ausschnitt {
  readonly x: number;
  readonly y: number;
  readonly breite: number;
  readonly hoehe: number;
}

/** Halbmesser eines Knotens. Fläche wächst mit der Zahl der Beiträge. */
export function radius(gewicht: number): number {
  return 16 + Math.min(24, Math.sqrt(Math.max(0, gewicht)) * 4);
}

/**
 * Ordnet die Knoten an.
 *
 * Verbundene Knoten stehen beieinander, unverbundene verteilen sich auf einem
 * Ring. Das ist keine Kräftesimulation, sondern eine feste Vorschrift - für
 * die Größenordnung dieser Netze (unter hundert Quellen) genügt sie, ist
 * sofort fertig und liefert immer dasselbe Bild.
 */
export function ordneAn(
  knoten: readonly NetzKnoten[],
  kanten: readonly NetzKante[],
  verhaeltnis = 1.7,
): readonly PlatzierterKnoten[] {
  if (knoten.length === 0) return [];

  const gruppen = zusammenhangskomponenten(knoten, kanten);

  // Verbundene Gruppen in die Mitte, Einzelgänger in einen Ring darum.
  //
  // Vorher lag jede Gruppe auf demselben großen Ring - auch jeder einzelne,
  // unverbundene Knoten. Bei sieben Quellen mit einer Dreiergruppe standen die
  // vier Einzelnen dadurch so weit auseinander, dass zwei Drittel der Fläche
  // leer blieben und alles winzig wirkte. Der Kern der Aussage steht jetzt in
  // der Mitte, das Unverbundene außen herum - und beides dicht.
  const verbunden = gruppen.filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
  const einzeln = gruppen.filter((g) => g.length === 1).flatMap((g) => g);

  const platziert: PlatzierterKnoten[] = [];
  let kernRadius = 0;

  if (verbunden.length === 1) {
    const gruppe = verbunden[0];
    if (gruppe) {
      platziert.push(...ordneGruppeAn(gruppe, 0, 0));
      kernRadius = eigenRadiusVon(gruppe) + groessterRadius(gruppe);
    }
  } else if (verbunden.length > 1) {
    // Mehrere Geflechte: selbst auf einem kleinen Ring, eng gesetzt.
    const platzBedarf = verbunden.reduce(
      (summe, g) => summe + eigenRadiusVon(g) * 2 + 70,
      0,
    );
    const innen = Math.max(160, platzBedarf / (Math.PI * 2));
    verbunden.forEach((gruppe, index) => {
      const winkel = (index / verbunden.length) * Math.PI * 2;
      platziert.push(
        ...ordneGruppeAn(gruppe, Math.cos(winkel) * innen, Math.sin(winkel) * innen),
      );
    });
    kernRadius = innen + Math.max(...verbunden.map((g) => eigenRadiusVon(g) + groessterRadius(g)));
  }

  if (einzeln.length > 0) {
    // Der Ring muss den Kern umschließen und zugleich weit genug sein, dass
    // sich die Einzelnen nicht berühren. Es gilt die größere der beiden
    // Bedingungen; alles Weitere wäre nur Leerraum.
    const umfang = einzeln.reduce((summe, k) => summe + radius(k.gewicht) * 2 + 64, 0);
    const ringRadius = Math.max(
      kernRadius + groessterRadius(einzeln) + 96,
      umfang / (Math.PI * 2),
      einzeln.length === 1 ? 0 : 150,
    );
    einzeln.forEach((k, i) => {
      // Ein einzelner Knoten ohne Kern steht in der Mitte, nicht daneben.
      if (einzeln.length === 1 && kernRadius === 0) {
        platziert.push({ ...k, x: 0, y: 0, radius: radius(k.gewicht) });
        return;
      }
      // Um einen halben Schritt versetzt gegen den inneren Ring.
      //
      // Ohne diesen Versatz stehen bei zwei Gruppen und zwei Einzelnen alle
      // vier auf derselben Waagerechten: Zwei Punkte auf einem Kreis liegen
      // einander gegenüber, und beide Kreise begannen beim selben Winkel. Das
      // Ergebnis war kein Netz, sondern eine Reihe - und der Ausschnitt musste
      // in der Höhe mit Leerraum aufgefüllt werden, bis alles winzig war.
      const winkel = ((i + 0.5) / einzeln.length) * Math.PI * 2;
      platziert.push({
        ...k,
        x: Math.cos(winkel) * ringRadius,
        y: Math.sin(winkel) * ringRadius,
        radius: radius(k.gewicht),
      });
    });
  }

  return inForm(platziert, verhaeltnis);
}

/**
 * Bringt die Anordnung in die Form der Zeichenfläche.
 *
 * Die Ringe oben sind Kreise. Ein kreisrundes Bild in einer breiten Karte lässt
 * links und rechts je ein Viertel leer; in einer hohen Karte oben und unten.
 * Beides ist derselbe Fehler, nur gespiegelt - und am Telefon ist er der
 * schlimmere, weil dort ohnehin wenig Platz ist. Genau darauf ging die erste
 * Rückmeldung: "am Handy sehe ich einen".
 *
 * Deshalb wird die längere Achse gedehnt, nie die kürzere gestaucht. Das ist
 * unbedenklich für die Überschneidungsfreiheit: Jeder Abstand auf der gedehnten
 * Achse wächst, jeder auf der anderen bleibt - kein Paar kommt einander näher.
 *
 * Die Obergrenze verhindert, dass ein sehr schmales Fenster die Anordnung zu
 * einer Linie plattdrückt, in der man keine Nachbarschaft mehr erkennt.
 */
export const GROESSTE_DEHNUNG = 2.2;

function inForm(
  knoten: readonly PlatzierterKnoten[],
  verhaeltnis: number,
): readonly PlatzierterKnoten[] {
  if (!Number.isFinite(verhaeltnis) || verhaeltnis <= 0 || knoten.length < 2) return knoten;

  // Gemessen statt angenommen: Welche Achse zu kurz ist, hängt daran, wie die
  // Knoten tatsächlich liegen - und das wechselt mit der Zahl der Gruppen. Eine
  // fest gewählte Achse zu dehnen half in der Hälfte der Fälle nicht.
  let breite = 0;
  let hoehe = 0;
  for (const a of knoten) {
    for (const b of knoten) {
      breite = Math.max(breite, Math.abs(a.x - b.x));
      hoehe = Math.max(hoehe, Math.abs(a.y - b.y));
    }
  }
  if (breite < 1 || hoehe < 1) return knoten;

  const ist = breite / hoehe;
  if (ist < verhaeltnis) {
    const dehnung = Math.min(GROESSTE_DEHNUNG, verhaeltnis / ist);
    return knoten.map((k) => ({ ...k, x: k.x * dehnung }));
  }
  const dehnung = Math.min(GROESSTE_DEHNUNG, ist / verhaeltnis);
  return knoten.map((k) => ({ ...k, y: k.y * dehnung }));
}

function groessterRadius(gruppe: readonly NetzKnoten[]): number {
  return gruppe.length === 0 ? 0 : Math.max(...gruppe.map((k) => radius(k.gewicht)));
}

/**
 * Radius des Kreises, auf dem die Mitglieder einer Gruppe liegen.
 *
 * Die Untergrenze hängt an der Knotengröße und nicht mehr an einer festen Zahl.
 * Vorher standen 120 dort - bei einer Zweiergruppe lagen deren Mitglieder damit
 * 240 Einheiten auseinander, während der Ring der Unverbundenen bei 146 lag.
 * Zwei verbundene Quellen standen also weiter voneinander entfernt als von
 * einer, mit der sie nichts zu tun haben; das Bild sagte das Gegenteil dessen,
 * was gemeint war. Der Test hat es gefunden, nicht das Hinsehen.
 */
function eigenRadiusVon(gruppe: readonly NetzKnoten[]): number {
  if (gruppe.length <= 1) return 0;
  const groesster = groessterRadius(gruppe);
  const umfang = gruppe.length * (groesster * 2 + 46);
  return Math.max(groesster + 24, umfang / (Math.PI * 2));
}

/** Knoten einer Gruppe kreisförmig um ihren Mittelpunkt. */
function ordneGruppeAn(
  gruppe: readonly NetzKnoten[],
  mitteX: number,
  mitteY: number,
): readonly PlatzierterKnoten[] {
  const erster = gruppe[0];
  if (!erster) return [];
  if (gruppe.length === 1) {
    return [{ ...erster, x: mitteX, y: mitteY, radius: radius(erster.gewicht) }];
  }

  // Abstand so wählen, dass sich auch die größten Kreise nicht berühren.
  const eigenRadius = eigenRadiusVon(gruppe);

  return gruppe.map((k, i) => {
    const winkel = (i / gruppe.length) * Math.PI * 2;
    return {
      ...k,
      x: mitteX + Math.cos(winkel) * eigenRadius,
      y: mitteY + Math.sin(winkel) * eigenRadius,
      radius: radius(k.gewicht),
    };
  });
}

/**
 * Ordnet jedem Knoten die Nummer seiner Gruppe zu.
 *
 * Gemeint ist damit dasselbe wie bei `zusammenhangskomponenten`: eine Menge von
 * Quellen, die über Belege miteinander verbunden sind. Für die Einfärbung ist
 * das die aussagekräftigste Einteilung, die sich ohne Sprachverständnis
 * gewinnen lässt - gleiche Farbe heißt "diese Quellen berichten nachweislich
 * über dieselben Vorgänge".
 *
 * Bewusst keine Gemeinschaftserkennung im engeren Sinn (Leiden, Louvain): Die
 * würde innerhalb einer Komponente weiter unterteilen. Bei Netzen dieser Größe
 * gäbe es dafür nichts zu tun, und ein Verfahren einzubauen, dessen Nutzen erst
 * bei tausend Knoten beginnt, wäre Vorratshaltung.
 *
 * Ein Knoten ohne jede Verbindung bekommt OHNE_GRUPPE. Ihm eine eigene Farbe
 * zu geben wäre falsch: Er bildet keine Gruppe, er steht allein. Vier
 * Einzelgänger in vier Farben sahen aus wie vier Befunde, obwohl es keiner
 * war - und sie übertönten die Gruppe, um die es geht.
 *
 * Die Nummern sind stabil: größte Gruppe zuerst, bei Gleichstand nach Kennung.
 * Sonst wechselten die Farben bei jedem Laden der Seite.
 */
export const OHNE_GRUPPE = -1;

export function gruppenNummern(
  knoten: readonly NetzKnoten[],
  kanten: readonly NetzKante[],
): ReadonlyMap<string, number> {
  const gruppen = [...zusammenhangskomponenten(knoten, kanten)].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return (a[0]?.id ?? "").localeCompare(b[0]?.id ?? "");
  });
  const nummern = new Map<string, number>();
  let naechste = 0;
  for (const gruppe of gruppen) {
    if (gruppe.length === 1) {
      for (const k of gruppe) nummern.set(k.id, OHNE_GRUPPE);
      continue;
    }
    for (const k of gruppe) nummern.set(k.id, naechste);
    naechste++;
  }
  return nummern;
}

/** Zerlegt das Netz in Gruppen, die untereinander verbunden sind. */
export function zusammenhangskomponenten(
  knoten: readonly NetzKnoten[],
  kanten: readonly NetzKante[],
): readonly (readonly NetzKnoten[])[] {
  const nachbarn = new Map<string, string[]>();
  for (const k of knoten) nachbarn.set(k.id, []);
  for (const kante of kanten) {
    // Kanten auf unbekannte Knoten übergehen, statt daran zu scheitern.
    if (!nachbarn.has(kante.von) || !nachbarn.has(kante.nach)) continue;
    nachbarn.get(kante.von)?.push(kante.nach);
    nachbarn.get(kante.nach)?.push(kante.von);
  }

  const gesehen = new Set<string>();
  const gruppen: NetzKnoten[][] = [];
  const nachId = new Map(knoten.map((k) => [k.id, k]));

  for (const start of knoten) {
    if (gesehen.has(start.id)) continue;
    const gruppe: NetzKnoten[] = [];
    const offen = [start.id];
    gesehen.add(start.id);
    while (offen.length > 0) {
      const id = offen.pop();
      if (id === undefined) break;
      const k = nachId.get(id);
      if (k) gruppe.push(k);
      for (const n of nachbarn.get(id) ?? []) {
        if (!gesehen.has(n)) {
          gesehen.add(n);
          offen.push(n);
        }
      }
    }
    gruppen.push(gruppe);
  }
  return gruppen;
}

/**
 * Der Ausschnitt, in dem alle Knoten samt Beschriftung Platz haben.
 *
 * Das ist die eigentliche Behebung des Fehlers "Symbole driften auseinander":
 * Nicht die Knoten werden in die Fläche gezwungen, sondern die Fläche wird um
 * die Knoten gelegt.
 */
export function passendeAnsicht(
  knoten: readonly PlatzierterKnoten[],
  rand = 74,
  zielVerhaeltnis?: number,
): Ausschnitt {
  if (knoten.length === 0) {
    return anVerhaeltnisAngleichen(
      { x: -200, y: -140, breite: 400, hoehe: 280 },
      zielVerhaeltnis,
    );
  }

  let linksX = Infinity;
  let obenY = Infinity;
  let rechtsX = -Infinity;
  let untenY = -Infinity;

  for (const k of knoten) {
    linksX = Math.min(linksX, k.x - k.radius);
    obenY = Math.min(obenY, k.y - k.radius);
    rechtsX = Math.max(rechtsX, k.x + k.radius);
    // Unter dem Kreis steht das Namensfeld (Kreisrand + 10, Höhe 20) - dafür
    // etwas mehr Platz, sonst wird es am unteren Rand abgeschnitten.
    untenY = Math.max(untenY, k.y + k.radius + 34);
  }

  return anVerhaeltnisAngleichen(
    {
      x: linksX - rand,
      y: obenY - rand,
      breite: Math.max(1, rechtsX - linksX + rand * 2),
      hoehe: Math.max(1, untenY - obenY + rand * 2),
    },
    zielVerhaeltnis,
  );
}

/**
 * Weitet den Ausschnitt auf das Seitenverhältnis der Zeichenfläche.
 *
 * Ohne das bleibt ein Rest, den man nicht wegbekommt: Eine SVG-Zeichnung passt
 * ihren Ausschnitt in die Fläche ein und lässt an zwei Seiten Leerraum, wenn
 * die Verhältnisse nicht übereinstimmen. In der Karte des Dashboards waren das
 * oben und unten je gut zweihundert Punkte - ein Viertel der Fläche für nichts.
 *
 * Geweitet wird nur, nie beschnitten: Sonst verschwänden Knoten am Rand, und
 * genau das war der Mangel, den passendeAnsicht beheben sollte.
 */
function anVerhaeltnisAngleichen(a: Ausschnitt, zielVerhaeltnis?: number): Ausschnitt {
  if (!zielVerhaeltnis || !Number.isFinite(zielVerhaeltnis) || zielVerhaeltnis <= 0) return a;
  const ist = a.breite / a.hoehe;
  if (Math.abs(ist - zielVerhaeltnis) < 0.01) return a;

  if (ist < zielVerhaeltnis) {
    const breite = a.hoehe * zielVerhaeltnis;
    return { ...a, x: a.x - (breite - a.breite) / 2, breite };
  }
  const hoehe = a.breite / zielVerhaeltnis;
  return { ...a, y: a.y - (hoehe - a.hoehe) / 2, hoehe };
}

/** Ausschnitt nach Vergrößerung und Verschiebung durch die Nutzerin. */
export function verschobeneAnsicht(
  grund: Ausschnitt,
  vergroesserung: number,
  versatzX: number,
  versatzY: number,
): Ausschnitt {
  const faktor = 1 / Math.max(0.2, vergroesserung);
  const breite = grund.breite * faktor;
  const hoehe = grund.hoehe * faktor;
  return {
    // Beim Vergrößern bleibt die Mitte stehen, sonst wanderte das Bild weg.
    x: grund.x + (grund.breite - breite) / 2 + versatzX,
    y: grund.y + (grund.hoehe - hoehe) / 2 + versatzY,
    breite,
    hoehe,
  };
}

/** Ausschnitt als Angabe für das viewBox-Merkmal einer SVG-Zeichnung. */
export function alsViewBox(a: Ausschnitt): string {
  return `${a.x.toFixed(1)} ${a.y.toFixed(1)} ${a.breite.toFixed(1)} ${a.hoehe.toFixed(1)}`;
}

/**
 * Kante als leicht gebogene Linie.
 *
 * Zwei gerade Linien zwischen denselben Punkten liegen übereinander; gebogene
 * fächern auf und bleiben einzeln erkennbar. Die Krümmung ist an die Länge
 * gekoppelt, damit kurze Kanten nicht zu Bögen werden.
 */
export function kantenPfad(
  ax: number, ay: number, bx: number, by: number, staerke = 0.12,
): string {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  // Senkrechte auf der Verbindung - dorthin wird der Scheitel verschoben.
  const dx = bx - ax;
  const dy = by - ay;
  const laenge = Math.hypot(dx, dy) || 1;
  const kx = mx - (dy / laenge) * laenge * staerke;
  const ky = my + (dx / laenge) * laenge * staerke;
  return `M ${ax.toFixed(1)} ${ay.toFixed(1)} Q ${kx.toFixed(1)} ${ky.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

/** Scheitelpunkt derselben Kurve - dort sitzt die Beschriftung. */
export function kantenMitte(
  ax: number, ay: number, bx: number, by: number, staerke = 0.12,
): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const laenge = Math.hypot(dx, dy) || 1;
  // Der Scheitel einer quadratischen Kurve liegt auf halbem Weg zum
  // Steuerpunkt, nicht auf ihm.
  return {
    x: (ax + bx) / 2 - (dy / laenge) * laenge * staerke * 0.5,
    y: (ay + by) / 2 + (dx / laenge) * laenge * staerke * 0.5,
  };
}

/**
 * Breite eines Namensfelds unter einem Knoten.
 *
 * Vorbild ist ein gerahmtes Feld statt freistehenden Textes. Das ist nicht nur
 * Zierde: Der Hintergrund trägt ein Raster, und heller Text darauf ist schwer
 * zu lesen - am Telefon, wo alles kleiner ist, besonders.
 *
 * Gerechnet statt gemessen: In einer SVG-Zeichnung ist die Textbreite erst
 * nach dem Zeichnen bekannt, und bis dahin stünde das Feld an der falschen
 * Stelle. Die Schrift ist eine Festbreitenschrift, deshalb ist die Rechnung
 * genau genug - jedes Zeichen ist gleich breit.
 */
export const ZEICHEN_BREITE = 0.62;
export const FELD_POLSTER = 9;

export function feldBreite(text: string, schriftgroesse = 11): number {
  return text.length * schriftgroesse * ZEICHEN_BREITE + FELD_POLSTER * 2;
}

/** Höchstlänge eines Namens im Feld. Längere werden gekürzt statt umgebrochen. */
export const NAME_HOECHSTLAENGE = 22;

export function gekuerzt(text: string, hoechstens = NAME_HOECHSTLAENGE): string {
  const sauber = text.trim();
  if (sauber.length <= hoechstens) return sauber;
  // Ein abgeschnittener Name mit Auslassungszeichen ist ehrlicher als einer,
  // der einfach endet - man sieht, dass etwas fehlt.
  return `${sauber.slice(0, hoechstens - 1)}…`;
}

/**
 * Passen die Namensfelder nebeneinander, ohne sich zu überdecken?
 *
 * Die Felder haben eine feste Größe auf dem Bildschirm, die Anordnung eine in
 * Zeichnungseinheiten. Am Telefon ist ein Bildschirmpunkt viele
 * Zeichnungseinheiten breit - dort wurden aus lesbaren Feldern plötzlich
 * Balken, die einander überdeckten.
 *
 * Statt eine Bildschirmbreite zu raten, ab der es "wohl passt", wird gerechnet:
 * Wie weit stehen die nächsten Nachbarn auseinander, und wie breit ist das
 * breiteste Feld? Passt es nicht, zeigt die Ansicht den Namen nur noch für den
 * Knoten, auf den gezeigt wird. Weniger Beschriftung ist besser als
 * unleserliche.
 */
export function felderPassen(
  knoten: readonly PlatzierterKnoten[],
  skala: number,
  schriftgroesse = 11,
): boolean {
  if (knoten.length < 2) return true;
  if (!Number.isFinite(skala) || skala <= 0) return true;

  // Ein Feld sitzt unter seinem Knoten: Kreisrand + 10, Höhe 20, beides in
  // Bildschirmpunkten. Zwei Felder können sich senkrecht nur berühren, wenn
  // ihre Knoten näher beieinanderliegen als diese Strecke.
  const senkrechteFreiheit = Math.max(...knoten.map((k) => k.radius)) + 34 * skala;

  let engster = Number.POSITIVE_INFINITY;
  for (let i = 0; i < knoten.length; i++) {
    for (let j = i + 1; j < knoten.length; j++) {
      const a = knoten[i];
      const b = knoten[j];
      if (!a || !b) continue;
      // Zwei Knoten übereinander stören einander nicht - ihre Felder liegen
      // untereinander. Nur der waagerechte Abstand entscheidet.
      if (Math.abs(a.y - b.y) > senkrechteFreiheit) continue;
      engster = Math.min(engster, Math.abs(a.x - b.x));
    }
  }
  if (!Number.isFinite(engster)) return true;

  const breitestes = Math.max(
    ...knoten.map((k) => feldBreite(gekuerzt(k.label), schriftgroesse)),
  );
  return breitestes * skala <= engster;
}
