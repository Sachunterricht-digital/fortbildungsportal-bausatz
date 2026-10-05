"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ladeSchulamt } from "@/lib/schulamt";
import { prisma } from "@/lib/prisma";
import { AuthError, ERFASSER, darfBearbeiten, requireRole, type SessionUser } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { sanitizeBeschreibung, htmlZuText } from "@/lib/sanitize";
import { bearbeitenLink, bildeSlug, oeffentlicherLink } from "@/lib/queries";
import { normalisiereSchlagwortListe, schlagwortSchluessel } from "@/lib/schlagwort";
import { sendeMail, vornameAus } from "@/lib/mail";
import { sendeFreigabeMail } from "@/actions/freigabe";
import { formatZeitraum } from "@/lib/datetime";
import {
  STATUS_FUER_REFERENTEN,
  darfFreigeben,
  formatLabel,
  schulartLabel,
  type Rolle,
} from "@/constants/fortbildung";
import {
  FortbildungSchema,
  fehlendeReferentIds,
  formDataZuEingabe,
  pruefeVeroeffentlichung,
  zuFeldFehlern,
  type FormularState,
} from "@/lib/validation/fortbildung";
import { T } from "@/texte/de";

/**
 * Anlegen und Ändern einer Fortbildung.
 *
 * `id` wird über `.bind()` vorgegeben (siehe FortbildungForm) — leer bedeutet
 * "neu anlegen".
 */
/** Reiter der Bearbeitungsmaske, die nach dem Speichern wieder geöffnet werden dürfen. */
const TAB_IDS = ["eckdaten", "beschreibung", "zielgruppe", "digcomp", "referenten"];

