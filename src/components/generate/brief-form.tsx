"use client";

import { useState } from "react";
import { ChevronDown, Check, Library, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StreamOutput, type GenerationState } from "./stream-output";
import { ArtifactPanel } from "./artifact-panel";
import { UrlImporter, type ImportedContent } from "./url-importer";
import type { GenerationOutput } from "@/lib/validations/generation";
import { FRAMEWORKS } from "@/lib/ai/frameworks";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

interface RecentPiece {
  id: string;
  title: string;
  format: string;
  brandName: string | null;
}

interface TrendContext {
  title: string;
  description?: string | null;
  notes?: string | null;
  transcript?: string | null;
  source_url?: string | null;
  platform?: string | null;
  format?: string | null;
}

interface Props {
  brands: Brand[];
  defaultBrandId?: string;
  recentPieces: RecentPiece[];
  defaultRefId?: string;
  defaultTopic?: string;
  defaultExt?: boolean;
  defaultFormat?: string;
  defaultObjective?: string;
  trendContext?: TrendContext;
}

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
];

const OBJECTIVES = [
  { value: "educate", label: "Educar — autoridade e aprendizado" },
  { value: "engage", label: "Engajar — conexão e conversas" },
  { value: "sell", label: "Vender — apresentar oferta" },
  { value: "inspire", label: "Inspirar — motivação e identificação" },
];

const FORMATS: { value: string; label: string }[] = [
  { value: "carousel", label: "Carrossel" },
  { value: "reel", label: "Reels" },
  { value: "story", label: "Stories" },
  { value: "single", label: "Post único" },
];

const TONES = [
  { value: "__default__", label: "Padrão da marca" },
  { value: "conversational", label: "Conversacional" },
  { value: "authority", label: "Autoridade" },
  { value: "formal", label: "Formal" },
  { value: "minimalist", label: "Minimalista" },
];

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Post único",
};

const VALID_FORMATS = ["carousel", "reel", "story", "single"];

