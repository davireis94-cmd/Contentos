"use client";

import { useState, useRef } from "react";
import {
  Loader2,
  X,
  AlertTriangle,
  Link2,
  CheckCircle2,
  ClipboardPaste,
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

// Platforms that reliably block server-side content extraction
const BLOCKED_PLATFORMS = ["instagram", "linkedin"];

interface Props {
  value: ImportedContent | null;
  onChange: (content: ImportedContent | null) => void;
}

type ViewState = "form" | "partial-caption" | "done" | "manual";

export function UrlImporter({ value, onChange }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("form");
  const [partialContent, setPartialContent] = useState<ImportedContent | null>(null);
  const [caption, setCaption] = useState("");
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

      if (!content.description && BLOCKED_PLATFORMS.includes(content.platform)) {
        // Platform blocks us — ask user to paste the caption manually
        setPartialContent(content);
        setCaption("");
        setView("partial-caption");
      } else {
        // Got content or it's a platform where partial is acceptable
        onChange(content);
        setView("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function handleCaptionConfirm() {
    if (!partialContent) return;
    onChange({ ...partialContent, description: caption.trim() || null, isPartial: !caption.trim() });
    setView("done");
  }

  function handleSkipCaption() {
    if (!partialContent) return;
    onChange(partialContent);
    setView("done");
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
    setCaption("");
    setManualText("");
    setPartialContent(null);
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
          <div className="border-t pt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="size-3 shrink-0" />
              <span>Sem legenda — a URL foi salva como contexto de referência.</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── PARTIAL-CAPTION: Instagram blocked, ask for caption ──────────────────
  if (view === "partial-caption" && partialContent) {
    const icon = PLATFORM_ICONS[partialContent.platform] ?? "🔗";
    return (
      <div className="rounded-md border bg-amber-50/60 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">{partialContent.platformLabel} — URL salvo</p>
            <p className="truncate text-[10px] text-muted-foreground">{partialContent.url}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-amber-700">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>{partialContent.platformLabel} não permite acesso automático ao conteúdo.</strong>{" "}
            Para a IA analisar a estrutura e o estilo, cole a legenda do post abaixo:
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ClipboardPaste className="size-3" />
            Abra o post → copie a legenda → cole aqui
          </div>
          <Textarea
            rows={4}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Cole a legenda do post aqui…"
            className="text-sm bg-white"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleCaptionConfirm}
            disabled={!caption.trim()}
          >
            Usar esta legenda
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleSkipCaption}
            className="text-muted-foreground text-xs"
          >
            Usar só a URL
          </Button>
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
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
        <span>YouTube, X, TikTok: automático · Instagram: pede a legenda</span>
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
