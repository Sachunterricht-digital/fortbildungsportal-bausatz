import sanitizeHtml from "sanitize-html";

/**
 * Allowlist für den WYSIWYG-Editor.
 *
 * Der Editor-Inhalt kommt als HTML vom Client und wird später ungeprüft ins
 * DOM gerendert. Ohne diese Filterung wäre das eine gespeicherte
 * XSS-Schwachstelle — jede Person mit Redaktionszugang könnte Skriptcode bei
 * allen Besuchern des öffentlichen Frontends ausführen.
 *
 * Erlaubt ist nur, was der Editor auch anbietet.
 */
const OPTIONEN: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "code",
    "pre",
    "a",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
  },
  // javascript: und data: sind damit ausgeschlossen.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  transformTags: {
    // Externe Links immer in neuem Tab und ohne Referrer-Leak öffnen.
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      },
    }),
  },
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
};

/** Filtert HTML aus dem Editor auf die Allowlist. */
export function sanitizeBeschreibung(html: string): string {
  return sanitizeHtml(html, OPTIONEN).trim();
}

/**
 * Klartext-Fassung für die Volltextsuche.
 * Blockelemente werden zu Leerzeichen, damit "…Ende</p><p>Anfang…" nicht zu
 * einem zusammengeklebten Wort wird.
 */
export function htmlZuText(html: string): string {
  const mitTrennern = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ");

  return sanitizeHtml(mitTrennern, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ist im Editor überhaupt Inhalt? (`<p></p>` ist für den Editor "leer") */
export function istLeer(html: string): boolean {
  return htmlZuText(html).length === 0;
}
