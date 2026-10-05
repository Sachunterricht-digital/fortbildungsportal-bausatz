/**
 * QR-Code-Erzeugung nach ISO/IEC 18004.
 *
 * Bewusst ohne Fremdbibliothek: Der Aushang ist die einzige Stelle, die einen
 * QR-Code braucht, und eine Abhängigkeit weniger ist eine Abhängigkeit weniger
 * im Sicherheits- und Wartungsaufwand. Die Umsetzung wird in
 * scripts/pruefungen.ts gegen einen echten Decoder geprüft — ein selbst
 * gebauter Encoder ohne Gegenprobe wäre fahrlässig.
 *
 * Unterstützt wird der Byte-Modus (UTF-8) in den Versionen 1 bis 15. Das
 * genügt für Adressen bis 220 Zeichen selbst bei der höchsten Fehlerkorrektur.
 */

export type FehlerKorrektur = "L" | "M" | "Q" | "H";

/** Bitmuster der Korrekturstufe im Formatfeld. */
const EC_BITS: Record<FehlerKorrektur, number> = { L: 1, M: 0, Q: 3, H: 2 };

/**
 * Blockaufteilung je Version und Korrekturstufe:
 * [Korrekturcodewörter je Block, Blöcke Gruppe 1, Datenwörter Gruppe 1,
 *  Blöcke Gruppe 2, Datenwörter Gruppe 2]
 *
 * Quelle: ISO/IEC 18004, Tabelle 9. Nur die tatsächlich genutzten Stufen sind
 * hinterlegt — für den Aushang ist das ausschließlich H.
 */
const BLOECKE: Record<FehlerKorrektur, Array<[number, number, number, number, number]>> = {
  H: [
    [17, 1, 9, 0, 0],
    [28, 1, 16, 0, 0],
    [22, 2, 13, 0, 0],
    [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12],
    [28, 4, 15, 0, 0],
    [26, 4, 13, 1, 14],
    [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13],
    [28, 6, 15, 2, 16],
    [24, 3, 12, 8, 13],
    [28, 7, 14, 4, 15],
    [22, 12, 11, 4, 12],
    [24, 11, 12, 5, 13],
    [24, 11, 12, 7, 13],
  ],
  Q: [
    [13, 1, 13, 0, 0],
    [22, 1, 22, 0, 0],
    [18, 2, 17, 0, 0],
    [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16],
    [24, 4, 19, 0, 0],
    [18, 2, 14, 4, 15],
    [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17],
    [24, 6, 19, 2, 20],
    [28, 4, 22, 4, 23],
    [26, 4, 20, 6, 21],
    [24, 8, 20, 4, 21],
    [20, 11, 16, 5, 17],
    [30, 5, 24, 7, 25],
  ],
  M: [
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44],
    [30, 1, 50, 4, 51],
    [22, 6, 36, 2, 37],
    [22, 8, 37, 1, 38],
    [24, 4, 40, 5, 41],
    [24, 5, 41, 5, 42],
  ],
  L: [
    [7, 1, 19, 0, 0],
    [10, 1, 34, 0, 0],
    [15, 1, 55, 0, 0],
    [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0],
    [20, 2, 78, 0, 0],
    [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0],
    [18, 2, 68, 2, 69],
    [20, 4, 81, 0, 0],
    [24, 2, 92, 2, 93],
    [26, 4, 107, 0, 0],
    [30, 3, 115, 1, 116],
    [22, 5, 87, 1, 88],
  ],
};

/** Mittelpunkte der Ausrichtungsmuster je Version (Index 0 = Version 1). */
const AUSRICHTUNG: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
];

// ---------------------------------------------------------------------------
// Rechnen im Galois-Feld GF(256)
// ---------------------------------------------------------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

for (let i = 0, x = 1; i < 255; i += 1) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d; // primitives Polynom x⁸+x⁴+x³+x²+1
}
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]!;

function mal(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!;
}

/** Generatorpolynom g(x) = ∏(x + α^i) für n Korrekturcodewörter. */
function generator(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i += 1) {
    const naechst = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j += 1) {
      naechst[j] ^= g[j]!;
      naechst[j + 1] ^= mal(g[j]!, EXP[i]!);
    }
    g = naechst;
  }
  return g;
}

/** Reed-Solomon-Rest über die Datencodewörter. */
function korrekturWoerter(daten: number[], anzahl: number): number[] {
  const g = generator(anzahl);
  const rest = [...daten, ...new Array<number>(anzahl).fill(0)];

  for (let i = 0; i < daten.length; i += 1) {
    const faktor = rest[i]!;
    if (faktor === 0) continue;
    for (let j = 0; j < g.length; j += 1) {
      rest[i + j] ^= mal(g[j]!, faktor);
    }
  }

  return rest.slice(daten.length);
}

