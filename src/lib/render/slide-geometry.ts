/**
 * FONTE ÚNICA de geometria do slide (sem React).
 *
 * Por que existe: antes, cada layout era código React DUPLICADO no preview
 * (carousel-studio) e no render PNG (api/render/slide), então o preview "mentia"
 * — não batia com o PNG final. Aqui centralizamos os NÚMEROS (margens, retângulo
 * da imagem, tamanhos de fonte) como FRAÇÕES do slide. O preview renderiza numa
 * base pequena (ex.: 216×270) e o PNG em 1080×1350; como tudo é fração, os dois
 * batem por construção. É também o que faz Reels/TikTok/X (outros tamanhos)
 * reaproveitarem a mesma geometria depois.
 *
 * O "modo de imagem" é independente do "layout" de texto e mora num token
 * [Image: x] no corpo do slide (igual a [Layout: x]) — assim não exige migração
 * de banco. cleanBody() já remove qualquer [Chave: valor].
 */

export type ImageMode = "bg" | "card-top" | "framed" | "half" | "none";

const IMAGE_MODES: ImageMode[] = ["bg", "card-top", "framed", "half", "none"];

/** Lê o modo de imagem do corpo. Sem token → "none" (chamador decide legado). */
export function getImageMode(body: string | null | undefined): ImageMode {
  const m = (body ?? "").match(/\[Image:\s*([a-z-]+)\]/i);
  const v = m?.[1]?.toLowerCase();
  return (IMAGE_MODES as string[]).includes(v ?? "") ? (v as ImageMode) : "none";
}

/**
 * Modo EFETIVO considerando legado: slides antigos têm imageUrl mas nenhum token
 * [Image:] → tratamos como "bg" (comportamento histórico de fundo inteiro).
 * Sem imagem, qualquer modo cai em "none".
 */
export function effectiveImageMode(body: string | null | undefined, hasImage: boolean): ImageMode {
  if (!hasImage) return "none";
  const m = getImageMode(body);
  return m === "none" ? "bg" : m;
}

/** Troca/insere o token [Image: x] no corpo, preservando o resto do texto. */
export function setImageModeToken(body: string, mode: ImageMode): string {
  const cleaned = (body ?? "").replace(/\n?\[Image:\s*[a-z-]+\]/gi, "").trimEnd();
  if (mode === "none") return cleaned;
  return `${cleaned}\n[Image: ${mode}]`;
}

export const IMAGE_MODE_LABELS: Record<ImageMode, string> = {
  "bg": "Fundo inteiro",
  "card-top": "Card no topo",
  "framed": "Card emoldurado",
  "half": "Meia-página",
  "none": "Sem imagem",
};

// ── Geometria por modo ───────────────────────────────────────────────────────
//
// Tudo em FRAÇÃO do W/H do slide. computeImageLayout() devolve px concretos para
// o tamanho pedido (216 no preview, 1080 no PNG). Os campos opcionais de imagem
// só vêm preenchidos nos modos que usam imagem contida.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  border: number; // largura da moldura (0 = sem moldura)
}

export interface ImageLayout {
  mode: ImageMode;
  /** Retângulo da imagem (modos card-top/framed/half). Ausente em bg/none. */
  image?: Rect;
  /** Caixa de texto: onde o bloco de título/corpo começa e seus limites. */
  text: { x: number; y: number; w: number; bottom: number; align: "left" | "center" };
  /** Tamanhos de fonte já em px para este W. */
  font: { title: number; sub: number; body: number };
  /** Padding lateral padrão (px) — útil para móveis (rodapé, contador). */
  pad: number;
  /** true se o texto fica sobre área escura (cor de texto clara). */
  darkText: boolean;
}

/**
 * Calcula a geometria concreta de um slide COM imagem contida.
 * Para mode "bg"/"none" o chamador segue o layout de texto normal; esta função
 * cobre card-top, framed e half (os modos novos).
 */
export function computeImageLayout(mode: ImageMode, W: number, H: number): ImageLayout {
  const pad = Math.round(0.083 * W);
  const footer = Math.round(0.13 * H); // espaço reservado p/ barra de progresso/rodapé

  if (mode === "card-top") {
    const cardTop = Math.round(0.06 * H);
    const cardH = Math.round(0.46 * H);
    const card: Rect = {
      x: pad,
      y: cardTop,
      w: W - 2 * pad,
      h: cardH,
      radius: Math.round(0.028 * W),
      border: 0,
    };
    return {
      mode,
      image: card,
      text: {
        x: pad,
        y: card.y + card.h + Math.round(0.04 * H),
        w: W - 2 * pad,
        bottom: H - footer,
        align: "left",
      },
      font: { title: Math.round(0.072 * W), sub: Math.round(0.028 * W), body: Math.round(0.036 * W) },
      pad,
      darkText: false, // card-top usa fundo claro por padrão
    };
  }

  if (mode === "framed") {
    const side = Math.round(0.13 * W);
    const cardTop = Math.round(0.085 * H);
    const cardH = Math.round(0.40 * H);
    const card: Rect = {
      x: side,
      y: cardTop,
      w: W - 2 * side,
      h: cardH,
      radius: Math.round(0.018 * W),
      border: Math.max(1, Math.round(0.006 * W)),
    };
    return {
      mode,
      image: card,
      text: {
        x: pad,
        y: card.y + card.h + Math.round(0.05 * H),
        w: W - 2 * pad,
        bottom: H - footer,
        align: "center",
      },
      font: { title: Math.round(0.068 * W), sub: Math.round(0.027 * W), body: Math.round(0.034 * W) },
      pad,
      darkText: false,
    };
  }

  // half — imagem ocupa metade esquerda (altura cheia), texto na metade direita.
  const halfW = Math.round(0.5 * W);
  const innerPad = Math.round(0.055 * W);
  const card: Rect = { x: 0, y: 0, w: halfW, h: H, radius: 0, border: 0 };
  return {
    mode: "half",
    image: card,
    text: {
      x: halfW + innerPad,
      y: Math.round(0.16 * H),
      w: W - halfW - innerPad - pad,
      bottom: H - footer,
      align: "left",
    },
    font: { title: Math.round(0.058 * W), sub: Math.round(0.024 * W), body: Math.round(0.03 * W) },
    pad,
    darkText: false,
  };
}
