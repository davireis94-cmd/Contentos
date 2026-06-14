import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/anthropic";
import { extractJson } from "@/lib/ai/json";
import { CRITIC_SYSTEM, renderPostForCritic, type CriticResult } from "@/lib/skills/content-critic";
import { renderExtrasForPrompt, type BrandExtras } from "@/lib/brand/extras";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  brandId?: string;
  output: {
    slides?: { title?: string; subtitle?: string; body?: string; cta?: string }[];
    caption?: string;
    hashtags?: string[];
    format?: string;
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.output?.slides) {
    return NextResponse.json({ error: "output inválido" }, { status: 400 });
  }

  // Contexto da marca (voz + estratégia) para avaliar alinhamento — opcional.
  let brandCtx = "";
  if (body.brandId) {
    const [{ data: brand }, { data: voice }] = await Promise.all([
      supabase.from("brands").select("name, description, identity").eq("id", body.brandId).maybeSingle(),
      supabase
        .from("brand_voice")
        .select("tone, target_audience, content_pillars, forbidden_words")
        .eq("brand_id", body.brandId)
        .maybeSingle(),
    ]);
    if (brand) {
      const extras = ((brand.identity ?? {}) as { brain_extras?: BrandExtras }).brain_extras ?? {};
      brandCtx = `\n\nCONTEXTO DA MARCA (para avaliar alinhamento de voz):
Marca: ${brand.name}
Tom: ${voice?.tone || "(não definido)"}
Público: ${voice?.target_audience || "(não definido)"}
Pilares: ${voice?.content_pillars?.join(", ") || "(não definidos)"}
Palavras proibidas: ${voice?.forbidden_words?.join(", ") || "(nenhuma)"}
${renderExtrasForPrompt(extras)}`;
    }
  }

  const postText = renderPostForCritic(body.output);

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: CRITIC_SYSTEM + brandCtx,
      messages: [{ role: "user", content: `Critique este post:\n\n${postText}` }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const result = extractJson<CriticResult>(raw);
    // Sanidade básica
    result.score = Math.max(0, Math.min(100, Number(result.score) || 0));
    result.issues = Array.isArray(result.issues) ? result.issues.slice(0, 6) : [];
    result.strengths = Array.isArray(result.strengths) ? result.strengths.slice(0, 3) : [];
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Falha ao criticar" }, { status: 502 });
  }
}
