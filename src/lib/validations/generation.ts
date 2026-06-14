import { z } from "zod";

export const contentFormatSchema = z.enum([
  "carousel",
  "reel",
  "story",
  "single",
]);

export const objectiveSchema = z.enum([
  "educate",
  "engage",
  "sell",
  "inspire",
]);

export const platformSchema = z.enum([
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "x",
]);

export const slideSchema = z.object({
  index: z.number().int().min(0),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  body: z.string().min(1),
  cta: z.string().optional(),
  // URL de imagem de fundo gerada por IA (Fase 2.2). Opcional e persistida no slide.
  imageUrl: z.string().optional(),
});

/**
 * Canonical shape every AI generation must return.
 * The route handler retries automatically when Claude's output
 * fails this schema — the user never sees malformed JSON.
 */
export const generationOutputSchema = z.object({
  title: z.string().min(1),
  format: contentFormatSchema,
  platform: platformSchema.optional(),
  productionTool: z.string().optional(),
  slides: z.array(slideSchema).min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string().regex(/^#?[\p{L}\p{N}_]+$/u)).min(3).max(30),
});

export const importedContentSchema = z.object({
  url: z.string().max(2000),
  platform: z.string().max(50),
  platformLabel: z.string().max(100).optional(),
  title: z.string().max(500).nullable(),
  description: z.string().max(5000).nullable(),
  imageUrl: z.string().max(2000).nullable().optional(),
  author: z.string().max(200).nullable(),
  isPartial: z.boolean().optional(),
});

export const generationInputSchema = z.object({
  brandId: z.string().uuid(),
  platform: platformSchema,
  topic: z.string().min(3).max(500),
  objective: objectiveSchema,
  format: contentFormatSchema,
  slideCount: z.number().int().min(1).max(20).default(7),
  toneOverride: z
    .enum(["formal", "conversational", "authority", "minimalist"])
    .optional(),
  productionTool: z.string().max(100).optional(),
  framework: z.string().max(50).optional(),
  referenceIds: z.array(z.string().uuid()).max(3).optional(),
  externalRef: z.string().max(5000).optional(),
  importedRef: importedContentSchema.optional(),
});

export type GenerationOutput = z.infer<typeof generationOutputSchema>;
export type GenerationInput = z.infer<typeof generationInputSchema>;
export type Slide = z.infer<typeof slideSchema>;
