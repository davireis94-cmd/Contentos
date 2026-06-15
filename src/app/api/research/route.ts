import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/anthropic";
import { extractJson } from "@/lib/ai/json";
import { renderExtrasForPrompt, type BrandExtras } from "@/lib/brand/extras";
import {
  buildResearchSystem,
  WEB_SEARCH_TOOL,
  extractFinalText,
  type ResearchBrief,
} from "@/lib/skills/deep-research";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  topic?: string;
  brandId?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  const topic = body?.topic?.trim();
  if (!topic) return NextResponse.json({ error: "tema obrigatório" }, { status: 400 });

  let brandCtx = "";
  if (body?.brandId) {
    const [{ data: brand }, { data: voice }] = await Promise.all([
      supabase.from("brands").select("name, description, identity").eq("id", body.brandId).maybeSingle(),
      supabase
        .from("brand_voice")
        .select("tone, target_audience, content_pillars")
        .eq("brand_id", body.brandId)
        .maybeSingle(),
    ]);
    if (brand) {
      const extras = ((brand.identity ?? {}) as { brain_extras?: BrandExtras }).brain_extras ?? {};
      brandCtx = `\n\nCONTEXTO DA MARCA (para mirar a pesquisa no público certo):
Marca: ${brand.name}
Público: ${voice?.target_audience || "(não definido)"}
Pilares: ${voice?.content_pillars?.join(", ") || "(não definidos)"}
${renderExtrasForPrompt(extras)}`;
    }
  }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: buildResearchSystem(brandCtx),
      tools: [WEB_SEARCH_TOOL],
      messages: [{ role: "user", content: `Pesquise a fundo o tema para um post: "${topic}"` }],
    });
    const raw = extractFinalText(msg);
    const brief = extractJson<ResearchBrief>(raw);

    brief.summary = typeof brief.summary === "string" ? brief.summary : "";
    brief.facts = Array.isArray(brief.facts) ? brief.facts.slice(0, 8) : [];
    brief.stats = Array.isArray(brief.stats) ? brief.stats.slice(0, 8) : [];
    brief.angles = Array.isArray(brief.angles) ? brief.angles.slice(0, 8) : [];
    brief.myths = Array.isArray(brief.myths) ? brief.myths.slice(0, 6) : [];
    return NextResponse.json({ brief });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ error: `Falha na pesquisa: ${detail.slice(0, 200)}` }, { status: 502 });
  }
}
