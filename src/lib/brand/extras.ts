/**
 * "Linhas" avançadas do Brand Brain — o que separa um cérebro raso de um de
 * classe mundial. Guardadas em brands.identity.brain_extras (sem migração).
 */
export interface BrandExtras {
  enemy?: string; // inimigo/vilão contra o qual a marca luta
  strong_opinions?: string[]; // opiniões fortes / polêmicas
  stories?: string[]; // histórias, cases e provas reais
  audience_pains?: string[]; // dores específicas do público
  audience_desires?: string[]; // desejos/sonhos do público
  offers?: string[]; // ofertas e CTAs
  style_references?: string[]; // referências de estilo/criadores admirados
}

export const EXTRAS_FIELDS: { key: keyof BrandExtras; label: string; isArray: boolean }[] = [
  { key: "enemy", label: "Inimigo / vilão da marca", isArray: false },
  { key: "strong_opinions", label: "Opiniões fortes / polêmicas", isArray: true },
  { key: "stories", label: "Histórias, cases e provas", isArray: true },
  { key: "audience_pains", label: "Dores do público", isArray: true },
  { key: "audience_desires", label: "Desejos do público", isArray: true },
  { key: "offers", label: "Ofertas e CTAs", isArray: true },
  { key: "style_references", label: "Referências de estilo", isArray: true },
];

/** Quantos campos avançados já estão preenchidos (0–7). */
export function extrasFilledCount(e: BrandExtras | null | undefined): number {
  if (!e) return 0;
  return EXTRAS_FIELDS.filter(({ key, isArray }) => {
    const v = e[key];
    return isArray ? Array.isArray(v) && v.length > 0 : !!(v as string)?.trim();
  }).length;
}

/** Renderiza os extras como seção de texto para o system prompt da geração. */
export function renderExtrasForPrompt(e: BrandExtras | null | undefined): string {
  if (!e) return "";
  const lines: string[] = [];
  if (e.enemy?.trim()) lines.push(`Inimigo/vilão (posicione a marca contra isso): ${e.enemy}`);
  if (e.strong_opinions?.length) lines.push(`Opiniões fortes da marca (defenda-as): ${e.strong_opinions.join(" | ")}`);
  if (e.audience_pains?.length) lines.push(`Dores do público (fale delas com precisão): ${e.audience_pains.join(" | ")}`);
  if (e.audience_desires?.length) lines.push(`Desejos do público (conecte a eles): ${e.audience_desires.join(" | ")}`);
  if (e.stories?.length) lines.push(`Histórias/provas reais (use como evidência): ${e.stories.join(" | ")}`);
  if (e.offers?.length) lines.push(`Ofertas/CTAs (direcione quando fizer sentido): ${e.offers.join(" | ")}`);
  if (e.style_references?.length) lines.push(`Referências de estilo: ${e.style_references.join(" | ")}`);
  return lines.join("\n");
}