export function BriefForm({ brands, defaultBrandId, recentPieces, defaultRefId, defaultTopic, defaultExt, defaultFormat, defaultObjective, trendContext }: Props) {
  const [generationState, setGenerationState] = useState<GenerationState>({
    status: "idle",
  });
  const [platform, setPlatform] = useState("instagram");
  const [format, setFormat] = useState(defaultFormat && VALID_FORMATS.includes(defaultFormat) ? defaultFormat : "carousel");
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [refSearch, setRefSearch] = useState("");
  const [refFormatFilter, setRefFormatFilter] = useState("all");
  const [selectedRefs, setSelectedRefs] = useState<string[]>(
    defaultRefId ? [defaultRefId] : []
  );
  const [pendingRefs, setPendingRefs] = useState<string[]>(
    defaultRefId ? [defaultRefId] : []
  );
  const [showExtRef, setShowExtRef] = useState(!!defaultExt);
  const [importedRef, setImportedRef] = useState<ImportedContent | null>(null);
  const [framework, setFramework] = useState("");
  // Tópico controlado: limita a 500 (limite do schema) e mostra contador, para
  // não dar "Dados inválidos" quando vem pré-preenchido com texto longo.
  const [topicVal, setTopicVal] = useState((defaultTopic ?? "").slice(0, 500));

  const filteredPieces = recentPieces.filter((p) => {
    const matchesSearch =
      !refSearch.trim() ||
      p.title.toLowerCase().includes(refSearch.toLowerCase()) ||
      (p.brandName ?? "").toLowerCase().includes(refSearch.toLowerCase());
    const matchesFormat = refFormatFilter === "all" || p.format === refFormatFilter;
    return matchesSearch && matchesFormat;
  });

  function togglePending(id: string) {
    setPendingRefs((prev) => {
      if (prev.includes(id)) return prev.filter((r) => r !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function confirmRefs() {
    setSelectedRefs(pendingRefs);
    setRefPickerOpen(false);
  }

  function openPicker() {
    setPendingRefs(selectedRefs);
    setRefSearch("");
    setRefFormatFilter("all");
    setRefPickerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const trendExternalRef = trendContext
      ? [
          `Vídeo/post de referência: "${trendContext.title}"`,
          trendContext.description ? `Descrição: ${trendContext.description}` : null,
          trendContext.notes ? `Por que funciona: ${trendContext.notes}` : null,
          trendContext.transcript
            ? `Transcrição do vídeo:\n${trendContext.transcript.slice(0, 4000)}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n")
      : undefined;

    const input = {
      brandId: fd.get("brandId") as string,
      platform,
      topic: fd.get("topic") as string,
      objective: fd.get("objective") as string,
      format,
      slideCount: parseInt(fd.get("slideCount") as string, 10) || 7,
      toneOverride:
        (fd.get("toneOverride") as string) === "__default__"
          ? undefined
          : (fd.get("toneOverride") as string) || undefined,
      productionTool: undefined,
      framework: framework || undefined,
      referenceIds: selectedRefs.length > 0 ? selectedRefs : undefined,
      importedRef: importedRef ?? undefined,
      externalRef: trendExternalRef,
    };

    setGenerationState({ status: "running", messages: ["Iniciando..."] });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok || !response.body) {
        setGenerationState({
          status: "error",
          message: "Falha ao conectar com o gerador.",
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (currentEvent === "progress") {
              setGenerationState((prev) => ({
                status: "running",
                messages: [
                  ...(prev.status === "running" ? prev.messages : []),
                  data.message as string,
                ],
              }));
            } else if (currentEvent === "complete") {
              setGenerationState({
                status: "done",
                pieceId: data.pieceId as string,
                output: data.output as GenerationOutput,
              });
            } else if (currentEvent === "error") {
              setGenerationState({
                status: "error",
                message: data.message as string,
              });
            }
          }
        }
      }
    } catch {
      setGenerationState({
        status: "error",
        message: "Erro de conexão. Tente novamente.",
      });
    }
  }

  const isRunning = generationState.status === "running";
  const selectedPieces = recentPieces.filter((p) => selectedRefs.includes(p.id));

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Trend banner */}
            {trendContext && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                <span className="text-emerald-600 shrink-0 mt-0.5">✦</span>
                <div className="min-w-0">
                  <p className="font-medium text-emerald-800 dark:text-emerald-300 text-xs">
                    Gerando conteúdo inspirado em:
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                    {trendContext.title}
                  </p>
                  {trendContext.transcript && (
                    <p className="text-[10px] text-emerald-600/70 mt-0.5">
                      Transcrição do vídeo incluída como contexto
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Brand */}
            <div className="space-y-2">
              <Label>Marca</Label>
              <Select name="brandId" defaultValue={defaultBrandId ?? brands[0]?.id} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a marca" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select
                name="platform"
                value={platform}
                onValueChange={(v) => { setPlatform(v); }}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic">Tópico / Ideia</Label>
              <Textarea
                id="topic"
                name="topic"
                rows={3}
                required
                minLength={3}
                maxLength={500}
                value={topicVal}
                onChange={(e) => setTopicVal(e.target.value.slice(0, 500))}
                placeholder="Ex: 3 erros que impedem empresários de escalar sem contratar mais pessoas"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Quanto mais específico, mais certeiro o conteúdo.
                </p>
                <p className={`text-xs ${topicVal.length >= 500 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {topicVal.length}/500
                </p>
              </div>
            </div>

            {/* Framework de copy */}
            <div className="space-y-2">
              <Label>Framework <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {FRAMEWORKS.map((fw) => {
                  const active = framework === fw.id;
                  return (
                    <button
                      key={fw.id}
                      type="button"
                      onClick={() => setFramework(active ? "" : fw.id)}
                      title={fw.description}
                      className={`rounded-full border px-3 py-1 text-xs transition-all ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      {fw.emoji} {fw.label}
                    </button>
                  );
                })}
              </div>
              {framework && (
                <p className="text-xs text-muted-foreground">
                  {FRAMEWORKS.find((f) => f.id === framework)?.description}
                </p>
              )}
            </div>

            {/* Reference posts — modal picker */}
            {recentPieces.length > 0 && (
              <div className="space-y-2">
                <Dialog open={refPickerOpen} onOpenChange={setRefPickerOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      onClick={openPicker}
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      <span className="flex items-center gap-2">
                        <Library className="size-3.5" />
                        Basear em posts existentes
                        {selectedRefs.length > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {selectedRefs.length} selecionado{selectedRefs.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </span>
                      <ChevronDown className="size-3.5" />
                    </button>
                  </DialogTrigger>

                  <DialogContent className="max-w-lg p-0 gap-0">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b">
                      <DialogTitle className="text-base">Selecionar referências</DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Escolha até 3 posts. A IA vai usar a estrutura e o ritmo como inspiração.
                      </p>
                    </DialogHeader>

                    {/* Search + filter */}
                    <div className="px-4 pt-3 pb-2 space-y-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={refSearch}
                          onChange={(e) => setRefSearch(e.target.value)}
                          placeholder="Buscar post..."
                          className="w-full rounded-md border bg-transparent pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {["all", "carousel", "reel", "story", "single"].map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setRefFormatFilter(f)}
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-all ${
                              refFormatFilter === f
                                ? "border-primary bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:border-foreground/30"
                            }`}
                          >
                            {f === "all" ? "Todos" : FORMAT_LABELS[f] ?? f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* List */}
                    <div className="max-h-72 overflow-y-auto">
                      {filteredPieces.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Nenhum post encontrado
                        </p>
                      ) : (
                        filteredPieces.map((piece) => {
                          const checked = pendingRefs.includes(piece.id);
                          const disabled = !checked && pendingRefs.length >= 3;
                          return (
                            <label
                              key={piece.id}
                              className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent border-b last:border-0 ${
                                disabled ? "opacity-40 cursor-not-allowed" : ""
                              } ${checked ? "bg-primary/5" : ""}`}
                            >
                              <div className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary" : "border-input"}`}>
                                {checked && <Check className="size-2.5 text-primary-foreground" />}
                              </div>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => !disabled && togglePending(piece.id)}
                                className="sr-only"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm leading-snug">{piece.title}</p>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">
                                    {FORMAT_LABELS[piece.format] ?? piece.format}
                                  </span>
                                  {piece.brandName && (
                                    <>
                                      <span className="text-[10px] text-muted-foreground/40">·</span>
                                      <span className="text-[10px] text-muted-foreground">{piece.brandName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                      <span className="text-xs text-muted-foreground">
                        {pendingRefs.length}/3 selecionados
                      </span>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRefPickerOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="button" size="sm" onClick={confirmRefs}>
                          Confirmar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Selected chips */}
                {selectedPieces.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPieces.map((p) => (
                      <span key={p.id} className="flex items-center gap-1 rounded-full border bg-secondary px-2 py-0.5 text-xs">
                        <span className="max-w-[140px] truncate">{p.title}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedRefs((prev) => prev.filter((r) => r !== p.id))}
                          className="ml-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* External reference post — URL import */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowExtRef((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="size-3.5" />
                  Recriar a partir de post externo
                  {importedRef && (
                    <Badge variant="secondary" className="text-[10px]">ativo</Badge>
                  )}
                </span>
                <ChevronDown
                  className={`size-3.5 transition-transform ${showExtRef ? "rotate-180" : ""}`}
                />
              </button>

              {showExtRef && (
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Importe qualquer post por URL ou cole o texto. A IA analisa a estrutura e recria na voz da sua marca — conteúdo 100% original.
                  </p>
                  <UrlImporter value={importedRef} onChange={setImportedRef} />
                </div>
              )}
            </div>

            {/* Objective */}
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select name="objective" defaultValue={["educate", "engage", "sell", "inspire"].includes(defaultObjective ?? "") ? defaultObjective : "educate"} required>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format + SlideCount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select
                  name="format"
                  value={format}
                  onValueChange={(v) => { setFormat(v); }}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slideCount">
                  {format === "single" ? "Slides" : "Nº de slides"}
                </Label>
                <Input
                  id="slideCount"
                  name="slideCount"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={7}
                  disabled={format === "single"}
                />
              </div>
            </div>

            {/* Tone override */}
            <div className="space-y-2">
              <Label>Tom de voz (opcional)</Label>
              <Select name="toneOverride" defaultValue="__default__">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isRunning || brands.length === 0}
            >
              <Sparkles className="mr-2 size-4" />
              {isRunning
                ? "Gerando..."
                : selectedRefs.length > 0
                ? `Gerar com ${selectedRefs.length} referência${selectedRefs.length > 1 ? "s" : ""}`
                : "Gerar conteúdo"}
            </Button>

            {brands.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Crie uma marca no Brand Brain antes de gerar conteúdo.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Output — abre num painel lateral grande (estilo artifact), minimizável */}
      <ArtifactPanel
        active={generationState.status !== "idle"}
        title={generationState.status === "running" ? "Gerando conteúdo…" : "Conteúdo gerado"}
        onClose={() => setGenerationState({ status: "idle" })}
      >
        <StreamOutput state={generationState} />
      </ArtifactPanel>
    </div>
  );
}
