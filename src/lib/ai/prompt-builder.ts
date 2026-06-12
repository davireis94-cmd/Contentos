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

interface ReferencePost {
  title: string;
  format: string;
  slides: Array<{ index: number; title: string; subtitle?: string; body: string; cta?: string }>;
  caption: string;
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
  references?: ReferencePost[];
  externalRef?: string;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  educate: "Educar o público, gerar autoridade e ensinar algo concreto",
  engage: "Gerar engajamento, conversas e conexão emocional",
  sell: "Apresentar oferta, superar objeções e converter",
  inspire: "Inspirar, motivar e criar identificação com a marca",
};

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  carousel:
    "Carrossel: slides sequenciais com progressão lógica. Primeiro slide = gancho forte que force o swipe. Último slide = CTA claro.",
  reel:
    "Roteiro de Reels: texto dividido em cenas/cortes rápidos. Primeiros 1-3 segundos = gancho visual/verbal. Encerramento com CTA.",
  story:
    "Stories sequenciais: cada slide tem 1 ideia central, linguagem direta, máximo 2-3 linhas por slide.",
  single:
    "Post único: imagem estática com legenda completa. Primeiro parágrafo é o gancho que aparece antes do 'ver mais'.",
};

const PLATFORM_SPECS: Record<string, string> = {
  instagram: `Instagram:
- Carrossel: até 10 slides, 1080×1080px (quadrado) ou 1080×1350px (retrato 4:5)
- Reels: vertical 1080×1920px, duração ideal 15-60 segundos, gancho nos primeiros 3 segundos
- Stories: vertical 1080×1920px, texto curto, máximo 3 linhas por slide
- Post único: 1080×1080px ou 1080×1350px
- Legenda: até 2200 caracteres; as primeiras ~125 chars aparecem sem expandir — coloque o gancho aí
- Hashtags: até 30, idealmente 5-15 focados no nicho`,

  tiktok: `TikTok:
- Formato: vídeo vertical 1080×1920px (9:16)
- Gancho nos primeiros 1-3 segundos é determinante — sem ele o algoritmo não distribui
- Duração ideal: 30-60 segundos para alto engajamento
- Tom dinâmico, direto, entretido; trending sounds ampliam alcance orgânico
- Legenda: curta, o que conta é o gancho verbal no vídeo
- Hashtags: 3-5 relevantes ao nicho`,

  youtube: `YouTube:
- Vídeo padrão: horizontal 1920×1080px (16:9); Shorts: vertical 1080×1920px (até 60 segundos)
- Primeiros 15 segundos determinam a retenção — gancho imediato obrigatório
- Vídeos longos: estruture com capítulos e timestamps
- Título: 50-70 caracteres com palavra-chave principal
- Descrição detalhada com timestamps aumenta SEO e watch time`,

  linkedin: `LinkedIn:
- Tom profissional, orientado a insights, dados e resultados concretos
- Carrosséis PDF funcionam muito bem (até 10 slides)
- Post texto: parágrafos curtos, espaçamento generoso, primeiras linhas = gancho
- Evite linguagem informal ou gírias — público aqui espera profissionalismo
- Hashtags: 3-5 relevantes ao setor
- Horário ideal: dias úteis, horário comercial`,

  x: `X (Twitter):
- Textos curtos e impactantes (até 280 chars por tweet)
- Threads para conteúdo longo — cada tweet deve ter valor isolado, sem "continua..."
- Gancho no primeiro tweet é crucial para expansão da thread
- Sem hashtags excessivos — 1-2 no máximo
- Tom: direto, opinioso, confiante, sem rodeios`,
};

const TONE_DESCRIPTIONS: Record<string, string> = {
  formal: "profissional, técnico, vocabulário rico, sem gírias",
  conversational: "direto, como se estivesse falando com um amigo, usa linguagem do dia a dia",
  authority: "assertivo, confiante, baseado em dados e experiências concretas, sem rodeios",
  minimalist: "frases curtas, sem floreios, cada palavra tem peso, estilo editorial",
};

