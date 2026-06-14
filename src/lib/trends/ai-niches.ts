import { anthropic } from "@/lib/ai/anthropic";
import type { NicheConfig } from "./sources";

interface AiNiche {
  label: string; // tema legível
  youtubeQuery: string; // busca natural p/ YouTube (PT-BR)
  hashtag: string; // hashtag real e popular (sem #), uma palavra/composta
}

const SYSTEM =
  "Você é especialista em descoberta de tendências. A partir da marca, indica os melhores termos de busca e hashtags REAIS e populares para encontrar conteúdo viral do nicho.";

/**
 * Usa a IA para traduzir o contexto da marca em nichos de busca acionáveis
 * (termo de YouTube + hashtag real de Instagram/TikTok). Retorna [] em falha.
 */
export async function suggestNiches(brandContext: string): Promise<NicheConfig[]> {
  if (!brandContext.trim()) return [];

  const prompt = `MARCA:
${brandContext}

Liste de 3 a 4 nichos para descobrir conteúdo viral relevante a esta marca.
Para cada um:
- "label": nome do tema (2-4 palavras)
- "youtubeQuery": busca natural no YouTube em pt-BR (3-5 palavras)
- "hashtag": UMA hashtag real e POPULAR do tema (sem #, sem espaços, minúscula, em português quando fizer sentido)

Use termos que realmente existem e têm volume (ex: marketingdigital, empreendedorismo, gastronomia), não termos abstratos.
Responda APENAS com um array JSON, sem markdown.
Ex: [{"label":"Marketing Digital","youtubeQuery":"marketing digital para negócios","hashtag":"marketingdigital"}]`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]) as AiNiche[];
    return parsed
      .filter((n) => n.youtubeQuery && n.hashtag)
      .slice(0, 4)
      .map((n, i) => ({
        id: `marca-${i + 1}`,
        label: n.label || n.youtubeQuery,
        tag: n.hashtag.toLowerCase().replace(/[^a-z0-9]/g, ""),
        hashtag: n.hashtag.toLowerCase().replace(/[^a-z0-9]/g, ""),
        youtubeQuery: n.youtubeQuery,
        youtubeCategories: [],
        subreddits: [],
      }))
      .filter((n) => n.hashtag.length > 2);
  } catch {
    return [];
  }
}
