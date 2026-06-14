/**
 * Deriva a paleta visual dos slides a partir da identidade da marca (Brand Brain).
 * É isto que torna o carrossel ON-BRAND: em vez de cor fixa, cada marca renderiza
 * com a SUA cor primária + variações derivadas dela.
 */
export interface BrandTokens {
  primary: string;
  light: string;
  dark: string;
  darkBg: string;
  lightBg: string;
  lightBorder: string;
  gradient: string;
  handle: string | null;
}

// Paleta padrão (fallback) — vinho/creme.
export const DEFAULT_TOKENS: BrandTokens = {
  primary: "#6B1A2A",
  light: "#9B3A4A",
  dark: "#3D0F18",
  darkBg: "#180E0C",
  lightBg: "#FAF7F2",
  lightBorder: "#EDE8E0",
  gradient: "linear-gradient(165deg,#3D0F18 0%,#6B1A2A 50%,#9B3A4A 100%)",
  handle: null,
};

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}
/** Mistura uma cor com alvo (preto p/ escurecer, branco p/ clarear). amount 0..1 */
function mix(rgb: [number, number, number], target: [number, number, number], amount: number): string {
  const [r, g, b] = rgb;
  const [tr, tg, tb] = target;
  return rgbToHex(r + (tr - r) * amount, g + (tg - g) * amount, b + (tb - b) * amount);
}

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];

/**
 * Gera os tokens a partir das cores da identidade. Usa a primeira cor (ou a com
 * role "primary") como base e deriva variações. Cai no padrão se não houver cor.
 */
export function deriveBrandTokens(
  colors?: { hex: string; role?: string }[] | null,
  handle?: string | null
): BrandTokens {
  const cleanHandle = handle ? `@${handle.replace(/^@/, "").trim()}` : null;

  if (!colors || colors.length === 0) {
    return { ...DEFAULT_TOKENS, handle: cleanHandle };
  }

  // Escolhe a cor base: role "primary" se houver, senão a primeira válida.
  const primaryEntry =
    colors.find((c) => c.role?.toLowerCase() === "primary" && hexToRgb(c.hex)) ??
    colors.find((c) => hexToRgb(c.hex));
  const baseRgb = primaryEntry ? hexToRgb(primaryEntry.hex) : null;
  if (!baseRgb) return { ...DEFAULT_TOKENS, handle: cleanHandle };

  const primary = rgbToHex(...baseRgb);
  // Cor de destaque do gradiente: 2ª cor da paleta, se existir e for válida.
  const accentEntry = colors.find((c) => c.hex !== primaryEntry?.hex && hexToRgb(c.hex));
  const accentRgb = accentEntry ? hexToRgb(accentEntry.hex) : null;

  const dark = mix(baseRgb, BLACK, 0.45);
  const light = accentRgb ? rgbToHex(...accentRgb) : mix(baseRgb, WHITE, 0.28);
  const darkBg = mix(baseRgb, BLACK, 0.82); // quase preto com leve tom da marca
  const lightBg = mix(baseRgb, WHITE, 0.94); // quase branco com leve tom
  const lightBorder = mix(baseRgb, WHITE, 0.86);
  const gradient = `linear-gradient(165deg,${dark} 0%,${primary} 50%,${light} 100%)`;

  return { primary, light, dark, darkBg, lightBg, lightBorder, gradient, handle: cleanHandle };
}
