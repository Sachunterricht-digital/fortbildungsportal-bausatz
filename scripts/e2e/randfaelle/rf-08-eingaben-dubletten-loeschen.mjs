import { execFileSync } from "node:child_process";

import sharp from "sharp";

import {
  BASIS,
  adminAnmelden,
  erwarte,
  escapeRegex,
  erstelleEntwurf,
  legePersonAn,
  melde,
  neuerKontext,
  personMitEinladung,
  pruefe,
  setzePasswort,
  starteBrowser,
  testPerson,
} from "./hilfe.mjs";

/**
 * Prüft direkt im Upload-Volume der Testinstanz, ob eine Porträtdatei noch
 * existiert. Läuft nur, wenn E2E_PRUEFE_PORTRAET_DATEI=1 gesetzt ist — das
 * Skript soll auch ohne SSH-Zugriff zur Testinstanz durchlaufen.
 */
function portraetDateiExistiert(referentId) {
  try {
    execFileSync("ssh", [
      (process.env.TEST_SSH_HOST ?? "testserver"),
      `docker exec fortbildung-test-app-1 test -f /app/uploads/portraets/${referentId}.webp`,
    ]);
    return true;
  } catch {
    return false;
  }
}

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);

  await pruefe("Leerer Titel serverseitig", async () => {
    await ref.goto(`${BASIS}/admin/fortbildungen/neu`);
    await ref.getByRole("button", { name: "Als Entwurf speichern" }).click();
    await ref.getByRole("alert").filter({ hasText: /Titel|Zeichen|kurz/i }).first().waitFor({ timeout: 15_000 });
    erwarte(ref.url().includes("/neu"), "Ein leerer Titel wurde als Entwurf gespeichert.");
    return { satz: "Auch der Entwurf verlangt serverseitig einen mindestens drei Zeichen langen Titel." };
  });

  await pruefe("Semantischer Unsinn als Titel", async () => {
    const id = await erstelleEntwurf(ref, "!!!");
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    erwarte((await ref.locator('input[name="titel"]').inputValue()) === "!!!", "Der Unsinnstitel wurde nicht gespeichert.");
    return {
      status: "UNKLAR",
      satz: "Die formale Prüfung akzeptiert „!!!“ als Titel; eine fachliche Plausibilitätsprüfung gibt es nicht.",
    };
  });

  await pruefe("Sehr langer Titel serverseitig", async () => {
    await ref.goto(`${BASIS}/admin/fortbildungen/neu`);
    const titel = "L".repeat(201);
    await ref.locator('input[name="titel"]').evaluate((element, wert) => {
      element.removeAttribute("maxlength");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, wert);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, titel);
    await ref.getByRole("button", { name: "Als Entwurf speichern" }).click();
    await ref.getByRole("alert").filter({ hasText: /Titel|Zeichen|lang/i }).first().waitFor({ timeout: 15_000 });
    erwarte(ref.url().includes("/neu"), "Der überlange Titel wurde trotz Servervalidierung gespeichert.");
    return { satz: "Auch nach Entfernen des Browserlimits weist die Server Action 201 Titelzeichen ab." };
  });

  await pruefe("Sonderzeichen im Titel", async () => {
    const titel = `RF08 ÄÖÜ & <Rand> „Zitat“ 😀 ${Date.now()}`;
    const id = await erstelleEntwurf(ref, titel);
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    const gespeichert = await ref.locator('input[name="titel"]').inputValue();
    erwarte(gespeichert === titel, `Sonderzeichen wurden verändert: „${gespeichert}“.`);
    return { satz: "Unicode, Umlaute und HTML-Sonderzeichen bleiben im Textfeld unverändert und werden als Text gerendert." };
  });

  await pruefe("Gleicher Titel zweimal", async () => {
    const titel = `RF08 Doppelter Titel ${Date.now()}`;
    await erstelleEntwurf(ref, titel);
    await erstelleEntwurf(ref, titel);
    await ref.goto(`${BASIS}/admin?q=${encodeURIComponent(titel)}`);
    const anzahl = await ref.getByRole("link", { name: titel, exact: true }).count();
    erwarte(anzahl === 2, `Es wurden ${anzahl} statt zwei gleichnamiger Entwürfe gefunden.`);
    return {
      status: "UNKLAR",
      satz: "Die Anwendung erlaubt zwei Themen mit identischem Titel; eindeutige Slugs verhindern nur URL-Kollisionen.",
    };
  });

  await pruefe("Gleiche E-Mail bei zwei Personen", async () => {
    const kennung = Date.now().toString(36);
    const a = testPerson(`rf08-mail-a-${kennung}`);
    const b = { ...testPerson(`rf08-mail-b-${kennung}`), email: a.email };
    await legePersonAn(admin, a);
    await legePersonAn(admin, b);
    await admin.goto(`${BASIS}/admin/referenten`);
    const mailTreffer = await admin.getByText(a.email, { exact: true }).count();
    erwarte(mailTreffer >= 2, `Die E-Mail erscheint nur ${mailTreffer}-mal; der Dublettentest ist nicht aussagekräftig.`);
    return {
      status: "FEHLER",
      satz: "Zwei Verzeichniseinträge können dieselbe E-Mail tragen; erst die Kontoanlage stößt auf die eindeutige User-E-Mail.",
    };
  });

  await pruefe("Z3: Fehlermeldung im Registrierungslink-Dialog sichtbar", async () => {
    // Nutzt die gleiche E-Mail wie im vorigen Fall (Befund 5 bleibt bewusst
    // bestehen): Für Person a klappt die Einrichtung, für Person b mit
    // derselben Mail muss richteZugangEin() mit „bereits ein Konto“ abbrechen
    // — und der Dialog muss das auch zeigen (Zusatzfund Z3), statt auf den
    // leeren erneuernState zurückzufallen.
    const kennung = Date.now().toString(36);
    const c = testPerson(`rf08-z3-a-${kennung}`);
    const d = { ...testPerson(`rf08-z3-b-${kennung}`), email: c.email };
    await legePersonAn(admin, c);
    await legePersonAn(admin, d);

    await admin.goto(`${BASIS}/admin/referenten`);
    await admin
      .getByRole("button", { name: `Registrierungslink für ${c.vorname} ${c.nachname} verwalten` })
      .click();
    let dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Nur Link erzeugen und kopieren" }).click();
    await dialog.locator("input[readonly]").waitFor({ timeout: 15_000 });
    await admin.keyboard.press("Escape");

    await admin
      .getByRole("button", { name: `Registrierungslink für ${d.vorname} ${d.nachname} verwalten` })
      .click();
    dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Nur Link erzeugen und kopieren" }).click();
    await dialog.getByRole("alert").filter({ hasText: /bereits.*Konto/i }).waitFor({ timeout: 15_000 });
    erwarte(
      (await dialog.locator("input[readonly]").count()) === 0,
      "Trotz belegter E-Mail wurde für Person b ein Registrierungslink angezeigt.",
    );
    await admin.keyboard.press("Escape");
    return { satz: "Der Dialog zeigt die Meldung „bereits ein Konto“ statt stumm zu bleiben." };
  });

  await pruefe("E-Mail einer Person mit Konto ändern", async () => {
    const neueEmail = `geaendert-${Date.now().toString(36)}@test.local`;
    await admin.goto(`${BASIS}/admin/referenten`);
    await admin
      .getByRole("button", { name: `${person.vorname} ${person.nachname} bearbeiten` })
      .click();
    let dialog = admin.getByRole("dialog");
    await dialog.locator('input[name="email"]').fill(neueEmail);
    await dialog.getByRole("button", { name: "Speichern" }).click();
    await dialog.getByText(/gespeichert/i).waitFor({ timeout: 15_000 });
    await admin.keyboard.press("Escape");

    await admin
      .getByRole("button", {
        name: `Registrierungslink für ${person.vorname} ${person.nachname} verwalten`,
      })
      .click();
    dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Nur Link erzeugen und kopieren" }).click();
    const feld = dialog.locator("input[readonly]");
    await feld.waitFor({ timeout: 15_000 });
    const resetUrl = new URL(await feld.inputValue());
    const pruefseite = await refKontext.newPage();
    await pruefseite.goto(`${BASIS}${resetUrl.pathname}${resetUrl.search}`);
    const kontoEmail = await pruefseite.locator("#anmeldename").inputValue();
    await pruefseite.close();
    await admin.keyboard.press("Escape");
    erwarte(
      kontoEmail === neueEmail,
      `Der Reset-Link zeigte „${kontoEmail}“ statt der geänderten Mail „${neueEmail}“.`,
    );
    person.email = neueEmail;
    return {
      satz: `Die Mailänderung im Verzeichnis (${neueEmail}) wandert automatisch ans verknüpfte Konto — der Reset-Link zeigt sie sofort (Befund 6 behoben).`,
    };
  });

  await pruefe("Person mit Konto löschen und E-Mail wiederverwenden", async () => {
    const loeschPerson = testPerson(`rf08-loeschen-${Date.now().toString(36)}`);
    await legePersonAn(admin, loeschPerson);
    await admin
      .getByRole("button", {
        name: `Registrierungslink für ${loeschPerson.vorname} ${loeschPerson.nachname} verwalten`,
      })
      .click();
    let dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Nur Link erzeugen und kopieren" }).click();
    const linkFeld = dialog.locator("input[readonly]");
    await linkFeld.waitFor({ timeout: 15_000 });
    const linkUrl = new URL(await linkFeld.inputValue());
    await admin.keyboard.press("Escape");
    const loeschKonto = await refKontext.newPage();
    await setzePasswort(
      loeschKonto,
      `${BASIS}${linkUrl.pathname}${linkUrl.search}`,
      loeschPerson,
    );

    // Porträt hochladen, damit sich die Datenleiche (Befund 11) am Volume
    // prüfen lässt, nicht nur die Kontolöschung (Befund 7).
    await loeschKonto.goto(`${BASIS}/admin/konto`);
    const winzigesBild = await sharp({
      create: { width: 64, height: 64, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 50 } },
    })
      .png()
      .toBuffer();
    await loeschKonto.locator('input[name="foto"]').setInputFiles({
      name: "loesch-portraet.png",
      mimeType: "image/png",
      buffer: winzigesBild,
    });
    await loeschKonto.getByRole("button", { name: "Foto speichern" }).click();
    const portraetSrc = await loeschKonto
      .locator('img[src^="/api/portraet/"]')
      .getAttribute("src", { timeout: 20_000 });
    const loeschReferentId = portraetSrc?.match(/\/api\/portraet\/([^?]+)/)?.[1];
    await loeschKonto.close();

    const dateiVorherDa = process.env.E2E_PRUEFE_PORTRAET_DATEI === "1" && loeschReferentId
      ? portraetDateiExistiert(loeschReferentId)
      : null;

    await admin.goto(`${BASIS}/admin/referenten`);
    await admin
      .getByRole("button", { name: `${loeschPerson.vorname} ${loeschPerson.nachname} entfernen` })
      .click();
    await admin
      .getByRole("cell", { name: new RegExp(escapeRegex(loeschPerson.nachname)) })
      .first()
      .waitFor({ state: "detached" });

    if (dateiVorherDa !== null) {
      erwarte(dateiVorherDa === true, "Die Porträtdatei war vor dem Löschen unerwartet schon nicht mehr vorhanden — Testaufbau prüfen.");
      const dateiNachher = portraetDateiExistiert(loeschReferentId);
      erwarte(dateiNachher === false, `Die Porträtdatei ${loeschReferentId}.webp liegt nach dem Löschen der Person weiterhin im Upload-Volume.`);
    }

    const ersatz = {
      ...testPerson(`rf08-ersatz-${Date.now().toString(36)}`),
      email: loeschPerson.email,
    };
    await legePersonAn(admin, ersatz);
    await admin
      .getByRole("button", {
        name: `Registrierungslink für ${ersatz.vorname} ${ersatz.nachname} verwalten`,
      })
      .click();
    dialog = admin.getByRole("dialog");
    await dialog.getByRole("button", { name: "Nur Link erzeugen und kopieren" }).click();
    // entferneReferent() löscht seit dem Fix das verknüpfte Konto mit, die
    // E-Mail ist danach wieder frei. Trotzdem robust prüfen statt blind auf
    // den Linktext zu warten: Fehlt der Fix, meldet ZugangDialog die belegte
    // Mail entweder sichtbar oder (Z3, ebenfalls behoben) gar nicht.
    await admin.waitForTimeout(3_000);
    const meldung = await dialog.getByText(/belegt|bereits.*Konto/i).count();
    const neuerLink = await dialog.locator("input[readonly]").count();
    if (neuerLink > 0) {
      const portraetSatz =
        dateiVorherDa === null
          ? " (Porträtdatei nicht geprüft, E2E_PRUEFE_PORTRAET_DATEI=1 setzen für den SSH-Check am Upload-Volume.)"
          : " Die Porträtdatei wurde beim Löschen ebenfalls entfernt.";
      return {
        satz: `Das Löschen der Person hat das verknüpfte Konto mitentfernt; die E-Mail lässt sich für eine neue Person sofort wieder für einen Registrierungslink verwenden.${portraetSatz}`,
      };
    }
    if (meldung > 0) {
      return {
        status: "FEHLER",
        satz: "Die E-Mail gilt nach dem Löschen der Person weiterhin als belegt — das verknüpfte Konto wurde beim Löschen offenbar nicht entfernt.",
      };
    }
    return {
      status: "FEHLER",
      satz: "Der Dialog bleibt nach dem Klick stumm, ohne Link und ohne Fehlermeldung.",
    };
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
