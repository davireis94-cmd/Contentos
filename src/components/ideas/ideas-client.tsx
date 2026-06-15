"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Lightbulb, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContentIdea, IdeaFormat, IdeaObjective } from "@/lib/skills/idea-generation";

const FORMAT_LABELS: Record<IdeaFormat, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Post único",
};

const OBJECTIVE_LABELS: Record<IdeaObjective, string> = {
  awareness: "Alcance",
  engagement: "Engajamento",
  saves: "Salvável",
  conversion: "Conversão",
};

// O gerador usa outro enum de objetivo — mapeia para pré-preencher o briefing.
const OBJECTIVE_TO_GEN: Record<IdeaObjective, string> = {
  awareness: "inspire",
  engagement: "engage",
  saves: "educate",
  conversion: "sell",
};

const SOURCE_STYLE: Record<string, string> = {
  tendência: "bg-amber-50 text-amber-700 border-amber-200",
  performance: "bg-green-50 text-green-700 border-green-200",
  marca: "bg-blue-50 text-blue-700 border-blue-200",
};

function generateHref(idea: ContentIdea, brandId: string | null): string {
  const params = new URLSearchParams({
    topic: idea.angle ? `${idea.hook} — ${idea.angle}` : idea.hook,
    format: idea.format,
    objective: OBJECTIVE_TO_GEN[idea.objective],
  });
  if (brandId) params.set("brandId", brandId);
  return `/generate?${params.toString()}`;
}

function IdeaCard({ idea, brandId }: { idea: ContentIdea; brandId: string | null }) {
  const [copied, setCopied] = useState(false);
  const copyText = idea.angle ? `${idea.hook}\n${idea.angle}` : idea.hook;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="font-medium leading-snug">{idea.hook}</p>
        </div>
        {idea.angle && <p className="text-sm text-muted-foreground">{idea.angle}</p>}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{FORMAT_LABELS[idea.format]}</Badge>
          <Badge variant="outline">{OBJECTIVE_LABELS[idea.objective]}</Badge>
          {idea.pillar && <Badge variant="secondary">{idea.pillar}</Badge>}
          <Badge variant="outline" className={SOURCE_STYLE[idea.source] ?? ""}>
            {idea.source}
          </Badge>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button asChild size="sm">
            <Link href={generateHref(idea, brandId)}>
              <Wand2 className="size-3.5" /> Gerar este
            </Link>
          </Button>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(copyText);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {copied ? (
              <><Check className="size-3 text-green-600" /> Copiado</>
            ) : (
              <><Copy className="size-3" /> Copiar</>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  brands: { id: string; name: string }[];
}

export function IdeasClient({ brands }: Props) {
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? "");
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedBrandId, setUsedBrandId] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brandId || undefined, count: 12 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Falha ao gerar pautas.");
        return;
      }
      setIdeas(data.ideas ?? []);
      setUsedBrandId(data.brandId ?? brandId ?? null);
    } catch {
      setError("Erro de conexão. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {brands.length > 1 && (
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Escolha a marca" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button onClick={generate} disabled={loading}>
          {loading ? (
            <><Loader2 className="size-4 animate-spin" /> Gerando pautas...</>
          ) : (
            <><Sparkles className="size-4" /> {ideas.length ? "Gerar novas pautas" : "Gerar pautas"}</>
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!ideas.length && !loading && !error && (
        <p className="text-sm text-muted-foreground">
          Clique em “Gerar pautas” para receber um lote de ideias prontas para produzir.
        </p>
      )}

      {ideas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {ideas.map((idea, i) => (
            <IdeaCard key={i} idea={idea} brandId={usedBrandId} />
          ))}
        </div>
      )}
    </div>
  );
}
