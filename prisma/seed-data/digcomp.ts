/**
 * DigCompEdu Bavaria — amtlicher Kompetenzrahmen als Baum.
 *
 * Quelle: Bayerisches Staatsministerium für Unterricht und Kultus,
 * „DigCompEdu Bavaria – Digitale und medienbezogene Lehrkompetenzen“.
 * Die Quelle steht unter CC BY-SA 4.0 DE. Abgeglichen am 01.09.2026.
 *
 * Der Seed arbeitet über die stabilen Codes mit upsert. Titel und
 * Beschreibungen können daher aktualisiert werden, ohne bestehende
 * Fortbildungs-Zuordnungen zu verlieren.
 */

export interface KompetenzSeed {
  code: string;
  titel: string;
  beschreibung?: string;
  istPlatzhalter?: boolean;
  children: KompetenzSeed[];
}

export const DIGCOMP_BAUM: KompetenzSeed[] = [
  {
    code: "1",
    titel: "Berufsbezogenes Handeln",
    beschreibung:
      "Digitale Medien und Werkzeuge für Kommunikation, Zusammenarbeit, Reflexion und die berufliche Weiterentwicklung nutzen.",
    children: [
      {
        code: "1.1",
        titel: "Berufliche Kommunikation",
        beschreibung:
          "Digitale Medien zur Kommunikation mit Lernenden, Erziehungsberechtigten und Dritten nutzen und zur Verbesserung organisatorischer Kommunikationsstrategien beitragen.",
        children: [],
      },
      {
        code: "1.2",
        titel: "Kollegiale Zusammenarbeit",
        beschreibung:
          "Digitale Medien nutzen, um zusammenzuarbeiten, Erfahrungen und Materialien auszutauschen und gemeinsam Unterrichtskonzepte zu entwickeln.",
        children: [],
      },
      {
        code: "1.3",
        titel: "Reflektiertes Handeln",
        beschreibung:
          "Das pädagogische Handeln beim didaktisch sinnvollen Einsatz digitaler Medien individuell und als Gruppe reflektieren, beurteilen und weiterentwickeln.",
        children: [],
      },
      {
        code: "1.4",
        titel: "Kontinuierliche Weiterentwicklung",
        beschreibung:
          "Digitale Medien und Werkzeuge für die berufliche Entwicklung nutzen.",
        children: [],
      },
    ],
  },
  {
    code: "2",
    titel: "Digitale Ressourcen",
    beschreibung:
      "Digitale Lehr- und Lernressourcen auswählen, erstellen, anpassen, organisieren, schützen und teilen.",
    children: [
      {
        code: "2.1",
        titel: "Auswählen digitaler Ressourcen",
        beschreibung:
          "Geeignete digitale Lehr- und Lernressourcen identifizieren, auswerten und auswählen und dabei Kompetenzerwerb, Kontext, Didaktik und Lerngruppe berücksichtigen.",
        children: [],
      },
      {
        code: "2.2",
        titel: "Erstellen und Anpassen digitaler Ressourcen",
        beschreibung:
          "Digitale Lehr- und Lernressourcen unter Beachtung der Lizenzen modifizieren, weiterentwickeln und neu erstellen.",
        children: [],
      },
      {
        code: "2.3",
        titel: "Organisieren, Schützen und Teilen digitaler Ressourcen",
        beschreibung:
          "Digitale Inhalte organisieren und bereitstellen, personenbezogene Daten schützen sowie Datenschutz, Urheberrecht und freie Lizenzen korrekt anwenden.",
        children: [],
      },
    ],
  },
  {
    code: "3",
    titel: "Lehren und Lernen",
    beschreibung:
      "Digitale Medien und Werkzeuge didaktisch begründet für Lehren, Lernbegleitung sowie kollaboratives und selbstgesteuertes Lernen einsetzen.",
    children: [
      {
        code: "3.1",
        titel: "Lehren",
        beschreibung:
          "Digitale Medien und Werkzeuge gezielt einsetzen, um Lernprozesse zu unterstützen und neue Unterrichtsformate und -methoden zu entwickeln.",
        children: [],
      },
      {
        code: "3.2",
        titel: "Lernbegleitung",
        beschreibung:
          "Digitale Medien für eine bessere Interaktion mit Lernenden sowie für zeitnahe, gezielte Beratung und Unterstützung nutzen.",
        children: [],
      },
      {
        code: "3.3",
        titel: "Kollaboratives Lernen",
        beschreibung:
          "Digitale Medien nutzen, um kollaborative Lernstrategien zu fördern und durch Kommunikation und Kooperation neues Wissen zu erarbeiten.",
        children: [],
      },
      {
        code: "3.4",
        titel: "Selbstgesteuertes Lernen",
        beschreibung:
          "Digitale Technologien nutzen, damit Lernende ihr Lernen planen, reflektieren, dokumentieren und Ergebnisse kommunizieren können.",
        children: [],
      },
    ],
  },
  {
    code: "4",
    titel: "Lerndiagnose und Feedback",
    beschreibung:
      "Digitale Medien für Lernstandserhebung, Analyse der Lernevidenz sowie individuelles Feedback und Planung nutzen.",
    children: [
      {
        code: "4.1",
        titel: "Lernstandserhebung",
        beschreibung:
          "Digitale Medien für die Lernstandserhebung verwenden und damit Vielfalt und Angemessenheit von Beurteilungsformaten erhöhen.",
        children: [],
      },
      {
        code: "4.2",
        titel: "Analyse der Lernevidenz",
        beschreibung:
          "Daten zu Lernverhalten, Leistung und Fortschritt digital erheben, analysieren und interpretieren.",
        children: [],
      },
      {
        code: "4.3",
        titel: "Feedback und Planung",
        beschreibung:
          "Digitale Medien für gezieltes, zeitnahes und individuelles Feedback nutzen und darauf basierend Unterrichtsstrategien anpassen.",
        children: [],
      },
    ],
  },
  {
    code: "5",
    titel: "Schülerorientierung",
    beschreibung:
      "Digitale Teilhabe sichern, individuelle Lernwege ermöglichen und Lernende aktivieren.",
    children: [
      {
        code: "5.1",
        titel: "Barrierefreiheit und digitale Teilhabe",
        beschreibung:
          "Sicherstellen, dass alle Lernenden die eingesetzten digitalen Medien und Lernaktivitäten gemäß ihren Lernvoraussetzungen vollumfänglich nutzen können.",
        children: [],
      },
      {
        code: "5.2",
        titel: "Differenzierung",
        beschreibung:
          "Lernenden ermöglichen, individuelle Lernziele und das erforderliche Leistungsniveau im eigenen Lerntempo und auf individuellen Lernwegen zu erreichen.",
        children: [],
      },
      {
        code: "5.3",
        titel: "Schüleraktivierung",
        beschreibung:
          "Digitale Medien und Werkzeuge nutzen, um Lernende zu aktivieren und vertiefte, kreative sowie problemorientierte Auseinandersetzung zu fördern.",
        children: [],
      },
    ],
  },
  {
    code: "6",
    titel: "Förderung der Medienkompetenz der Lernenden",
    beschreibung:
      "Lernaktivitäten gestalten, die den systematischen Aufbau der Medienkompetenz der Lernenden fördern.",
    children: [
      {
        code: "6.1",
        titel: "Basiskompetenzen",
        beschreibung:
          "Lernende beim Identifizieren zugrunde liegender Informatiksysteme, beim Erkennen von Zusammenhängen und beim Problemlösen unterstützen.",
        children: [],
      },
      {
        code: "6.2",
        titel: "Suchen und Verarbeiten",
        beschreibung:
          "Lernende Informationen mit digitalen Medien finden, organisieren und verarbeiten sowie Quellen kritisch bewerten lassen.",
        children: [],
      },
      {
        code: "6.3",
        titel: "Kommunizieren und Kooperieren",
        beschreibung:
          "Lernende digitale Medien effektiv und verantwortungsbewusst für Kommunikation, Kooperation, Kollaboration und Partizipation nutzen lassen.",
        children: [],
      },
      {
        code: "6.4",
        titel: "Produzieren und Präsentieren",
        beschreibung:
          "Lernende digitale Inhalte und Medienprodukte zielgerichtet und unter Berücksichtigung rechtlicher Aspekte gestalten und präsentieren lassen.",
        children: [],
      },
      {
        code: "6.5",
        titel: "Analysieren und Reflektieren",
        beschreibung:
          "Lernende Medienangebote sowie Potenziale und Risiken der Digitalisierung kritisch analysieren und reflektiert nutzen lassen.",
        children: [],
      },
    ],
  },
];
