export type ThemeId = "editorial-light" | "editorial-dark" | "bold-sans" | "revista";

export interface CarouselTheme {
  id: ThemeId;
  label: string;
  desc: string;
  coverLayout: string;
  contentLayout: string;
  ctaLayout: string;
  isDark: boolean;
}

export const CAROUSEL_THEMES: CarouselTheme[] = [
  {
    id: "editorial-light",
    label: "Editorial Claro",
    desc: "Creme · serif · @laschuk",
    coverLayout: "editorial",
    contentLayout: "light",
    ctaLayout: "gradient",
    isDark: false,
  },
  {
    id: "editorial-dark",
    label: "Editorial Escuro",
    desc: "Grafite · serif · @laschuk",
    coverLayout: "editorial",
    contentLayout: "dark",
    ctaLayout: "gradient",
    isDark: true,
  },
  {
    id: "bold-sans",
    label: "Bold Sans",
    desc: "Preto · condensado · @asterisk",
    coverLayout: "editorial",
    contentLayout: "dark",
    ctaLayout: "gradient",
    isDark: true,
  },
  {
    id: "revista",
    label: "Revista",
    desc: "Branco · uppercase · @brandsdecoded",
    coverLayout: "editorial",
    contentLayout: "light",
    ctaLayout: "light",
    isDark: false,
  },
];

// ── Fonte do carrossel ───────────────────────────────────────────────────────

export type FontKey = "serif" | "condensed" | "sans" | "brand";

export interface FontOption {
  key: FontKey;
  label: string;
  preview: string; // família CSS fallback para preview
}

export const FONT_OPTIONS: FontOption[] = [
  { key: "serif",     label: "Serif",      preview: "Georgia, serif" },
  { key: "condensed", label: "Condensada", preview: "Impact, sans-serif" },
  { key: "sans",      label: "Sem serifa", preview: "system-ui, sans-serif" },
  { key: "brand",     label: "Da marca",   preview: "system-ui, sans-serif" },
];

export function getFontKey(body: string | null | undefined): FontKey | null {
  const m = (body ?? "").match(/\[Font:\s*([a-z]+)\]/i);
  const k = m?.[1] as FontKey | undefined;
  return FONT_OPTIONS.some((f) => f.key === k) ? k! : null;
}

export function setFontToken(body: string, fontKey: FontKey): string {
  const cleaned = (body ?? "").replace(/\n?\[Font:\s*[a-z]+\]/gi, "").trimEnd();
  return `${cleaned}\n[Font: ${fontKey}]`;
}

/** Resolve a família CSS real para um FontKey, usando brandFont quando key=brand */
export function resolveFontFamily(key: FontKey | null, brandFont?: string | null): string {
  if (key === "brand" && brandFont) return `"${brandFont}", system-ui, sans-serif`;
  if (key === "condensed") return "var(--font-anton), Impact, sans-serif";
  if (key === "sans") return "system-ui, sans-serif";
  return "Georgia, serif"; // serif + null → serif
}

export function getThemeId(body: string | null | undefined): ThemeId | null {
  const m = (body ?? "").match(/\[Theme:\s*([a-z-]+)\]/i);
  const id = m?.[1] as ThemeId | undefined;
  return CAROUSEL_THEMES.some((t) => t.id === id) ? id! : null;
}

export function setThemeToken(body: string, themeId: ThemeId): string {
  const cleaned = (body ?? "").replace(/\n?\[Theme:\s*[a-z-]+\]/gi, "").trimEnd();
  return `${cleaned}\n[Theme: ${themeId}]`;
}
