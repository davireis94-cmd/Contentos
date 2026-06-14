interface BrandScoreInput {
  hasLogo: boolean;
  colorsCount: number;
  hasFonts: boolean;
  hasDescription: boolean;
  hasAudience: boolean;
  hasTone: boolean;
  pillarsCount: number;
  phrasesCount: number;
  forbiddenCount: number;
  referencesCount: number;
  examplesCount: number;
}

/**
 * Completeness score 0-100. A VOZ é o que faz a IA escrever bem, então
 * pesa a maior parte (75). Visual (logo/cores/fontes) é polimento (10) e
 * exemplos/referências enriquecem (15). Assim um cérebro de voz completa
 * já chega perto de 75% sem depender de logo/cores.
 */
export function computeBrandScore(input: BrandScoreInput): number {
  let score = 0;
  // ── Voz (75) ──
  if (input.hasDescription) score += 12;
  if (input.hasAudience) score += 18;
  if (input.hasTone) score += 18;
  score += Math.min(input.pillarsCount * 6, 18);
  if (input.phrasesCount > 0) score += 5;
  if (input.forbiddenCount > 0) score += 4;
  // ── Visual (10) ──
  if (input.hasLogo) score += 4;
  if (input.colorsCount >= 2) score += 4;
  else if (input.colorsCount === 1) score += 2;
  if (input.hasFonts) score += 2;
  // ── Exemplos & referências (15) ──
  score += Math.min(input.referencesCount * 3, 6);
  score += Math.min(input.examplesCount * 3, 9);
  return Math.min(score, 100);
}

export function scoreHint(score: number): string | null {
  if (score >= 90) return null;
  if (score < 40) return "Preencha o tom de voz e o público-alvo para melhorar as gerações.";
  if (score < 70) return "Adicione pilares de conteúdo e exemplos de posts anteriores.";
  return "Adicione mais exemplos de posts para a IA aprender seu estilo.";
}
