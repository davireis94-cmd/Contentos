import type { GenerationInput } from "@/lib/validations/generation";

interface DocumentContext {
  resumo?: string;
  publico_alvo?: string;
  tom_de_voz?: string;
  valores?: string[];
  diferenciais?: string[];
  pilares?: string[];
  frases_chave?: string[];
  palavras_evitar?: string[];
  posicionamento?: string;
}

interface BrandContext {
  name: string;
  description: string | null;
  voice: {
    tone: string;
    target_audience: string | null;
    content_pillars: string[];
    characteristic_phrases: string[];
    forbidden_words: string[];
  } | null;
  examples: { content: string }[];
  documents?: DocumentContext[];
}

const OBJECTIVE_LABELS: Record<string, string> = {
  educate: "Educar o público, gerar autoridade e ensinar algo concreto",
  engage: "Gerar engajamento, conversas e conexão emocional",
  sell: "Apresentar oferta, superar objeções e converter",
  inspire: "Inspirar, motivar e criar identificação com a marca",
};

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  carousel:
    "Carrossel para Instagram: slides sequenciais com progressão lógica. Primeiro slide = gancho forte que force o swipe. Último slide = CTA claro.",
  reel:
    "Roteiro de Reels: texto dividido em cenas/cortes rápidos. Primeiro 3 segundos = gancho visual/verbal. Encerramento com CTA.",
  story:
    "Stories sequenciais: cada slide tem 1 ideia central, linguagem direta, máximo 2-3 linhas por slide.",
  single:
    "Post único: imagem estática com legenda completa. Primeiro parágrafo é o gancho que aparece antes do 'ver mais'.",
};

const TONE_DESCRIPTIONS: Record<string, string> = {
  formal: "profissional, técnico, vocabulário rico, sem gírias",
  conversational: "direto, como se estivesse falando com um amigo, usa linguagem do dia a dia",
  authority: "assertivo, confiante, baseado em dados e experiências concretas, sem rodeios",
  minimalist: "frases curtas, sem floreios, cada palavra tem peso, estilo editorial",
};

export function buildSystemPrompt(brand: BrandContext, input: GenerationInput): string {
  const tone = input.toneOverride ?? brand.voice?.tone ?? "conversational";
  const toneDesc = TONE_DESCRIPTIONS[tone] ?? tone;
  const pillars = brand.voice?.content_pillars?.join(", ") || "não definidos";
  const phrases = brand.voice?.characteristic_phrases?.join(", ") || "nenhuma";
  const forbidden = brand.voice?.forbidden_words?.join(", ") || "nenhuma";
  const audience = brand.voice?.target_audience || "público em geral";

  const examplesSection =
    brand.examples.length > 0
      ? brand.examples
          .slice(0, 5)
          .map((e, i) => `--- Exemplo ${i + 1} ---\n${e.content}`)
          .join("\n\n")
      : "Nenhum exemplo cadastrado ainda.";

  const docsSection =
    brand.documents && brand.documents.length > 0
      ? brand.documents
          .map((doc) => {
            const parts: string[] = [];
            if (doc.resumo) parts.push(`Resumo: ${doc.resumo}`);
            if (doc.publico_alvo) parts.push(`Público-alvo: ${doc.publico_alvo}`);
            if (doc.tom_de_voz) parts.push(`Tom de voz: ${doc.tom_de_voz}`);
            if (doc.posicionamento) parts.push(`Posicionamento: ${doc.posicionamento}`);
            if (doc.valores?.length) parts.push(`Valores: ${doc.valores.join(", ")}`);
            if (doc.diferenciais?.length) parts.push(`Diferenciais: ${doc.diferenciais.join(", ")}`);
            if (doc.pilares?.length) parts.push(`Pilares de conteúdo: ${doc.pilares.join(", ")}`);
            if (doc.frases_chave?.length) parts.push(`Frases características: ${doc.frases_chave.join(" | ")}`);
            if (doc.palavras_evitar?.length) parts.push(`Evitar: ${doc.palavras_evitar.join(", ")}`);
            return parts.join("\n");
          })
          .join("\n\n")
      : null;

  return `Você é um ghostwriter especialista em conteúdo para redes sociais.
Sua missão: criar conteúdo autêntico que soa exatamente como a voz da marca abaixo.

## MARCA: ${brand.name}
${brand.description ? `Descrição: ${brand.description}` : ""}
Público-alvo: ${audience}

## TOM DE VOZ
Tom: ${toneDesc}
Pilares de conteúdo: ${pillars}
Frases características (USE-AS quando encaixar): ${phrases}
Palavras PROIBIDAS (NUNCA use): ${forbidden}

## EXEMPLOS DE POSTS REAIS DESTA MARCA
${examplesSection}
${docsSection ? `\n## IDENTIDADE DA MARCA (extraído de documentos oficiais)\n${docsSection}` : ""}
## FORMATO DO CONTEÚDO
${FORMAT_INSTRUCTIONS[input.format] ?? input.format}

## REGRAS DE OURO
- Nunca soe como IA — escreva como humano que conhece profundamente o mercado
- Use as frases características quando natural
- NUNCA use as palavras proibidas
- Mantenha coerência total com os exemplos de posts anteriores
- O primeiro slide/parágrafo DEVE ser um gancho irresistível

## FORMATO DE SAÍDA
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem \`\`\`json.
Schema obrigatório:
{
  "title": "título interno do post (não aparece ao público)",
  "format": "${input.format}",
  "slides": [
    {
      "index": 0,
      "title": "texto do título do slide",
      "subtitle": "subtítulo opcional",
      "body": "corpo do texto",
      "cta": "call to action opcional (só no último slide)"
    }
  ],
  "caption": "legenda completa para acompanhar o post, com emojis se for a voz da marca",
  "hashtags": ["#hashtag1", "#hashtag2"]
}

Para "${input.format}": crie exatamente ${input.format === "single" ? 1 : input.slideCount} slide(s).
Hashtags: entre 5 e 20, relevantes e sem espaços.`;
}

export function buildUserPrompt(input: GenerationInput): string {
  const objectiveDesc = OBJECTIVE_LABELS[input.objective] ?? input.objective;
  return `Crie o conteúdo com as seguintes especificações:

TÓPICO: ${input.topic}
OBJETIVO: ${objectiveDesc}
FORMATO: ${input.format}
NÚMERO DE SLIDES: ${input.format === "single" ? 1 : input.slideCount}${
    input.toneOverride ? `\nTOM ESPECIAL: ${TONE_DESCRIPTIONS[input.toneOverride]}` : ""
  }

Lembre-se: retorne APENAS o JSON, nada mais.`;
}
