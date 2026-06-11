"use client";

import { useState } from "react";
import { ExternalLink, Lightbulb, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_LABELS, type Platform } from "@/types/app";
import { PlatformsField } from "./platforms-field";
import { addReference, deleteReference } from "../../actions";

interface Analysis {
  estrategia?: string;
  estilo?: string;
  pontos_fortes?: string[];
  formatos_frequentes?: string[];
  licoes?: string[];
  sugestoes?: { tema: string; formato: string; objetivo: string }[];
}

interface Reference {
  id: string;
  name: string;
  handle: string | null;
  platforms: Platform[];
  notes: string | null;
  ai_analysis: string | null;
}

interface BrandVoice {
  tone: string;
  target_audience: string | null;
  content_pillars: string[];
}

interface ReferencesTabProps {
  brandId: string;
  references: Reference[];
  voice: BrandVoice | null;
}

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Single",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  educate: "Educar",
  engage: "Engajar",
  sell: "Vender",
  inspire: "Inspirar",
};

function ReferenceAvatar({ name, handle }: { name: string; handle: string | null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const cleanHandle = handle?.replace(/^@/, "");
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (cleanHandle && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://unavatar.io/instagram/${cleanHandle}`}
        alt={name}
        onError={() => setImgFailed(true)}
        className="size-12 shrink-0 rounded-full object-cover bg-accent"
      />
    );
  }

  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold">
      {initials}
    </div>
  );
}

function ReferenceCard({
  ref: reference,
  brandId,
  voice,
}: {
  ref: Reference;
  brandId: string;
  voice: BrandVoice | null;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(() => {
    if (!reference.ai_analysis) return null;
    try { return JSON.parse(reference.ai_analysis); } catch { return null; }
  });
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!!analysis);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/brand-references/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceId: reference.id,
          name: reference.name,
          handle: reference.handle,
          platforms: reference.platforms,
          notes: reference.notes,
          brandVoice: voice,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro desconhecido");
      setAnalysis(json.analysis);
      setExpanded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao analisar");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <ReferenceAvatar name={reference.name} handle={reference.handle} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{reference.name}</p>
              {reference.handle && (
                <a
                  href={`https://instagram.com/${reference.handle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            {reference.handle && (
              <p className="text-xs text-muted-foreground">{reference.handle}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reference.platforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px]">
                  {PLATFORM_LABELS[p]}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={analysis ? () => setExpanded((v) => !v) : handleAnalyze}
              disabled={analyzing}
              className="h-7 px-2 text-xs"
            >
              {analyzing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <><Sparkles className="mr-1 size-3" />{analysis ? (expanded ? "Recolher" : "Ver análise") : "Analisar"}</>
              )}
            </Button>
            <form action={deleteReference}>
              <input type="hidden" name="brandId" value={brandId} />
              <input type="hidden" name="referenceId" value={reference.id} />
              <button
                type="submit"
                title="Remover"
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Notes */}
        {reference.notes && (
          <p className="text-xs text-muted-foreground border-l-2 pl-2 italic">
            {reference.notes}
          </p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* AI Analysis */}
        {analysis && expanded && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3 text-sm">
            {analysis.estrategia && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Estratégia de conteúdo</p>
                <p className="text-xs leading-relaxed">{analysis.estrategia}</p>
              </div>
            )}

            {analysis.estilo && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Tom & estilo</p>
                <p className="text-xs">{analysis.estilo}</p>
              </div>
            )}

            {analysis.pontos_fortes && analysis.pontos_fortes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Pontos fortes</p>
                <ul className="space-y-0.5">
                  {analysis.pontos_fortes.map((p) => (
                    <li key={p} className="text-xs flex gap-1.5">
                      <span className="text-muted-foreground">·</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.licoes && analysis.licoes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Lições para aplicar</p>
                <ul className="space-y-0.5">
                  {analysis.licoes.map((l) => (
                    <li key={l} className="text-xs flex gap-1.5">
                      <Lightbulb className="size-3 shrink-0 mt-0.5 text-amber-500" />{l}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.sugestoes && analysis.sugestoes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Sugestões de conteúdo</p>
                <div className="space-y-1.5">
                  {analysis.sugestoes.map((s, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{s.tema}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {FORMAT_LABELS[s.formato] ?? s.formato} · {OBJECTIVE_LABELS[s.objetivo] ?? s.objetivo}
                        </p>
                      </div>
                      <Link
                        href={`/generate?format=${s.formato}&objective=${s.objetivo}`}
                        className="shrink-0 flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] hover:bg-accent transition-colors"
                      >
                        <Wand2 className="size-2.5" />Gerar
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="h-6 px-2 text-[10px] text-muted-foreground"
            >
              {analyzing ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Sparkles className="mr-1 size-3" />}
              Reanalisar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReferencesTab({ brandId, references, voice }: ReferencesTabProps) {
  return (
    <div className="space-y-4">
      {/* Add form */}
      <Card>
        <CardContent className="pt-5">
          <form action={addReference} className="space-y-4">
            <input type="hidden" name="brandId" value={brandId} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="Ex: Alex Hormozi" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="handle">@ handle (Instagram)</Label>
                <Input id="handle" name="handle" placeholder="@alexhormozi" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plataformas</Label>
              <PlatformsField name="platforms" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Por que essa referência é relevante? O que admira no conteúdo dela?"
              />
            </div>
            <Button type="submit" size="sm">
              Adicionar referência
            </Button>
          </form>
        </CardContent>
      </Card>

      {references.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma referência ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione criadores que inspiram seu estilo de conteúdo.
          </p>
        </div>
      )}

      {references.map((ref) => (
        <ReferenceCard key={ref.id} ref={ref} brandId={brandId} voice={voice} />
      ))}
    </div>
  );
}
