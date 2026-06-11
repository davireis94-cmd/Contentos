interface BrandScoreInput {
  hasLogo: boolean;
  colorsCount: number;
  hasFonts: boolean;
  hasDescription: boolean;
  hasAudience: boolean;
  pillarsCount: number;
  phrasesCount: number;
  forbiddenCount: number;
  referencesCount: number;
  examplesCount: number;
}

/**
 * Completeness score 0-100. Weights favor the inputs that most
 * improve generation quality: audience, pillars and examples.
 */
export function computeBrandScore(input: BrandScoreInput): number {
  let score = 0;
  if (input.hasLogo) score += 10;
  if (input.colorsCount >= 2) score += 10;
  else if (input.colorsCount === 1) score += 5;
  if (input.hasFonts) score += 5;
  if (input.hasDescription) score += 10;
  if (input.hasAudience) score += 15;
  score += Math.min(input.pillarsCount * 5, 15);
  if (input.phrasesCount > 0) score += 5;
  if (input.forbiddenCount > 0) score += 5;
  score += Math.min(input.referencesCount * 5, 10);
  score += Math.min(input.examplesCount * 5, 15);
  return Math.min(score, 100);
}

export function scoreHint(score: number): string | null {
  if (score >= 90) return null;
  if (score < 40) return "Preencha o tom de voz e o público-alvo para melhorar as gerações.";
  if (score < 70) return "Adicione pilares de conteúdo e exemplos de posts anteriores.";
  return "Adicione mais exemplos de posts para a IA aprender seu estilo.";
}
