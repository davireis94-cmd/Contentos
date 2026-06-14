/**
 * Configuração de nichos → fontes de dados.
 * YouTube categories: 22=People&Blogs, 26=Howto&Style, 27=Education, 28=Science&Tech, 24=Entertainment
 */

export interface NicheConfig {
  id: string;
  label: string;
  tag?: string; // etiqueta curta exibida no card (#tag). Default: id
  hashtag?: string; // hashtag real p/ Instagram/TikTok (sem #). Default: derivado da query
  youtubeQuery: string; // termo de busca no YouTube (mais relevante que só categoria)
  youtubeCategories: number[];
  subreddits: string[]; // vazio = buscar no Reddit por palavra-chave (search)
}

const PT_STOPWORDS = new Set([
  "para","com","que","dos","das","uma","seu","sua","por","mais","como","sobre",
  "the","and","for","with","você","voce","nas","nos","aos","pra","ser","tem",
  "de","da","do","em","no","na","os","as","um","ao","sem","seus","suas","meu",
  "minha","nosso","nossa","todo","toda","cada","entre","sobre","ainda","muito",
]);

/** Palavras significativas (>3 letras, sem stopwords, sem acento) de um texto. */
function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !PT_STOPWORDS.has(w));
}

/** Etiqueta curta (1-2 palavras) a partir de um texto livre. */
function shortTag(text: string): string {
  return keywords(text).slice(0, 2).join("-") || "marca";
}

/** Converte um texto livre (pilar/frase) numa busca enxuta de 2-4 palavras-chave. */
function conciseQuery(text: string): string {
  return keywords(text).slice(0, 4).join(" ");
}

/**
 * Monta nichos de busca a partir dos temas da marca (pilares/descrição).
 * Cada tema vira uma busca focada no YouTube + Reddit (por palavra-chave).
 */
export function brandNiches(queries: string[]): NicheConfig[] {
  const built = queries
    .map((q) => ({ label: q.trim(), query: conciseQuery(q) }))
    .filter((q) => q.query.length > 2);
  // Dedup pela busca enxuta (evita pilares que viram a mesma query)
  const seen = new Set<string>();
  const unique = built.filter((q) => {
    if (seen.has(q.query)) return false;
    seen.add(q.query);
    return true;
  });
  return unique.slice(0, 4).map((q, i) => ({
    id: `marca-${i + 1}`,
    label: q.label,
    tag: shortTag(q.label),
    youtubeQuery: q.query,
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
  source: "youtube" | "reddit" | "instagram" | "tiktok";
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
  isReference?: boolean; // veio de um perfil de referência do usuário
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    ups?: number;
    saved?: number;
    engagementRate?: number; // %
    velocityPerHour?: number;
  };
}
