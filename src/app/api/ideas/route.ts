import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/queries/context";
import { anthropic } from "@/lib/ai/anthropic";
import { extractJson } from "@/lib/ai/json";
import { renderExtrasForPrompt, type BrandExtras } from "@/lib/brand/extras";
import { renderPerformanceForPrompt, type PerformanceInsights } from "@/lib/brand/performance";
import {
  buildIdeaSystem,
  normalizeIdeas,
  renderTrendsForPrompt,
} from "@/lib/skills/idea-generation";

export const runtime = "nodejs";
export const maxDuration = 90;

interface Body {
  brandId?: string;
  count?: number;
}

export async function POST(request: NextRequest) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as Body | null;
  const count = Math.min(Math.max(body?.count ?? 12, 8), 15);

  // Marca: usa a informada, ou a primeira do workspace.
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, description, identity")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const brandId = body?.brandId ?? brand?.id;
  if (!brandId) return NextResponse.json({ error: "Nenhuma marca configurada" }, { status: 400 });

  const [{ data: voice }, { data: trends }] = await Promise.all([
    supabase
      .from("brand_voice")
      .select("tone, target_audience, content_pillars, characteristic_phrases, forbidden_words")
      .eq("brand_id", brandId)
      .maybeSingle(),
    supabase
      .from("benchmark_content")
      .select("title, description, topic_tags, source, niche")
      .or(`workspace_id.eq.${workspace.id},workspace_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const identity = (brand?.identity ?? {}) as {
    brain_extras?: BrandExtras;
    performance_insights?: PerformanceInsights;
  };

  const brandCtx = `\nVOZ DA MARCA:
Marca: ${brand?.name ?? ""}
Sobre: ${brand?.description || "(não definido)"}
Tom: ${voice?.tone || "(não definido)"}
Público: ${voice?.target_audience || "(não definido)"}
Pilares: ${voice?.content_pillars?.join(", ") || "(não definidos)"}
Frases características: ${voice?.characteristic_phrases?.join(" | ") || "(nenhuma)"}
Palavras proibidas: ${voice?.forbidden_words?.join(", ") || "(nenhuma)"}
${renderExtrasForPrompt(identity.brain_extras ?? {})}`;

  const trendsBlock = renderTrendsForPrompt(trends ?? []);
  const performanceBlock = renderPerformanceForPrompt(identity.performance_insights);

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: buildIdeaSystem({ brandCtx, trendsBlock, performanceBlock, count }),
      messages: [{ role: "user", content: `Gere ${count} pautas para a marca acima.` }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const ideas = normalizeIdeas(extractJson(raw));

    if (!ideas.length) {
      return NextResponse.json({ error: "Não foi possível gerar pautas. Tente de novo." }, { status: 502 });
    }
    return NextResponse.json({ ideas, brandId });
  } catch {
    return NextResponse.json({ error: "Falha ao gerar pautas" }, { status: 502 });
  }
}
