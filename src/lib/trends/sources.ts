/**
 * Configuração de nichos → fontes de dados.
 * YouTube categories: 22=People&Blogs, 26=Howto&Style, 27=Education, 28=Science&Tech, 24=Entertainment
 */

export interface NicheConfig {
  id: string;
  label: string;
  tag?: string; // etiqueta curta exibida no card (#tag). Default: id
  youtubeQuery: string; // termo de busca no YouTube (mais relevante que só categoria)
  youtubeCategories: number[];
  subreddits: string[]; // vazio = buscar no Reddit por palavra-chave (search)
}

/** Etiqueta curta (1-2 palavras) a partir de um texto livre. */
function shortTag(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 2)
    .join("-") || "marca";
}

/**
 * Monta nichos de busca a partir dos temas da marca (pilares/descrição).
 * Cada tema vira uma busca focada no YouTube + Reddit (por palavra-chave).
 */
export function brandNiches(queries: string[]): NicheConfig[] {
  const clean = queries.map((q) => q.trim()).filter((q) => q.length > 2);
  return Array.from(new Set(clean))
    .slice(0, 4)
    .map((q, i) => ({
      id: `marca-${i + 1}`,
      label: q,
      tag: shortTag(q),
      youtubeQuery: q,
      youtubeCategories: [],
      subreddits: [], // sem subreddit fixo → busca por palavra-chave
    }));
}

export const NICHES: NicheConfig[] = [
  {
    id: "marketing",
    label: "Marketing",
    youtubeQuery: "marketing digital instagram",
    youtubeCategories: [27, 26],
    subreddits: ["marketing", "socialmedia", "InstagramMarketing"],
  },
  {
    id: "empreendedorismo",
    label: "Empreendedorismo",
    youtubeQuery: "empreendedorismo negócios",
    youtubeCategories: [27, 22],
    subreddits: ["Entrepreneur", "smallbusiness"],
  },
  {
    id: "ia",
    label: "Inteligência Artificial",
    youtubeQuery: "inteligência artificial IA ferramentas",
    youtubeCategories: [28, 27],
    subreddits: ["artificial", "ChatGPT", "OpenAI"],
  },
];

export const REGION_CODE = "BR";
export const RELEVANCE_LANGUAGE = "pt";

export interface FetchedTrend {
  source: "youtube" | "reddit";
  externalId: string;
  niche: string;
  title: string;
  description: string | null;
  sourceUrl: string;
  thumbnailUrl: string | null;
  author: string | null;
  platform: string; // 'youtube' | 'reddit'
  format: string; // 'reel' | 'post'
  publishedAt: string | null;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    ups?: number;
    engagementRate?: number; // %
    velocityPerHour?: number;
  };
}
