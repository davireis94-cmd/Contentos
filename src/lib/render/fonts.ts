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
 * Se alguma falhar, é omitida (o ImageResponse cai na fonte padrão).
 */
export async function getBrandFonts(): Promise<FontDef[]> {
  const [playfair700, inter400, inter600] = await Promise.all([
    loadGoogleFont("Playfair Display", 700),
    loadGoogleFont("Inter", 400),
    loadGoogleFont("Inter", 600),
  ]);

  const fonts: FontDef[] = [];
  if (playfair700) fonts.push({ name: "Playfair", data: playfair700, weight: 700, style: "normal" });
  if (inter400) fonts.push({ name: "Inter", data: inter400, weight: 400, style: "normal" });
  if (inter600) fonts.push({ name: "Inter", data: inter600, weight: 600, style: "normal" });
  return fonts;
}
