import { anthropic } from "@/lib/ai/anthropic";
import { type BrandExtras } from "./extras";

const MODEL = "claude-sonnet-4-6";

/**
 * Gera perguntas de entrevista sob medida para extrair o que falta no cérebro
 * da marca (inimigo, opiniões, histórias, dores/desejos, ofertas, estilo).
 */
export async function generateQuestions(brandContext: string): Promise<string[]> {
  const prompt = `${brandContext ? `MARCA:\n${brandContext}\n\n` : ""}Você vai ENTREVISTAR o dono desta marca para deixar o "cérebro" dela de classe mundial.
Faça de 5 a 6 perguntas curtas, específicas e fáceis de responder, que extraiam:
- o inimigo/vilão contra o qual a marca luta
- opiniões fortes/polêmicas que diferenciam
- histórias, cases e provas reais (com números se possível)
- as dores e os desejos mais específicos do público
- o que a marca vende (ofertas/CTAs)
Personalize as perguntas ao contexto da marca (não genéricas).
Responda APENAS com um array JSON de strings. Ex: ["pergunta 1","pergunta 2"]`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as string[];
    return parsed.filter((q) => typeof q === "string" && q.trim()).slice(0, 6);
  } catch {
    return [];
  }
}

/**
 * Sintetiza as respostas da entrevista nos campos avançados do cérebro,
 * preservando o que já existe (merge).
 */
export async function synthesizeExtras(
  brandContext: string,
  qa: { q: string; a: string }[],
  current: BrandExtras
): Promise<BrandExtras> {
  const transcript = qa
    .filter((p) => p.a?.trim())
    .map((p, i) => `P${i + 1}: ${p.q}\nR${i + 1}: ${p.a}`)
    .join("\n\n");
  if (!transcript) return current;

  const prompt = `${brandContext ? `MARCA:\n${brandContext}\n\n` : ""}ENTREVISTA:
${transcript}

JÁ EXISTE NO CÉREBRO (não duplique, complemente):
${JSON.stringify(current)}

Extraia e ORGANIZE as respostas nos campos abaixo (em português, na voz do entrevistado, sem inventar o que não foi dito):
{
  "enemy": "uma frase do inimigo/vilão da marca",
  "strong_opinions": ["opiniões fortes/polêmicas"],
  "stories": ["histórias, cases e provas reais"],
  "audience_pains": ["dores específicas do público"],
  "audience_desires": ["desejos do público"],
  "offers": ["ofertas e CTAs"],
  "style_references": ["referências de estilo, se citadas"]
}
Inclua apenas campos com conteúdo real. Responda APENAS o JSON, sem markdown.`;

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return current;
    const parsed = JSON.parse(match[0]) as BrandExtras;

    // Merge com o existente (união em arrays, preenche string se vazia).
    const mergeArr = (a?: string[], b?: string[]) =>
      Array.from(new Set([...(a ?? []), ...(b ?? [])].map((s) => s?.trim()).filter(Boolean)));
    return {
      enemy: current.enemy?.trim() || parsed.enemy?.trim() || undefined,
      strong_opinions: mergeArr(current.strong_opinions, parsed.strong_opinions),
      stories: mergeArr(current.stories, parsed.stories),
      audience_pains: mergeArr(current.audience_pains, parsed.audience_pains),
      audience_desires: mergeArr(current.audience_desires, parsed.audience_desires),
      offers: mergeArr(current.offers, parsed.offers),
      style_references: mergeArr(current.style_references, parsed.style_references),
    };
  } catch {
    return current;
  }
}
