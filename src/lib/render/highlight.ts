/**
 * Destaque de palavra-chave no título (estilo capa de revista / makemusicnow).
 * Convenção: o usuário (ou a IA) envolve a palavra a destacar em *asteriscos*.
 * Ex: "POR QUE NÃO TEMOS *HITS* EM 2025?" → "HITS" sai na cor da marca + sublinhado.
 *
 * Usado tanto no preview (carousel-studio) quanto no render PNG (api/render/slide),
 * por isso vive num módulo neutro sem dependência de React.
 */
export interface TitleSegment {
  text: string;
  hl: boolean; // true = palavra destacada
}

/**
 * Quebra o título em segmentos por PALAVRA, marcando quais estão destacadas.
 * Quebrar por palavra (e não só por trecho *...*) permite que o render use
 * flex-wrap, com o sublinhado caindo só sob a palavra certa.
 */
export function parseTitleHighlight(title: string): TitleSegment[] {
  const raw = title ?? "";
  const segments: TitleSegment[] = [];
  // Divide preservando os marcadores *...*; depois separa cada trecho em palavras.
  const parts = raw.split(/(\*[^*]+\*)/g).filter((p) => p !== "");
  for (const part of parts) {
    const hl = part.startsWith("*") && part.endsWith("*") && part.length > 2;
    const clean = hl ? part.slice(1, -1) : part;
    const words = clean.split(/(\s+)/).filter((w) => w !== "");
    for (const w of words) {
      if (/^\s+$/.test(w)) continue; // espaços viram gap no flex
      segments.push({ text: w, hl });
    }
  }
  return segments.length ? segments : [{ text: raw, hl: false }];
}

/** Remove os marcadores de destaque (para usos sem realce: cópia, alt, etc.). */
export function stripHighlightMarks(title: string): string {
  return (title ?? "").replace(/\*([^*]+)\*/g, "$1");
}
