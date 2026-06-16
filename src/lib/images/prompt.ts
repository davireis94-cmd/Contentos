/**
 * Builder de prompt de imagem CONDICIONADO ao Brand Brain.
 * É isto que faz a imagem sair on-brand (e não genérica como o Gravyx):
 * injeta paleta, mood/tom e público da marca no prompt.
 *
 * O prompt sai em inglês (modelos aderem melhor), pedindo background editorial
 * com espaço negativo para o texto sobreposto e SEM texto na imagem.
 */

export interface BrandImageContext {
  description?: string | null;
  colors?: { hex: string; role?: string }[];
  tone?: string | null;
  audience?: string | null;
  /** DNA visual agregado das referências (benchmark) — guia de estilo, não cópia. */
  referenceStyle?: { mood?: string; layout?: string; uso_de_foto?: string } | null;
}

const TONE_MOOD: Record<string, string> = {
  formal: "refined, corporate, restrained",
  conversational: "warm, approachable, candid",
  authority: "bold, confident, premium",
  minimalist: "clean, minimal, lots of empty space",
};

/**
 * Modo de encaixe da imagem no slide. Muda a COMPOSIÇÃO pedida ao modelo:
 * - bg: fundo inteiro, texto sobreposto → precisa de espaço vazio embaixo.
 * - card-top / framed: imagem num bloco contido → assunto centralizado, sem
 *   depender de espaço para texto (o texto fica FORA da imagem).
 * - half: imagem ocupa metade vertical → assunto na metade que aparece.
 */
export type ImagePromptMode = "bg" | "card-top" | "framed" | "half" | "none";

const MODE_COMPOSITION: Record<ImagePromptMode, { aspect: string; comp: string }> = {
  "bg": {
    aspect: "4:5 vertical",
    comp: "Full-bleed background. Leave generous negative space in the lower third for a text overlay.",
  },
  "card-top": {
    aspect: "4:3 landscape",
    comp: "Self-contained hero image with the main subject centered and well framed; the whole image is shown inside a card (no text will overlay it).",
  },
  "framed": {
    aspect: "1:1 square",
    comp: "Self-contained, balanced square composition with the subject centered; shown inside a framed card (no text overlay).",
  },
  "half": {
    aspect: "4:5 vertical",
    comp: "Portrait or single-subject composition that reads well when only one vertical half is visible; keep the subject centered, no important detail at the far edges.",
  },
  "none": { aspect: "4:5 vertical", comp: "Balanced editorial composition." },
};

export function buildImagePrompt(
  topic: string,
  brand: BrandImageContext,
  mode: ImagePromptMode = "bg",
): string {
  const colors =
    brand.colors && brand.colors.length > 0
      ? brand.colors.map((c) => c.hex).slice(0, 4).join(", ")
      : "deep wine, cream, warm neutrals";

  const mood = brand.tone ? TONE_MOOD[brand.tone] ?? "sophisticated, premium" : "sophisticated, premium";

  const ref = brand.referenceStyle;
  const refLine = ref && (ref.mood || ref.layout || ref.uso_de_foto)
    ? `Take visual cues (mood/composition, do NOT copy) from this reference style: ${[ref.mood, ref.uso_de_foto, ref.layout].filter(Boolean).join("; ")}.`
    : "";

  const m = MODE_COMPOSITION[mode] ?? MODE_COMPOSITION.bg;

  const parts = [
    `Editorial, magazine-quality image for a premium Instagram carousel about "${topic}".`,
    `Visual style: ${mood}, cinematic lighting, shallow depth of field, subtle film grain.`,
    `Color grading cohesive with this brand palette: ${colors}.`,
    refLine,
    brand.description ? `Brand context: ${brand.description.slice(0, 200)}.` : "",
    brand.audience ? `Aimed at: ${brand.audience}.` : "",
    m.comp,
    `Absolutely no text, no words, no letters, no typography, no logos, no watermarks.`,
    `High-end, tasteful, ${m.aspect} composition.`,
  ];

  return parts.filter(Boolean).join(" ");
}
