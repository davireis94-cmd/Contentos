/**
 * Skill: deep-research + fact-check
 * Duas capacidades que usam BUSCA WEB real (ferramenta nativa do Claude):
 *
 * 1. Research — antes de produzir, pesquisa o tema a fundo e devolve um briefing
 *    com fatos checados, dados/estatísticas COM fonte, ângulos e mitos a evitar.
 * 2. Fact-check — recebe um post pronto e verifica as afirmações factuais contra
 *    a web, apontando o que é falso/duvidoso/sem fonte e como corrigir.
 *
 * Composável: o research alimenta o gerador; o fact-check roda sobre a saída.
 */

import type Anthropic from "@anthropic-ai/sdk";

// ── Research ────────────────────────────────────────────────────────────────
export interface ResearchFact {
  claim: string; // a afirmação verificada
  source: string; // de onde veio (veículo/autor)
}
export interface ResearchStat {
  value: string; // o número/dado (ex: "70% dos Reels…")
  context: string; // o que ele significa
  source: string;
}
export interface ResearchBrief {
  summary: string; // 2-3 frases: o estado atual do tema
  facts: ResearchFact[]; // fatos sólidos que dão autoridade
  stats: ResearchStat[]; // dados com fonte
  angles: string[]; // ângulos fortes para um post
  myths: string[]; // crenças comuns/erradas a NÃO repetir
}

export function buildResearchSystem(brandCtx: string): string {
  return `Você é um pesquisador de conteúdo. Use a BUSCA WEB para investigar o tema a fundo ANTES de escrever qualquer coisa. Priorize fontes recentes e confiáveis; descarte boato e achismo.

OBJETIVO: entregar um briefing de pesquisa que dê AUTORIDADE e EVITE erros factuais a um post de Instagram sobre o tema.

REGRAS:
- Faça buscas reais. Não invente dado nem fonte. Se não achou, não liste.
- Toda estatística precisa de fonte nomeada. Sem fonte, não entra.
- "myths" = crenças comuns mas erradas/desatualizadas sobre o tema, para o criador NÃO repetir.
- "angles" = ganchos/ângulos sustentados pelo que você achou (não genéricos).
- Seja específico e atual (cite ano quando relevante).
${brandCtx}

Ao final, responda SOMENTE com JSON válido, sem markdown:
{
  "summary": "2-3 frases sobre o estado atual do tema",
  "facts": [{ "claim": "fato sólido", "source": "veículo/autor" }],
  "stats": [{ "value": "o dado", "context": "o que significa", "source": "fonte" }],
  "angles": ["ângulo forte 1", "..."],
  "myths": ["mito a evitar 1", "..."]
}`;
}

// ── Fact-check ──────────────────────────────────────────────────────────────
export type FactVerdict = "confirmado" | "duvidoso" | "falso" | "sem_fonte";

export interface FactClaim {
  claim: string; // a afirmação do post
  verdict: FactVerdict;
  explanation: string; // por quê, com base na busca
  correction: string | null; // como corrigir (se duvidoso/falso); null se confirmado
  source: string | null; // fonte encontrada
}
export interface FactCheckResult {
  verdict: string; // 1 frase: o post é factualmente confiável?
  riskLevel: "baixo" | "médio" | "alto"; // risco de espalhar erro
  claims: FactClaim[];
}

export const FACTCHECK_SYSTEM = `Você é um checador de fatos. Recebe um post pronto para redes sociais e verifica, usando BUSCA WEB real, as AFIRMAÇÕES FACTUAIS dele (dados, números, atribuições, "estudos dizem", afirmações históricas/técnicas).

REGRAS:
- Verifique de verdade na web. Não chute.
- Avalie só o que é checável: ignore opinião, CTA, gancho subjetivo.
- Para cada afirmação relevante, dê um veredito:
  - "confirmado": bate com fontes confiáveis.
  - "duvidoso": parcialmente certo, exagerado, sem consenso ou desatualizado.
  - "falso": contradiz as fontes.
  - "sem_fonte": afirma número/fato específico sem que se ache respaldo.
- Em "duvidoso"/"falso"/"sem_fonte", proponha uma correção concreta (ou sugira remover/abrandar).
- No máximo 6 afirmações, priorizando as de maior risco. Se o post não tem afirmação factual checável, devolva claims vazio e risco "baixo".

Ao final, responda SOMENTE com JSON válido, sem markdown:
{
  "verdict": "1 frase honesta sobre a confiabilidade factual do post",
  "riskLevel": "baixo|médio|alto",
  "claims": [
    { "claim": "afirmação", "verdict": "confirmado|duvidoso|falso|sem_fonte", "explanation": "por quê", "correction": "como corrigir ou null", "source": "fonte ou null" }
  ]
}`;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Configuração da ferramenta de busca web nativa do Claude. */
export const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search", max_uses: 5 } as const;

/** Junta todos os blocos de texto da resposta (ignora blocos de tool/busca). */
export function extractFinalText(msg: Anthropic.Messages.Message): string {
  return msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
