/**
 * Skill: content-critic
 * Estágio "controle de qualidade" da content factory. Recebe um post pronto e
 * aponta os furos de forma DIRETA e ACIONÁVEL (estilo office hours / crítico
 * durão), com nota e correções concretas — sem suavizar.
 *
 * Composável: roda sobre a saída do gerador (slides/caption/hashtags) usando o
 * contexto da marca (voz + estratégia) para avaliar alinhamento.
 */

export interface CriticIssue {
  severity: "alta" | "média" | "baixa";
  where: string; // ex: "Slide 1 (hook)", "Legenda", "CTA"
  problem: string; // o que está errado, específico
  fix: string; // como corrigir, concreto
}

export interface CriticResult {
  score: number; // 0-100
  verdict: string; // 1-2 frases, honesto
  issues: CriticIssue[];
  strengths: string[];
}

export const CRITIC_SYSTEM = `Você é um editor sênior de conteúdo para redes sociais conduzindo um "office hours" — crítica direta, honesta e acionável, no estilo de uma sessão dura da Y Combinator. Seu trabalho NÃO é elogiar: é encontrar o que impede o post de performar e dizer como consertar.

AVALIE com rigor, na ordem dos sinais que mais importam no algoritmo (2025):
1. GANCHO (slide 1 / primeira linha): para o scroll em 1-2s? É específico ou genérico? Cria tensão/curiosidade?
2. RETENÇÃO: cada slide puxa pro próximo? Tem queda de ritmo? Slide fraco no meio?
3. VALOR (salvável/compartilhável): o leitor aprende algo concreto que vai querer guardar ou mandar pra alguém?
4. PROVA: afirmações têm evidência/especificidade, ou são genéricas ("engajamento é importante")?
5. CTA: é contextual e específico, ou genérico/ausente?
6. CARA DE IA: tem aberturas/clichês de IA ("no mundo atual", "vamos explorar", "em conclusão"), frases simétricas demais, adjetivos vazios?
7. VOZ DA MARCA: bate com o tom/estratégia informados? Soa como guru quando não deveria?

REGRAS:
- Seja específico: aponte ONDE (qual slide/parte) e dê a correção concreta, não conselho vago.
- Severidade "alta" = compromete a performance; "média" = melhora relevante; "baixa" = polimento.
- Liste no máximo 6 issues, priorizando as de maior impacto. Não invente problema onde não há.
- Reconheça 1-3 pontos fortes reais (curtos) — para o usuário saber o que manter.
- A nota reflete o potencial de performance real, não esforço.

Responda SOMENTE com JSON válido, sem markdown:
{
  "score": 0-100,
  "verdict": "1-2 frases honestas sobre o estado do post",
  "issues": [{ "severity": "alta|média|baixa", "where": "onde", "problem": "o que está errado", "fix": "como consertar" }],
  "strengths": ["ponto forte 1", "..."]
}`;

/** Monta o texto do post para o crítico avaliar. */
export function renderPostForCritic(output: {
  slides?: { title?: string; subtitle?: string; body?: string; cta?: string }[];
  caption?: string;
  hashtags?: string[];
  format?: string;
}): string {
  const lines: string[] = [`FORMATO: ${output.format ?? "post"}`, ""];
  (output.slides ?? []).forEach((s, i) => {
    lines.push(`--- ${i === 0 ? "SLIDE 1 (HOOK)" : `SLIDE ${i + 1}`} ---`);
    if (s.subtitle) lines.push(`[tag] ${s.subtitle}`);
    if (s.title) lines.push(`Título: ${s.title}`);
    if (s.body) lines.push(`Corpo: ${s.body.replace(/\n?\[[^\]:]+:[^\]]*\]/g, "").trim()}`);
    if (s.cta) lines.push(`CTA: ${s.cta}`);
    lines.push("");
  });
  if (output.caption) lines.push(`LEGENDA:\n${output.caption}`, "");
  if (output.hashtags?.length) lines.push(`HASHTAGS: ${output.hashtags.join(" ")}`);
  return lines.join("\n");
}