export async function saveFortbildung(
  id: string | null,
  _bisher: FormularState,
  formData: FormData,
): Promise<FormularState> {
  let user;
  try {
    user = await requireRole(...ERFASSER);
  } catch (error) {
    if (error instanceof AuthError) return { fehler: { _: error.message } };
    throw error;
  }

  // Referentinnen und Referenten dürfen nur an ihre eigenen Termine.
  if (id && !(await darfBearbeiten(user, id))) {
    return {
      fehler: { _: T.maske.actionsFortbildung.nichtIhreVeranstaltung },
    };
  }

  const geparst = FortbildungSchema.safeParse(formDataZuEingabe(formData));
  if (!geparst.success) {
    return { fehler: zuFeldFehlern(geparst.error) };
  }

  const daten = geparst.data;

  // Redaktionsfelder (Kurztitel, Fach, Niveaustufe, DigCompEdu, FIBS) pflegt
  // nur die Redaktion. Referenten sehen sie nicht und schicken sie leer mit,
  // deshalb gelten für sie die gespeicherten Werte.
  const redaktion = user.role !== "REFERENT";
  if (!redaktion) {
    const bisher = id
      ? await prisma.fortbildung.findUnique({
          where: { id },
          select: {
            kurztitel: true,
            fach: true,
            niveaustufe: true,
            fibsLehrgangsnummer: true,
            fibsUrl: true,
            kompetenzen: { select: { kompetenzCode: true } },
          },
        })
      : null;
    daten.kurztitel = bisher?.kurztitel ?? null;
    daten.fach = bisher?.fach ?? null;
    daten.niveaustufe = (bisher?.niveaustufe ?? null) as typeof daten.niveaustufe;
    daten.fibsLehrgangsnummer = bisher?.fibsLehrgangsnummer ?? null;
    daten.fibsUrl = bisher?.fibsUrl ?? null;
    daten.kompetenzen = bisher?.kompetenzen.map((k) => k.kompetenzCode) ?? [];
  }

  // --- Was diese Rolle mit dem Status tun darf ------------------------------
  if (!darfFreigeben(user.role)) {
    const bisher = id
      ? await prisma.fortbildung.findUnique({
          where: { id },
          select: { status: true },
        })
      : null;

    // Ein bereits veröffentlichtes Thema bleibt inhaltlich offen — die
    // Änderung geht sofort online, ohne neue Freigabe (siehe
    // STATUS_REFERENT_BEARBEITBAR). Der Statuswechsel dahin bleibt aber der
    // Administration vorbehalten: erlaubt ist das mitgeschickte
    // "VEROEFFENTLICHT" nur, wenn der Datensatz das schon vorher war, nie als
    // neuer Übergang von einem Referenten-Request.
    const bleibtVeroeffentlicht =
      bisher?.status === "VEROEFFENTLICHT" && daten.status === "VEROEFFENTLICHT";

    if (!STATUS_FUER_REFERENTEN.includes(daten.status) && !bleibtVeroeffentlicht) {
      return {
        fehler: {
          status: T.maske.actionsFortbildung.veroeffentlichenNurAdmin,
        },
      };
    }

    // Abgesagte oder archivierte Themen darf ein Referent nicht mehr
    // anfassen — die Entscheidung darüber liegt endgültig bei der
    // Administration.
    if (
      bisher &&
      !STATUS_FUER_REFERENTEN.includes(bisher.status as never) &&
      bisher.status !== "VEROEFFENTLICHT"
    ) {
      return {
        fehler: {
          _: T.maske.actionsFortbildung.bereitsFreigegeben,
        },
      };
    }
  } else if (id && daten.status === "ENTWURF") {
    // Ein eingereichtes Thema geht über dieses Formular nicht zurück auf
    // Entwurf — dafür gibt es „Zurückweisen“ mit Begründung und Mail an die
    // einreichende Person. Referentinnen und Referenten dürfen das weiterhin
    // selbst (eigener Zwischenstand speichern), siehe Zweig oben.
    const bisher = await prisma.fortbildung.findUnique({
      where: { id },
      select: { status: true },
    });
    if (bisher?.status === "EINGEREICHT") {
      return {
        fehler: { status: T.maske.actionsFortbildung.zurueckAufEntwurfGesperrt },
      };
    }
  }

  // --- Kompetenzcodes gegen den Rahmen prüfen -------------------------------
  const gueltigeCodes = await bekannteKompetenzCodes(daten.kompetenzen);
  const unbekannt = daten.kompetenzen.filter((code) => !gueltigeCodes.has(code));
  if (unbekannt.length > 0) {
    return {
      fehler: {
        kompetenzen: T.maske.actionsFortbildung.unbekannteKompetenzen(unbekannt.join(", ")),
      },
    };
  }

  // Erst gegen die Datenbank auflösen: Eine manipulierte, aber formal gültige
  // UUID darf die Veröffentlichungs-Pflicht nicht nur scheinbar erfüllen. Nur
  // aktive Personen sind neu auswählbar — eine historische Zuordnung, die
  // schon vor dem Speichern bestand, bleibt aber erhalten, auch wenn die
  // Person inzwischen deaktiviert wurde.
  const bereitsZugeordneteReferenten = id
    ? (
        await prisma.fortbildungReferent.findMany({
          where: { fortbildungId: id },
          select: { referentId: true },
        })
      ).map((r) => r.referentId)
    : [];
  const referentIds = await pruefeReferenten(daten.referenten, bereitsZugeordneteReferenten);
  const fehlendeReferenten = fehlendeReferentIds(daten.referenten, referentIds);
  if (fehlendeReferenten.length > 0) {
    return {
      fehler: {
        referenten: T.maske.actionsFortbildung.referentenFehlen,
      },
    };
  }

  const unvollstaendig = pruefeVeroeffentlichung({
    ...daten,
    referenten: referentIds,
  });
  if (unvollstaendig) return { fehler: unvollstaendig };

  const schlagwortIds = await schlagworteAufloesen(daten.schlagworte);

  const beschreibungHtml = sanitizeBeschreibung(daten.beschreibungHtml);
  const beschreibungText = htmlZuText(beschreibungHtml);

  const basisDaten = {
    titel: daten.titel,
    kurztitel: daten.kurztitel,
    beschreibungHtml,
    beschreibungText,
    organisationsform: daten.organisationsform,
    maxTn: daten.maxTn,
    format: daten.format,
    beginn: daten.beginn,
    ende: daten.ende,
    ortText: daten.ortText,
    schularten: daten.schularten,
    fach: daten.fach,
    niveaustufe: daten.niveaustufe ?? null,
    fibsLehrgangsnummer: daten.fibsLehrgangsnummer,
    fibsUrl: daten.fibsUrl,
    status: daten.status,
  };

  const verknuepfungen = {
    schlagworte: {
      create: schlagwortIds.map((schlagwortId) => ({ schlagwortId })),
    },
    kompetenzen: {
      create: daten.kompetenzen.map((kompetenzCode) => ({ kompetenzCode })),
    },
    referenten: {
      create: referentIds.map((referentId) => ({ referentId })),
    },
  };

  let fortbildungId: string;
  let vorherigerStatus: string | null = null;

  if (id) {
    const bestehend = await prisma.fortbildung.findUnique({
      where: { id },
      select: { id: true, titel: true, beginn: true, slug: true, status: true },
    });
    if (!bestehend) return { fehler: { _: T.maske.actionsFortbildung.fortbildungExistiertNicht } };
    vorherigerStatus = bestehend.status;

    // Optimistische Sperre: Das Formular schickt den zuletzt gesehenen
    // updatedAt-Stand verdeckt mit. Weicht er vom aktuellen Datenbankstand ab
    // — ein anderer Tab, eine zwischenzeitliche Freigabe — trifft das Update
    // keine Zeile mehr. Fehlt der Wert (altes oder manipuliertes Formular),
    // greift ein Datum, das nie zutrifft, damit die Sperre nicht lautlos
    // umgangen werden kann.
    const erwarteteUpdatedAtRoh = formData.get("updatedAt");
    const erwarteteUpdatedAt =
      typeof erwarteteUpdatedAtRoh === "string" && erwarteteUpdatedAtRoh
        ? new Date(erwarteteUpdatedAtRoh)
        : null;
    const gueltigeSperre =
      erwarteteUpdatedAt && !Number.isNaN(erwarteteUpdatedAt.getTime())
        ? erwarteteUpdatedAt
        : new Date(0);

    // Verknüpfungen komplett ersetzen: Die Auswahl im Formular ist der neue
    // Sollzustand, ein Diff wäre hier nur mehr Code ohne Gewinn. Interaktive
    // Transaktion, weil die Relationstabellen nur angefasst werden dürfen,
    // wenn die Sperre oben tatsächlich gegriffen hat.
    const konflikt = await prisma.$transaction(async (tx) => {
      const aktualisiert = await tx.fortbildung.updateMany({
        where: { id, updatedAt: gueltigeSperre },
        data: {
          ...basisDaten,
          ...statusMetadaten(bestehend.status, daten.status, user),
          // Slug nur nachziehen, wenn sich Titel oder Datum geändert haben —
          // sonst würden bereits geteilte Links ins Leere laufen.
          ...(bestehend.titel !== daten.titel ||
          bestehend.beginn?.getTime() !== daten.beginn?.getTime()
            ? { slug: bildeSlug(daten.titel, daten.beginn, bestehend.id) }
            : {}),
        },
      });
      if (aktualisiert.count === 0) return true;

      await tx.fortbildungSchlagwort.deleteMany({ where: { fortbildungId: id } });
      await tx.fortbildungKompetenz.deleteMany({ where: { fortbildungId: id } });
      await tx.fortbildungReferent.deleteMany({ where: { fortbildungId: id } });
      await tx.fortbildung.update({ where: { id }, data: verknuepfungen });
      return false;
    });

    if (konflikt) {
      return { fehler: { _: T.maske.actionsFortbildung.konflikt } };
    }

    fortbildungId = id;
    await auditLog({
      userId: user.id,
      aktion: "UPDATE",
      entitaet: "Fortbildung",
      entitaetId: id,
      details: { titel: daten.titel, status: daten.status },
    });
  } else {
    const angelegt = await prisma.fortbildung.create({
      data: {
        ...basisDaten,
        ...statusMetadaten(null, daten.status, user),
        // Platzhalter, weil der Slug die ID braucht, die es erst nach dem
        // Insert gibt. Wird direkt darunter ersetzt.
        slug: `neu-${crypto.randomUUID()}`,
        createdById: user.id,
        quelle: "MANUELL",
        ...verknuepfungen,
      },
      select: { id: true },
    });

    await prisma.fortbildung.update({
      where: { id: angelegt.id },
      data: { slug: bildeSlug(daten.titel, daten.beginn, angelegt.id) },
    });

    fortbildungId = angelegt.id;
    await auditLog({
      userId: user.id,
      aktion: "CREATE",
      entitaet: "Fortbildung",
      entitaetId: fortbildungId,
      details: { titel: daten.titel, status: daten.status },
    });
  }

  // --- Bestätigungsmail beim Einreichen ------------------------------------
  // Erst gespeichert, dann versendet — ein Mailfehler darf das Einreichen nie
  // rückgängig machen. Nur beim tatsächlichen Übergang nach EINGEREICHT (auch
  // erneutes Einreichen nach Rückweisung), nicht bei jedem Zwischenspeichern.
  if (
    user.role === "REFERENT" &&
    daten.status === "EINGEREICHT" &&
    vorherigerStatus !== "EINGEREICHT"
  ) {
    await sendeEinreichBestaetigung(user, fortbildungId, {
      titel: daten.titel,
      format: daten.format,
      beginn: daten.beginn,
      ende: daten.ende,
      schularten: daten.schularten,
    });
  }

  // --- Freigabe-Mail, wenn die Administration direkt im Formular auf
  // „Veröffentlicht“ setzt ---------------------------------------------------
  // Derselbe Übergang wie in freigeben() (src/actions/freigabe.ts) — dieselbe
  // Funktion, damit es dafür nur eine Wahrheit gibt. Erst gespeichert, dann
  // versendet, ein Mailfehler darf die Veröffentlichung nie rückgängig machen.
  if (
    darfFreigeben(user.role) &&
    daten.status === "VEROEFFENTLICHT" &&
    vorherigerStatus !== "VEROEFFENTLICHT"
  ) {
    await sendeFreigabeMail(fortbildungId, user.id);
  }

  // --- Hinweis-Mail an die Dienstmail, wenn ein Referent ein bereits
  // freigegebenes Thema ändert -----------------------------------------------
  // Keine neue Freigabe: Die Änderung ist sofort online (siehe
  // STATUS_REFERENT_BEARBEITBAR). Admin-Änderungen lösen diese Mail bewusst
  // nicht aus, nur ein Speichern durch die Rolle REFERENT ist meldenswert.
  if (
    user.role === "REFERENT" &&
    vorherigerStatus === "VEROEFFENTLICHT" &&
    daten.status === "VEROEFFENTLICHT"
  ) {
    await sendeAenderungsHinweisMail(user, fortbildungId, daten.titel);
  }

  revalidatePath("/admin");
  revalidatePath("/fortbildungen");
  revalidatePath("/kalender");

  const tab = formData.get("tab");
  const tabZusatz =
    typeof tab === "string" && TAB_IDS.includes(tab) ? `&tab=${encodeURIComponent(tab)}` : "";
  redirect(`/admin/fortbildungen/${fortbildungId}?gespeichert=1${tabZusatz}`);
}

