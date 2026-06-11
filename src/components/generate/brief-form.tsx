"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
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
import { StreamOutput, type GenerationState } from "./stream-output";
import type { GenerationOutput } from "@/lib/validations/generation";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Props {
  brands: Brand[];
  defaultBrandId?: string;
}

const OBJECTIVES = [
  { value: "educate", label: "Educar — autoridade e aprendizado" },
  { value: "engage", label: "Engajar — conexão e conversas" },
  { value: "sell", label: "Vender — apresentar oferta" },
  { value: "inspire", label: "Inspirar — motivação e identificação" },
];

const FORMATS = [
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

export function BriefForm({ brands, defaultBrandId }: Props) {
  const [generationState, setGenerationState] = useState<GenerationState>({
    status: "idle",
  });
  const [format, setFormat] = useState("carousel");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const input = {
      brandId: fd.get("brandId") as string,
      topic: fd.get("topic") as string,
      objective: fd.get("objective") as string,
      format: fd.get("format") as string,
      slideCount: parseInt(fd.get("slideCount") as string, 10) || 7,
      toneOverride:
        (fd.get("toneOverride") as string) === "__default__"
          ? undefined
          : (fd.get("toneOverride") as string) || undefined,
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      {/* Form */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-5">
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

            {/* Topic */}
            <div className="space-y-2">
              <Label htmlFor="topic">Tópico / Ideia</Label>
              <Textarea
                id="topic"
                name="topic"
                rows={3}
                required
                minLength={3}
                placeholder="Ex: 3 erros que impedem empresários de escalar sem contratar mais pessoas"
              />
              <p className="text-xs text-muted-foreground">
                Quanto mais específico, mais certeiro o conteúdo.
              </p>
            </div>

            {/* Objective */}
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select name="objective" defaultValue="educate" required>
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
                  defaultValue="carousel"
                  onValueChange={setFormat}
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
              {isRunning ? "Gerando..." : "Gerar conteúdo"}
            </Button>

            {brands.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Crie uma marca no Brand Brain antes de gerar conteúdo.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Output */}
      <div>
        {generationState.status === "idle" ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <Sparkles className="mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">O conteúdo aparecerá aqui</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Preencha o briefing e clique em Gerar
            </p>
          </div>
        ) : (
          <StreamOutput state={generationState} />
        )}
      </div>
    </div>
  );
}
