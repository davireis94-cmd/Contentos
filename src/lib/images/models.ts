/**
 * Mapa de modelos de imagem → path do Replicate + builder de input.
 * Abstração modelo-atrás-do-crédito (lição Gravyx): todos custam o mesmo
 * em créditos; a diferença de custo real é absorvida e registrada no ledger.
 *
 * Os keys batem com IMAGE_MODELS em pricing.ts.
 */

export interface ImageModelDef {
  key: string; // bate com pricing.ts IMAGE_MODELS
  label: string;
  hint: string;
  provider?: "replicate" | "gemini"; // padrão: replicate
  replicatePath: string; // owner/model no Replicate (vazio p/ gemini)
  buildInput: (prompt: string) => Record<string, unknown>;
}

export const IMAGE_MODEL_DEFS: ImageModelDef[] = [
  {
    key: "flux-1.1-pro",
    label: "Flux 1.1 Pro",
    hint: "Realismo fotográfico (recomendado)",
    replicatePath: "black-forest-labs/flux-1.1-pro",
    buildInput: (prompt) => ({
      prompt,
      aspect_ratio: "4:5",
      output_format: "png",
      prompt_upsampling: true,
      safety_tolerance: 5,
    }),
  },
  {
    key: "flux-dev",
    label: "Flux Dev",
    hint: "Rápido e econômico",
    replicatePath: "black-forest-labs/flux-dev",
    buildInput: (prompt) => ({
      prompt,
      aspect_ratio: "4:5",
      output_format: "png",
      num_outputs: 1,
    }),
  },
  {
    key: "ideogram-v2",
    label: "Ideogram",
    hint: "Melhor com texto legível na imagem",
    replicatePath: "ideogram-ai/ideogram-v2",
    buildInput: (prompt) => ({
      prompt,
      aspect_ratio: "4:5",
      magic_prompt_option: "Auto",
    }),
  },
  {
    key: "nano-banana-pro",
    label: "Nano Banana",
    hint: "Google Gemini Image (via Replicate)",
    replicatePath: "google/nano-banana",
    buildInput: (prompt) => ({
      prompt,
    }),
  },
  {
    key: "gemini-free",
    label: "Gemini (grátis)",
    hint: "Google Gemini direto — grátis, com limite diário",
    provider: "gemini",
    replicatePath: "",
    buildInput: (prompt) => ({ prompt }),
  },
];

export function getImageModel(key: string): ImageModelDef {
  return IMAGE_MODEL_DEFS.find((m) => m.key === key) ?? IMAGE_MODEL_DEFS[0];
}
