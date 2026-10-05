import { BASIS, adminAnmelden, melde, neuerKontext, pruefe, starteBrowser } from "./hilfe.mjs";

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);

  await pruefe("„Profil verwalten“ führt zum Profilteil", async () => {
    await admin.goto(`${BASIS}/admin`);
    await admin.getByRole("button", { name: "Profil verwalten" }).click();
    await admin.waitForURL(`${BASIS}/admin/konto#profil`, { timeout: 15_000 });
    await admin.getByRole("heading", { name: "Profil", exact: true }).waitFor({ timeout: 10_000 });
    return { satz: "Der Knopf neben „Neue Fortbildung“ führt auf /admin/konto#profil mit sichtbarem Profilformular." };
  });

  await pruefe("„Kontoeinstellungen“ führt zum Konto-/Passwortteil", async () => {
    await admin.goto(`${BASIS}/admin`);
    await admin.getByRole("link", { name: /Kontoeinstellungen/ }).click();
    await admin.waitForURL(`${BASIS}/admin/konto#konto`, { timeout: 15_000 });
    await admin.getByRole("heading", { name: "Passwort ändern" }).waitFor({ timeout: 10_000 });
    return { satz: "Der Eintrag unten links in der Seitenleiste führt auf /admin/konto#konto mit sichtbarem Passwortformular, ohne Namenskachel." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await adminKontext.close();
  await browser.close();
}