async function sendeEinreichBestaetigung(
  user: SessionUser,
  fortbildungId: string,
  angaben: {
    titel: string;
    format: string;
    beginn: Date | null;
    ende: Date | null;
    schularten: string[];
  },
): Promise<void> {
  const versendet = await sendeMail({
    an: user.email,
    betreff: T.mails.bestaetigung.betreff(angaben.titel),
    text: T.mails.bestaetigung.text({
      vorname: vornameAus(user.name, user.email),
      titel: angaben.titel,
      format: formatLabel(angaben.format),
      termin: formatZeitraum(angaben.beginn, angaben.ende),
      zielgruppe: angaben.schularten.map(schulartLabel).join(", "),
      link: bearbeitenLink(fortbildungId),
    }),
  });

  if (!versendet) {
    await auditLog({
      userId: user.id,
      aktion: "MAIL_FEHLER",
      entitaet: "Fortbildung",
      entitaetId: fortbildungId,
      details: { anlass: "einreichBestaetigung", an: user.email },
    });
  }
}

/** Adresse aus MAIL_BCC, gleicher Standardwert wie in src/lib/mail.ts. */
const DIENSTMAIL_STANDARD = "kontakt@example.org";

/**
 * Hinweis-Mail an die Dienstmail, wenn eine Referentin oder ein Referent ein
 * bereits veröffentlichtes Thema ändert. Geht nicht an den Referenten selbst
 * — die Änderung ist bereits online, es gibt keine neue Freigabe.
 */
