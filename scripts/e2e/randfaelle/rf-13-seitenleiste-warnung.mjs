import {
  BASIS,
  adminAnmelden,
  erwarte,
  melde,
  neuerKontext,
  pruefe,
  starteBrowser,
} from "./hilfe.mjs";

/**
 * Sammelliste 29.09., Punkt a: ein Klick auf einen internen Link (hier die
 * Seitenleiste) fragt bei ungespeicherten Änderungen nach, genau wie der
 * bisherige Sonderfall beim „Abbrechen“-Link. Siehe
 * src/lib/useUngespeicherteAenderungen.ts (document-weiter Klick-Abfang).
 */
const browser = await starteBrowser();
const seitenfehler = [];
const { kontext, seite: admin } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  await admin.goto(`${BASIS}/admin/fortbildungen/neu`);
  await admin.locator('input[name="titel"]').fill(`RF13 Seitenleiste ${Date.now().toString(36)}`);
  // Kurz warten, bis React den geänderten Zustand markiert hat.
  await admin.waitForTimeout(300);

  await pruefe("Seitenleisten-Klick fragt bei ungespeicherten Änderungen nach", async () => {
    let dialogText = null;
    admin.once("dialog", async (dialog) => {
      dialogText = dialog.message();
      await dialog.dismiss();
    });
    await admin.getByRole("link", { name: "Fortbildungskatalog" }).click();
    await admin.waitForTimeout(500);
    erwarte(dialogText !== null, "Beim Klick auf die Seitenleiste erschien kein Bestätigungsdialog.");
    erwarte(
      admin.url().includes("/admin/fortbildungen/neu"),
      "Die Seite hat trotz abgebrochenem Dialog wahrscheinlich gewechselt.",
    );
    return { satz: `Dialog „${dialogText}“ erschien, Abbrechen hielt auf der Seite.` };
  });

  await pruefe("Bestätigter Dialog lässt die Navigation zu", async () => {
    admin.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await admin.getByRole("link", { name: "Fortbildungskatalog" }).click();
    await admin.waitForURL(/\/admin\/katalog/, { timeout: 10_000 });
    return { satz: "Nach Bestätigen des Dialogs wechselte die Seite zum Katalog." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await kontext.close();
  await browser.close();
}
