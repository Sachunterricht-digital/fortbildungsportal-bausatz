/**
 * Prüfungen für das Onboarding unter der Terminumfrage (läuft in `npm test`).
 *
 * 1. Schemafälle: Whitelist, Dedupe, Telefon (wie im Profil), „weitere Formate“ aus.
 * 2. Wächter: Die Handynummer ist `Referent.telefon`, es gibt keine zweite
 *    Spalte. `telefon` und die Tabelle `ReferentOnboarding` dürfen nur in den
 *    dafür vorgesehenen Dateien vorkommen. Ein neuer Treffer an anderer Stelle
 *    (Liste, Export, Mail, Umfragetabelle) lässt den Test scheitern.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { OnboardingSchema, zeitenKompakt, ZEITEN } from "@/constants/onboarding";
import { ProfilSchema } from "@/lib/validation/profil";

let fehler = 0;
function pruefe(name: string, ok: boolean, info = "") {
  if (!ok) fehler += 1;
  console.log(`${ok ? "  ok  " : "  FEHL"} ${name}${ok || !info ? "" : `\n         ${info}`}`);
}

const basis = {
  kontaktwege: ["MAIL"],
  telefon: "",
  weitereFormate: false,
  zeiten: [] as string[],
  bemerkung: "",
};

function parse(aenderung: Record<string, unknown>) {
  return OnboardingSchema.safeParse({ ...basis, ...aenderung });
}

function feldImFehler(ergebnis: ReturnType<typeof parse>): string | undefined {
  return ergebnis.success ? undefined : String(ergebnis.error.issues[0]?.path[0]);
}

console.log("Onboarding, Schema");

// Kontaktwege
{
  const ok = parse({ kontaktwege: ["MESSENGER", "MAIL", "MAIL"] });
  pruefe("Kontaktwege: Dedupe und feste Reihenfolge", ok.success && JSON.stringify(ok.data.kontaktwege) === '["MAIL","MESSENGER"]');
  pruefe("Kontaktwege: leer ist erlaubt", parse({ kontaktwege: [] }).success);
  pruefe("Kontaktwege: unbekannter Wert wird abgelehnt", feldImFehler(parse({ kontaktwege: ["FAX"] })) === "kontaktwege");
  pruefe("Kontaktwege: Kleinschreibung wird abgelehnt", !parse({ kontaktwege: ["mail"] }).success);
}

// Telefon (= Referent.telefon, Prüfung wie im Profil: getrimmt, höchstens 40 Zeichen, leer wird null)
for (const gut of ["0151 2345678", "+49 (151) 234-5678", "01781817344", "12345", "0151 2345678 (privat)", "0".repeat(40)]) {
  const r = parse({ telefon: gut });
  pruefe(`Telefon gültig: ${gut}`, r.success && r.data.telefon === gut);
}
for (const schlecht of ["0".repeat(41), "x".repeat(200)]) {
  pruefe(`Telefon ungültig: ${schlecht.length} Zeichen`, feldImFehler(parse({ telefon: schlecht })) === "telefon");
}
{
  const leer = parse({ telefon: "   " });
  pruefe("Telefon: leer und nur Leerzeichen werden null", leer.success && leer.data.telefon === null);
  const getrimmt = parse({ telefon: "  0151 2345678  " });
  pruefe("Telefon: Ränder werden entfernt", getrimmt.success && getrimmt.data.telefon === "0151 2345678");
  const profil = ProfilSchema.safeParse({ vorname: "A", nachname: "B", organisation: "Schule", funktion: "REFERENT", telefon: "  0151 2345678 (privat)  " });
  pruefe("Telefon: Profil und Onboarding prüfen gleich", profil.success && profil.data.telefon === "0151 2345678 (privat)" && parse({ telefon: "0151 2345678 (privat)" }).success);
  pruefe("Telefon: Profil lehnt 41 Zeichen ebenfalls ab", !ProfilSchema.safeParse({ vorname: "A", nachname: "B", organisation: "Schule", funktion: "REFERENT", telefon: "0".repeat(41) }).success);
}

// Weitere Formate, Zeiten, Bemerkung
{
  const aus = parse({ weitereFormate: false, zeiten: ["MO_VORMITTAGS"], bemerkung: "Montag ab 14 Uhr" });
  pruefe(
    "Formate aus: Zeiten und Bemerkung werden verworfen",
    aus.success && aus.data.zeiten.length === 0 && aus.data.bemerkung === null,
  );
  const an = parse({ weitereFormate: true, zeiten: ["DI_NACHMITTAGS", "MO_VORMITTAGS", "MO_VORMITTAGS"], bemerkung: "  ab 14 Uhr  " });
  pruefe(
    "Formate an: Zeiten dedupliziert, in Tabellenreihenfolge, Bemerkung getrimmt",
    an.success && JSON.stringify(an.data.zeiten) === '["MO_VORMITTAGS","DI_NACHMITTAGS"]' && an.data.bemerkung === "ab 14 Uhr",
  );
  pruefe("Formate an: Bemerkung leer wird null", (() => { const r = parse({ weitereFormate: true, bemerkung: "" }); return r.success && r.data.bemerkung === null; })());
  for (const unmoeglich of ["SA_VORMITTAGS", "MO_ABENDS", "MO", "mo_vormittags", "MO_VORMITTAGS "]) {
    pruefe(`Zeit unmöglich: ${unmoeglich}`, feldImFehler(parse({ weitereFormate: true, zeiten: [unmoeglich] })) === "zeiten");
  }
  pruefe("Zeit unmöglich auch bei Formate aus: wird abgelehnt statt verworfen", !parse({ weitereFormate: false, zeiten: ["SA_VORMITTAGS"] }).success);
  pruefe("Bemerkung: 300 Zeichen sind erlaubt", parse({ weitereFormate: true, bemerkung: "x".repeat(300) }).success);
  pruefe("Bemerkung: 301 Zeichen werden abgelehnt", feldImFehler(parse({ weitereFormate: true, bemerkung: "x".repeat(301) })) === "bemerkung");
  pruefe("Bemerkung: 301 Zeichen mit Formate aus werden ebenfalls abgelehnt", feldImFehler(parse({ weitereFormate: false, bemerkung: "x".repeat(301) })) === "bemerkung");
}

pruefe("Zeitenliste hat zehn Einträge Montag bis Freitag", ZEITEN.length === 10 && ZEITEN[0].value === "MO_VORMITTAGS" && ZEITEN[9].value === "FR_NACHMITTAGS");
pruefe("zeitenKompakt: „Mo vm, Di nm“", zeitenKompakt(["DI_NACHMITTAGS", "MO_VORMITTAGS", "UNBEKANNT"]) === "Mo vm, Di nm");
pruefe("zeitenKompakt: leer", zeitenKompakt([]) === "");

// ---------------------------------------------------------------------------
// Wächter
// ---------------------------------------------------------------------------
console.log("Onboarding, Wächter (Telefon und ReferentOnboarding nur an erlaubten Stellen)");

const src = path.join(process.cwd(), "src");

/** Relativ zu `src`, mit Schrägstrich. */
const ERLAUBT: Record<string, string[]> = {
  referentonboarding: [
    "actions/umfrageOeffentlich.ts",
    "actions/onboardingAdmin.ts",
    "actions/stammdaten.ts",
    "app/umfrage/[token]/page.tsx",
    "app/admin/referenten/onboarding/page.tsx",
  ],
  // `telefon` ist auch das Profilfeld, deshalb stehen hier alle Stellen, die
  // es heute laden oder schreiben. Neu darf es nur mit Eintrag hier dazukommen,
  // nie in Umfragetabellen, Umfrage-Admin, Exporten, Mails oder öffentlichen Seiten.
  telefon: [
    // Profil und Referentenverwaltung (Anzeige und Pflege der einen Nummer)
    "actions/profil.ts",
    "actions/stammdaten.ts",
    "lib/validation/profil.ts",
    "components/admin/ProfilFormular.tsx",
    "components/admin/ReferentenVerwaltung.tsx",
    "app/admin/konto/page.tsx",
    "app/admin/referenten/page.tsx",
    "texte/teile/profil.ts",
    // Onboarding: nur die eigene Nummer (Token) und die Admin-Ansicht
    "constants/onboarding.ts",
    "texte/teile/onboarding.ts",
    "components/umfrage/OnboardingFormular.tsx",
    "actions/umfrageOeffentlich.ts",
    "app/umfrage/[token]/page.tsx",
    "app/admin/referenten/onboarding/page.tsx",
    "actions/onboardingAdmin.ts",
    "components/admin/OnboardingLoeschen.tsx",
    // nur Kommentar oder Wortbedeutung „Telefon als Gerät“
    "lib/queries.ts",
    "components/public/Monatskalender.tsx",
  ],
};

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const voll = path.join(ordner, name);
    if (statSync(voll).isDirectory()) return dateien(voll);
    return /\.(ts|tsx|mjs|js)$/.test(name) ? [voll] : [];
  });
}

