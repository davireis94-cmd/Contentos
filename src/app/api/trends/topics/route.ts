import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/queries/context";
import { clusterTopics, type TopicInput } from "@/lib/trends/topics";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  keywords?: string[];
  nicheOnly?: boolean;
}

/** Agrupa as tendências atuais em temas acionáveis usando IA. */
export async function POST(request: NextRequest) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user || !workspace) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    /* corpo vazio é aceitável */
  }
  const keywords = (body.keywords ?? []).map((k) => k.toLowerCase());
  const nicheOnly = body.nicheOnly !== false && keywords.length > 0;

  const { data: trends } = await supabase
    .from("benchmark_content")
    .select("id, title, platform, niche, source, metrics")
    .or(`workspace_id.eq.${workspace.id},workspace_id.is.null`)
    .neq("source", "manual")
    .order("created_at", { ascending: false })
    .limit(80);

  if (!trends || trends.length === 0) {
    return NextResponse.json({
      topics: [],
      message: "Nenhuma tendência para analisar. Atualize as tendências primeiro.",
    });
  }

  const filtered = nicheOnly
    ? trends.filter((t) => {
        const hay = `${t.title} ${t.niche ?? ""}`.toLowerCase();
        return keywords.some((k) => hay.includes(k));
      })
    : trends;

  const pool = filtered.length >= 4 ? filtered : trends;

  const items: TopicInput[] = pool.map((t) => {
    const m = (t.metrics ?? {}) as { velocityPerHour?: number; engagementRate?: number };
    return {
      id: t.id,
      title: t.title,
      platform: t.platform,
      niche: t.niche,
      velocityPerHour: m.velocityPerHour,
      engagementRate: m.engagementRate,
    };
  });

  try {
    const topics = await clusterTopics(items);
    return NextResponse.json({ topics });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao analisar temas" },
      { status: 502 }
    );
  }
}
