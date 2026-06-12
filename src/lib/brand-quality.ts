export type QualityStatus = "done" | "partial" | "missing";

export interface QualityItem {
  id: string;
  label: string;
  status: QualityStatus;
  impact: string;
  hint: string;
  tab: string;
  critical: boolean;
  detail?: string;
  fromDocs?: boolean;
}

interface VoiceData {
  tone?: string | null;
  target_audience?: string | null;
  content_pillars?: string[];
  characteristic_phrases?: string[];
  forbidden_words?: string[];
}

export interface DocExtracted {
  hasPublicoAlvo: boolean;
  hasPilares: boolean;
  hasFrasesChave: boolean;
  hasPalavrasEvitar: boolean;
}

export function computeQualityItems(
  brand: { description?: string | null },
  voice: VoiceData | null,
  examplesCount: number,
  documentsCount: number,
  referencesCount: number,
  docExtracted?: DocExtracted
): QualityItem[] {
  const pillarsCount = voice?.content_pillars?.length ?? 0;
  const phrasesCount = voice?.characteristic_phrases?.length ?? 0;
  const forbiddenCount = voice?.forbidden_words?.length ?? 0;

  const hasAudience = !!(voice?.target_audience && voice.target_audience.trim().length > 20);
  const hasPillars = pillarsCount >= 3;
  const hasPhrases = phrasesCount >= 3;
  const hasForbidden = forbiddenCount >= 1;

  return [
    {
      id: "description",
      label: "Descrição da marca",
      status:
        brand.description && brand.description.trim().length > 20 ? "done" : "missing",
      impact: "Define o contexto base para todo conteúdo gerado.",
      hint: "2–3 frases diretas: o que você faz, para quem e qual resultado entrega.",
      tab: "identity",
      critical: false,
    },
    {
      id: "target_audience",
      label: "Público-alvo",
      status: hasAudience
        ? "done"
        : docExtracted?.hasPublicoAlvo
        ? "partial"
        : "missing",
      impact: "Sem público-alvo definido, a IA gera conteúdo genérico que não ressoa com ninguém.",
      hint: "Quem é (faixa etária, cargo, nicho), qual é a dor principal, o que quer alcançar.",
      tab: "voice",
      critical: true,
      fromDocs: !hasAudience && docExtracted?.hasPublicoAlvo,
    },
    {
      id: "characteristic_phrases",
      label: "Frases características",
      status: hasPhrases
        ? "done"
        : phrasesCount > 0 || docExtracted?.hasFrasesChave
        ? "partial"
        : "missing",
      impact: "O que separa conteúdo autêntico de conteúdo genérico — a IA replica seu vocabulário único.",
      hint: "Bordões, expressões de abertura, encerramentos, metáforas que você sempre usa. Mínimo 3.",
      tab: "voice",
      critical: true,
      detail: !hasPhrases ? `${phrasesCount}/3` : undefined,
      fromDocs: !hasPhrases && docExtracted?.hasFrasesChave,
    },
    {
      id: "content_pillars",
      label: "Pilares de conteúdo",
      status: hasPillars
        ? "done"
        : pillarsCount > 0 || docExtracted?.hasPilares
        ? "partial"
        : "missing",
      impact: "Garante variedade estratégica — a IA não repete os mesmos ângulos a cada geração.",
      hint: "3–6 temas centrais da sua comunicação. Ex: Liderança, Gestão, Produtividade, Cases.",
      tab: "voice",
      critical: false,
      detail: !hasPillars ? `${pillarsCount}/3` : undefined,
      fromDocs: !hasPillars && docExtracted?.hasPilares,
    },
    {
      id: "forbidden_words",
      label: "Palavras proibidas",
      status: hasForbidden
        ? "done"
        : docExtracted?.hasPalavrasEvitar
        ? "partial"
        : "missing",
      impact: "Elimina clichês de IA e expressões que não combinam com a identidade da marca.",
      hint: "Expressões que você odeia ver no seu conteúdo. Inclua clichês de IA ('mergulhar', 'jornada').",
      tab: "voice",
      critical: false,
      fromDocs: !hasForbidden && docExtracted?.hasPalavrasEvitar,
    },
    {
      id: "examples",
      label: "Exemplos de posts reais",
      status:
        examplesCount >= 3 ? "done" : examplesCount > 0 ? "partial" : "missing",
      impact: "A maior fonte de aprendizado — a IA aprende seu estilo real a partir dos seus próprios posts.",
      hint: "Cole legendas e carrosséis que tiveram boa performance. Mínimo 3, idealmente 5–10.",
      tab: "examples",
      critical: true,
      detail: examplesCount < 3 ? `${examplesCount}/3` : undefined,
    },
    {
      id: "documents",
      label: "Documento de marca",
      status: documentsCount >= 1 ? "done" : "missing",
      impact: "Injeta o DNA completo da marca — estratégia, posicionamento, identidade.",
      hint: "Manual de marca, estratégia de comunicação, deck de posicionamento.",
      tab: "documents",
      critical: false,
    },
    {
      id: "references",
      label: "Referências de mercado",
      status:
        referencesCount >= 2 ? "done" : referencesCount === 1 ? "partial" : "missing",
      impact: "Calibra o conteúdo pelo que funciona no seu nicho.",
      hint: "Adicione 2–3 perfis que você admira — a IA analisa o que funciona para eles.",
      tab: "references",
      critical: false,
      detail: referencesCount < 2 ? `${referencesCount}/2` : undefined,
    },
  ];
}

export function computeLiveScore(items: QualityItem[]): number {
  const done = items.filter((i) => i.status === "done").length;
  return Math.round((done / items.length) * 100);
}
