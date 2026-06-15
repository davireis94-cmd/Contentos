/**
 * Carrega fontes (TTF) para o Satori / next-og ImageResponse.
 *
 * Truque do User-Agent antigo: o Google Fonts serve TTF (em vez de WOFF2)
 * para navegadores legados — Satori precisa de TTF/OTF/WOFF, não WOFF2.
 *
 * Memoizado por cold start para não rebaixar a chave a cada render.
 */

const LEGACY_UA =
  "Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.93 Safari/537.36";

const cache = new Map<string, ArrayBuffer>();

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family
    )}:wght@${weight}`;
    const css = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_UA } }).then((r) =>
      r.text()
    );
    const match = css.match(/src:\s*url\((.+?)\)\s*format\('(?:truetype|opentype)'\)/);
    if (!match) return null;

    const buf = await fetch(match[1]).then((r) => r.arrayBuffer());
    cache.set(key, buf);
    return buf;
  } catch {
    return null;
  }
}

export interface FontDef {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700;
  style: "normal";
}

/**
 * Retorna as fontes da marca para o ImageResponse.
 *
 * Truque: a fonte de TÍTULO escolhida pela marca é registrada com o nome
 * interno "Playfair", e a de CORPO com "Inter" — assim os estilos do render
 * (fontFamily: "Playfair" / "Inter") já a adotam SEM precisar editar cada slide.
 * Aceita qualquer Google Font pelo nome; cai no padrão se falhar.
 */
export async function getBrandFonts(
  headingFamily?: string | null,
  bodyFamily?: string | null
): Promise<FontDef[]> {
  const heading = headingFamily?.trim() || "Playfair Display";
  const body = bodyFamily?.trim() || "Inter";

  // Tenta a fonte da marca; se falhar, cai no padrão (mesmo nome interno).
  const loadWithFallback = async (family: string, fallback: string, weight: number) =>
    (await loadGoogleFont(family, weight)) ?? (await loadGoogleFont(fallback, weight));

  const [head700, body400, body600, anton] = await Promise.all([
    loadWithFallback(heading, "Playfair Display", 700),
    loadWithFallback(body, "Inter", 400),
    loadWithFallback(body, "Inter", 600),
    // Fonte display do layout "editorial" — condensada e pesada (estilo capa).
    loadGoogleFont("Anton", 400),
  ]);

  const fonts: FontDef[] = [];
  if (head700) fonts.push({ name: "Playfair", data: head700, weight: 700, style: "normal" });
  if (body400) fonts.push({ name: "Inter", data: body400, weight: 400, style: "normal" });
  if (body600) fonts.push({ name: "Inter", data: body600, weight: 600, style: "normal" });
  if (anton) fonts.push({ name: "Anton", data: anton, weight: 400, style: "normal" });
  return fonts;
}
