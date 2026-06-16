import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/anthropic";
import { CAROUSEL_TEMPLATES } from "@/lib/templates/carousel-templates";
import { extractJson } from "@/lib/ai/json";
import { type BrandExtras, renderExtrasForPrompt } from "@/lib/brand/extras";
import { renderPerformanceForPrompt, type PerformanceInsights } from "@/lib/brand/performance";

export const runtime = "nodejs";
export const maxDuration = 90;

/** Extrai tokens [Key: value] do body, retorna { clean, tokens } */
function splitTokens(body: string) {
  const tokens = (body.match(/\[[^\]]+:[^\]]*\]/g) ?? []).join("\n");
  const clean = body.replace(/\n?\[[^\]]+:[^\]]*\]/g, "").trim();
  return { clean, tokens };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { templateId, topic, angle, brandId } = await request.json() as {
    templateId: string;
    topic: string;
    angle?: string;
    brandId: string;
  };

  const tpl = CAROUSEL_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return NextResponse.json({ error: "Template não encontrado" }, { status: 400 });

  const { data: brand } = await supabase
    .from("brands")
    .select("name, description, workspace_id, identity")
    .eq("id", brandId)
    .single();
  if (!brand) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });

  const { data: voice } = await supabase
    .from("brand_voice")
    .select("tone, target_audience, content_pillars, characteristic_phrases, forbidden_words")
    .eq("brand_id", brandId)
    .maybeSingle();

  const identity = (brand.identity ?? {}) as { brain_extras?: BrandExtras; performance_insights?: PerformanceInsights };
  const extras = identity.brain_extras ?? {};
  const perf = renderPerformanceForPrompt(identity.performance_insights);

  const brandCtx = `MARCA: ${brand.name}
Público: ${voice?.target_audience || "(não definido)"}
Tom: ${voice?.tone || "(não definido)"}
Pilares: ${voice?.content_pillars?.join(", ") || "(não definidos)"}
Frases características: ${voice?.characteristic_phrases?.join(" | ") || "(nenhuma)"}
Palavras proibidas: ${voice?.forbidden_words?.join(", ") || "(nenhuma)"}
${renderExtrasForPrompt(extras)}${perf ? `\n\nO QUE FUNCIONA COM ESTE PÚBLICO:\n${perf}` : ""}`;

  // Monta estrutura do template (com tokens, sem placeholder text)
  const templateSlides = tpl.build(topic.trim() || tpl.title);
  const slideStructure = templateSlides
    .map((s, i) => {
      const { tokens } = splitTokens(s.body ?? "");
      const label = i === 0 ? "CAPA" : i === templateSlides.length - 1 ? "CTA FINAL" : `SLIDE ${i + 1}`;
      return `${label} (slide ${i + 1}/${templateSlides.length}):
  Título: ${s.title}
  Subtítulo: ${s.subtitle || "(sem subtítulo)"}
  CTA: ${s.cta || "(sem CTA)"}
  Tokens de layout/fonte (mantenha exatamente): ${tokens || "(nenhum)"}`;
    })
    .join("\n\n");

  const prompt = `Gere um carrossel de Instagram para a marca "${brand.name}" sobre o tema: "${topic}".
${angle ? `\nÂNGULO/CONTEXTO EXTRA: ${angle}` : ""}

ESTRUTURA OBRIGATÓRIA — siga exatamente estes ${templateSlides.length} slides:

${slideStructure}

REGRAS:
- Escreva o CORPO (body) de cada slide com conteúdo real e direto — MÁXIMO 130 caracteres de texto limpo
- Use o tom e voz da marca (contexto abaixo)
- Adapte os títulos ao tema específico quando fizer sentido (mas mantenha o subtítulo)
- No final de cada body, adicione os tokens de layout/fonte EXATAMENTE como indicado (ex: \\n[Layout: dark]\\n[Font: serif])
- Sem clichês: "No mundo atual", "Vamos explorar", "Em conclusão"
- Slides de conteúdo: máx 130 chars. CTA final: pode ser um pouco mais longo.
- Gere também legenda completa e 5-8 hashtags

Retorne JSON válido sem markdown:
{
  "slides": [
    {"index": 0, "title": "...", "subtitle": "...", "body": "texto real\\n[Layout: editorial]\\n[Font: serif]", "cta": null},
    ...
  ],
  "caption": "legenda com emoji e CTA",
  "hashtags": ["hashtag1", "hashtag2"]
}`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: `Você é especialista em conteúdo para Instagram. ${brandCtx}`,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  const output = extractJson<{ slides: Record<string, unknown>[]; caption: string; hashtags: string[] }>(raw);

  // Garante index sequencial
  output.slides = output.slides.map((s, i) => ({ index: i, ...s }));
  if (!Array.isArray(output.hashtags)) output.hashtags = [];
  if (typeof output.caption !== "string") output.caption = "";

  const { data: piece, error } = await supabase
    .from("content_pieces")
    .insert({
      workspace_id: brand.workspace_id,
      brand_id: brandId,
      created_by: user.id,
      title: topic.trim() || tpl.title,
      format: "carousel",
      objective: "engage",
      status: "scripted",
      slides: output.slides,
      caption: output.caption,
      hashtags: output.hashtags,
    })
    .select("id")
    .single();

  if (error || !piece) return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });

  return NextResponse.json({ pieceId: piece.id });
}
