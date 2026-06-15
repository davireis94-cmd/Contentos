/**
 * ════════════════════════════════════════════════════════════════════════════
 *  PRICING — Fonte única da verdade de custos e créditos
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Este arquivo é, ao mesmo tempo, o motor de cálculo de custo E o manual de
 *  referência do modelo de negócio. Toda decisão de preço passa por aqui.
 *
 *  CONCEITO CENTRAL — custos são BIMODAIS:
 *    Texto  → centavos     (Claude)
 *    Imagem → dezenas de centavos
 *    Vídeo  → DÓLARES       (Veo, Higgsfield, Kling)
 *
 *  Por isso NÃO usamos crédito único linear. Texto/imagem entram no bundle
 *  generoso; vídeo é metrado com teto por janela (estilo Claude weekly limit).
 *
 *  ⚠️ Preços de imagem/vídeo são VOLÁTEIS — confirmar ao vivo antes de lançar.
 *     Preços de texto (Claude) são oficiais — ver skill claude-api.
 *
 *  Última revisão: 2026-06-12
 * ════════════════════════════════════════════════════════════════════════════
 */

/** Câmbio usado para converter custo USD → BRL nos dashboards. Atualizar periodicamente. */
export const USD_TO_BRL = 5.45;

/** Valor de varejo de 1 crédito, em BRL. Base de toda a precificação ao usuário. */
export const CREDIT_VALUE_BRL = 0.1;

// ─────────────────────────────────────────────────────────────────────────────
// MODELOS DE TEXTO — preço por 1 MILHÃO de tokens (USD). Oficial (claude-api).
// ─────────────────────────────────────────────────────────────────────────────

export const TEXT_MODELS: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5.0, output: 25.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 }, // ← modelo atual do app
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// MODELOS DE IMAGEM — preço por IMAGEM gerada (USD). ⚠️ Volátil.
// ─────────────────────────────────────────────────────────────────────────────

export const IMAGE_MODELS: Record<string, number> = {
  "flux-dev": 0.025,
  "flux-1.1-pro": 0.04,
  "imagen-3": 0.04,
  "ideogram-v2": 0.08, // bom para texto dentro da imagem
  "nano-banana-pro": 0.13, // Gemini Image Pro
  "gemini-free": 0, // Gemini direto (free tier do Google) — custo USD zero
};

// ─────────────────────────────────────────────────────────────────────────────
// MODELOS DE VÍDEO — preço por SEGUNDO de vídeo (USD). ⚠️ Muito volátil.
//   Estes são os que estouram a margem se não forem metrados.
// ─────────────────────────────────────────────────────────────────────────────

export const VIDEO_MODELS: Record<string, { perSecond: number; bucket: VideoBucket }> = {
  "kling-2.1": { perSecond: 0.09, bucket: "video_kling" }, // ~5s ≈ $0.45
  "runway-gen4": { perSecond: 0.12, bucket: "video_kling" },
  "higgsfield": { perSecond: 0.4, bucket: "video_premium" }, // cinematográfico
  "veo-3": { perSecond: 0.5, bucket: "video_premium" }, // com áudio, premium
};

export type VideoBucket = "video_kling" | "video_premium";

// ─────────────────────────────────────────────────────────────────────────────
// TTS / VOZ — preço por 1000 CARACTERES (USD). ⚠️ Volátil.
// ─────────────────────────────────────────────────────────────────────────────

