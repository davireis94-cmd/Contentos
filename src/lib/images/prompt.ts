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

export function buildImagePrompt(topic: string, brand: BrandImageContext): string {
  const colors =
    brand.colors && brand.colors.length > 0
      ? brand.colors.map((c) => c.hex).slice(0, 4).join(", ")
      : "deep wine, cream, warm neutrals";

  const mood = brand.tone ? TONE_MOOD[brand.tone] ?? "sophisticated, premium" : "sophisticated, premium";

  const ref = brand.referenceStyle;
  const refLine = ref && (ref.mood || ref.layout || ref.uso_de_foto)
    ? `Take visual cues (mood/composition, do NOT copy) from this reference style: ${[ref.mood, ref.uso_de_foto, ref.layout].filter(Boolean).join("; ")}.`
    : "";

  const parts = [
    `Editorial, magazine-quality vertical background image for a premium Instagram carousel about "${topic}".`,
    `Visual style: ${mood}, cinematic lighting, shallow depth of field, subtle film grain.`,
    `Color grading cohesive with this brand palette: ${colors}.`,
    refLine,
    brand.description ? `Brand context: ${brand.description.slice(0, 200)}.` : "",
    brand.audience ? `Aimed at: ${brand.audience}.` : "",
    `Leave generous negative space in the lower third for a text overlay.`,
    `Absolutely no text, no words, no letters, no typography, no logos, no watermarks.`,
    `High-end, tasteful, 4:5 vertical composition.`,
  ];

  return parts.filter(Boolean).join(" ");
}
