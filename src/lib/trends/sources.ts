/**
 * Configuração de nichos → fontes de dados.
 * YouTube categories: 22=People&Blogs, 26=Howto&Style, 27=Education, 28=Science&Tech, 24=Entertainment
 */

export interface NicheConfig {
  id: string;
  label: string;
  youtubeQuery: string; // termo de busca no YouTube (mais relevante que só categoria)
  youtubeCategories: number[];
  subreddits: string[];
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
