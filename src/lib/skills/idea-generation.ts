/**
 * Skill: idea-generation
 * Estágio "pauta" da content factory. Em vez de pedir um tema por vez, gera um
 * LOTE de 10-15 pautas acionáveis cruzando três fontes:
 *   1. Brand Brain (voz, pilares, público) — para soar como a marca.
 *   2. Tendências (benchmark_content: YouTube + Apify) — o que está em alta no nicho.
 *   3. Performance (performance_insights) — o que já funcionou com o público real.
 *
 * Composável: a saída alimenta o gerador (cada pauta vira um briefing pronto
 * via /generate?topic=...&format=...&objective=...).
 */

export type IdeaFormat = "carousel" | "reel" | "story" | "single";
export type IdeaObjective = "awareness" | "engagement" | "saves" | "conversion";

export interface ContentIdea {
  hook: string; // o gancho/ângulo — primeira frase que para o scroll
  angle: string; // o ângulo em 1 frase (por que essa pauta importa agora)
  format: IdeaFormat; // formato recomendado
  objective: IdeaObjective; // objetivo principal
  pillar: string | null; // pilar de conteúdo da marca (se aplicável)
  source: string; // de onde veio a inspiração: "tendência", "performance", "marca"
}

const FORMAT_HINT =
  'carousel | reel | story | single (escolha o que melhor serve o ângulo)';
const OBJECTIVE_HINT =
  'awareness (alcance) | engagement (comentários) | saves (salvável) | conversion (clique/venda)';

/** Monta a seção de tendências para o prompt (compacta — só o que ajuda a pauta). */
export function renderTrendsForPrompt(
  trends: { title: string; description?: string | null; topic_tags?: string[] | null; source?: string | null; niche?: string | null }[]
): string {
  if (!trends.length) return "(sem tendências coletadas — gere a partir da marca e performance)";
  return trends
    .slice(0, 25)
    .map((t) => {
      const tags = t.topic_tags?.length ? ` [${t.topic_tags.slice(0, 4).join(", ")}]` : "";
      const desc = t.description?.trim() ? ` — ${t.description.trim().slice(0, 140)}` : "";
      const src = t.source ? ` (${t.source})` : "";
      return `- ${t.title}${desc}${tags}${src}`;
    })
    .join("\n");
}

export interface BuildIdeaSystemArgs {
  brandCtx: string; // bloco de voz da marca (mesmo formato das outras skills)
  trendsBlock: string; // saída de renderTrendsForPrompt
  performanceBlock: string; // saída de renderPerformanceForPrompt (pode ser "")
  count: number; // quantas pautas (10-15)
}

export function buildIdeaSystem({ brandCtx, trendsBlock, performanceBlock, count }: BuildIdeaSystemArgs): string {
  const perfSection = performanceBlock?.trim()
    ? `\nO QUE JÁ FUNCIONOU COM ESTE PÚBLICO (priorize ângulos parecidos):\n${performanceBlock.trim()}\n`
    : "";

  return `Você é um estrategista de conteúdo que monta a pauta editorial de uma marca para Instagram. Seu trabalho é gerar ${count} PAUTAS distintas e acionáveis — não posts prontos, mas ângulos fortes que valem a pena produzir.

Cada pauta deve nascer do cruzamento de três sinais: a voz/estratégia da marca, o que está em alta no nicho agora (tendências) e o que já performou com o público real. Não invente tema genérico: ancore em algo concreto de uma dessas fontes.

REGRAS:
- ${count} pautas DISTINTAS entre si (sem repetir o mesmo ângulo com outras palavras).
- O "hook" é a primeira frase que pararia o scroll — específico, com tensão ou curiosidade. Nada de "Dicas de X" ou "A importância de Y".
- Varie formato e objetivo ao longo do lote (não jogue tudo em carrossel/awareness).
- Respeite a voz da marca: pilares, público, palavras proibidas. Sem clichê de IA, sem promessa fácil.
- Em "source", diga honestamente de onde veio a faísca: "tendência", "performance" ou "marca".
- Se um pilar de conteúdo da marca se encaixar, preencha "pillar"; senão, null.

${brandCtx}

TENDÊNCIAS DO NICHO (agora):
${trendsBlock}
${perfSection}
Responda SOMENTE com JSON válido, sem markdown:
{
  "ideas": [
    {
      "hook": "a primeira frase que para o scroll",
      "angle": "1 frase: por que essa pauta importa agora",
      "format": "${FORMAT_HINT}",
      "objective": "${OBJECTIVE_HINT}",
      "pillar": "pilar da marca ou null",
      "source": "tendência | performance | marca"
    }
  ]
}
Gere exatamente ${count} itens.`;
}

const VALID_FORMATS: IdeaFormat[] = ["carousel", "reel", "story", "single"];
const VALID_OBJECTIVES: IdeaObjective[] = ["awareness", "engagement", "saves", "conversion"];

/** Normaliza a saída crua do modelo em ideias seguras para a UI. */
export function normalizeIdeas(raw: unknown): ContentIdea[] {
  const arr = (raw as { ideas?: unknown[] })?.ideas;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it): ContentIdea | null => {
      const o = it as Record<string, unknown>;
      const hook = typeof o.hook === "string" ? o.hook.trim() : "";
      if (!hook) return null;
      const format = VALID_FORMATS.includes(o.format as IdeaFormat) ? (o.format as IdeaFormat) : "carousel";
      const objective = VALID_OBJECTIVES.includes(o.objective as IdeaObjective)
        ? (o.objective as IdeaObjective)
        : "engagement";
      const pillarRaw = typeof o.pillar === "string" ? o.pillar.trim() : "";
      return {
        hook,
        angle: typeof o.angle === "string" ? o.angle.trim() : "",
        format,
        objective,
        pillar: pillarRaw && pillarRaw.toLowerCase() !== "null" ? pillarRaw : null,
        source: typeof o.source === "string" ? o.source.trim() : "marca",
      };
    })
    .filter((x): x is ContentIdea => x !== null);
}
