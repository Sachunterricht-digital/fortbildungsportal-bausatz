import {
  BASIS,
  adminAnmelden,
  anmelden,
  ergaenzeRedaktion,
  erstelleEntwurf,
  erwarte,
  gibFrei,
  melde,
  neuerKontext,
  personMitEinladung,
  pruefe,
  reicheNeuesSchilfEin,
  setzePasswort,
  starteBrowser,
} from "./hilfe.mjs";

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);

  await pruefe("Fremdes Thema per URL öffnen", async () => {
    const fremdTitel = `RF05 Fremd ${Date.now()}`;
    const fremdId = await erstelleEntwurf(admin, fremdTitel);
    const antwort = await ref.goto(`${BASIS}/admin/fortbildungen/${fremdId}`);
    const formular = await ref.locator('form input[name="titel"]').count();
    erwarte(formular === 0, "Ein Referent erhielt das Bearbeitungsformular eines fremden Themas.");
    return { satz: `Das fremde Thema wird nicht ausgeliefert (HTTP ${antwort?.status() ?? "unbekannt"}).` };
  });

  await pruefe("Admin-Seite per URL öffnen", async () => {
    const antwort = await ref.goto(`${BASIS}/admin/referenten`);
    const verwaltung = await ref.getByRole("heading", { name: /Referentinnen und Referenten/ }).count();
    erwarte(verwaltung === 0, "Die Referentenverwaltung war für die Rolle REFERENT sichtbar.");
    const status = antwort?.status() ?? 0;
    // Seit src/app/admin/error.tsx fängt eine eigene Fehlerseite den
    // AuthError aus requireRole() ab: kurze Meldung „Kein Zugriff“ statt der
    // generischen Next-500-Seite. Der HTTP-Status einer abgefangenen
    // Server-Component-Exception bleibt bei Next.js technisch 500, deshalb
    // zählt hier der sichtbare Inhalt, nicht allein der Statuscode.
    const keinZugriff = await ref.getByRole("heading", { name: "Kein Zugriff" }).count();
    if (keinZugriff > 0) {
      return { satz: `Die Referentenverwaltung bleibt gesperrt und zeigt die freundliche „Kein Zugriff“-Seite (HTTP ${status}).` };
    }
    return status >= 500
      ? {
          status: "FEHLER",
          satz: `Die Rechteprüfung sperrt den Inhalt, antwortet bei direkter URL aber weiterhin mit einer nackten HTTP-${status}-Seite statt der „Kein Zugriff“-Seite.`,
        }
      : { satz: `Die Referentenverwaltung bleibt gesperrt (HTTP ${status}).` };
  });

  await pruefe("Freigabe-Seite per URL öffnen", async () => {
    const antwort = await ref.goto(`${BASIS}/admin/freigaben`);
    const freigabeknopf = await ref
      .getByRole("button", { name: "Freigeben und veröffentlichen" })
      .count();
    erwarte(freigabeknopf === 0, "Ein Referent erhielt auf direktem Weg einen Freigabeknopf.");
    const status = antwort?.status() ?? 0;
    const keinZugriff = await ref.getByRole("heading", { name: "Kein Zugriff" }).count();
    if (keinZugriff > 0) {
      return { satz: `Die Freigabe bleibt gesperrt und zeigt die freundliche „Kein Zugriff“-Seite (HTTP ${status}).` };
    }
    return status >= 500
      ? {
          status: "FEHLER",
          satz: `Die Freigabe bleibt gesperrt, die direkte URL endet jedoch weiterhin mit einer nackten HTTP-${status}-Seite statt der „Kein Zugriff“-Seite.`,
        }
      : { satz: `Die Freigabeseite bleibt für Referenten gesperrt (HTTP ${status}).` };
  });

  await pruefe("Sitzung endet mitten in der Bearbeitung", async () => {
    const titel = `RF05 Sitzung ${Date.now()}`;
    const id = await erstelleEntwurf(ref, titel);
    const geaendert = `${titel} UNGESPEICHERT`;
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    await ref.locator('input[name="titel"]').fill(geaendert);
    await refKontext.clearCookies();
    await ref.getByRole("button", { name: "Änderungen speichern" }).click();
    // proxy.ts lässt next-action-Anfragen seit dem Fix unangetastet durch —
    // ein HTTP-Redirect mitten in einer Server-Action-Anfrage wird vom
    // Client als ungültige Antwort gewertet und erzeugte vorher eine kaputte
    // Fehlerseite. Jetzt prüft die Action selbst über requireUser() und
    // liefert eine normale, im Formular sichtbare Meldung.
    await ref.waitForTimeout(4_000);
    const meldungImFormular = await ref.getByText(/Nicht angemeldet/i).count();
    const zurAnmeldung = /\/login/.test(ref.url());
    const netzwerkfehler = await ref.getByText(/couldn.?t load|kann nicht geladen/i).count();
    await admin.goto(`${BASIS}/admin/fortbildungen/${id}`);
    const datenbankTitel = await admin.locator('input[name="titel"]').inputValue();
    erwarte(datenbankTitel === titel, "Trotz abgelaufener Sitzung wurde die Änderung gespeichert.");
    if (meldungImFormular > 0) {
      return { satz: "Die Server Action weist den Speicherversuch mit sichtbarer Meldung ab; die Datenbank bleibt unverändert." };
    }
    if (zurAnmeldung) {
      return { satz: "Der Browser landet sauber auf der Anmeldeseite; die Datenbank bleibt unverändert." };
    }
    return {
      status: "FEHLER",
      satz: netzwerkfehler > 0
        ? "Der Speicherversuch endet weiterhin in einer nackten Chromium-Fehlerseite („This page couldn't load“) statt einer Anmeldeaufforderung oder Meldung; die Datenbank bleibt zwar unverändert, die Rückmeldung an die Person ist aber kaputt."
        : `Unklare Rückmeldung nach Sitzungsende (URL: ${ref.url()}); die Datenbank bleibt immerhin unverändert.`,
    };
  });

  await anmelden(ref, person.email, person.passwort);

  const titel = `RF05 Status ${Date.now()}`;
  let id;
  await pruefe("Nach dem Einreichen weiter ändern", async () => {
    id = await reicheNeuesSchilfEin(ref, titel, "Vor der administrativen Prüfung.");
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    const speichern = ref.getByRole("button", { name: "Änderungen speichern" });
    erwarte((await speichern.count()) === 1, "Das eingereichte Thema bot unerwartet kein Bearbeitungsformular.");
    const neuerTitel = `${titel} geändert`;
    await ref.locator('input[name="titel"]').fill(neuerTitel);
    await speichern.click();
    await ref.waitForURL(/gespeichert=1/, { timeout: 20_000 });
    return {
      status: "FEHLER",
      satz: "Ein Referent kann ein bereits eingereichtes Thema während der Admin-Prüfung ohne Rücknahme weiter ändern.",
    };
  });

  await pruefe("Nach der Freigabe weiter ändern", async () => {
    // Seit der Sammelliste 29.09. mittags dürfen Referentinnen und Referenten
    // ein freigegebenes Thema weiter bearbeiten — die Änderung geht sofort
    // online, ohne neue Freigabe (siehe rf-18 für den vollen Ablauf inklusive
    // Hinweis-Mail und Veröffentlichungsprüfung). Vorher war das gesperrt,
    // dieser Fall prüft jetzt bewusst das Gegenteil von früher.
    const aktuellerTitel = `${titel} geändert`;
    await ergaenzeRedaktion(admin, id);
    await gibFrei(admin, aktuellerTitel);
    await ref.goto(`${BASIS}/admin/fortbildungen/${id}`);
    erwarte(
      (await ref.getByRole("button", { name: "Änderungen speichern" }).count()) === 1,
      "Nach der Freigabe fehlt dem Referenten das Bearbeitungsformular — freigegebene Themen sollen seit der Sammelliste 29.09. weiter bearbeitbar bleiben.",
    );
    await ref.getByText(/veröffentlicht/i).first().waitFor();
    return {
      satz: "Nach der Veröffentlichung bleibt die inhaltliche Bearbeitung für Referenten offen, ein Statuswechsel aber weiterhin gesperrt.",
    };
  });

  await pruefe("Freigeben auf einem bereits entschiedenen Thema", async () => {
    const titel2 = `RF05 Doppelfreigabe ${Date.now()}`;
    const id2 = await reicheNeuesSchilfEin(ref, titel2, "Zwei Admin-Sitzungen sehen dieselbe Karte.");
    await ergaenzeRedaktion(admin, id2);
    const admin2 = await adminKontext.newPage();
    await Promise.all([
      admin.goto(`${BASIS}/admin/freigaben`),
      admin2.goto(`${BASIS}/admin/freigaben`),
    ]);
    const karteA = admin.locator("article").filter({ hasText: titel2 });
    const karteB = admin2.locator("article").filter({ hasText: titel2 });
    await karteA.getByRole("button", { name: "Freigeben und veröffentlichen" }).click();
    await karteA.getByRole("link", { name: titel2, exact: true }).waitFor({ state: "detached", timeout: 15_000 });
    // admin2 hat die Karte noch offen (nicht neu geladen) und gibt dieselbe,
    // inzwischen bereits freigegebene Fortbildung erneut frei.
    await karteB.getByRole("button", { name: "Freigeben und veröffentlichen" }).click();
    await karteB
      .getByRole("alert")
      .filter({ hasText: /wartet nicht mehr/i })
      .waitFor({ timeout: 15_000 });
    await admin2.close();
    return {
      satz: "Die zweite, veraltete Freigabe zeigt eine verständliche Meldung statt eines stillen Nichtstuns.",
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
