"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { T } from "@/texte/de";

/**
 * WYSIWYG-Editor für die Lehrgangsbeschreibung.
 *
 * Gibt HTML nach außen. Das wird serverseitig noch einmal durch die Allowlist
 * in src/lib/sanitize.ts gefiltert — der Editor ist eine Bedienhilfe, keine
 * Sicherheitsgrenze.
 */
export function RichTextEditor({
  wert,
  onChange,
  fehlerhaft,
}: {
  wert: string;
  onChange: (html: string) => void;
  fehlerhaft?: boolean;
}) {
  const editor = useEditor({
    // Ohne diese Zeile warnt Tiptap beim Server-Rendering vor Hydration-Fehlern.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Der Sanitizer lässt diese Elemente ohnehin nicht durch.
        horizontalRule: false,
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
      }),
    ],
    content: wert,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "beschreibung min-h-40 w-full px-3 py-2 text-sm outline-none [&_p]:leading-relaxed",
      },
    },
  });

  if (!editor) {
    return (
      <div className="h-52 animate-pulse border border-input bg-muted/40" />
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        fehlerhaft && "border-destructive ring-3 ring-destructive/20",
      )}
    >
      <Werkzeugleiste editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Werkzeugleiste({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
      <Knopf
        aktiv={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        titel={T.maske.richTextEditor.fett}
      >
        <Bold className="size-4" />
      </Knopf>
      <Knopf
        aktiv={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        titel={T.maske.richTextEditor.kursiv}
      >
        <Italic className="size-4" />
      </Knopf>
      <Knopf
        aktiv={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        titel={T.maske.richTextEditor.durchgestrichen}
      >
        <Strikethrough className="size-4" />
      </Knopf>

      <Trenner />

      <Knopf
        aktiv={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        titel={T.maske.richTextEditor.ueberschrift}
      >
        <span className="text-xs font-semibold">{T.maske.richTextEditor.ueberschriftKurz}</span>
      </Knopf>
      <Knopf
        aktiv={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        titel={T.maske.richTextEditor.unterueberschrift}
      >
        <span className="text-xs font-semibold">{T.maske.richTextEditor.unterueberschriftKurz}</span>
      </Knopf>

      <Trenner />

      <Knopf
        aktiv={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        titel={T.maske.richTextEditor.aufzaehlung}
      >
        <List className="size-4" />
      </Knopf>
      <Knopf
        aktiv={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        titel={T.maske.richTextEditor.nummerierteListe}
      >
        <ListOrdered className="size-4" />
      </Knopf>
      <Knopf
        aktiv={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        titel={T.maske.richTextEditor.zitat}
      >
        <Quote className="size-4" />
      </Knopf>

      <Trenner />

      <Knopf
        aktiv={editor.isActive("link")}
        onClick={() => {
          const bisher = editor.getAttributes("link").href as string | undefined;
          const eingabe = window.prompt(T.maske.richTextEditor.linkAdressePrompt, bisher ?? "https://");
          if (eingabe === null) return;
          if (eingabe.trim() === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().setLink({ href: eingabe.trim() }).run();
        }}
        titel={T.maske.richTextEditor.linkSetzen}
      >
        <Link2 className="size-4" />
      </Knopf>
      <Knopf
        onClick={() => editor.chain().focus().unsetLink().run()}
        deaktiviert={!editor.isActive("link")}
        titel={T.maske.richTextEditor.linkEntfernen}
      >
        <Link2Off className="size-4" />
      </Knopf>

      <div className="ml-auto flex items-center gap-0.5">
        <Knopf
          onClick={() => editor.chain().focus().undo().run()}
          deaktiviert={!editor.can().undo()}
          titel={T.maske.richTextEditor.rueckgaengig}
        >
          <Undo2 className="size-4" />
        </Knopf>
        <Knopf
          onClick={() => editor.chain().focus().redo().run()}
          deaktiviert={!editor.can().redo()}
          titel={T.maske.richTextEditor.wiederherstellen}
        >
          <Redo2 className="size-4" />
        </Knopf>
      </div>
    </div>
  );
}

function Knopf({
  children,
  onClick,
  aktiv,
  deaktiviert,
  titel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  aktiv?: boolean;
  deaktiviert?: boolean;
  titel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deaktiviert}
      title={titel}
      aria-label={titel}
      aria-pressed={aktiv}
      className={cn(
        "flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        aktiv && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Trenner() {
  return <span className="mx-1 h-4 w-px bg-border" aria-hidden />;
}
