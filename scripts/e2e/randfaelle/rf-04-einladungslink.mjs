import {
  BASIS,
  adminAnmelden,
  erwarte,
  melde,
  neuerKontext,
  personMitEinladung,
  pruefe,
  setzePasswort,
  starteBrowser,
  tokenAendern,
} from "./hilfe.mjs";

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);

  await pruefe("Manipulierter Token", async () => {
    const p = await refKontext.newPage();
    await p.goto(tokenAendern(link));
    const formular = await p.locator('input[name="wiederholung"]').count();
    const hinweis = await p.getByText(/gültig|abgelaufen/i).count();
    await p.close();
    erwarte(formular === 0 && hinweis > 0, "Ein manipulierter Token zeigte das Passwortformular oder keinen klaren Hinweis.");
    return { satz: "Eine Änderung am Token macht den Link ungültig; das Passwortformular wird nicht ausgeliefert." };
  });

  await pruefe("Einladungslink zweimal benutzen", async () => {
    await setzePasswort(ref, link, person);
    const p = await refKontext.newPage();
    await p.goto(link);
    const formular = await p.locator('input[name="wiederholung"]').count();
    await p.close();
    erwarte(formular === 0, "Der bereits verwendete Einladungslink zeigte erneut das Passwortformular.");
    return { satz: "Nach der ersten erfolgreichen Verwendung ist der Einmal-Token verbraucht." };
  });

  await pruefe("Abgelaufener Einladungslink", async () => {
    const abgelaufen = process.env.E2E_ABGELAUFENER_LINK;
    if (!abgelaufen) {
      return {
        status: "UNKLAR",
        satz: "Ohne E2E_ABGELAUFENER_LINK lässt sich der 14-Tage-Ablauf rein über die Oberfläche nicht vorspulen.",
      };
    }
    const url = new URL(abgelaufen);
    erwarte(/localhost|127\.0\.0\.1/.test(url.hostname), "E2E_ABGELAUFENER_LINK zeigt nicht auf die Testinstanz.");
    const p = await refKontext.newPage();
    await p.goto(abgelaufen.replace(url.origin, BASIS));
    const formular = await p.locator('input[name="wiederholung"]').count();
    const hinweis = await p.getByText(/gültig|abgelaufen/i).count();
    await p.close();
    erwarte(formular === 0 && hinweis > 0, "Der abgelaufene Link wurde nicht eindeutig abgewiesen.");
    return { satz: "Der bereitgestellte abgelaufene Link wird ohne Passwortformular abgewiesen." };
  });
} catch (error) {
  melde("FEHLER", "Testeinrichtung", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (seitenfehler.length) melde("UNKLAR", "Seitenfehler", seitenfehler.join("; "));
  await adminKontext.close();
  await refKontext.close();
  await browser.close();
}