export const TTS_MODELS: Record<string, number> = {
  "elevenlabs": 0.18,
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERAÇÕES — o que o usuário "compra". Cada operação tem:
//   - credits: quanto é COBRADO do usuário (varejo, UX limpa)
//   - o custo REAL é calculado dinamicamente das tabelas acima
//   Markup-alvo: 4–10x sobre o custo cru nas ops baratas; vídeo é metrado.
// ─────────────────────────────────────────────────────────────────────────────

export type Operation =
  | "generate_carousel"
  | "generate_reel"
  | "generate_story"
  | "generate_single"
  | "refine"
  | "render_png"
  | "extract_trend"
  | "image_ai"
  | "video_kling"
  | "video_premium"
  | "tts"
  | "publish";

/** Créditos cobrados por operação (varejo). null = custo dinâmico por unidade. */
export const OPERATION_CREDITS: Record<Operation, number | null> = {
  generate_carousel: 5,
  generate_reel: 4,
  generate_story: 3,
  generate_single: 3,
  refine: 2,
  render_png: 1,
  extract_trend: 2,
  image_ai: 8, // por imagem
  video_kling: null, // dinâmico: por segundo
  video_premium: null,
  tts: null,
  publish: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// PLANOS — limites mensais + tetos rolantes de vídeo (janela semanal).
//   carousels: -1 = ilimitado (com soft-limit anti-abuso por hora).
// ─────────────────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  label: string;
  priceBrl: number;
  monthlyCredits: number; // bolsa mensal para texto/imagem
  carousels: number; // -1 = ilimitado
  imagesPerMonth: number;
  videoKlingPerWeek: number;
  videoPremiumPerWeek: number;
}

export const PLANS: Record<string, Plan> = {
  free: {
    id: "free",
    label: "Free",
    priceBrl: 0,
    monthlyCredits: 50,
    carousels: 10,
    imagesPerMonth: 0,
    videoKlingPerWeek: 0,
    videoPremiumPerWeek: 0,
  },
  starter: {
    id: "starter",
    label: "Starter",
    priceBrl: 49,
    monthlyCredits: 400,
    carousels: 100,
    imagesPerMonth: 30,
    videoKlingPerWeek: 3,
    videoPremiumPerWeek: 0,
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceBrl: 129,
    monthlyCredits: 2000,
    carousels: -1,
    imagesPerMonth: 150,
    videoKlingPerWeek: 10,
    videoPremiumPerWeek: 4,
  },
  agency: {
    id: "agency",
    label: "Agency",
    priceBrl: 349,
    monthlyCredits: 8000,
    carousels: -1,
    imagesPerMonth: 600,
    videoKlingPerWeek: 40,
    videoPremiumPerWeek: 15,
  },
};

// ═════════════════════════════════════════════════════════════════════════════
//  FUNÇÕES DE CÁLCULO
// ═════════════════════════════════════════════════════════════════════════════

/** Custo real (USD) de uma chamada de texto. */
export function textCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = TEXT_MODELS[model];
  if (!p) return 0;
  return (tokensIn / 1_000_000) * p.input + (tokensOut / 1_000_000) * p.output;
}

/** Custo real (USD) de N imagens geradas. */
export function imageCostUsd(model: string, count: number): number {
  const p = IMAGE_MODELS[model] ?? 0;
  return p * count;
}

/** Custo real (USD) de um vídeo de N segundos. */
export function videoCostUsd(model: string, seconds: number): number {
  const p = VIDEO_MODELS[model];
  if (!p) return 0;
  return p.perSecond * seconds;
}

/** Custo real (USD) de TTS para N caracteres. */
export function ttsCostUsd(model: string, chars: number): number {
  const p = TTS_MODELS[model] ?? 0;
  return (chars / 1000) * p;
}

/** Converte custo USD em créditos de varejo, aplicando markup mínimo. */
export function usdToCredits(usd: number, markup = 5): number {
  const retailBrl = usd * USD_TO_BRL * markup;
  return Math.max(1, Math.ceil(retailBrl / CREDIT_VALUE_BRL));
}

/** Créditos a cobrar por uma operação. Para ops dinâmicas, calcula do custo. */
export function operationCredits(
  operation: Operation,
  costUsd: number
): number {
  const fixed = OPERATION_CREDITS[operation];
  if (fixed !== null) return fixed;
  return usdToCredits(costUsd);
}

/** Bucket de janela rolante para uma operação (null = não metrado por janela). */
export function windowBucketFor(operation: Operation): VideoBucket | null {
  if (operation === "video_kling") return "video_kling";
  if (operation === "video_premium") return "video_premium";
  return null;
}
