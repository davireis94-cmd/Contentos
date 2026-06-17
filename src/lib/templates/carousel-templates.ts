import type { Slide } from "@/lib/validations/generation";
import type { FontKey } from "@/lib/render/carousel-themes";
import { setFontToken } from "@/lib/render/carousel-themes";

export interface CarouselTemplate {
  id: string;
  title: string;
  description: string;
  slideCount: number;
  badge?: string;
  defaultFont: FontKey;
  /** Gera os slides com o tópico fornecido (fonte já aplicada) */
  build(topic: string): Slide[];
}

function withFont(slides: Slide[], font: FontKey): Slide[] {
  return slides.map((s) => ({ ...s, body: setFontToken(s.body ?? "", font) }));
}

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  // ─── @laschuk — Editorial Claro ───────────────────────────────────────────
  {
    id: "editorial-light",
    title: "Editorial Claro",
    description: "Creme + serif. Capa impactante, conteúdo em claro e escuro alternados, CTA em gradiente.",

    slideCount: 7,
    badge: "Popular",
    defaultFont: "serif" as FontKey,
    build(topic) {
      return withFont([
        {
          index: 0,
          title: `*${topic.toUpperCase()}*`,
          subtitle: "Algo que você precisa saber",
          body: "O problema que a maioria ignora — e como isso muda tudo.\n[Layout: editorial]",
        },
        {
          index: 1,
          title: "O problema que ninguém fala",
          subtitle: "CONTEXTO",
          body: "Escreva aqui 2-3 linhas sobre o cenário atual do tema.\n[Layout: dark]",
        },
        {
          index: 2,
          title: "Por que isso acontece",
          subtitle: "A CAUSA",
          body: "Explique a raiz do problema em 2-3 linhas diretas.\n[Layout: light]",
        },
        {
          index: 3,
          title: "O que a maioria faz errado",
          subtitle: "O ERRO",
          body: "Descreva o comportamento comum que perpetua o problema.\n[Layout: dark]",
        },
        {
          index: 4,
          title: "A virada que muda o jogo",
          subtitle: "O INSIGHT",
          body: "O ponto de virada — o que você descobriu ou aprendeu na prática.\n[Layout: light]",
        },
        {
          index: 5,
          title: "Como aplicar agora",
          subtitle: "A SOLUÇÃO",
          body: "3 passos práticos ou a ação imediata que o leitor pode tomar.\n[Layout: dark]",
        },
        {
          index: 6,
          title: "Salva esse post pra não perder",
          subtitle: "",
          body: "Se isso fez sentido pra você, compartilha com quem precisa ver.\n[Layout: gradient]",
          cta: "Seguir para mais",
        },
      ], this.defaultFont);
    },
  },

  // ─── @laschuk — Editorial Escuro ──────────────────────────────────────────
  {
    id: "editorial-dark",
    title: "Editorial Escuro",
    description: "Grafite + serif. Autoridade e profundidade. Todos os slides em escuro.",

    slideCount: 7,
    defaultFont: "serif" as FontKey,
    build(topic) {
      return withFont([
        {
          index: 0,
          title: `*${topic.toUpperCase()}*`,
          subtitle: "O que ninguém te contou",
          body: "Gancho que força o swipe.\n[Layout: editorial]",
        },
        {
          index: 1,
          title: "O cenário real",
          subtitle: "SITUAÇÃO",
          body: "Descreva o contexto em 2-3 linhas. Seja específico.\n[Layout: dark]\n[Theme: editorial-dark]",
        },
        {
          index: 2,
          title: "A crença que paralisa",
          subtitle: "O MITO",
          body: "Qual a ideia errada que o público carrega sobre esse tema?\n[Layout: dark]\n[Theme: editorial-dark]",
        },
        {
          index: 3,
          title: "O que os dados mostram",
          subtitle: "A REALIDADE",
          body: "Um dado ou observação concreta que quebra o mito.\n[Layout: dark]\n[Theme: editorial-dark]",
        },
        {
          index: 4,
          title: "A mudança de perspectiva",
          subtitle: "O SHIFT",
          body: "Como enxergar diferente — o insight central do carrossel.\n[Layout: dark]\n[Theme: editorial-dark]",
        },
        {
          index: 5,
          title: "O que fazer a partir de agora",
          subtitle: "PRÓXIMO PASSO",
          body: "Ação concreta e imediata. Sem rodeios.\n[Layout: dark]\n[Theme: editorial-dark]",
        },
        {
          index: 6,
          title: "Me conta nos comentários",
          subtitle: "",
          body: "Qual parte ressoou mais com você?\n[Layout: gradient]",
          cta: "Comentar",
        },
      ], this.defaultFont);
    },
  },

  // ─── @asteriskcreate — Bold Sans ──────────────────────────────────────────
  {
    id: "bold-sans",
    title: "Bold Sans",
    description: "Preto + condensado. Títulos enormes, impacto visual máximo, estilo @asterisk.",
    slideCount: 6,
    badge: "Alto impacto",
    defaultFont: "condensed" as FontKey,
    build(topic) {
      return withFont([
        {
          index: 0,
          title: `*${topic.toUpperCase()}*`,
          subtitle: "Uma verdade que incomoda",
          body: "O gancho em 1 linha.\n[Layout: editorial]",
        },
        {
          index: 1,
          title: "A maioria não percebe",
          subtitle: "PROBLEMA",
          body: "2 linhas máximo. Seja direto e agressivo.\n[Layout: dark]\n[Theme: bold-sans]",
        },
        {
          index: 2,
          title: "Isso muda tudo",
          subtitle: "VIRADA",
          body: "O ponto de inflexão em 2 linhas.\n[Layout: dark]\n[Theme: bold-sans]",
        },
        {
          index: 3,
          title: "Como funciona na prática",
          subtitle: "COMO",
          body: "Processo simples, 2-3 linhas diretas.\n[Layout: dark]\n[Theme: bold-sans]",
        },
        {
          index: 4,
          title: "O resultado concreto",
          subtitle: "RESULTADO",
          body: "O que muda quando você aplica isso.\n[Layout: dark]\n[Theme: bold-sans]",
        },
        {
          index: 5,
          title: "Salva e compartilha",
          subtitle: "",
          body: "Se isso abriu sua cabeça, imagina o que vem por aí.\n[Layout: gradient]",
          cta: "Seguir",
        },
      ], this.defaultFont);
    },
  },

  // ─── @brandsdecoded — Revista ─────────────────────────────────────────────
  {
    id: "revista",
    title: "Revista",
    description: "Branco + uppercase. Elegante, editorial de moda/negócios. Estilo @brandsdecoded.",
    slideCount: 8,
    defaultFont: "sans" as FontKey,
    build(topic) {
      return withFont([
        {
          index: 0,
          title: `*${topic.toUpperCase()}*: O QUE NINGUÉM TE CONTOU`,
          subtitle: "E como isso muda tudo",
          body: "\n[Layout: editorial]",
        },
        {
          index: 1,
          title: "O padrão que todo mundo segue",
          subtitle: "O PROBLEMA",
          body: "Descreva o comportamento padrão que leva ao problema.\n[Layout: light]\n[Theme: revista]",
        },
        {
          index: 2,
          title: "Por que esse padrão existe",
          subtitle: "A ORIGEM",
          body: "Contexto histórico ou explicação simples da causa.\n[Layout: light]\n[Theme: revista]",
        },
        {
          index: 3,
          title: "O que as marcas que funcionam fazem diferente",
          subtitle: "O CONTRASTE",
          body: "Mostre o comportamento alternativo com 1-2 exemplos.\n[Layout: light]\n[Theme: revista]",
        },
        {
          index: 4,
          title: "O princípio por trás",
          subtitle: "O INSIGHT",
          body: "A lógica central — o motivo pelo qual funciona.\n[Layout: light]\n[Theme: revista]",
        },
        {
          index: 5,
          title: "Como aplicar no seu caso",
          subtitle: "APLICAÇÃO",
          body: "Passos práticos adaptados ao contexto do leitor.\n[Layout: light]\n[Theme: revista]",
        },
        {
          index: 6,
          title: "O que muda quando você aplica",
          subtitle: "RESULTADO",
          body: "O antes e depois em 2 linhas.\n[Layout: light]\n[Theme: revista]",
        },
        {
          index: 7,
          title: "Salva esse carrossel",
          subtitle: "",
          body: "Para consultar quando precisar.\n[Layout: gradient]",
          cta: "Seguir para mais",
        },
      ], this.defaultFont);
    },
  },

  // ─── Estilo Davi Moxoto — escuro + elementos ricos ───────────────────────
  {
    id: "davi-moxoto",
    title: "Escuro com Elementos",
    description: "Dark sólido com chips, citações e negrito inline. Autoridade + profundidade visual.",
    slideCount: 7,
    badge: "Seu estilo",
    defaultFont: "serif" as FontKey,
    build(topic) {
      return withFont([
        {
          index: 0,
          title: `*${topic.toUpperCase()}*`,
          subtitle: "O que ninguém fala sobre isso",
          body: "Gancho que força o swipe. Uma linha que gera curiosidade.\n[Layout: editorial]",
        },
        {
          index: 1,
          title: "O cenário real",
          subtitle: "CONTEXTO",
          body: "Descreva a situação em 2 linhas diretas. **Seja específico aqui.**\n[chips: ponto 1 | ponto 2 | ponto 3]\n[Layout: dark]",
        },
        {
          index: 2,
          title: "O que a maioria não percebe",
          subtitle: "O PROBLEMA",
          body: "Explique o erro comum em 2 linhas.\n[quote: Insight central | Escreva aqui a frase de impacto do slide]\n[Layout: dark]",
        },
        {
          index: 3,
          title: "A virada",
          subtitle: "O SHIFT",
          body: "O que muda quando você enxerga diferente. **Isso é o que separa quem avança de quem fica parado.**\n[Layout: dark-photo]",
        },
        {
          index: 4,
          title: "Como aplicar na prática",
          subtitle: "A SOLUÇÃO",
          body: "Ação concreta e direta.\n[chips: passo 1 | passo 2 | passo 3]\n[quote: Na prática | Descreva aqui o resultado real de quem aplica]\n[Layout: dark]",
        },
        {
          index: 5,
          title: "O resultado quando você faz isso",
          subtitle: "RESULTADO",
          body: "2 linhas sobre a transformação. **Não é teoria — é o que acontece na prática.**\n[Layout: dark]",
        },
        {
          index: 6,
          title: "Salva esse post",
          subtitle: "",
          body: "Vai precisar disso mais de uma vez.\n[Layout: gradient]",
          cta: "Seguir para mais",
        },
      ], this.defaultFont);
    },
  },

  // ─── Estilo Instagram (cases + avatar na capa/CTA) ────────────────────────
  {
    id: "instagram-cases",
    title: "Instagram (Cases)",
    description: "Capa com sua foto, cases alternando claro/escuro com fonte, e CTA com avatar. Igual aos posts do @davimoxoto.",
    slideCount: 7,
    badge: "Com avatar",
    defaultFont: "serif" as FontKey,
    build(topic) {
      return withFont([
        {
          index: 0,
          title: `Enquanto você debate, *${topic.toUpperCase()}* já virou número`,
          subtitle: "O recorte que importa",
          body: "O gancho que força o swipe — uma linha de tensão.\n[Layout: editorial]",
        },
        {
          index: 1,
          title: "O caso que prova o ponto",
          subtitle: "CASE 01",
          body: "Conte um exemplo concreto com **um número que impressiona**. Quem fez, o que mudou.\n[quote: Resultado | Escreva aqui o dado de impacto]\n[Layout: dark]",
        },
        {
          index: 2,
          title: "Não foi sorte — foi método",
          subtitle: "CASE 02",
          body: "Segundo exemplo, reforçando o padrão. Seja específico no antes/depois.\n[Layout: light]",
        },
        {
          index: 3,
          title: "E no pequeno negócio?",
          subtitle: "NA PRÁTICA",
          body: "Mostre que funciona em qualquer escala.\n[chips: caso 1 | caso 2 | caso 3]\n[Layout: dark]",
        },
        {
          index: 4,
          title: "O padrão por trás de todos",
          subtitle: "O INSIGHT",
          body: "A lógica comum que conecta os casos — o aprendizado central.\n[Layout: light]",
        },
        {
          index: 5,
          title: "Como dar o primeiro passo",
          subtitle: "A AÇÃO",
          body: "O passo imediato e concreto pro leitor aplicar hoje. **Sem teoria.**\n[Layout: dark]",
        },
        {
          index: 6,
          title: "Qual a tarefa mais cara do seu negócio hoje?",
          subtitle: "SUA VEZ",
          body: "Não a mais glamourosa. A que mais rouba tempo. Me conta nos comentários.\n[Layout: gradient]",
          cta: "Seguir para mais",
        },
      ], this.defaultFont);
    },
  },

  // ─── Carrossel com imagem (card-top) ──────────────────────────────────────
  {
    id: "image-cards",
    title: "Carrossel com Fotos",
    description: "Slides com imagem no topo + texto curto embaixo. Ideal para tutoriais visuais.",
    slideCount: 6,
    defaultFont: "serif" as FontKey,
    build(topic) {
      return withFont([
        {
          index: 0,
          title: `*${topic.toUpperCase()}*`,
          subtitle: "Guia visual",
          body: "O que você vai aprender nesse carrossel.\n[Layout: editorial]",
        },
        {
          index: 1,
          title: "Passo 1",
          subtitle: "COMEÇANDO",
          body: "Descrição do primeiro passo em 1-2 linhas.\n[Layout: light]\n[Image: card-top]",
        },
        {
          index: 2,
          title: "Passo 2",
          subtitle: "AVANÇANDO",
          body: "O que fazer em seguida.\n[Layout: light]\n[Image: card-top]",
        },
        {
          index: 3,
          title: "Passo 3",
          subtitle: "APLICANDO",
          body: "A etapa de aplicação prática.\n[Layout: light]\n[Image: card-top]",
        },
        {
          index: 4,
          title: "O resultado esperado",
          subtitle: "RESULTADO",
          body: "O que acontece quando você executa os 3 passos.\n[Layout: light]\n[Image: card-top]",
        },
        {
          index: 5,
          title: "Testa e me conta",
          subtitle: "",
          body: "Qual passo foi mais útil pra você?\n[Layout: gradient]",
          cta: "Comentar",
        },
      ], this.defaultFont);
    },
  },
];
