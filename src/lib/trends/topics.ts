import { anthropic } from "@/lib/ai/anthropic";

export interface TrendTopic {
  title: string; // nome curto do tema
  why: string; // por que está viralizando
  angle: string; // ângulo de post sugerido p/ a marca
  heat: "alta" | "média" | "baixa";
  trendIds: string[]; // ids das tendências que compõem o tema
}

/** Entrada compacta enviada à IA (1 linha por tendência). */
export interface TopicInput {
  id: string;
  title: string;
  platform: string;
  niche: string | null;
  velocityPerHour?: number;
  engagementRate?: number;
}

const SYSTEM = `Você é um estrategista de conteúdo para Instagram. Recebe uma lista de conteúdos virais do mercado e os agrupa em TEMAS acionáveis para um criador.`;

function buildPrompt(items: TopicInput[], brandContext: string): string {
  const list = items
    .map(
      (t, i) =>
        `${i + 1}. [id:${t.id}] (${t.platform}${t.niche ? `/${t.niche}` : ""}${
          t.velocityPerHour ? `, ${t.velocityPerHour}/h` : ""
        }${t.engagementRate ? `, ${t.engagementRate}% eng` : ""}) ${t.title}`
    )
    .join("\n");

  return `${brandContext ? `CONTEXTO DA MARCA: ${brandContext}\n\n` : ""}TENDÊNCIAS:
${list}

Agrupe estas tendências em 3 a 6 TEMAS. Para cada tema:
- "title": nome curto e claro do tema (3-6 palavras)
- "why": por que esse tema está viralizando agora (1 frase, concreta)
- "angle": um ângulo de post pronto para a marca explorar (1 frase imperativa)
- "heat": "alta", "média" ou "baixa" — baseado na velocidade/engajamento das tendências do tema
- "trendIds": array com os ids ([id:...]) das tendências que pertencem ao tema

Responda APENAS com um array JSON, sem markdown. Exemplo:
[{"title":"...","why":"...","angle":"...","heat":"alta","trendIds":["abc","def"]}]`;
}

/**
 * Usa a IA para agrupar tendências em temas acionáveis.
 * Mantém o input enxuto (top por velocidade) para controlar custo.
 */
export async function clusterTopics(
  items: TopicInput[],
  brandContext = ""
): Promise<TrendTopic[]> {
  if (items.length === 0) return [];

  // Top 25 por velocidade para limitar tokens.
  const top = [...items]
    .sort((a, b) => (b.velocityPerHour ?? 0) - (a.velocityPerHour ?? 0))
    .slice(0, 25);

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: buildPrompt(top, brandContext) }],
  });

  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as TrendTopic[];
    const validIds = new Set(top.map((t) => t.id));
    return parsed
      .filter((t) => t.title && t.why)
      .map((t) => ({
        title: String(t.title),
        why: String(t.why),
        angle: String(t.angle ?? ""),
        heat: (["alta", "média", "baixa"] as const).includes(t.heat) ? t.heat : "média",
        trendIds: Array.isArray(t.trendIds)
          ? t.trendIds.filter((id) => validIds.has(id))
          : [],
      }));
  } catch {
    return [];
  }
}
