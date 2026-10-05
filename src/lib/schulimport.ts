import { z } from "zod";

export const SCHULIMPORT_MAX_BYTES = 128_000;
export const SCHULIMPORT_MAX_ZEILEN = 500;
export const SCHULIMPORT_SPALTEN = ["schulnummer", "name", "strasse", "ort"] as const;
const textfeld = (maximum: number) => z.string().trim().max(maximum).refine((wert) => !/[\u0000-\u001f\u007f]/.test(wert), "Steuerzeichen oder Zeilenumbrüche im Feld sind nicht erlaubt.");
const SchuleSchema = z.object({
  schulnummer: textfeld(20).regex(/^[0-9A-Za-z./ -]*$/, "Schulnummer enthält unzulässige Zeichen."),
  name: textfeld(150).min(2, "Schulname fehlt oder ist zu kurz."),
  strasse: textfeld(150),
  ort: textfeld(100).min(2, "Ort fehlt oder ist zu kurz."),
});

export type SchulimportDatensatz = z.infer<typeof SchuleSchema>;
export interface SchulimportZeile { zeile: number; daten: SchulimportDatensatz }
export interface SchulimportFehler { zeile: number; meldung: string }
export interface BestehenderSchulort {
  id: string; name: string; ort: string | null; strasse: string | null;
  schulnummer: string | null; istOnline: boolean; aktiv: boolean;
  _count: { fortbildungen: number };
}
export interface SchulimportPlanzeile extends SchulimportZeile {
  aktion: "neu" | "aktualisieren" | "unveraendert";
  id: string | null;
  vorher: BestehenderSchulort | null;
}
export interface SchulimportPlan { zeilen: SchulimportPlanzeile[]; fehler: SchulimportFehler[] }

/** CSV-Zustandsautomat: Semikolon/Komma, BOM, CRLF und doppelte Anführungszeichen. */
function zerlegeCsv(text: string, trenner: string): Array<{ zeile: number; werte: string[] }> {
  const zeilen: Array<{ zeile: number; werte: string[] }> = [];
  let werte: string[] = [], feld = "", zitiert = false, geschlossen = false, zeilennummer = 1, beginn = 1;
  const abschliessen = () => { werte.push(feld); feld = ""; geschlossen = false; };
  for (let i = 0; i < text.length; i++) {
    const zeichen = text[i];
    if (zitiert) {
      if (zeichen === '"') {
        if (text[i + 1] === '"') { feld += '"'; i++; } else { zitiert = false; geschlossen = true; }
      } else { feld += zeichen; if (zeichen === "\n") zeilennummer++; }
      continue;
    }
    if (zeichen === trenner) { abschliessen(); continue; }
    if (zeichen === "\n" || zeichen === "\r") {
      abschliessen();
      if (werte.some((wert) => wert.trim())) zeilen.push({ zeile: beginn, werte });
      if (zeilen.length > SCHULIMPORT_MAX_ZEILEN + 1) throw new Error(`Höchstens ${SCHULIMPORT_MAX_ZEILEN} Schulen je Datei.`);
      werte = []; if (zeichen === "\r" && text[i + 1] === "\n") i++;
      zeilennummer++; beginn = zeilennummer; continue;
    }
    if (geschlossen) { if (zeichen.trim()) throw new Error(`Zeile ${zeilennummer}: Unerwartetes Zeichen nach einem Anführungszeichen.`); continue; }
    if (zeichen === '"') {
      if (feld.trim()) throw new Error(`Zeile ${zeilennummer}: Anführungszeichen im Feld müssen verdoppelt und das Feld muss in Anführungszeichen gesetzt werden.`);
      feld = ""; zitiert = true;
    } else feld += zeichen;
  }
  if (zitiert) throw new Error(`Zeile ${beginn}: Schließendes Anführungszeichen fehlt.`);
  abschliessen();
  if (werte.some((wert) => wert.trim())) zeilen.push({ zeile: beginn, werte });
  return zeilen;
}

