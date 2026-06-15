/**
 * Skill: repurpose
 * Estágio "repurpose" da content factory — multiplica o output. Pega 1 peça
 * pronta e adapta para outros formatos/plataformas, preservando a ideia central
 * e a voz da marca, mas reescrevendo a estrutura para o que funciona em cada um.
 */

export interface RepurposeTarget {
  id: string;
  label: string;
  guide: string; // instrução de formato injetada no prompt
}

export const REPURPOSE_TARGETS: RepurposeTarget[] = [
  {
    id: "reel",
    label: "Roteiro de Reels",
    guide: "Roteiro de Reels (15-45s): GANCHO falado nos primeiros 3s + falas curtas por cena/corte (marque [cena]) + CTA no fim. Linguagem oral, direta.",
  },
  {
    id: "x_thread",
    label: "Thread no X",
    guide: "Thread no X/Twitter: 1º tweet = gancho que segura sozinho (até 280 chars). Cada tweet com valor isolado, sem 'continua...'. 4-7 tweets numerados. Último com CTA.",
  },
  {
    id: "stories",
    label: "Sequência de Stories",
    guide: "Stories sequenciais: 4-6 telas, 1 ideia por tela, máximo 2-3 linhas cada, linguagem direta. Última tela com CTA (enquete, link, 'arrasta pra cima').",
  },
  {
    id: "single",
    label: "Legenda de feed",
    guide: "Post único de feed: legenda completa. Gancho nas 2 primeiras linhas (antes do 'ver mais'), desenvolvimento com valor concreto, CTA contextual ao final.",
  },
  {
    id: "newsletter",
    label: "Trecho de newsletter",
    guide: "Trecho de newsletter: tom um pouco mais longo e pessoal, com título chamativo, 2-3 parágrafos que desenvolvem a ideia com mais profundidade e um fechamento que convida à resposta.",
  },
  {
    id: "linkedin",
    label: "Post de LinkedIn",
    guide: "Post de LinkedIn: tom profissional e orientado a insight. Primeira linha = gancho. Parágrafos curtos com espaçamento. Sem gírias. Fecha com pergunta ou aprendizado.",
  },
];

export function getRepurposeTargets(ids: string[]): RepurposeTarget[] {
  if (!ids.length) return REPURPOSE_TARGETS.slice(0, 4);
  return REPURPOSE_TARGETS.filter((t) => ids.includes(t.id));
}

export interface RepurposeVariant {
  id: string;
  label: string;
  content: string;
}

export function buildRepurposeSystem(brandCtx: string, targets: RepurposeTarget[]): string {
  const targetSpecs = targets
    .map((t) => `- ${t.id} ("${t.label}"): ${t.guide}`)
    .join("\n");

  return `Você é um especialista em reaproveitar conteúdo entre formatos e plataformas. Recebe uma peça original e a adapta para outros formatos — PRESERVANDO a ideia central e a voz da marca, mas REESCREVENDO a estrutura para o que performa em cada formato (não é copiar e colar).

REGRAS:
- Mantenha o insight/ângulo central da peça original em todas as versões.
- Adapte de verdade ao formato — ritmo, tamanho, gancho e CTA próprios de cada um.
- Respeite a voz da marca abaixo. Sem clichês de IA, sem promessa fácil, sem overclaiming.
- Conteúdo pronto para copiar e postar (não descreva o que faria — faça).
${brandCtx}

FORMATOS SOLICITADOS:
${targetSpecs}

Responda SOMENTE com JSON válido, sem markdown:
{
  "variants": [
    { "id": "<id do formato>", "content": "o conteúdo adaptado, pronto pra postar" }
  ]
}
Inclua um item por formato solicitado, na ordem dada.`;
}
