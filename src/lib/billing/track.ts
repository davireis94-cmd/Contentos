/**
 * Tracking de uso — registra cada operação de IA no ledger (usage_logs)
 * com custo real em USD, créditos cobrados e bucket de janela.
 *
 * trackUsage() NUNCA lança erro: falha de tracking não pode quebrar a
 * operação principal do usuário. Erros são logados e engolidos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Operation,
  textCostUsd,
  imageCostUsd,
  videoCostUsd,
  ttsCostUsd,
  operationCredits,
  windowBucketFor,
} from "./pricing";

interface TrackInput {
  supabase: SupabaseClient;
  workspaceId: string;
  userId: string;
  operation: Operation;
  model?: string;
  tokensInput?: number;
  tokensOutput?: number;
  /** Para imagem (qtd), vídeo (segundos) ou TTS (caracteres). */
  units?: number;
  unitType?: "image" | "video_second" | "tts_char";
  metadata?: Record<string, unknown>;
}

/** Calcula o custo real (USD) de uma operação a partir dos seus parâmetros. */
function computeCostUsd(input: TrackInput): number {
  const { operation, model, tokensInput = 0, tokensOutput = 0, units = 0 } = input;

  switch (operation) {
    case "generate_carousel":
    case "generate_reel":
    case "generate_story":
    case "generate_single":
    case "refine":
    case "extract_trend":
      return model ? textCostUsd(model, tokensInput, tokensOutput) : 0;
    case "image_ai":
      return model ? imageCostUsd(model, units || 1) : 0;
    case "video_kling":
    case "video_premium":
      return model ? videoCostUsd(model, units) : 0;
    case "tts":
      return model ? ttsCostUsd(model, units) : 0;
    case "render_png":
    case "publish":
      return 0; // custo de compute desprezível
    default:
      return 0;
  }
}

/** Registra uma operação no ledger. Retorna os valores calculados (ou null se falhou). */
export async function trackUsage(input: TrackInput): Promise<{
  costUsd: number;
  credits: number;
} | null> {
  try {
    const costUsd = computeCostUsd(input);
    const credits = operationCredits(input.operation, costUsd);
    const bucket = windowBucketFor(input.operation);

    await input.supabase.from("usage_logs").insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      operation: input.operation,
      model: input.model ?? null,
      tokens_input: input.tokensInput ?? 0,
      tokens_output: input.tokensOutput ?? 0,
      units: input.units ?? 0,
      unit_type: input.unitType ?? null,
      cost_usd: Number(costUsd.toFixed(6)),
      credits,
      window_bucket: bucket,
      status: "success",
      metadata: input.metadata ?? {},
    });

    return { costUsd, credits };
  } catch (err) {
    console.error("[trackUsage] failed:", err);
    return null;
  }
}

/** Resumo de uso de um workspace no período (mês corrente por padrão). */
export async function getUsageSummary(
  supabase: SupabaseClient,
  workspaceId: string,
  since?: Date
) {
  const from = since ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const { data } = await supabase
    .from("usage_logs")
    .select("operation, model, tokens_input, tokens_output, units, cost_usd, credits, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const totalCredits = rows.reduce((s, r) => s + Number(r.credits ?? 0), 0);
  const totalCostUsd = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

  const byOperation: Record<string, { count: number; credits: number; costUsd: number }> = {};
  for (const r of rows) {
    const op = r.operation ?? "unknown";
    byOperation[op] ??= { count: 0, credits: 0, costUsd: 0 };
    byOperation[op].count += 1;
    byOperation[op].credits += Number(r.credits ?? 0);
    byOperation[op].costUsd += Number(r.cost_usd ?? 0);
  }

  return { totalCredits, totalCostUsd, byOperation, events: rows.length };
}

/** Conta operações de um bucket de janela nos últimos N dias (para tetos rolantes). */
export async function countWindowUsage(
  supabase: SupabaseClient,
  workspaceId: string,
  bucket: "video_kling" | "video_premium",
  windowDays = 7
): Promise<number> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const { count } = await supabase
    .from("usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("window_bucket", bucket)
    .gte("created_at", since.toISOString());

  return count ?? 0;
}
