"use client";

import { useState } from "react";
import { Brain, Loader2, Sparkles, TrendingUp, TrendingDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PerformanceInsights } from "@/lib/brand/performance";

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  single: "Post único",
  story: "Stories",
};

export function PerformanceLearning({
  brandId,
  initial,
}: {
  brandId: string | null;
  initial: PerformanceInsights | null;
}) {
  const [insights, setInsights] = useState<PerformanceInsights | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justLearned, setJustLearned] = useState(false);

  async function learn() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      const data = await res.json() as { insights?: PerformanceInsights; error?: string };
      if (!res.ok || !data.insights) throw new Error(data.error ?? "Erro ao analisar");
      setInsights(data.insights);
      setJustLearned(true);
      setTimeout(() => setJustLearned(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/[0.04] to-transparent p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 shrink-0">
            <Brain className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">O que o Lumio aprendeu com seu público</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
              A IA analisa seus posts campeões e os fracos pra descobrir o que funciona —
              e usa isso toda vez que gera conteúdo novo.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={learn} disabled={loading} className="shrink-0">
          {loading ? (
            <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Analisando…</>
          ) : justLearned ? (
            <><Check className="size-3.5 mr-1.5" /> Aprendido!</>
          ) : (
            <><Sparkles className="size-3.5 mr-1.5" /> {insights ? "Reanalisar" : "Aprender com meus posts"}</>
          )}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive mt-3">{error}</p>}

      {insights && (
        <div className="mt-4 space-y-3">
          {insights.summary && (
            <p className="text-sm bg-card border rounded-lg px-3 py-2.5 leading-relaxed">
              {insights.summary}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {insights.bestFormat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                🏆 Melhor formato: {FORMAT_LABELS[insights.bestFormat] ?? insights.bestFormat}
              </span>
            )}
            {insights.bestTopics.map((t) => (
              <span key={t} className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs">
                {t}
              </span>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {insights.topPatterns.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mb-2">
                  <TrendingUp className="size-3.5" /> O que funciona
                </p>
                <ul className="space-y-1.5">
                  {insights.topPatterns.map((p) => (
                    <li key={p} className="text-xs flex gap-1.5 leading-relaxed">
                      <span className="text-emerald-500 shrink-0">✓</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insights.avoidPatterns.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 mb-2">
                  <TrendingDown className="size-3.5" /> O que evitar
                </p>
                <ul className="space-y-1.5">
                  {insights.avoidPatterns.map((p) => (
                    <li key={p} className="text-xs flex gap-1.5 leading-relaxed">
                      <span className="text-amber-500 shrink-0">✗</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Baseado em {insights.postsAnalyzed} posts · atualizado{" "}
            {new Date(insights.updatedAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}