async function sendeAenderungsHinweisMail(
  user: SessionUser,
  fortbildungId: string,
  titel: string,
): Promise<void> {
  const dienstmail = process.env.MAIL_BCC || DIENSTMAIL_STANDARD;

  const fortbildung = await prisma.fortbildung.findUnique({
    where: { id: fortbildungId },
    select: { slug: true },
  });

  const versendet = await sendeMail({
    an: dienstmail,
    betreff: T.mails.geaendertNachFreigabe.betreff(titel),
    text: T.mails.geaendertNachFreigabe.text({
      name: user.name ?? user.email,
      titel,
      linkAdmin: bearbeitenLink(fortbildungId),
      linkOeffentlich: fortbildung
        ? oeffentlicherLink(fortbildung.slug)
        : bearbeitenLink(fortbildungId),
    }),
  });

  if (!versendet) {
    await auditLog({
      userId: user.id,
      aktion: "MAIL_FEHLER",
      entitaet: "Fortbildung",
      entitaetId: fortbildungId,
      details: { anlass: "aenderungNachFreigabe", an: dienstmail },
    });
  }
}

/**
 * Zeitpunkte gehören zu einem Statusübergang, nicht zu jedem Speichern.
 * Sonst würde eine Textkorrektur die ursprüngliche Einreichung oder Freigabe
 * nachträglich auf den aktuellen Zeitpunkt verschieben.
 */
