import { execFileSync } from "node:child_process";

import sharp from "sharp";

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
} from "./hilfe.mjs";

/** Fragt die Testdatenbank (nur lesend) per ssh und psql ab. */
function sql(abfrage) {
  return execFileSync(
    "ssh",
    [(process.env.TEST_SSH_HOST ?? "testserver"), `docker exec fortbildung-test-db-1 psql -U fortbildungen -d fortbildungen_uamm -At -c ${JSON.stringify(abfrage)}`],
    { encoding: "utf8" },
  ).trim();
}

const browser = await starteBrowser();
const seitenfehler = [];
const { kontext: adminKontext, seite: admin } = await neuerKontext(browser, seitenfehler);
const { kontext: refKontext, seite: ref } = await neuerKontext(browser, seitenfehler);

try {
  await adminAnmelden(admin);
  const { person, link } = await personMitEinladung(admin);
  await setzePasswort(ref, link, person);
  await ref.goto(`${BASIS}/admin/konto`);

  await pruefe("Fotoauswahl abbrechen", async () => {
    const eingabe = ref.locator('input[name="foto"]');
    const chooserPromise = ref.waitForEvent("filechooser");
    await eingabe.click();
    const chooser = await chooserPromise;
    await chooser.setFiles([]);
    const dateien = await eingabe.evaluate((element) => element.files?.length ?? -1);
    erwarte(dateien === 0, "Nach Abbruch blieb eine Datei im Uploadfeld ausgewählt.");
    return { satz: "Der abgebrochene Dateidialog lässt das Uploadfeld leer und startet keinen Upload." };
  });

  await pruefe("Animiertes GIF wird angenommen, nur das erste Bild zählt", async () => {
    // Zwei Bilder (rot, blau) untereinander als Rohdaten, daraus ein animiertes GIF.
    const kante = 64;
    const roh = Buffer.concat([
      Buffer.alloc(kante * kante * 3, 0).map((_, i) => (i % 3 === 0 ? 220 : 20)),
      Buffer.alloc(kante * kante * 3, 0).map((_, i) => (i % 3 === 2 ? 220 : 20)),
    ]);
    const gif = await sharp(roh, { raw: { width: kante, height: kante * 2, channels: 3, pageHeight: kante } })
      .gif({ loop: 0, delay: [100, 100] })
      .toBuffer();
    erwarte(gif.subarray(0, 3).toString() === "GIF", "Das Test-GIF ist kein GIF.");
    await ref.locator('input[name="foto"]').setInputFiles({ name: "bewegt.gif", mimeType: "image/gif", buffer: gif });
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    const bild = ref.locator('img[src^="/api/portraet/"]');
    await bild.waitFor({ timeout: 20_000 });
    const src = await bild.getAttribute("src");
    const antwort = await ref.request.get(new URL(src, BASIS).toString());
    erwarte(antwort.headers()["content-type"]?.includes("image/webp"), "Das GIF-Foto kommt nicht als WebP zurück.");
    const meta = await sharp(await antwort.body()).metadata();
    erwarte((meta.pages ?? 1) === 1, "Das gespeicherte Foto ist noch animiert.");
    const { dominant } = await sharp(await antwort.body()).stats();
    erwarte(dominant.r > dominant.b, "Nicht das erste (rote) Bild wurde übernommen.");
    return { satz: "Ein animiertes GIF wird angenommen, als einzelnes WebP-Bild (erstes Bild) gespeichert und als Profilfoto angezeigt." };
  });

  const referentId = (
    await ref.locator('img[src^="/api/portraet/"]').getAttribute("src")
  ).match(/\/api\/portraet\/([^/?]+)/)?.[1];
  erwarte(Boolean(referentId), "Referenten-ID ließ sich nicht aus der Foto-Adresse lesen.");

  await pruefe("Foto mit falschem Format", async () => {
    const vorherigeSrc = await ref.locator('img[src^="/api/portraet/"]').getAttribute("src");
    await ref.locator('input[name="foto"]').setInputFiles({
      name: "kein-bild.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("kein Bild"),
    });
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    await ref.getByText("Nur JPEG, PNG, WebP oder GIF sind erlaubt.").waitFor({ timeout: 15_000 });
    erwarte(
      (await ref.locator('img[src^="/api/portraet/"]').getAttribute("src")) === vorherigeSrc,
      "Trotz falschem Typ wurde ein neues Profilfoto gespeichert.",
    );
    return { satz: "Die Server Action weist einen nicht erlaubten MIME-Typ mit Feldmeldung ab." };
  });

  await pruefe("Foto mit rund drei Megabyte geht durch", async () => {
    // 1024×1024 reines Rauschen, ohne PNG-Kompression: die Datei bleibt nah
    // an 1024*1024*3 Byte ≈ 3 MB, ein realistischer Alltagsfall für ein
    // Handyfoto. Vorher (Zusatzfund Z1) scheiterte das schon am
    // Server-Action-Bodylimit von 1 MB; next.config.ts erlaubt jetzt 6 MB.
    const bild = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        noise: { type: "gaussian", mean: 128, sigma: 50 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    erwarte(bild.length > 2 * 1024 * 1024, `Das Testbild ist mit ${bild.length} Byte unerwartet klein.`);

    // Das GIF-Foto aus dem Fall davor steht schon da: erst die geänderte Adresse beweist den neuen Upload.
    const srcDavor = await ref.locator('img[src^="/api/portraet/"]').getAttribute("src");
    await ref.locator('input[name="foto"]').setInputFiles({
      name: "rund-drei-mb.png",
      mimeType: "image/png",
      buffer: bild,
    });
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    await ref.waitForFunction(
      (alt) => {
        const bild = document.querySelector('img[src^="/api/portraet/"]');
        return bild && bild.getAttribute("src") !== alt;
      },
      srcDavor,
      { timeout: 20_000 },
    );
    return {
      satz: `Ein rund ${(bild.length / (1024 * 1024)).toFixed(1)}-MB-Foto wird gespeichert und als Profilfoto angezeigt.`,
    };
  });

  await pruefe("Foto größer als fünf Megabyte", async () => {
    // Der vorige Fall hat bereits ein gültiges Foto gespeichert — hier zählt
    // deshalb nicht „kein Bild sichtbar“, sondern „das bestehende Foto bleibt
    // unverändert“ (gleiche src samt Cache-Buster).
    const vorherigeSrc = await ref.locator('img[src^="/api/portraet/"]').getAttribute("src");
    await ref.locator('input[name="foto"]').setInputFiles({
      name: "zu-gross.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 1),
    });
    // Seit 03.10. prüft der Browser die Größe schon beim Wählen und schickt
    // nichts ab. Es darf also kein POST kommen, die Feldmeldung steht sofort.
    let posts = 0;
    const zaehle = (r) => { if (r.url().includes("/admin/konto") && r.method() === "POST") posts += 1; };
    ref.on("request", zaehle);
    await ref.getByRole("button", { name: "Foto speichern" }).click().catch(() => {});
    await ref.waitForTimeout(1500);
    ref.off("request", zaehle);
    erwarte(posts === 0, `Eine zu große Datei wurde trotzdem abgeschickt (${posts} POST).`);
    await ref.getByText(/zu groß/i).first().waitFor({ timeout: 15_000 });
    const nachherSrc = await ref.locator('img[src^="/api/portraet/"]').getAttribute("src");
    erwarte(nachherSrc === vorherigeSrc, "Trotz Größenüberschreitung wurde ein neues Profilfoto gespeichert.");
    return { satz: "Eine Datei über fünf Megabyte wird schon im Browser mit verständlicher Meldung abgelehnt, ohne Upload." };
  });
  await pruefe("HEIC-Foto zeigt die eigene Meldung", async () => {
    // Dummy mit HEIC-Typ und Endung: die Server Action erkennt es vor der Bildverarbeitung.
    const vorherigeSrc = await ref.locator('img[src^="/api/portraet/"]').getAttribute("src");
    await ref.locator('input[name="foto"]').setInputFiles({
      name: "IMG_0001.HEIC",
      mimeType: "image/heic",
      buffer: Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(2048, 7)]),
    });
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    await ref.getByText(/iPhone-Fotos im HEIC-Format bitte vorher als JPEG sichern/).waitFor({ timeout: 15_000 });
    erwarte(
      (await ref.locator('img[src^="/api/portraet/"]').getAttribute("src")) === vorherigeSrc,
      "Trotz HEIC wurde ein neues Foto gespeichert.",
    );
    return { satz: "Eine HEIC-Datei (auch ohne passenden Typ nur an der Endung) erzeugt die verständliche HEIC-Meldung." };
  });

  await pruefe("HEIC nur an der Endung erkannt (Typ leer)", async () => {
    await ref.waitForTimeout(1000);
    await ref.locator('input[name="foto"]').setInputFiles({
      name: "foto.heif",
      mimeType: "",
      buffer: Buffer.alloc(1024, 3),
    });
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    await ref.getByText(/iPhone-Fotos im HEIC-Format/).waitFor({ timeout: 15_000 });
    return { satz: "Auch ohne MIME-Typ greift die Endung .heif." };
  });

  await pruefe("Unlesbares Bild wird abgelehnt und protokolliert", async () => {
    // React setzt das Formular nach der vorigen Aktion kurz verzögert zurück und würde die Datei sonst wieder leeren.
    await ref.waitForTimeout(1000);
    await ref.locator('input[name="foto"]').setInputFiles({
      name: "kaputt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("das ist kein jpeg"),
    });
    await ref.getByRole("button", { name: "Foto speichern" }).click();
    await ref.getByText(/lässt sich nicht als Bild lesen/).waitFor({ timeout: 15_000 });
    return { satz: "Eine beschädigte JPEG-Datei bekommt die Unlesbar-Meldung." };
  });

  await pruefe("Abgelehnte Uploads stehen im AuditLog (UPLOAD_ABGELEHNT)", async () => {
    const zeilen = sql(
      `SELECT details->>'grund' || '|' || (details->>'mimeType') || '|' || (details->>'endung') || '|' || (details->>'groesseKb') || '|' || entitaet FROM "AuditLog" WHERE aktion='UPLOAD_ABGELEHNT' AND "entitaetId"='${referentId}' ORDER BY at`,
    ).split("\n");
    const gruende = zeilen.map((z) => z.split("|")[0]);
    // zu_gross erreicht den Server seit 03.10. nicht mehr, der Browser prüft vorher
    for (const g of ["falscher_typ", "heic", "unlesbar"]) {
      erwarte(gruende.includes(g), `Kein AuditLog-Eintrag mit Grund ${g}. Gefunden: ${zeilen.join(" ; ")}`);
    }
    erwarte(zeilen.some((z) => z === "heic|image/heic|heic|2|Referent"), `HEIC-Eintrag nicht wie erwartet: ${zeilen.join(" ; ")}`);
    const voll = sql(`SELECT count(*) FROM "AuditLog" WHERE aktion='UPLOAD_ABGELEHNT' AND details::text ILIKE '%IMG_0001%'`);
    erwarte(voll === "0", "Der volle Dateiname steht im AuditLog.");
    return { satz: `AuditLog hat Einträge UPLOAD_ABGELEHNT mit Grund, MIME-Typ, Endung und Größe (${gruende.join(", ")}), ohne vollen Dateinamen.` };
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