// ---------------------------------------------------------------------------
// Kodierung
// ---------------------------------------------------------------------------

function datenCodewoerter(version: number, stufe: FehlerKorrektur): number {
  const [ec, b1, d1, b2, d2] = BLOECKE[stufe][version - 1]!;
  void ec;
  return b1 * d1 + b2 * d2;
}

/** Kleinste Version, in die der Text passt. */
function passendeVersion(bytes: number, stufe: FehlerKorrektur): number {
  for (let version = 1; version <= 15; version += 1) {
    const kopf = version < 10 ? 12 : 20;
    const platz = datenCodewoerter(version, stufe) * 8 - kopf;
    if (bytes * 8 <= platz) return version;
  }
  throw new Error(
    `Der Text ist mit Fehlerkorrektur ${stufe} zu lang für einen QR-Code (${bytes} Byte).`,
  );
}

function baueBitfolge(
  daten: Uint8Array,
  version: number,
  stufe: FehlerKorrektur,
): number[] {
  const bits: number[] = [];
  const schreibe = (wert: number, laenge: number) => {
    for (let i = laenge - 1; i >= 0; i -= 1) bits.push((wert >> i) & 1);
  };

  schreibe(0b0100, 4); // Byte-Modus
  schreibe(daten.length, version < 10 ? 8 : 16);
  for (const byte of daten) schreibe(byte, 8);

  const gesamt = datenCodewoerter(version, stufe) * 8;
  schreibe(0, Math.min(4, gesamt - bits.length)); // Abschlusszeichen
  while (bits.length % 8 !== 0) bits.push(0);

  // Auffüllen mit dem vorgeschriebenen Wechselmuster
  const fueller = [0xec, 0x11];
  for (let i = 0; bits.length < gesamt; i += 1) schreibe(fueller[i % 2]!, 8);

  return bits;
}

/** Daten- und Korrekturwörter in Blöcke teilen und verschränken. */
function verschraenke(
  bits: number[],
  version: number,
  stufe: FehlerKorrektur,
): number[] {
  const [ecLaenge, b1, d1, b2, d2] = BLOECKE[stufe][version - 1]!;

  const woerter: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j]!;
    woerter.push(byte);
  }

  const datenBloecke: number[][] = [];
  const ecBloecke: number[][] = [];
  let position = 0;

  for (const [anzahl, laenge] of [
    [b1, d1],
    [b2, d2],
  ] as const) {
    for (let i = 0; i < anzahl; i += 1) {
      const block = woerter.slice(position, position + laenge);
      position += laenge;
      datenBloecke.push(block);
      ecBloecke.push(korrekturWoerter(block, ecLaenge));
    }
  }

  const ergebnis: number[] = [];
  const maxDaten = Math.max(...datenBloecke.map((b) => b.length));

  for (let i = 0; i < maxDaten; i += 1) {
    for (const block of datenBloecke) if (i < block.length) ergebnis.push(block[i]!);
  }
  for (let i = 0; i < ecLaenge; i += 1) {
    for (const block of ecBloecke) ergebnis.push(block[i]!);
  }

  return ergebnis;
}

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------

type Feld = boolean[][];

function leereMatrix(groesse: number): Feld {
  return Array.from({ length: groesse }, () =>
    new Array<boolean>(groesse).fill(false),
  );
}

