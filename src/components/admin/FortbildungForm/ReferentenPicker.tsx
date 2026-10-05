"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { ReferentOption } from "./types";
import { T } from "@/texte/de";

export function ReferentenPicker({
  referenten,
  ausgewaehlt,
  onChange,
}: {
  referenten: ReferentOption[];
  ausgewaehlt: string[];
  onChange: (ids: string[]) => void;
}) {
  const [suche, setSuche] = useState("");
  const gesetzt = new Set(ausgewaehlt);

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    if (!begriff) return referenten;

    return referenten.filter((r) =>
      `${r.vorname} ${r.nachname} ${r.organisation ?? ""}`
        .toLowerCase()
        .includes(begriff),
    );
  }, [referenten, suche]);

  const gewaehlte = referenten.filter((r) => gesetzt.has(r.id));

  function umschalten(id: string, aktiv: boolean) {
    onChange(aktiv ? [...ausgewaehlt, id] : ausgewaehlt.filter((v) => v !== id));
  }

  return (
    <div className="space-y-4">
      {ausgewaehlt.map((id) => (
        <input key={id} type="hidden" name="referenten" value={id} />
      ))}

      {gewaehlte.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {gewaehlte.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 bg-secondary px-2 py-1 text-xs font-medium"
            >
              {r.vorname} {r.nachname}
              {r.organisation ? (
                <span className="text-muted-foreground">· {r.organisation}</span>
              ) : null}
              <button
                type="button"
                onClick={() => umschalten(r.id, false)}
                aria-label={T.maske.referentenPicker.entfernenAriaLabel(`${r.vorname} ${r.nachname}`)}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {referenten.length === 0 ? (
        <p className="border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {T.maske.referentenPicker.keineReferenten}{" "}
          <Link
            href="/admin/referenten"
            className="text-foreground underline underline-offset-4"
          >
            {T.maske.referentenPicker.jetztAnlegen}
          </Link>
        </p>
      ) : (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={T.maske.referentenPicker.suchePlatzhalter}
              aria-label={T.maske.referentenPicker.sucheAriaLabel}
              className="w-full pl-8"
            />
          </div>

          <div className="max-h-72 space-y-0.5 overflow-y-auto border p-1">
            {gefiltert.length === 0 ? (
              <p className="px-2.5 py-4 text-center text-sm text-muted-foreground">
                {T.maske.referentenPicker.keinTreffer(suche)}
              </p>
            ) : (
              gefiltert.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 transition-colors hover:bg-accent/50"
                >
                  <Checkbox
                    checked={gesetzt.has(r.id)}
                    onCheckedChange={(checked) => umschalten(r.id, checked)}
                  />
                  <span className="text-sm">
                    {r.nachname}, {r.vorname}
                    {r.organisation ? (
                      <span className="ml-1.5 text-muted-foreground">
                        · {r.organisation}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            <Link
              href="/admin/referenten"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              <UserPlus className="size-3" aria-hidden />
              {T.maske.referentenPicker.neueReferentinAnlegen}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
