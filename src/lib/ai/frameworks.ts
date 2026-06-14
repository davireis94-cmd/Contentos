/**
 * Biblioteca de frameworks de copy comprovados. O usuário escolhe um e a IA
 * estrutura o conteúdo nesse formato, mantendo a voz da marca.
 * Inspirado no "My Prompts" do Blotato — frameworks virais aplicados ao tema.
 */
export interface Framework {
  id: string;
  label: string;
  emoji: string;
  description: string; // o que aparece para o usuário
  prompt: string; // instrução estrutural injetada no prompt da IA
}

export const FRAMEWORKS: Framework[] = [
  {
    id: "lessons",
    label: "Lições aprendidas",
    emoji: "🎓",
    description: "“X lições que aprendi sobre…” — autoridade por experiência",
    prompt: `FRAMEWORK: LIÇÕES APRENDIDAS.
- Hook: declare o número de lições + o contexto duro que as ensinou ("X lições que aprendi [depois de / errando / construindo]…").
- Cada slide/bloco = UMA lição numerada, com uma frase de impacto + 1-2 linhas explicando por que importa na prática.
- As lições devem ser específicas e contra-intuitivas, não óbvias.
- Fechamento: a lição que mais doeu ou a que mais mudou tudo + CTA.`,
  },
  {
    id: "pas",
    label: "PAS",
    emoji: "🎯",
    description: "Problema → Agitação → Solução — clássico de conversão",
    prompt: `FRAMEWORK: PAS (Problema → Agitação → Solução).
- PROBLEMA (slides iniciais): nomeie a dor real do público com precisão — que ela se reconheça ("é exatamente isso que eu sinto").
- AGITAÇÃO (meio): mostre o custo de não resolver — o que se perde, o que piora, o que o público tenta e falha.
- SOLUÇÃO (final): apresente o caminho/oferta de forma concreta + CTA claro.
- Tom: empático no problema, firme na solução.`,
  },
  {
    id: "mistakes",
    label: "Erros comuns",
    emoji: "⚠️",
    description: "“X erros que te impedem de…” — alto salvamento",
    prompt: `FRAMEWORK: ERROS COMUNS.
- Hook: "X erros que [impedem / sabotam / custam caro]…" com a consequência concreta.
- Cada slide/bloco = UM erro + por que ele acontece + o que fazer no lugar (correção prática).
- Os erros devem ser específicos do nicho, não genéricos.
- Fechamento: o erro mais grave de todos + CTA ("salva pra não esquecer").`,
  },
  {
    id: "before_after",
    label: "Antes / Depois",
    emoji: "🔄",
    description: "Transformação concreta — prova e desejo",
    prompt: `FRAMEWORK: ANTES / DEPOIS.
- Hook: prometa a transformação de forma vívida e específica.
- ANTES: descreva o estado atual doloroso com detalhes reais (rotina, sentimento, resultado ruim).
- A VIRADA: o que mudou — o insight, decisão ou método que separou os dois mundos.
- DEPOIS: o novo estado concreto, com contraste claro em relação ao antes.
- CTA: convide o público a dar o primeiro passo da mesma transformação.`,
  },
  {
    id: "story",
    label: "História pessoal",
    emoji: "📖",
    description: "Narrativa com lição — conexão emocional",
    prompt: `FRAMEWORK: HISTÓRIA PESSOAL.
- Hook: comece no meio da tensão (um momento específico, uma cena, uma frase dita).
- Desenvolva a narrativa em ordem: situação → conflito/erro → virada → o que aprendeu.
- Use detalhes concretos e sensoriais — nada de resumo genérico.
- A lição emerge da história, não é colada no fim de forma artificial.
- CTA: conecte a lição à vida do público + pergunta que gera resposta.`,
  },
  {
    id: "offer",
    label: "Oferta (Hormozi)",
    emoji: "💰",
    description: "Valor irresistível — estilo Alex Hormozi",
    prompt: `FRAMEWORK: OFERTA DE VALOR (estilo Hormozi).
- Hook: prometa um resultado específico e desejável, ancorado em tempo ou esforço reduzido.
- Empilhe VALOR: mostre o que a pessoa ganha, quebre objeções uma a uma, reduza o risco percebido.
- Use especificidade numérica plausível e prova quando possível.
- Crie urgência ou escassez real (sem manipulação barata).
- CTA direto e único: a próxima ação concreta para obter a oferta.`,
  },
  {
    id: "myth_truth",
    label: "Mito vs Verdade",
    emoji: "🔥",
    description: "Quebra de crença — gera debate e autoridade",
    prompt: `FRAMEWORK: MITO vs VERDADE.
- Hook: enuncie a crença comum que você vai derrubar ("Todo mundo acha que… mas").
- Cada bloco: apresente um mito + por que ele é falso/incompleto + a verdade que poucos dizem.
- Assuma uma posição clara e opinativa — sem ficar em cima do muro.
- Fundamente com lógica ou experiência real, não só opinião solta.
- CTA: provoque o público a repensar + comentar se concorda.`,
  },
  {
    id: "how_to",
    label: "Passo a passo",
    emoji: "📋",
    description: "Tutorial acionável — “como fazer X”",
    prompt: `FRAMEWORK: PASSO A PASSO.
- Hook: prometa o resultado final concreto que o passo a passo entrega.
- Cada slide/bloco = UM passo numerado, na ordem real de execução, acionável de imediato.
- Inclua o "como" prático em cada passo, não só o "o quê".
- Antecipe o erro mais comum de cada etapa quando relevante.
- Fechamento: o resultado montado + CTA ("salva e executa hoje").`,
  },
];

export function getFramework(id: string | undefined | null): Framework | null {
  if (!id) return null;
  return FRAMEWORKS.find((f) => f.id === id) ?? null;
}

/** Seção de framework para injetar no prompt da geração. */
export function renderFrameworkForPrompt(id: string | undefined | null): string {
  const fw = getFramework(id);
  if (!fw) return "";
  return `## FRAMEWORK ESCOLHIDO (siga esta estrutura à risca)\n${fw.prompt}`;
}
