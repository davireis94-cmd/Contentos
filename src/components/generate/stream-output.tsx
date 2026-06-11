"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Loader2, Eye, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GenerationOutput } from "@/lib/validations/generation";

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Post único",
};

export type GenerationState =
  | { status: "idle" }
  | { status: "running"; messages: string[] }
  | { status: "done"; pieceId: string; output: GenerationOutput }
  | { status: "error"; message: string };

interface Props {
  state: GenerationState;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded p-1 text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function StreamOutput({ state }: Props) {
  const router = useRouter();

  if (state.status === "idle") return null;

  if (state.status === "running") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
          <div className="space-y-1 text-center">
            {state.messages.map((msg, i) => (
              <p
                key={i}
                className={
                  i === state.messages.length - 1
                    ? "text-sm font-medium"
                    : "text-xs text-muted-foreground line-through"
                }
              >
                {msg}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-start gap-3 py-5">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-sm">Erro na geração</p>
            <p className="text-sm text-muted-foreground">{state.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // done
  const { output, pieceId } = state;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle className="size-4 text-green-600" />
        <p className="text-sm font-medium">Conteúdo gerado com sucesso</p>
        <Badge variant="secondary">{FORMAT_LABELS[output.format] ?? output.format}</Badge>
      </div>

      {/* Slides */}
      <div className="space-y-3">
        {output.slides.map((slide, i) => (
          <Card key={i}>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Slide {i + 1}
                </span>
                <CopyButton text={[slide.title, slide.subtitle, slide.body, slide.cta].filter(Boolean).join("\n")} />
              </div>
              <CardTitle className="text-base leading-snug">{slide.title}</CardTitle>
              {slide.subtitle && (
                <p className="text-sm text-muted-foreground">{slide.subtitle}</p>
              )}
            </CardHeader>
            <CardContent className="pb-4">
              <p className="whitespace-pre-wrap text-sm">{slide.body}</p>
              {slide.cta && (
                <p className="mt-2 text-sm font-medium text-foreground/80">→ {slide.cta}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Caption */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Legenda</span>
            <CopyButton text={output.caption} />
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="whitespace-pre-wrap text-sm">{output.caption}</p>
        </CardContent>
      </Card>

      {/* Hashtags */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Hashtags</span>
            <CopyButton text={output.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {output.hashtags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs font-normal">
                {tag.startsWith("#") ? tag : `#${tag}`}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/content/${pieceId}`)}
        >
          <Eye className="mr-1.5 size-3.5" />
          Ver conteúdo
        </Button>
        <Button
          size="sm"
          onClick={() => router.push("/generate")}
        >
          Gerar novo
        </Button>
      </div>
    </div>
  );
}
