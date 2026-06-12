"use client";

import { useState, useRef } from "react";
import {
  Loader2,
  X,
  Link2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ImportedContent {
  url: string;
  platform: string;
  platformLabel: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  author: string | null;
  isPartial: boolean;
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  youtube: "▶️",
  twitter: "𝕏",
  tiktok: "🎵",
  linkedin: "💼",
  web: "🔗",
};

interface Props {
  value: ImportedContent | null;
  onChange: (content: ImportedContent | null) => void;
}

type ViewState = "form" | "done" | "manual";

export function UrlImporter({ value, onChange }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("form");
  const [manualText, setManualText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json() as { content?: ImportedContent; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar");

      const content = data.content;
      if (!content) return;

      onChange(content);
      setView("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function handleManualConfirm() {
    if (!manualText.trim()) return;
    onChange({
      url: "",
      platform: "web",
      platformLabel: "Texto manual",
      title: null,
      description: manualText.trim(),
      imageUrl: null,
      author: null,
      isPartial: false,
    });
    setView("done");
  }

  function handleClear() {
    onChange(null);
    setUrl("");
    setManualText("");
    setError(null);
    setView("form");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ── DONE: show preview card ──────────────────────────────────────────────
  if (view === "done" && value) {
    const icon = PLATFORM_ICONS[value.platform] ?? "🔗";
    const preview = value.description
      ? value.description.slice(0, 240) + (value.description.length > 240 ? "…" : "")
      : null;

    return (
      <div className="rounded-md border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base leading-none">{icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium">
                {value.platformLabel}
                {value.author && (
                  <span className="ml-1.5 font-normal text-muted-foreground">{value.author}</span>
                )}
              </p>
              {value.url && (
                <p className="truncate text-[10px] text-muted-foreground">{value.url}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {preview ? (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2 line-clamp-4">
              {preview}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="size-3 shrink-0" />
              <span>Conteúdo capturado — a IA vai analisar a estrutura e recriar na voz da marca.</span>
            </div>
          </>
        ) : (
          <div className="border-t pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3 shrink-0" />
              <span>URL salva — a IA usa a referência para gerar no mesmo estilo e formato.</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MANUAL: paste text mode ───────────────────────────────────────────────
  if (view === "manual") {
    return (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-xs text-muted-foreground">
          Cole a legenda, roteiro ou transcrição do post de referência.
        </p>
        <Textarea
          rows={4}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Cole aqui o texto do post de referência…"
          className="text-sm"
          autoFocus
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleManualConfirm} disabled={!manualText.trim()}>
            Usar este texto
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setView("form")}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // ── FORM: initial state ───────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleImport(); } }}
          placeholder="Cole a URL do post (Instagram, YouTube, X, TikTok…)"
          className="text-sm"
          disabled={loading}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void handleImport()}
          disabled={loading || !url.trim()}
          className="shrink-0"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Importar"}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="size-3 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>YouTube, X, TikTok: extrai o conteúdo · Instagram/LinkedIn: usa a URL como referência</span>
        <span className="text-muted-foreground/40">·</span>
        <button
          type="button"
          onClick={() => setView("manual")}
          className="flex items-center gap-1 underline underline-offset-2 hover:text-foreground transition-colors"
        >
          <Link2 className="size-2.5" />
          Colar texto direto
        </button>
      </div>
    </div>
  );
}
