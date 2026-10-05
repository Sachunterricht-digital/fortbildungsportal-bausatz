import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

export const BASIS = process.env.E2E_BASIS ?? "http://localhost:3101";
if (!/^(?:http:\/\/)?(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/.test(BASIS)) {
  throw new Error("Randfalltests laufen ausschließlich gegen localhost/127.0.0.1.");
}

export const ADMIN_MAIL =
  process.env.E2E_ADMIN_MAIL ?? "admin@example.org";
export const ADMIN_PW = process.env.E2E_ADMIN_PW;
if (!ADMIN_PW) throw new Error("E2E_ADMIN_PW fehlt (Passwort des Admin-Kontos der Testinstanz).");

export function laufKennung(praefix = "rf") {
  return `${praefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function testPerson(kennung = laufKennung("person")) {
  return {
    vorname: "Randa",
    nachname: `Fall-${kennung}`,
    organisation: "GS Randstadt",
    email: `${kennung}@test.local`.toLowerCase(),
    passwort: `Randfall-${kennung}-Passwort!`,
  };
}

export function melde(status, fall, satz) {
  if (!new Set(["BESTANDEN", "FEHLER", "UNKLAR"]).has(status)) {
    throw new Error(`Unbekannter Ergebnisstatus: ${status}`);
  }
  console.log(`${status} | ${fall} | ${satz.replace(/\s+/g, " ").trim()}`);
}

export async function pruefe(fall, fn) {
  try {
    const ergebnis = await fn();
    if (ergebnis?.status) {
      melde(ergebnis.status, fall, ergebnis.satz);
    } else {
      melde("BESTANDEN", fall, ergebnis?.satz ?? "Der erwartete Zustand wurde erreicht.");
    }
    return true;
  } catch (error) {
    melde(
      "FEHLER",
      fall,
      (error instanceof Error ? error.message : String(error)).split("\n").slice(0, 2).join(" | "),
    );
    return false;
  }
}

export function erwarte(bedingung, meldung) {
  if (!bedingung) throw new Error(meldung);
}

export async function starteBrowser() {
  return chromium.launch(process.env.E2E_CHROMIUM_PFAD ? { executablePath: process.env.E2E_CHROMIUM_PFAD } : {});
}

export function beobachteSeite(seite, sammlung) {
  seite.on("pageerror", (error) => sammlung.push(`JS: ${error.message}`));
  seite.on("response", (antwort) => {
    if (antwort.status() >= 500) sammlung.push(`${antwort.status()} ${antwort.url()}`);
  });
}

export async function neuerKontext(browser, sammlung = []) {
  const kontext = await browser.newContext();
  const seite = await kontext.newPage();
  beobachteSeite(seite, sammlung);
  return { kontext, seite };
}

export async function anmelden(seite, email, passwort) {
  await seite.goto(`${BASIS}/login`);
  await seite.locator('input[name="email"]').fill(email);
  await seite.locator('input[name="passwort"]').fill(passwort);
  await Promise.all([
    seite.waitForURL(/\/admin(?:\/|\?|$)/, { timeout: 15_000 }),
    seite.getByRole("button", { name: "Anmelden" }).click(),
  ]);
}

export async function adminAnmelden(seite) {
  await anmelden(seite, ADMIN_MAIL, ADMIN_PW);
}

export async function legePersonAn(admin, person, optionen = {}) {
  await admin.goto(`${BASIS}/admin/referenten`);
  await admin.getByRole("button", { name: "Neue Person anlegen" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.locator('input[name="vorname"]').fill(person.vorname);
  await dialog.locator('input[name="nachname"]').fill(person.nachname);
  await dialog.locator('input[name="organisation"]').fill(person.organisation);
  await dialog.locator('input[name="email"]').fill(person.email);
  const speichern = dialog.getByRole("button", { name: "Speichern" });
  if (optionen.doppelt) await synchronDoppelt(speichern);
  else await speichern.click();
  await dialog.getByText(/gespeichert/i).waitFor({ timeout: 15_000 });
  await admin.keyboard.press("Escape");
  await admin.getByRole("cell", { name: new RegExp(escapeRegex(person.nachname)) }).first().waitFor();
}

export async function erzeugeEinladungslink(admin, person, optionen = {}) {
  await admin.goto(`${BASIS}/admin/referenten`);
  await admin
    .getByRole("button", {
      name: `Registrierungslink für ${person.vorname} ${person.nachname} verwalten`,
    })
    .click();
  const dialog = admin.getByRole("dialog");
  const knopf = dialog.getByRole("button", { name: "Nur Link erzeugen und kopieren" });
  if (optionen.doppelt) await synchronDoppelt(knopf);
  else await knopf.click();
  const feld = dialog.locator("input[readonly]");
  await feld.waitFor({ timeout: 15_000 });
  const externeUrl = new URL(await feld.inputValue());
  const link = `${BASIS}${externeUrl.pathname}${externeUrl.search}`;
  await admin.keyboard.press("Escape");
  return link;
}

export async function personMitEinladung(admin, optionen = {}) {
  const person = testPerson(optionen.kennung);
  await legePersonAn(admin, person, optionen.person ?? {});
  const link = await erzeugeEinladungslink(admin, person, optionen.link ?? {});
  return { person, link };
}

export async function setzePasswort(seite, link, person, optionen = {}) {
  await seite.goto(link);
  await seite.locator('input[name="passwort"]').fill(person.passwort);
  await seite.locator('input[name="wiederholung"]').fill(person.passwort);
  const knopf = seite.locator('button[type="submit"]');
  if (optionen.doppelt) await synchronDoppelt(knopf);
  else await knopf.click();
  await seite.waitForURL((url) => !url.pathname.startsWith("/zugang"), { timeout: 20_000 });
}

export async function profilSpeichern(seite, werte = {}, optionen = {}) {
  await seite.goto(`${BASIS}/admin/konto`);
  if (werte.vorname !== undefined) await seite.locator('input[name="vorname"]').fill(werte.vorname);
  if (werte.nachname !== undefined) await seite.locator('input[name="nachname"]').fill(werte.nachname);
  if (werte.organisation !== undefined) {
    await seite.locator('input[name="organisation"]').fill(werte.organisation);
  }
  if (werte.telefon !== undefined) await seite.locator('input[name="telefon"]').fill(werte.telefon);
  if (werte.schwerpunkte !== undefined) {
    await seite.locator('input[name="schwerpunkte"]').fill(werte.schwerpunkte);
  }
  if (werte.kurzprofil !== undefined) {
    await seite.locator('textarea[name="kurzprofil"]').fill(werte.kurzprofil);
  }
  const knopf = seite.getByRole("button", { name: /^(Profil speichern|Speichern und veröffentlichen)$/ });
  if (optionen.doppelt) await synchronDoppelt(knopf);
  else await knopf.click();
  await seite.getByText(/gespeichert/i).first().waitFor({ timeout: 15_000 });
}

export async function erstelleEntwurf(seite, titel, optionen = {}) {
  await seite.goto(`${BASIS}/admin/fortbildungen/neu`);
  await seite.locator('input[name="titel"]').fill(titel);
  const knopf = seite.getByRole("button", { name: "Als Entwurf speichern" });
  if (optionen.doppelt) await synchronDoppelt(knopf);
  else await knopf.click();
  await seite.waitForURL(/\/admin\/fortbildungen\/[^/?]+\?gespeichert=1/, { timeout: 20_000 });
  return idAusUrl(seite.url());
}

export async function reicheNeuesSchilfEin(seite, titel, beschreibung, optionen = {}) {
  await seite.goto(`${BASIS}/admin/fortbildungen/neu`);
  await seite.locator('input[name="titel"]').fill(titel);
  await seite.getByRole("button", { name: "Weiter" }).click();
  await seite.locator(".ProseMirror").click();
  await seite.keyboard.type(beschreibung);
  await seite.getByRole("button", { name: "Weiter" }).click();
  await seite.getByRole("button", { name: "Weiter" }).click();
  await seite.getByRole("button", { name: "Weiter" }).click();
  // Seit 03.10. hat der letzte Schritt für Referenten kein Statusfeld mehr,
  // „Zur Freigabe einreichen“ setzt den Status selbst. Für Admins bleibt es.
  const status = seite
    .locator('[role="combobox"]')
    .filter({ hasText: /Entwurf|Eingereicht/ })
    .first();
  if (await status.isVisible().catch(() => false)) {
    await status.click();
    await seite.getByRole("option", { name: /eingereicht/i }).click();
  }
  const knopf = seite.getByRole("button", { name: "Zur Freigabe einreichen" });
  if (optionen.doppelt) await synchronDoppelt(knopf);
  else await knopf.click();
  await seite.waitForURL(/\/admin\/fortbildungen\/[^/?]+\?gespeichert=1/, { timeout: 20_000 });
  return idAusUrl(seite.url());
}

export async function reicheEntwurfEin(seite, id, beschreibung, optionen = {}) {
  await seite.goto(`${BASIS}/admin/fortbildungen/${id}`);
  await seite.getByRole("tab", { name: "Beschreibung" }).click();
  await seite.locator(".ProseMirror").click();
  await seite.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await seite.keyboard.type(beschreibung);
  await seite.getByRole("tab", { name: "Eckdaten" }).click();
  const status = seite
    .locator('[role="combobox"]')
    .filter({ hasText: /Entwurf|Eingereicht/ })
    .first();
  await status.click();
  await seite.getByRole("option", { name: /eingereicht/i }).click();
  const knopf = seite.getByRole("button", { name: "Änderungen speichern" });
  if (optionen.doppelt) await synchronDoppelt(knopf);
  else await knopf.click();
  await seite.waitForURL(/gespeichert=1/, { timeout: 20_000 });
}

export async function ergaenzeRedaktion(admin, id) {
  await admin.goto(`${BASIS}/admin/fortbildungen/${id}`);
  await admin.getByRole("tab", { name: /DigCompEdu/ }).click();
  const niveau = admin.locator('[role="combobox"]').filter({ hasText: /Niveau|wählen/i }).first();
  await niveau.click();
  await admin.getByRole("option").first().click();
  await admin.getByRole("button", { name: /KB 1/ }).click();
  await admin.getByRole("region").locator('[role="checkbox"]').first().click();
  await admin.getByRole("button", { name: "Änderungen speichern" }).click();
  await admin.waitForURL(/gespeichert=1/, { timeout: 20_000 });
}

export async function weiseZurueck(admin, titel, begruendung) {
  await admin.goto(`${BASIS}/admin/freigaben`);
  const karte = admin.locator("article").filter({ hasText: titel });
  await karte.getByRole("button", { name: "Zurückweisen" }).click();
  await karte.locator('textarea[name="notiz"]').fill(begruendung);
  await karte.getByRole("button", { name: "Zurückweisen" }).click();
  // Nicht karte.getByText(titel): Sobald das Notizfeld offen ist, nennt auch
  // der Hinweistext unter der Textarea den Titel („Der Text erscheint bei
  // „<titel>“ …“), das ergibt zwei Treffer (strict mode violation). Der Link
  // in der Überschrift ist eindeutig.
  await karte.getByRole("link", { name: titel, exact: true }).waitFor({ state: "detached", timeout: 15_000 });
}

export async function gibFrei(admin, titel, optionen = {}) {
  await admin.goto(`${BASIS}/admin/freigaben`);
  const karte = admin.locator("article").filter({ hasText: titel });
  const knopf = karte.getByRole("button", { name: "Freigeben und veröffentlichen" });
  if (optionen.doppelt) await synchronDoppelt(knopf);
  else await knopf.click();
  await karte.getByRole("link", { name: titel, exact: true }).waitFor({ state: "detached", timeout: 15_000 });
}

export async function synchronDoppelt(locator) {
  await locator.evaluate((element) => {
    element.click();
    element.click();
  });
}

export function idAusUrl(url) {
  const teile = new URL(url).pathname.split("/").filter(Boolean);
  return teile.at(-1);
}

export function tokenAendern(link) {
  const url = new URL(link);
  const token = url.searchParams.get("token") ?? "";
  const ende = token.at(-1) === "A" ? "B" : "A";
  url.searchParams.set("token", `${token.slice(0, -1)}${ende}`);
  return url.toString();
}

export function escapeRegex(wert) {
  return wert.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
