// Klicktest gegen die Live-Seite nach jedem Deploy (scripts/live.sh deploy).
//
//   node scripts/e2e/live-klicktest.mjs
//
// Liest nur, bis auf die Anmeldung (lastLoginAt, LOGIN im AuditLog des
// Admin-Kontos): öffentliche Seiten und Admin-Seiten aufrufen, Bilder prüfen,
// Server-Log der letzten Minuten durchsehen. Kein Formular wird abgeschickt
// außer der Anmeldung, es entstehen keine anderen Daten und keine Mails.
// Bildschirmfotos gibt es nur von öffentlichen Seiten (scripts/e2e/bilder/live-*.png),
// die Admin-Seiten zeigen Personendaten und werden nie fotografiert.
// Vor jedem Lauf werden alle alten live-*.png gelöscht.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASIS = process.env.LIVE_URL;
if (!BASIS) throw new Error("LIVE_URL fehlt (Adresse der Live-Seite, z. B. https://fortbildung.example.org).");
const ADMIN_MAIL = process.env.LIVE_ADMIN_MAIL ?? "admin@example.org";
const ADMIN_PW = process.env.LIVE_ADMIN_PW;
if (!ADMIN_PW) throw new Error("LIVE_ADMIN_PW fehlt (Passwort des Admin-Kontos der Live-Seite).");

const OEFFENTLICH = ["/", "/fortbildungen", "/kalender", "/referenten", "/impressum", "/datenschutz", "/login"];
const ADMIN = ["/admin", "/admin/referenten", "/admin/freigaben", "/admin/kalender", "/admin/konto", "/admin/umfragen", "/admin/referenten/onboarding"];
// Bildschirmfotos nur von öffentlichen Seiten: Admin-Seiten zeigen Namen,
// Mailadressen und Telefonnummern und werden nie auf die Platte fotografiert.
// Bilder des Onboardings (Portal in drei Schritten), nur lesend per GET
const ONBOARDING_BILDER = [
  "/bilder/onboarding/1-profil.png",
  "/bilder/onboarding/2-themen-assistent-schritt-1.png",
  "/bilder/onboarding/3-pruefen.png",
];

const bilder = path.join(path.dirname(new URL(import.meta.url).pathname), "bilder");
mkdirSync(bilder, { recursive: true });
for (const datei of readdirSync(bilder)) {
  if (/^live-.*\.png$/.test(datei)) unlinkSync(path.join(bilder, datei));
}
const browser = await chromium.launch(process.env.E2E_CHROMIUM_PFAD ? { executablePath: process.env.E2E_CHROMIUM_PFAD } : {});

const ergebnis = [];
let fehlerZahl = 0;
function melde(ok, text) {
  if (!ok) fehlerZahl += 1;
  ergebnis.push(`${ok ? "ok    " : "FEHLER"} ${text}`);
}

async function pruefeSeite(seite, pfad, kuerzel, mitBild = false) {
  const probleme = [];
  const onError = (e) => probleme.push(`JS ${e.message.split("\n")[0]}`);
  const onResponse = (r) => {
    const typ = r.request().resourceType();
    if (r.status() >= 500 || (typ === "image" && r.status() >= 400)) probleme.push(`${r.status()} ${r.url().replace(BASIS, "")}`);
  };
  seite.on("pageerror", onError);
  seite.on("response", onResponse);
  try {
    const antwort = await seite.goto(BASIS + pfad, { waitUntil: "networkidle", timeout: 30000 });
    const status = antwort?.status() ?? 0;
    if (status >= 400) probleme.push(`Status ${status}`);
    const kaputteBilder = await seite.$$eval("img", (els) => els.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    for (const src of kaputteBilder) probleme.push(`Bild lädt nicht ${src.replace(BASIS, "")}`);
    if (mitBild) await seite.screenshot({ path: path.join(bilder, `live-${kuerzel}.png`), fullPage: true });
  } catch (e) {
    probleme.push(e.message.split("\n")[0]);
  } finally {
    seite.off("pageerror", onError);
    seite.off("response", onResponse);
  }
  melde(probleme.length === 0, `${pfad}${probleme.length ? ": " + probleme.slice(0, 3).join(" | ") : ""}`);
}

const name = (pfad) => pfad.replace(/^\//, "").replace(/\//g, "-") || "start";

// Öffentlich, Desktop und Handy
const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
for (const pfad of OEFFENTLICH) await pruefeSeite(desktop, pfad, name(pfad), true);
// Teambereich, nur lesend: erster Steckbrief aus dem Raster (falls schon Personen da sind)
try {
  const ersterSteckbrief = await desktop.goto(BASIS + "/referenten").then(() =>
    desktop.locator('main a[href^="/referenten/"]').first().getAttribute("href", { timeout: 3000 }).catch(() => null),
  );
  if (ersterSteckbrief) await pruefeSeite(desktop, ersterSteckbrief, "referenten-steckbrief", true);
  else melde(true, "/referenten: noch keine Mitglieder, Steckbrief nicht geprüft");
} catch (e) {
  melde(false, `Steckbrief: ${e.message.split("\n")[0]}`);
}
for (const pfad of ONBOARDING_BILDER) {
  try {
    const antwort = await fetch(BASIS + pfad);
    const typ = antwort.headers.get("content-type") ?? "";
    melde(antwort.status === 200 && /^image\//.test(typ), `${pfad}: Status ${antwort.status}, ${typ || "kein Typ"}`);
  } catch (e) {
    melde(false, `${pfad}: ${e.message.split("\n")[0]}`);
  }
}
const handy = await browser.newPage({ viewport: { width: 390, height: 844 } });
await pruefeSeite(handy, "/", "start-390", true);

// Admin
const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await admin.goto(BASIS + "/login");
  await admin.fill("input[name=email]", ADMIN_MAIL);
  await admin.fill("input[name=passwort]", ADMIN_PW);
  await Promise.all([admin.waitForURL(/\/admin/, { timeout: 15000 }), admin.click("button[type=submit]")]);
  melde(true, "Anmeldung Admin");
  for (const pfad of ADMIN) await pruefeSeite(admin, pfad, name(pfad), false);
} catch (e) {
  melde(false, `Anmeldung Admin: ${e.message.split("\n")[0]}`);
}
await browser.close();

// Server-Log der letzten zehn Minuten
try {
  const log = execFileSync("ssh", [process.env.LIVE_SSH_HOST ?? "liveserver", `cd ${process.env.LIVE_ZIEL ?? "/opt/fortbildung"} && docker compose logs --since 10m --no-color app 2>&1`]).toString();
  const treffer = log.split("\n").filter((z) => /EACCES|Unhandled|PrismaClient\w*Error|Error:|⨯/.test(z));
  melde(treffer.length === 0, `Server-Log 10 min${treffer.length ? ": " + treffer.length + " Zeilen, z.B. " + treffer.slice(0, 3).map((z) => z.slice(0, 160)).join(" | ") : ""}`);
} catch (e) {
  melde(false, `Server-Log nicht lesbar: ${e.message.split("\n")[0]}`);
}

console.log(ergebnis.join("\n"));
console.log(fehlerZahl ? `\n${fehlerZahl} Fehler, öffentliche Bilder in ${bilder}` : `\nKlicktest grün, öffentliche Bilder in ${bilder}`);
process.exit(fehlerZahl ? 1 : 0);