/** Zeichnet Sucher, Trenner, Taktmuster und Ausrichtungsmuster. */
function funktionsMuster(version: number): { modul: Feld; belegt: Feld } {
  const groesse = 17 + 4 * version;
  const modul = leereMatrix(groesse);
  const belegt = leereMatrix(groesse);

  const setze = (zeile: number, spalte: number, dunkel: boolean) => {
    modul[zeile]![spalte] = dunkel;
    belegt[zeile]![spalte] = true;
  };

  // Sucher samt Trennstreifen an drei Ecken
  for (const [zeile0, spalte0] of [
    [0, 0],
    [0, groesse - 7],
    [groesse - 7, 0],
  ] as const) {
    for (let z = -1; z <= 7; z += 1) {
      for (let s = -1; s <= 7; s += 1) {
        const zeile = zeile0 + z;
        const spalte = spalte0 + s;
        if (zeile < 0 || zeile >= groesse || spalte < 0 || spalte >= groesse) continue;
        const imRing = z >= 0 && z <= 6 && s >= 0 && s <= 6;
        const dunkel =
          imRing &&
          (z === 0 || z === 6 || s === 0 || s === 6 ||
            (z >= 2 && z <= 4 && s >= 2 && s <= 4));
        setze(zeile, spalte, dunkel);
      }
    }
  }

  // Taktmuster
  for (let i = 8; i < groesse - 8; i += 1) {
    setze(6, i, i % 2 === 0);
    setze(i, 6, i % 2 === 0);
  }

  // Ausrichtungsmuster, außer wo sie die Sucher überdecken würden
  const zentren = AUSRICHTUNG[version - 1]!;
  for (const z of zentren) {
    for (const s of zentren) {
      const beiSucher =
        (z <= 8 && s <= 8) ||
        (z <= 8 && s >= groesse - 9) ||
        (z >= groesse - 9 && s <= 8);
      if (beiSucher) continue;

      for (let dz = -2; dz <= 2; dz += 1) {
        for (let ds = -2; ds <= 2; ds += 1) {
          const rand = Math.max(Math.abs(dz), Math.abs(ds));
          setze(z + dz, s + ds, rand !== 1);
        }
      }
    }
  }

  // Immer dunkles Modul
  setze(4 * version + 9, 8, true);

  // Plätze für die Formatinformation freihalten
  for (let i = 0; i < 9; i += 1) {
    if (!belegt[8]![i]) belegt[8]![i] = true;
    if (!belegt[i]![8]) belegt[i]![8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    belegt[8]![groesse - 1 - i] = true;
    belegt[groesse - 1 - i]![8] = true;
  }

  // Ab Version 7 zusätzlich die Versionsinformation
  if (version >= 7) {
    const bits = versionsBits(version);
    for (let i = 0; i < 18; i += 1) {
      const dunkel = ((bits >> i) & 1) === 1;
      const zeile = Math.floor(i / 3);
      const spalte = groesse - 11 + (i % 3);
      setze(zeile, spalte, dunkel);
      setze(spalte, zeile, dunkel);
    }
  }

  return { modul, belegt };
}

/** BCH-gesicherte Versionsinformation (18 Bit). */
function versionsBits(version: number): number {
  let rest = version << 12;
  for (let i = 5; i >= 0; i -= 1) {
    if ((rest >> (12 + i)) & 1) rest ^= 0x1f25 << i;
  }
  return (version << 12) | rest;
}

/** BCH-gesicherte Formatinformation (15 Bit). */
function formatBits(stufe: FehlerKorrektur, maske: number): number {
  const wert = (EC_BITS[stufe] << 3) | maske;
  let rest = wert << 10;
  for (let i = 4; i >= 0; i -= 1) {
    if ((rest >> (10 + i)) & 1) rest ^= 0x537 << i;
  }
  return ((wert << 10) | rest) ^ 0x5412;
}

const MASKEN: Array<(z: number, s: number) => boolean> = [
  (z, s) => (z + s) % 2 === 0,
  (z) => z % 2 === 0,
  (_z, s) => s % 3 === 0,
  (z, s) => (z + s) % 3 === 0,
  (z, s) => (Math.floor(z / 2) + Math.floor(s / 3)) % 2 === 0,
  (z, s) => ((z * s) % 2) + ((z * s) % 3) === 0,
  (z, s) => (((z * s) % 2) + ((z * s) % 3)) % 2 === 0,
  (z, s) => (((z + s) % 2) + ((z * s) % 3)) % 2 === 0,
];

/** Bewertet eine maskierte Matrix nach den vier Strafregeln der Norm. */
function strafpunkte(modul: Feld): number {
  const n = modul.length;
  let punkte = 0;

  // Regel 1: fünf und mehr gleiche Module in Folge
  for (const wagerecht of [true, false]) {
    for (let a = 0; a < n; a += 1) {
      let laenge = 1;
      for (let b = 1; b < n; b += 1) {
        const jetzt = wagerecht ? modul[a]![b]! : modul[b]![a]!;
        const davor = wagerecht ? modul[a]![b - 1]! : modul[b - 1]![a]!;
        if (jetzt === davor) {
          laenge += 1;
        } else {
          if (laenge >= 5) punkte += 3 + (laenge - 5);
          laenge = 1;
        }
      }
      if (laenge >= 5) punkte += 3 + (laenge - 5);
    }
  }

  // Regel 2: gleichfarbige 2×2-Blöcke
  for (let z = 0; z < n - 1; z += 1) {
    for (let s = 0; s < n - 1; s += 1) {
      const w = modul[z]![s]!;
      if (w === modul[z]![s + 1] && w === modul[z + 1]![s] && w === modul[z + 1]![s + 1]) {
        punkte += 3;
      }
    }
  }

  // Regel 3: sucherähnliche Muster
  const muster1 = [true, false, true, true, true, false, true, false, false, false, false];
  const muster2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (const wagerecht of [true, false]) {
    for (let a = 0; a < n; a += 1) {
      for (let b = 0; b <= n - 11; b += 1) {
        const folge = Array.from({ length: 11 }, (_, i) =>
          wagerecht ? modul[a]![b + i]! : modul[b + i]![a]!,
        );
        if (
          muster1.every((w, i) => w === folge[i]) ||
          muster2.every((w, i) => w === folge[i])
        ) {
          punkte += 40;
        }
      }
    }
  }

  // Regel 4: Abweichung vom hälftigen Schwarzanteil
  const dunkel = modul.flat().filter(Boolean).length;
  const anteil = (dunkel * 100) / (n * n);
  punkte += Math.floor(Math.abs(anteil - 50) / 5) * 10;

  return punkte;
}

/**
 * Erzeugt die Modul-Matrix für einen Text.
 *
 * `true` bedeutet dunkel. Die Ruhezone (vier Module ringsum) ist NICHT
 * enthalten — sie muss beim Zeichnen freigelassen werden, sonst ist der Code
 * nicht lesbar.
 */
export function qrMatrix(
  text: string,
  stufe: FehlerKorrektur = "H",
): { module: Feld; groesse: number; version: number } {
  const daten = new TextEncoder().encode(text);
  const version = passendeVersion(daten.length, stufe);
  const groesse = 17 + 4 * version;

  const woerter = verschraenke(baueBitfolge(daten, version, stufe), version, stufe);
  const { modul: grundmuster, belegt } = funktionsMuster(version);

  // Datenbits im Zickzack von rechts unten nach links oben einsetzen
  const roh = leereMatrix(groesse);
  for (let z = 0; z < groesse; z += 1) roh[z] = [...grundmuster[z]!];

  let bitIndex = 0;
  const naechstesBit = (): boolean => {
    const wort = woerter[bitIndex >> 3];
    const bit = wort === undefined ? 0 : (wort >> (7 - (bitIndex & 7))) & 1;
    bitIndex += 1;
    return bit === 1;
  };

  let richtung = -1;
  let zeile = groesse - 1;

  for (let spalte = groesse - 1; spalte > 0; spalte -= 2) {
    if (spalte === 6) spalte -= 1; // Taktspalte überspringen

    for (;;) {
      for (let versatz = 0; versatz < 2; versatz += 1) {
        const s = spalte - versatz;
        if (!belegt[zeile]![s]) roh[zeile]![s] = naechstesBit();
      }

      zeile += richtung;
      if (zeile < 0 || zeile >= groesse) {
        zeile -= richtung;
        richtung = -richtung;
        break;
      }
    }
  }

  // Alle acht Masken durchrechnen und die unauffälligste nehmen
  let beste: Feld | null = null;
  let besteMaske = 0;
  let bestePunkte = Number.POSITIVE_INFINITY;

  for (let maske = 0; maske < 8; maske += 1) {
    const versuch = roh.map((z) => [...z]);

    for (let z = 0; z < groesse; z += 1) {
      for (let s = 0; s < groesse; s += 1) {
        if (!belegt[z]![s] && MASKEN[maske]!(z, s)) versuch[z]![s] = !versuch[z]![s];
      }
    }

    setzeFormat(versuch, stufe, maske);

    const punkte = strafpunkte(versuch);
    if (punkte < bestePunkte) {
      bestePunkte = punkte;
      beste = versuch;
      besteMaske = maske;
    }
  }

  void besteMaske;
  return { module: beste!, groesse, version };
}

function setzeFormat(modul: Feld, stufe: FehlerKorrektur, maske: number): void {
  const bits = formatBits(stufe, maske);
  const n = modul.length;

  // Die Formatinformation steht zweimal im Code, einmal senkrecht an Spalte 8
  // und einmal waagerecht an Zeile 8. Beide beginnen mit dem NIEDERSTWERTIGEN
  // Bit am Sucher oben links und laufen von dort weg — die Reihenfolge ist in
  // beiden Streifen unterschiedlich herum, deshalb die getrennten Zweige.
  //
  // Das immer dunkle Modul auf (n-8, 8) wird von keinem der beiden Streifen
  // berührt und bleibt stehen.
  for (let i = 0; i < 15; i += 1) {
    const dunkel = ((bits >> i) & 1) === 1;

    // Senkrecht: Zeilen 0–5, dann 7 und 8, dann n-7 bis n-1
    if (i < 6) modul[i]![8] = dunkel;
    else if (i < 8) modul[i + 1]![8] = dunkel;
    else modul[n - 15 + i]![8] = dunkel;

    // Waagerecht: Spalten n-1 bis n-8, dann 7, dann 5 bis 0
    if (i < 8) modul[8]![n - 1 - i] = dunkel;
    else if (i === 8) modul[8]![7] = dunkel;
    else modul[8]![14 - i] = dunkel;
  }
}
