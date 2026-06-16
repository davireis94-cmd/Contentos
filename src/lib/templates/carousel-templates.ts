import type { Slide } from "@/lib/validations/generation";

export interface CarouselTemplate {
  id: string;
  title: string;
  description: string;
  reference: string; // @conta
  slideCount: number;
  badge?: string;
  /** Gera os slides com o tópico fornecido */
  build(topic: string): Slide[];
}

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  // ─── @laschuk — Editorial Claro ───────────────────────────────────────────
  {
    id: "editorial-light",
    title: "Editorial Claro",
    description: "Creme + serif. Capa impactante, conteúdo em claro e escuro alternados, CTA em gradiente.",
    reference: "@laschuk",
    slideCount: 7,
    badge: "Popular",
    build(topic) {
      return [
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
      ];
    },
  },

  // ─── @laschuk — Editorial Escuro ──────────────────────────────────────────
  {
    id: "editorial-dark",
    title: "Editorial Escuro",
    description: "Grafite + serif. Autoridade e profundidade. Todos os slides em escuro.",
    reference: "@laschuk",
    slideCount: 7,
    build(topic) {
      return [
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
      ];
    },
  },

  // ─── @asteriskcreate — Bold Sans ──────────────────────────────────────────
  {
    id: "bold-sans",
    title: "Bold Sans",
    description: "Preto + condensado. Títulos enormes, impacto visual máximo, estilo @asterisk.",
    reference: "@asteriskcreate",
    slideCount: 6,
    badge: "Alto impacto",
    build(topic) {
      return [
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
      ];
    },
  },

  // ─── @brandsdecoded — Revista ─────────────────────────────────────────────
  {
    id: "revista",
    title: "Revista",
    description: "Branco + uppercase. Elegante, editorial de moda/negócios. Estilo @brandsdecoded.",
    reference: "@brandsdecoded",
    slideCount: 8,
    build(topic) {
      return [
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
      ];
    },
  },

  // ─── Carrossel com imagem (card-top) ──────────────────────────────────────
  {
    id: "image-cards",
    title: "Carrossel com Fotos",
    description: "Slides com imagem no topo + texto curto embaixo. Ideal para tutoriais visuais.",
    reference: "Estilo universal",
    slideCount: 6,
    build(topic) {
      return [
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
      ];
    },
  },
];