const treffer: Record<string, Set<string>> = { referentonboarding: new Set(), telefon: new Set() };
for (const datei of dateien(src)) {
  const rel = path.relative(src, datei).split(path.sep).join("/");
  const inhalt = readFileSync(datei, "utf8").toLowerCase();
  for (const begriff of Object.keys(treffer)) {
    if (inhalt.includes(begriff)) treffer[begriff].add(rel);
  }
}
for (const [begriff, erlaubt] of Object.entries(ERLAUBT)) {
  const fremd = [...treffer[begriff]].filter((rel) => !erlaubt.includes(rel));
  pruefe(`Wächter „${begriff}“: keine Treffer außerhalb der Liste`, fremd.length === 0, `Unerlaubt in: ${fremd.join(", ")}`);
  const fehlend = erlaubt.filter((rel) => !treffer[begriff].has(rel));
  pruefe(`Wächter „${begriff}“: Liste enthält keine Karteileichen`, fehlend.length === 0, `Ohne Treffer: ${fehlend.join(", ")}`);
}

/** Quelltext ohne Zeilenumbrüche und Mehrfach-Leerzeichen, damit Muster Umbrüche überstehen. */
const lies = (rel: string, wurzel = src) => readFileSync(path.join(wurzel, rel), "utf8").replace(/\s+/g, " ");

