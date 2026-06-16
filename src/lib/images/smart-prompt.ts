/**
 * Escritor INTELIGENTE de prompt de imagem.
 *
 * Antes, o prompt era um template fixo que só olhava o título do slide → imagem
 * genérica. Aqui um modelo barato (Haiku) lê o slide INTEIRO (título + subtítulo
 * + corpo) + a identidade da marca + o modo de encaixe + um ajuste opcional do
 * usuário, e escreve um prompt sob medida para o Flux.
 *
 * Falha graciosamente: se a chamada der erro, devolve null e o chamador cai no
 * template determinístico (buildImagePrompt).
 *
 * Custo: ~300 tokens in / ~120 out do Haiku por imagem (≈ US$0,0008). O tracking
 * fino desse passo de texto fica como TODO (operação de texto auxiliar); o custo
 * é desprezível frente ao da imagem em si.
 */

import { anthropic } from "@/lib/ai/anthropic";
import type { BrandImageContext, ImagePromptMode } from "./prompt";

const SMART_MODEL = "claude-haiku-4-5";

const MODE_COMPOSITION_HINT: Record<ImagePromptMode, string> = {
  "bg": "Full-bleed background that fills the whole slide; keep the lower third visually calm/uncluttered so text can be overlaid there.",
  "card-top": "Self-contained hero image shown WHOLE inside a card (no text will overlay it). Keep the main subject centered and well framed.",
  "framed": "Balanced, roughly square composition with the subject centered, shown inside a small framed card (no text overlay).",
  "half": "Portrait or single-subject composition that reads well when only one vertical half is visible; keep the subject centered, nothing important at the far edges.",
  "none": "Balanced editorial composition.",
};

const TONE_MOOD: Record<string, string> = {
  formal: "refined, corporate, restrained",
  conversational: "warm, approachable, candid",
  authority: "bold, confident, premium",
  minimalist: "clean, minimal, lots of empty space",
};

export interface SmartPromptInput {
  topic: string;
  slide: { title?: string; subtitle?: string | null; body?: string | null };
  brand: BrandImageContext;
  mode: ImagePromptMode;
  /** Ajuste livre do usuário, em português (ex.: "sem pessoas", "mesa escura"). */
  userHint?: string | null;
}

const SYSTEM = `You are an art director writing prompts for the Flux text-to-image model, used to create background/illustration images for a premium Instagram carousel.

Your job: given the slide content, the brand identity and the desired composition, output ONE single image prompt in ENGLISH.

Hard rules:
- Output ONLY the final prompt text. No preamble, no quotes, no explanations, no aspect ratio.
- The image must contain ABSOLUTELY NO text, words, letters, numbers, typography, logos or watermarks.
- Color grading must be cohesive with the brand palette provided.
- Tasteful, editorial, magazine-quality. Avoid generic stock-photo clichés.
- Translate the MEANING of the slide into a concrete, specific visual scene/metaphor — do not just describe the literal words.
- Respect the requested composition for where the image will sit.
- If the user gives an adjustment, honor it.
Keep it under ~80 words.`;

export async function buildSmartImagePrompt(input: SmartPromptInput): Promise<string | null> {
  const { topic, slide, brand, mode, userHint } = input;

  const colors =
    brand.colors && brand.colors.length > 0
      ? brand.colors.map((c) => c.hex).slice(0, 4).join(", ")
      : "deep wine, cream, warm neutrals";
  const mood = brand.tone ? TONE_MOOD[brand.tone] ?? "sophisticated, premium" : "sophisticated, premium";
  const ref = brand.referenceStyle;
  const refLine =
    ref && (ref.mood || ref.layout || ref.uso_de_foto)
      ? `Reference style cues (mood/composition only, do NOT copy): ${[ref.mood, ref.uso_de_foto, ref.layout].filter(Boolean).join("; ")}.`
      : "";

  const userMsg = [
    `POST TOPIC: ${topic}`,
    `SLIDE TITLE: ${slide.title ?? ""}`,
    slide.subtitle ? `SLIDE SUBTITLE: ${slide.subtitle}` : "",
    slide.body ? `SLIDE BODY: ${slide.body.slice(0, 600)}` : "",
    "",
    `BRAND PALETTE (hex): ${colors}`,
    `BRAND MOOD: ${mood}`,
    brand.description ? `BRAND CONTEXT: ${brand.description.slice(0, 240)}` : "",
    brand.audience ? `AUDIENCE: ${brand.audience}` : "",
    refLine,
    "",
    `COMPOSITION (where the image sits): ${MODE_COMPOSITION_HINT[mode] ?? MODE_COMPOSITION_HINT.bg}`,
    userHint?.trim() ? `USER ADJUSTMENT (honor this): ${userHint.trim()}` : "",
    "",
    "Write the image prompt now.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const msg = await anthropic.messages.create({
      model: SMART_MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    return text.length > 10 ? text : null;
  } catch (err) {
    console.error("[smart-prompt] falha, usando template:", err);
    return null;
  }
}