function buildImportedRefSection(ref: NonNullable<GenerationInput["importedRef"]>): string {
  const lines: string[] = [
    `## POST IMPORTADO COMO REFERÊNCIA`,
    `Plataforma: ${ref.platformLabel ?? ref.platform}`,
  ];
  if (ref.author) lines.push(`Criador: ${ref.author}`);
  if (ref.url) lines.push(`URL: ${ref.url}`);
  if (ref.title) lines.push(`\nTítulo: "${ref.title}"`);
  if (ref.description) {
    lines.push(`\nConteúdo original:\n"${ref.description}"`);
    lines.push(
      `\nAnalise em profundidade: tipo de gancho, ritmo entre parágrafos, ângulo escolhido para o tema, posição e estilo da CTA, tom emocional, comprimento dos blocos de texto. Recrie a mesma LÓGICA NARRATIVA com conteúdo completamente original e na voz da marca.`
    );
  } else {
    lines.push(
      `\nNão foi possível extrair o conteúdo completo deste URL. Use-o como referência estrutural e de estilo de acordo com o que for possível inferir da plataforma.`
    );
  }
  return lines.join("\n");
}

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

  const refsSection =
    brand.references && brand.references.length > 0
      ? brand.references
          .map((ref, i) => {
            const slideSummary = ref.slides
              .map((s) => `  Slide ${s.index + 1} — "${s.title}": ${s.body.slice(0, 120)}`)
              .join("\n");
            return `### Referência ${i + 1}: "${ref.title}" (${ref.format})\nEstrutura:\n${slideSummary}\nLegenda (trecho): ${ref.caption.slice(0, 200)}`;
          })
          .join("\n\n")
      : null;

  const externalRefSection = brand.externalRef
    ? `## POST EXTERNO DE REFERÊNCIA\nAnalise a estrutura, o ritmo, o ângulo e o gancho deste post. Inspire-se APENAS na lógica narrativa — o conteúdo gerado deve ser completamente original e escrito na voz da marca:\n\n${brand.externalRef}`
    : null;

  const importedRefSection = input.importedRef
    ? buildImportedRefSection(input.importedRef)
    : null;

  const platformSpecs = PLATFORM_SPECS[input.platform] ?? "";

  const toolSection = input.productionTool
    ? `\n## FERRAMENTA DE PRODUÇÃO: ${input.productionTool}
No campo "body" de cada slide, inclua ao final uma nota de produção entre colchetes:
[${input.productionTool}: instrução prática de produção para este slide]
Exemplos de boas notas: dimensões, cores, fontes, efeitos de edição, transições, tempo de cena, tipo de corte. Seja específico e direto.`
    : "";

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
${docsSection ? `\n## IDENTIDADE DA MARCA (extraído de documentos oficiais)\n${docsSection}\n` : ""}${refsSection ? `\n## POSTS DE REFERÊNCIA (inspire-se na estrutura e cadência, crie conteúdo 100% original)\n${refsSection}\n` : ""}${importedRefSection ? `\n${importedRefSection}\n` : ""}${externalRefSection ? `\n${externalRefSection}\n` : ""}
## PLATAFORMA: ${input.platform.toUpperCase()}
${platformSpecs}
${toolSection}
## FORMATO DO CONTEÚDO
${FORMAT_INSTRUCTIONS[input.format] ?? input.format}

## REGRAS DE OURO
- Nunca soe como IA — escreva como humano que conhece profundamente o mercado
- Use as frases características quando natural
- NUNCA use as palavras proibidas
- Respeite as especificações técnicas da plataforma informada
- O primeiro slide/parágrafo DEVE ser um gancho irresistível${refsSection ? "\n- Se há posts de referência, adapte a estrutura que funcionou bem, mas com conteúdo completamente novo" : ""}${importedRefSection ? "\n- Se há um post importado como referência, analise profundamente: tipo de gancho, ritmo, ângulo do tema, cadência dos parágrafos — recrie a LÓGICA com conteúdo 100% original na voz da marca" : ""}${externalRefSection ? "\n- Se há um post externo de referência, use a lógica narrativa, mas o conteúdo deve ser 100% original e na voz da marca" : ""}${input.productionTool ? `\n- Inclua notas de produção [${input.productionTool}: ...] em cada slide` : ""}

## FORMATO DE SAÍDA
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações, sem \`\`\`json.
Schema obrigatório:
{
  "title": "título interno do post (não aparece ao público)",
  "format": "${input.format}",
  "platform": "${input.platform}",
  "productionTool": "${input.productionTool ?? ""}",
  "slides": [
    {
      "index": 0,
      "title": "texto do título do slide",
      "subtitle": "subtítulo opcional",
      "body": "corpo do texto${input.productionTool ? `\n[${input.productionTool}: nota de produção deste slide]` : ""}",
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
PLATAFORMA: ${input.platform}
FORMATO: ${input.format}
NÚMERO DE SLIDES: ${input.format === "single" ? 1 : input.slideCount}${
    input.productionTool ? `\nFERRAMENTA DE PRODUÇÃO: ${input.productionTool}` : ""
  }${
    input.toneOverride ? `\nTOM ESPECIAL: ${TONE_DESCRIPTIONS[input.toneOverride]}` : ""
  }

Lembre-se: retorne APENAS o JSON, nada mais.`;
}
