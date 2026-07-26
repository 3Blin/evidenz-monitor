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
): readonly PlatzierterKnoten[] {
  if (knoten.length === 0) return [];

  const gruppen = zusammenhangskomponenten(knoten, kanten);
  const platziert: PlatzierterKnoten[] = [];

  // Die Gruppen liegen auf einem Ring um die Mitte, die größte innen. So
  // steht das dichteste Geflecht im Blickpunkt.
  const sortiert = [...gruppen].sort((a, b) => b.length - a.length);
  const ringRadius = sortiert.length === 1 ? 0 : 230 + sortiert.length * 26;

  sortiert.forEach((gruppe, index) => {
    const winkel = (index / sortiert.length) * Math.PI * 2 - Math.PI / 2;
    const mitteX = Math.cos(winkel) * ringRadius;
    const mitteY = Math.sin(winkel) * ringRadius;
    platziert.push(...ordneGruppeAn(gruppe, mitteX, mitteY));
  });

  return platziert;
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
  const groesster = Math.max(...gruppe.map((k) => radius(k.gewicht)));
  const umfang = gruppe.length * (groesster * 2 + 46);
  const eigenRadius = Math.max(120, umfang / (Math.PI * 2));

  return gruppe.map((k, i) => {
    const winkel = (i / gruppe.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...k,
      x: mitteX + Math.cos(winkel) * eigenRadius,
      y: mitteY + Math.sin(winkel) * eigenRadius,
      radius: radius(k.gewicht),
    };
  });
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
): Ausschnitt {
  if (knoten.length === 0) return { x: -200, y: -140, breite: 400, hoehe: 280 };

  let linksX = Infinity;
  let obenY = Infinity;
  let rechtsX = -Infinity;
  let untenY = -Infinity;

  for (const k of knoten) {
    linksX = Math.min(linksX, k.x - k.radius);
    obenY = Math.min(obenY, k.y - k.radius);
    rechtsX = Math.max(rechtsX, k.x + k.radius);
    // Unter dem Kreis steht der Name der Quelle - dafür etwas mehr Platz.
    untenY = Math.max(untenY, k.y + k.radius + 20);
  }

  return {
    x: linksX - rand,
    y: obenY - rand,
    breite: Math.max(1, rechtsX - linksX + rand * 2),
    hoehe: Math.max(1, untenY - obenY + rand * 2),
  };
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
