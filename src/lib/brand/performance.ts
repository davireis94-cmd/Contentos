/**
 * Feedback loop: aprendizados extraídos do desempenho real dos posts no
 * Instagram. Guardados em brands.identity.performance_insights (sem migração).
 * Alimentam o prompt de geração para que cada peça nova nasça sabendo o que
 * funciona com o público real da marca.
 */
export interface PerformanceInsights {
  updatedAt: string; // ISO — quando foi a última análise
  postsAnalyzed: number; // quantos posts entraram na análise
  bestFormat: string | null; // formato que mais performa (ex: "carousel")
  topPatterns: string[]; // padrões que funcionam (gancho, tema, estrutura)
  avoidPatterns: string[]; // padrões que NÃO engajam com este público
  bestTopics: string[]; // temas recorrentes nos posts campeões
  summary: string; // resumo humano de 1-2 frases
}

/** Score de desempenho de um post — pondera o que o algoritmo do IG valoriza. */
export function performanceScore(p: {
  likes: number;
  comments: number;
  reach: number;
  saved: number;
}): number {
  // Salvamentos e comentários sinalizam valor real; reach normaliza alcance.
  return p.saved * 5 + p.comments * 3 + p.likes + p.reach / 100;
}

/** Renderiza os aprendizados como seção do system prompt da geração. */
export function renderPerformanceForPrompt(p: PerformanceInsights | null | undefined): string {
  if (!p) return "";
  const lines: string[] = [];
  if (p.summary?.trim()) lines.push(p.summary.trim());
  if (p.bestFormat) lines.push(`Formato que mais performa com este público: ${p.bestFormat}.`);
  if (p.bestTopics?.length) lines.push(`Temas que mais engajam: ${p.bestTopics.join(" | ")}.`);
  if (p.topPatterns?.length) {
    lines.push(`PADRÕES QUE FUNCIONAM (priorize-os):\n${p.topPatterns.map((t) => `- ${t}`).join("\n")}`);
  }
  if (p.avoidPatterns?.length) {
    lines.push(`PADRÕES QUE NÃO ENGAJAM (evite-os):\n${p.avoidPatterns.map((t) => `- ${t}`).join("\n")}`);
  }
  return lines.join("\n");
}
