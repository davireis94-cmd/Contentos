"use client";

import {
  Coins,
  TrendingUp,
  Zap,
  Image as ImageIcon,
  Video,
  FileText,
  Sparkles,
  Wand2,
} from "lucide-react";

const OPERATION_META: Record<string, { label: string; icon: typeof Coins }> = {
  generate_carousel: { label: "Carrosséis", icon: FileText },
  generate_reel: { label: "Reels", icon: Video },
  generate_story: { label: "Stories", icon: Sparkles },
  generate_single: { label: "Posts únicos", icon: FileText },
  refine: { label: "Refinamentos", icon: Wand2 },
  render_png: { label: "Exports PNG", icon: ImageIcon },
  extract_trend: { label: "Extrações de trend", icon: TrendingUp },
  image_ai: { label: "Imagens IA", icon: ImageIcon },
  video_kling: { label: "Vídeos (Kling)", icon: Video },
  video_premium: { label: "Vídeos premium", icon: Video },
  tts: { label: "Narrações", icon: Zap },
  publish: { label: "Publicações", icon: Zap },
};

export interface UsageData {
  totalCredits: number;
  totalCostUsd: number;
  events: number;
  byOperation: Record<string, { count: number; credits: number; costUsd: number }>;
}

interface Props {
  usage: UsageData;
  plan: {
    label: string;
    monthlyCredits: number;
    priceBrl: number;
  };
  usdToBrl: number;
  monthLabel: string;
}

export function UsageDashboard({ usage, plan, usdToBrl, monthLabel }: Props) {
  const used = usage.totalCredits;
  const total = plan.monthlyCredits;
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  const costBrl = usage.totalCostUsd * usdToBrl;
  const marginBrl = plan.priceBrl - costBrl;
  const marginPct = plan.priceBrl > 0 ? (marginBrl / plan.priceBrl) * 100 : 0;

  const operations = Object.entries(usage.byOperation).sort(
    (a, b) => b[1].credits - a[1].credits
  );

  return (
    <div className="space-y-6">
      {/* Top: credits balance */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="size-5 text-primary" />
              <h2 className="text-base font-semibold">Créditos do mês</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{monthLabel}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-background">
              Plano {plan.label}
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between mb-2">
          <div>
            <span className="text-3xl font-bold">{remaining.toLocaleString("pt-BR")}</span>
            <span className="text-sm text-muted-foreground ml-1.5">
              de {total.toLocaleString("pt-BR")} restantes
            </span>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {used.toLocaleString("pt-BR")} usados
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct > 90 && (
          <p className="text-xs text-destructive mt-2 font-medium">
            Você está quase sem créditos. Considere fazer upgrade de plano.
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Zap}
          label="Operações no mês"
          value={usage.events.toLocaleString("pt-BR")}
          sub="gerações, refines, exports"
        />
        <StatCard
          icon={Coins}
          label="Créditos consumidos"
          value={used.toLocaleString("pt-BR")}
          sub={`${pct.toFixed(0)}% do plano`}
        />
        <StatCard
          icon={TrendingUp}
          label="Custo real estimado"
          value={`R$ ${costBrl.toFixed(2)}`}
          sub={
            plan.priceBrl > 0
              ? `margem ~${marginPct.toFixed(0)}% (R$ ${marginBrl.toFixed(2)})`
              : "plano gratuito"
          }
          highlight={plan.priceBrl > 0 && marginPct < 30}
        />
      </div>

      {/* Breakdown by operation */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b">
          <h3 className="text-sm font-semibold">Consumo por operação</h3>
        </div>
        {operations.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma operação registrada neste mês ainda.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Gere conteúdo para ver o consumo aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {operations.map(([op, data]) => {
              const meta = OPERATION_META[op] ?? { label: op, icon: Zap };
              const Icon = meta.icon;
              const opCostBrl = data.costUsd * usdToBrl;
              return (
                <div key={op} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.count}× · custo ~R$ {opCostBrl.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{data.credits.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">créditos</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${highlight ? "border-destructive/40" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className={`text-xs mt-0.5 ${highlight ? "text-destructive font-medium" : "text-muted-foreground"}`}>
        {sub}
      </p>
    </div>
  );
}
