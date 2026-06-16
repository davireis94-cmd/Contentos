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

export function getThemeId(body: string | null | undefined): ThemeId | null {
  const m = (body ?? "").match(/\[Theme:\s*([a-z-]+)\]/i);
  const id = m?.[1] as ThemeId | undefined;
  return CAROUSEL_THEMES.some((t) => t.id === id) ? id! : null;
}

export function setThemeToken(body: string, themeId: ThemeId): string {
  const cleaned = (body ?? "").replace(/\n?\[Theme:\s*[a-z-]+\]/gi, "").trimEnd();
  return `${cleaned}\n[Theme: ${themeId}]`;
}
