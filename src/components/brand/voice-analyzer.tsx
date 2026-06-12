"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  Wand2,
  Check,
  ChevronDown,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface VoiceSuggestions {
  tone: string;
  target_audience: string;
  content_pillars: string[];
  characteristic_phrases: string[];
  forbidden_words: string[];
  analysis_summary: string;
}

const TONE_LABELS: Record<string, string> = {
  conversational: "Conversacional",
  authority: "Autoridade",
  formal: "Formal",
  minimalist: "Minimalista",
};

interface Props {
  brandId: string;
}

type InputMode = "urls" | "text";

export function VoiceAnalyzer({ brandId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InputMode>("urls");
  const [urls, setUrls] = useState<string[]>(["", "", ""]);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<VoiceSuggestions | null>(null);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  // Which fields to apply
  const [applyTone, setApplyTone] = useState(true);
  const [applyAudience, setApplyAudience] = useState(true);
  const [applyPillars, setApplyPillars] = useState(true);
  const [applyPhrases, setApplyPhrases] = useState(true);
  const [applyForbidden, setApplyForbidden] = useState(true);

  function addUrl() {
    if (urls.length < 10) setUrls((u) => [...u, ""]);
  }

  function removeUrl(i: number) {
    setUrls((u) => u.filter((_, idx) => idx !== i));
  }

  function updateUrl(i: number, val: string) {
    setUrls((u) => u.map((v, idx) => (idx === i ? val : v)));
  }

  async function handleAnalyze() {
    setError(null);
    setSuggestions(null);
    setApplied(false);

    let posts: { url?: string; text?: string }[] = [];

    if (mode === "urls") {
      const validUrls = urls.filter((u) => u.trim());
      if (validUrls.length === 0) {
        setError("Adicione pelo menos 1 URL.");
        return;
      }
      posts = validUrls.map((u) => ({ url: u.trim() }));
    } else {
      // Split pasted text by separator
      const parts = pastedText.split(/\n?---\n?/).map((t) => t.trim()).filter(Boolean);
      if (parts.length === 0) {
        setError("Cole pelo menos 1 post.");
        return;
      }
      posts = parts.map((t) => ({ text: t }));
    }

    setLoading(true);
    try {
      const res = await fetch("/api/brand/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, posts }),
      });
      const data = await res.json() as {
        suggestions?: VoiceSuggestions;
        analyzedCount?: number;
        failedUrls?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Erro na análise");
      setSuggestions(data.suggestions ?? null);
      setAnalyzedCount(data.analyzedCount ?? 0);
      setFailedUrls(data.failedUrls ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!suggestions) return;
    setApplying(true);
    try {
      const res = await fetch("/api/brand/apply-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          tone: applyTone ? suggestions.tone : undefined,
          target_audience: applyAudience ? suggestions.target_audience : undefined,
          content_pillars: applyPillars ? suggestions.content_pillars : undefined,
          characteristic_phrases: applyPhrases ? suggestions.characteristic_phrases : undefined,
          forbidden_words: applyForbidden ? suggestions.forbidden_words : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Erro ao aplicar");
      }
      setApplied(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aplicar sugestões");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-lg border bg-gradient-to-br from-purple-50/50 to-card mb-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Sparkles className="size-3" />
          </span>
          <span className="text-sm font-medium">Analisar meus posts para sugerir tom de voz</span>
          <Badge variant="secondary" className="text-[10px]">IA</Badge>
        </span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cole as URLs dos seus melhores posts ou o texto das legendas. A IA analisa o padrão de comunicação e sugere como preencher o Brand Brain — você revisa e aplica com 1 clique.
          </p>

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-md border p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setMode("urls")}
              className={`rounded px-3 py-1 text-xs transition-all ${mode === "urls" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Por URLs
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`rounded px-3 py-1 text-xs transition-all ${mode === "text" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              Colar texto
            </button>
          </div>

          {mode === "urls" ? (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Suporta: Instagram, TikTok, YouTube, X. Até 10 posts.
              </p>
              {urls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={u}
                    onChange={(e) => updateUrl(i, e.target.value)}
                    placeholder={`https://www.instagram.com/p/...`}
                    className="text-sm"
                  />
                  {urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUrl(i)}
                      className="shrink-0 rounded p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {urls.length < 10 && (
                <button
                  type="button"
                  onClick={addUrl}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="size-3" /> Adicionar URL
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">
                Cole as legendas dos seus posts. Separe cada post com <code className="rounded bg-muted px-1">---</code> em uma linha separada.
              </p>
              <Textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={8}
                placeholder={`Aqui vai a legenda do primeiro post...\n\n---\n\nAqui vai a legenda do segundo post...\n\n---\n\nE assim por diante...`}
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                {pastedText.split(/\n?---\n?/).filter((t) => t.trim()).length} post(s) identificado(s)
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={loading}
            size="sm"
            className="w-full"
          >
            {loading ? (
              <><Loader2 className="mr-2 size-3.5 animate-spin" /> Analisando posts...</>
            ) : (
              <><Wand2 className="mr-2 size-3.5" /> Analisar e sugerir Brand Brain</>
            )}
          </Button>

          {/* Results */}
          {suggestions && (
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Análise concluída</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {analyzedCount} post{analyzedCount !== 1 ? "s" : ""} analisado{analyzedCount !== 1 ? "s" : ""}.
                    {failedUrls.length > 0 && ` ${failedUrls.length} URL(s) não acessível(eis).`}
                    {" "}Selecione o que aplicar.
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                {suggestions.analysis_summary}
              </p>

              <div className="space-y-3">
                <SuggestionRow
                  label="Tom de voz"
                  value={TONE_LABELS[suggestions.tone] ?? suggestions.tone}
                  checked={applyTone}
                  onChange={setApplyTone}
                />
                <SuggestionRow
                  label="Público-alvo"
                  value={suggestions.target_audience}
                  checked={applyAudience}
                  onChange={setApplyAudience}
                />
                <SuggestionRow
                  label="Pilares de conteúdo"
                  value={suggestions.content_pillars.join(" · ")}
                  checked={applyPillars}
                  onChange={setApplyPillars}
                />
                <SuggestionRow
                  label="Frases características"
                  value={suggestions.characteristic_phrases.join(" · ")}
                  checked={applyPhrases}
                  onChange={setApplyPhrases}
                />
                <SuggestionRow
                  label="Palavras a evitar"
                  value={suggestions.forbidden_words.join(", ")}
                  checked={applyForbidden}
                  onChange={setApplyForbidden}
                />
              </div>

              {applied ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="size-4" /> Aplicado com sucesso! O formulário foi atualizado abaixo.
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={applying || (!applyTone && !applyAudience && !applyPillars && !applyPhrases && !applyForbidden)}
                  size="sm"
                  className="w-full"
                >
                  {applying ? (
                    <><Loader2 className="mr-2 size-3.5 animate-spin" /> Aplicando...</>
                  ) : (
                    "Aplicar selecionados ao Brand Brain"
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({
  label,
  value,
  checked,
  onChange,
}: {
  label: string;
  value: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${checked ? "border-primary/40 bg-primary/5" : "opacity-60"}`}>
      <div
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${checked ? "border-primary bg-primary" : "border-input"}`}
        onClick={() => onChange(!checked)}
      >
        {checked && <Check className="size-2.5 text-primary-foreground" />}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm leading-snug">{value}</p>
      </div>
    </label>
  );
}