function statusMetadaten(
  bisher: string | null,
  naechster: string,
  user: { id: string; role: Rolle },
) {
  const daten: {
    eingereichtAm?: Date | null;
    freigegebenAm?: Date;
    freigegebenVonId?: string;
    freigabeNotiz?: null;
  } = {};

  if (naechster === "EINGEREICHT" && bisher !== "EINGEREICHT") {
    daten.eingereichtAm = new Date();
    daten.freigabeNotiz = null;
  } else if (naechster === "ENTWURF" && bisher === "EINGEREICHT") {
    daten.eingereichtAm = null;
  }

  if (
    naechster === "VEROEFFENTLICHT" &&
    bisher !== "VEROEFFENTLICHT" &&
    darfFreigeben(user.role)
  ) {
    daten.freigegebenAm = new Date();
    daten.freigegebenVonId = user.id;
    daten.freigabeNotiz = null;
  }

  return daten;
}

// ---------------------------------------------------------------------------
// Weitere Aktionen der Listenansicht
// ---------------------------------------------------------------------------

/**
 * Kopie anlegen. Wiederkehrende Formate sind der Alltagsfall — ohne diese
 * Funktion tippt das Medienteam denselben Lehrgang jedes Halbjahr neu.
 */
export async function duplizieren(id: string) {
  const user = await requireRole(...ERFASSER);
  if (!(await darfBearbeiten(user, id))) return;

  const quelle = await prisma.fortbildung.findUnique({
    where: { id },
    include: { schlagworte: true, kompetenzen: true, referenten: true },
  });
  if (!quelle) return;

  const kopie = await prisma.fortbildung.create({
    data: {
      titel: `${quelle.titel} (Kopie)`,
      kurztitel: quelle.kurztitel,
      beschreibungHtml: quelle.beschreibungHtml,
      beschreibungText: quelle.beschreibungText,
      organisationsform: quelle.organisationsform,
      maxTn: quelle.maxTn,
      format: quelle.format,
      beginn: quelle.beginn,
      ende: quelle.ende,
      veranstaltungsortId: quelle.veranstaltungsortId,
      ortText: quelle.ortText,
      schularten: quelle.schularten,
      fach: quelle.fach,
      niveaustufe: quelle.niveaustufe,
      // FIBS-Nummer bewusst NICHT kopieren: Sie gehört zu genau einem Termin.
      status: "ENTWURF",
      quelle: "MANUELL",
      createdById: user.id,
      slug: `kopie-${crypto.randomUUID()}`,
      schlagworte: {
        create: quelle.schlagworte.map((s) => ({ schlagwortId: s.schlagwortId })),
      },
      kompetenzen: {
        create: quelle.kompetenzen.map((k) => ({ kompetenzCode: k.kompetenzCode })),
      },
      referenten: {
        create: quelle.referenten.map((r) => ({
          referentId: r.referentId,
          rolle: r.rolle,
        })),
      },
    },
    select: { id: true },
  });

  await prisma.fortbildung.update({
    where: { id: kopie.id },
    data: { slug: bildeSlug(`${quelle.titel} Kopie`, quelle.beginn, kopie.id) },
  });

  await auditLog({
    userId: user.id,
    aktion: "CREATE",
    entitaet: "Fortbildung",
    entitaetId: kopie.id,
    details: { kopieVon: id },
  });

  redirect(`/admin/fortbildungen/${kopie.id}`);
}

