import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { prisma } from "@/lib/prisma";
import { T } from "@/texte/de";

/**
 * Rendert einen redaktionell gepflegten Text aus SystemSetting.
 *
 * Der Inhalt kommt als Markdown und wird von react-markdown gerendert — ohne
 * `rehype-raw`, HTML im Markdown wird also nicht ausgeführt.
 */
export async function SystemtextSeite({
  id,
  ueberschrift,
}: {
  id: string;
  ueberschrift: string;
}) {
  const eintrag = await prisma.systemSetting.findUnique({ where: { id } });

  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{ueberschrift}</h1>

      {eintrag?.value ? (
        <div className="beschreibung">
          <Markdown remarkPlugins={[remarkGfm]}>{eintrag.value}</Markdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {T.aussen.systemtextSeite.keinText}
        </p>
      )}
    </article>
  );
}
