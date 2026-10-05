import {
  adminAnmelden,
  erwarte,
  legePersonAn,
  melde,
  neuerKontext,
  pruefe,
  starteBrowser,
  testPerson,
} from "./hilfe.mjs";

/**
 * Sammelliste 29.09. mittags, Fall 1: Fehlt {Link} im Mailtext, darf die
 * Einladung nicht rausgehen — sonst bekäme die Person eine Mail ohne ihren
 * persönlichen Zugang. Die Prüfung läuft serverseitig in sendeEinladungPerMail()
 * (src/actions/zugang.ts), dieser Test setzt deshalb bewusst am Textfeld an,
 * nicht an einer Browser-Validierung.
 */
const browser = await starteBrowser();
const seitenfehler = [];
const { kontext, seite: admin } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const person = testPerson(`rf17-${Date.now().toString(36)}`);
  await legePersonAn(admin, person);

  await pruefe("Senden ohne {Link} im Text wird abgelehnt", async () => {
    await admin
      .getByRole("button", {
        name: `Registrierungslink für ${person.vorname} ${person.nachname} verwalten`,
      })
      .click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Einladung per Mail senden" }).click();

    const textfeld = dialog.getByLabel("Text");
    await textfeld.fill("Ein Text ganz ohne den Platzhalter für den Link.");
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();

    await dialog
      .getByText("Im Text fehlt {Link}. Dort setzt das Portal den Link ein.")
      .waitFor({ timeout: 15_000 });

    erwarte(
      (await dialog.locator("input[readonly]").count()) === 0,
      "Trotz fehlendem {Link} wurde ein Link angezeigt — die Mail könnte verschickt worden sein.",
    );
    erwarte(
      (await dialog.getByText(/gesendet/i).count()) === 0,
      "Trotz fehlendem {Link} meldet der Dialog einen Erfolg.",
    );

    return {
      satz: "Der Dialog lehnt das Senden ohne {Link} ab und zeigt die Meldung „Im Text fehlt {Link}“.",
    };
  });

  await pruefe("Senden mit {Link} im Text klappt weiterhin", async () => {
    const dialog = admin.getByRole("dialog");
    const textfeld = dialog.getByLabel("Text");
    await textfeld.fill("Hier ist dein Link: {Link}");
    await dialog.getByRole("button", { name: "Senden", exact: true }).click();

    await dialog
      .getByText("Mailversand ist aus, bitte Link kopieren.")
      .waitFor({ timeout: 15_000 });
    const linkFeld = dialog.locator("input[readonly]");
    await linkFeld.waitFor({ timeout: 10_000 });
    const link = await linkFeld.inputValue();
    erwarte(/^https?:\/\//.test(link), `Kein brauchbarer Link angezeigt: "${link}"`);
    await admin.keyboard.press("Escape");

    return { satz: `Mit {Link} im Text klappt das Senden weiterhin (Link: ${link}).` };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await kontext.close();
  await browser.close();
}
