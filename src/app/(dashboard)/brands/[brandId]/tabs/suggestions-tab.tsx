"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateBrandSuggestions, type Suggestion } from "../../actions";

const FORMAT_LABEL: Record<string, string> = {
  carrossel: "Carrossel",
  reel: "Reel",
  story: "Story",
  post: "Post",
};

interface Props {
  brandId: string;
  brandName: string;
  references: { name: string; handle: string | null }[];
}

export function SuggestionsTab({ brandId, brandName, references }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateBrandSuggestions(brandId);
      if (result.error && result.error !== "NO_REFERENCES") {
        setError(result.error);
      } else if (result.suggestions) {
        setSuggestions(result.suggestions);
        setGenerated(true);
      }
    });
  }

  /* ── No references ── */
  if (references.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center space-y-3">
        <Sparkles className="mx-auto size-7 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium">Referências de mercado necessárias</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Adicione pelo menos uma referência de mercado (concorrente ou inspiração) para desbloquear sugestões de conteúdo baseadas em análise competitiva.
          </p>
        </div>
        <Link
          href={`/brands/${brandId}?tab=references`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Adicionar referências →
        </Link>
      </div>
    );
  }

  /* ── Has references ── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Sugestões baseadas em análise competitiva</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Analisando:{" "}
            {references.map((r) => r.handle ?? r.name).join(", ")}
          </p>
        </div>
        {generated ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={isPending}
            className="shrink-0"
          >
            {isPending ? (
              <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Gerando…</>
            ) : (
              <><RefreshCw className="mr-1.5 size-3.5" />Regenerar</>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={generate}
            disabled={isPending}
            className="shrink-0"
          >
            {isPending ? (
              <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Gerando…</>
            ) : (
              <><Sparkles className="mr-1.5 size-3.5" />Gerar sugestões</>
            )}
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Empty / loading state */}
      {!generated && !isPending && !error && (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
          <Sparkles className="mx-auto size-5 text-muted-foreground/25" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            A IA vai analisar seus concorrentes e gerar ideias de conteúdo
            <br />
            alinhadas com a voz e posicionamento de <strong>{brandName}</strong>.
          </p>
        </div>
      )}

      {isPending && (
        <div className="rounded-lg border p-8 text-center space-y-2">
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Analisando referências e gerando sugestões…</p>
        </div>
      )}

      {/* Suggestion cards */}
      {!isPending && suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-2.5">
              {/* Format + Pillar badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {FORMAT_LABEL[s.format] ?? s.format}
                </span>
                {s.pillar && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">
                    {s.pillar}
                  </span>
                )}
              </div>

              {/* Hook — the star */}
              <p className="text-sm font-semibold leading-snug">"{s.hook}"</p>

              {/* Topic */}
              <p className="text-xs text-muted-foreground">{s.topic}</p>

              {/* Rationale */}
              <p className="text-[11px] text-muted-foreground/70 italic border-l-2 border-border pl-2">
                {s.rationale}
              </p>

              {/* CTA */}
              <Link
                href={`/generate?brandId=${brandId}&topic=${encodeURIComponent(s.topic)}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                Gerar este conteúdo →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