// Keine zweite Spalte: weder Schema noch Migration kennen eine Handynummer
{
  const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const modell = schema.match(/model ReferentOnboarding \{[\s\S]*?\n\}/)?.[0] ?? "";
  pruefe("Schema: ReferentOnboarding hat kein Feld handynummer oder telefon", modell !== "" && !/^\s*(handynummer|telefon)\s/im.test(modell));
  const migration = readFileSync(
    path.join(process.cwd(), "prisma", "migrations", "20261002100000_referent_onboarding", "migration.sql"),
    "utf8",
  );
  pruefe("Migration referent_onboarding: keine Spalte handynummer", !/handynummer/i.test(migration));
}

// Die Person kommt nur aus dem Token: Telefon wird nur für die eigene Person gelesen und geschrieben
{
  const seite = lies("app/umfrage/[token]/page.tsx");
  pruefe(
    "Umfrageseite lädt das Telefon nur über die Referent-ID aus dem Token",
    /referent\.findUnique\(\{ where: \{ id: teilnehmer\.referent\.id \}, select: \{ telefon: true \}/.test(seite) &&
      (seite.match(/telefon: true/g) ?? []).length === 1,
  );
  const aktion = lies("actions/umfrageOeffentlich.ts");
  pruefe(
    "Onboarding-Aktion schreibt Referent.telefon nur für die Person aus dem Token",
    /const referentId = teilnehmer\.referent\.id;/.test(aktion) &&
      (aktion.match(/referent\.update\(/g) ?? []).length === 1 &&
      aktion.includes("tx.referent.update({ where: { id: referentId }, data: { telefon } })"),
  );
  const protokoll = aktion.match(/entitaet: "ReferentOnboarding", entitaetId: referentId, details: \{([^}]*)\}/)?.[1] ?? "";
  pruefe(
    "Onboarding-Aktion: das Protokoll nimmt nie die Nummer selbst auf",
    protokoll !== "" && !/\btelefon\b/.test(protokoll.replace("telefonGesetzt: telefon !== null", "")),
  );
  pruefe("Token-Lader (umfrageToken.ts) kennt kein Telefon", !/telefon/i.test(lies("lib/umfrageToken.ts")));
}

assert.equal(fehler, 0, `${fehler} Prüfung(en) fehlgeschlagen`);
console.log("Onboarding-Prüfungen bestanden.");