function schluessel(wert: string): string { return wert.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE"); }
function ortSchluessel(daten: { name: string; ort: string | null }): string { return JSON.stringify([schluessel(daten.name), schluessel(daten.ort ?? "")]); }

export function leseSchulCsv(text: string): { zeilen: SchulimportZeile[]; fehler: SchulimportFehler[] } {
  const fehler: SchulimportFehler[] = [];
  if (new TextEncoder().encode(text).byteLength > SCHULIMPORT_MAX_BYTES) return { zeilen: [], fehler: [{ zeile: 0, meldung: "Die CSV-Datei darf höchstens 128 KB groß sein." }] };
  const inhalt = text.replace(/^\uFEFF/, "");
  const kopf = inhalt.split(/\r?\n/, 1)[0];
  let roh;
  try { roh = zerlegeCsv(inhalt, kopf.includes(";") ? ";" : ","); }
  catch (error) { return { zeilen: [], fehler: [{ zeile: 0, meldung: (error as Error).message }] }; }
  const spalten = roh.shift()?.werte.map((wert) => wert.trim().toLowerCase()) ?? [];
  if (spalten.length !== SCHULIMPORT_SPALTEN.length || new Set(spalten).size !== spalten.length || !SCHULIMPORT_SPALTEN.every((spalte) => spalten.includes(spalte))) {
    return { zeilen: [], fehler: [{ zeile: 1, meldung: `Die Kopfzeile muss genau diese Spalten enthalten: ${SCHULIMPORT_SPALTEN.join(";")}` }] };
  }
  if (!roh.length) fehler.push({ zeile: 0, meldung: "Die Datei enthält noch keine Schulen. Bitte die Vorlage zuerst befüllen." });
  if (roh.length > SCHULIMPORT_MAX_ZEILEN) return { zeilen: [], fehler: [{ zeile: 0, meldung: `Höchstens ${SCHULIMPORT_MAX_ZEILEN} Schulen je Datei.` }] };
  const zeilen: SchulimportZeile[] = [], nummern = new Set<string>(), namen = new Set<string>();
  for (const eintrag of roh) {
    if (eintrag.werte.length !== spalten.length) { fehler.push({ zeile: eintrag.zeile, meldung: "Die Anzahl der Felder passt nicht zur Kopfzeile." }); continue; }
    const daten = SchuleSchema.safeParse(Object.fromEntries(spalten.map((spalte, i) => [spalte, eintrag.werte[i]])));
    if (!daten.success) { for (const problem of daten.error.issues) fehler.push({ zeile: eintrag.zeile, meldung: `${problem.path.join(".")}: ${problem.message}` }); continue; }
    const nummer = schluessel(daten.data.schulnummer), name = ortSchluessel(daten.data);
    if ((nummer && nummern.has(nummer)) || namen.has(name)) { fehler.push({ zeile: eintrag.zeile, meldung: "Doppelte Schule in der Datei (Schulnummer oder Name und Ort)." }); continue; }
    if (nummer) nummern.add(nummer); namen.add(name);
    zeilen.push({ zeile: eintrag.zeile, daten: daten.data });
  }
  return { zeilen, fehler };
}

/** Keine Löschung, keine automatische Reaktivierung und keine leeren Überschreibungen. */
export function planeSchulimport(csv: string, bestand: BestehenderSchulort[]): SchulimportPlan {
  const gelesen = leseSchulCsv(csv);
  const plan: SchulimportPlan = { zeilen: [], fehler: [...gelesen.fehler] };
  const verwendet = new Set<string>();
  for (const eintrag of gelesen.zeilen) {
    const { daten } = eintrag;
    const nummerTreffer = daten.schulnummer ? bestand.filter((ort) => ort.schulnummer && schluessel(ort.schulnummer) === schluessel(daten.schulnummer)) : [];
    const nameTreffer = bestand.filter((ort) => ortSchluessel(ort) === ortSchluessel(daten));
    if (nummerTreffer.length > 1 || nameTreffer.length > 1 || (nummerTreffer.length && nameTreffer.length && nummerTreffer[0].id !== nameTreffer[0].id)) {
      plan.fehler.push({ zeile: eintrag.zeile, meldung: "Mehrdeutige Zuordnung: Schulnummer und/oder Name verweisen auf mehrere vorhandene Orte." }); continue;
    }
    const vorher = nummerTreffer[0] ?? nameTreffer[0] ?? null;
    if (vorher?.istOnline) { plan.fehler.push({ zeile: eintrag.zeile, meldung: "Der Online-Veranstaltungsort kann nicht als Schule importiert werden." }); continue; }
    if (vorher?.schulnummer && daten.schulnummer && schluessel(vorher.schulnummer) !== schluessel(daten.schulnummer)) {
      plan.fehler.push({ zeile: eintrag.zeile, meldung: "Diese Schule besitzt bereits eine andere Schulnummer. Bitte im Verzeichnis prüfen." }); continue;
    }
    if (vorher && verwendet.has(vorher.id)) { plan.fehler.push({ zeile: eintrag.zeile, meldung: "Mehrere CSV-Zeilen würden denselben vorhandenen Ort ändern." }); continue; }
    if (vorher) verwendet.add(vorher.id);
    const ergaenzt = { ...daten, schulnummer: daten.schulnummer || vorher?.schulnummer || "", strasse: daten.strasse || vorher?.strasse || "" };
    const geaendert = vorher && (Object.keys(ergaenzt) as Array<keyof SchulimportDatensatz>).some((feld) => ergaenzt[feld] !== (vorher[feld] ?? ""));
    plan.zeilen.push({ ...eintrag, daten: ergaenzt, vorher, id: vorher?.id ?? null, aktion: !vorher ? "neu" : geaendert ? "aktualisieren" : "unveraendert" });
  }
  return plan;
}