export async function loeschen(id: string) {
  const user = await requireRole("ADMIN");

  const fortbildung = await prisma.fortbildung.findUnique({
    where: { id },
    select: { titel: true },
  });

  await prisma.fortbildung.delete({ where: { id } });
  await auditLog({
    userId: user.id,
    aktion: "DELETE",
    entitaet: "Fortbildung",
    entitaetId: id,
    details: { titel: fortbildung?.titel },
  });

  revalidatePath("/admin");
  redirect("/admin");
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

async function bekannteKompetenzCodes(codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();

  const treffer = await prisma.digCompKompetenz.findMany({
    where: { code: { in: codes }, aktiv: true },
    select: { code: true },
  });
  return new Set(treffer.map((t) => t.code));
}

/**
 * Schlagwort-Namen zu IDs auflösen und neue Begriffe anlegen.
 *
 * Die Pflicht-Schlagworte werden hier serverseitig ergänzt. Im Formular sind
 * sie zwar als nicht entfernbare Chips gesetzt, aber ein manipulierter Request
 * käme ohne sie an — und genau dann wären die Einträge in der späteren
 * FIBS-Suche nicht mehr auffindbar.
 */
async function schlagworteAufloesen(namen: string[]): Promise<string[]> {
  const { pflichtSchlagworte } = await ladeSchulamt();
  const eindeutig = normalisiereSchlagwortListe([
    ...pflichtSchlagworte,
    ...namen,
  ]);

  const ids: string[] = [];

  for (const name of eindeutig) {
    const normalisiert = schlagwortSchluessel(name);
    const schlagwort = await prisma.schlagwort.upsert({
      where: { normalisiert },
      update: {},
      create: {
        name,
        normalisiert,
        istPflicht: pflichtSchlagworte.some(
          (pflicht) => schlagwortSchluessel(pflicht) === normalisiert,
        ),
      },
      select: { id: true },
    });
    ids.push(schlagwort.id);
  }

  return ids;
}

/**
 * Nur aktive Personen sind als Leitung neu auswählbar — sonst könnte ein
 * öffentliches Angebot ohne erreichbare Leitung erscheinen, weil deaktivierte
 * Personen außen ohnehin herausgefiltert werden. `bereitsZugeordnet` lässt
 * eine historische Zuordnung unangetastet, auch wenn die Person inzwischen
 * deaktiviert wurde: Sonst ließe sich ein altes Thema mit einer ausgeschiedenen
 * Person nicht mehr speichern, ohne sie erst zu entfernen.
 */
async function pruefeReferenten(
  ids: string[],
  bereitsZugeordnet: string[] = [],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const vorhanden = await prisma.referent.findMany({
    where: { id: { in: ids } },
    select: { id: true, aktiv: true },
  });
  const historisch = new Set(bereitsZugeordnet);
  return vorhanden.filter((r) => r.aktiv || historisch.has(r.id)).map((r) => r.id);
}
