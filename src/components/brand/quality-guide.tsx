"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QualityItem } from "@/lib/brand-quality";

interface Props {
  brandId: string;
  score: number;
  items: QualityItem[];
}

function scoreBar(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function scoreText(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
}

export function QualityGuide({ brandId, score, items }: Props) {
  const pending = items.filter((i) => i.status !== "done");
  const done = items.filter((i) => i.status === "done");
  // Critical only when completely empty (missing). Partial = progress made, downgrade to normal row.
  const critical = pending.filter((i) => i.critical && i.status === "missing");
  const nonCritical = pending.filter((i) => !i.critical || i.status === "partial");

  const [open, setOpen] = useState(score < 80);

  if (pending.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <CheckCircle2 className="size-4 shrink-0 text-green-500" />
        <p className="text-sm font-medium">Brand Brain completo</p>
        <span className={cn("ml-auto text-sm font-bold", scoreText(score))}>{score}%</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header — always visible, click to expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-border">
            <div
              className={cn("h-full rounded-full transition-all", scoreBar(score))}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={cn("text-xs font-bold shrink-0 tabular-nums", scoreText(score))}>
            {score}%
          </span>
          <span className="hidden sm:block text-xs text-muted-foreground truncate">
            Brand Health ·{" "}
            {pending.length} pendente{pending.length !== 1 ? "s" : ""}
            {critical.length > 0 && ` · ${critical.length} crítico${critical.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Expandable body */}
      {open && (
        <div className="border-t divide-y">
          {/* Critical banner */}
          {critical.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs font-medium text-amber-700">
              <AlertTriangle className="size-3 shrink-0" />
              {critical.length} campo{critical.length !== 1 ? "s críticos" : " crítico"} — prioridade máxima para melhorar o conteúdo gerado
            </div>
          )}

          {/* Critical items */}
          {critical.map((item) => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3">
              <Circle className="size-2.5 mt-1.5 shrink-0 fill-amber-400 text-amber-400" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold">{item.label}</span>
                  {item.detail && (
                    <span className="text-[10px] text-muted-foreground">{item.detail}</span>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">
                    crítico
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.impact}</p>
                {item.fromDocs && (
                  <p className="mt-1 text-[11px] text-primary font-medium">
                    ↳ Seus documentos têm dados para este campo — use "Aplicar ao Brand Brain" na aba Documentos
                  </p>
                )}
              </div>
              <Link
                href={`/brands/${brandId}?tab=${item.tab}`}
                className="shrink-0 text-xs font-medium text-primary hover:underline whitespace-nowrap"
              >
                Preencher →
              </Link>
            </div>
          ))}

          {/* Non-critical items — compact rows */}
          {nonCritical.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <Circle
                className={cn(
                  "size-2 shrink-0",
                  item.status === "partial" || item.fromDocs
                    ? "fill-amber-300 text-amber-300"
                    : "text-muted-foreground/25"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm">{item.label}</span>
                  {item.detail && (
                    <span className="text-[10px] text-muted-foreground">{item.detail}</span>
                  )}
                </div>
                {item.fromDocs && (
                  <p className="text-[11px] text-primary">
                    ↳ Dados disponíveis nos seus documentos — use "Aplicar ao Brand Brain"
                  </p>
                )}
              </div>
              <Link
                href={`/brands/${brandId}?tab=${item.tab}`}
                className="shrink-0 text-xs text-muted-foreground hover:text-primary whitespace-nowrap transition-colors"
              >
                Preencher →
              </Link>
            </div>
          ))}

          {/* Done items — compact footer */}
          {done.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30">
              <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {done.length} {done.length === 1 ? "campo completo" : "campos completos"}:{" "}
                {done.map((i) => i.label.split(" (")[0]).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
