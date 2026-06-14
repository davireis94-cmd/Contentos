import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { fetchInsights } from "@/lib/social/instagram";
import { anthropic } from "@/lib/ai/anthropic";
import { performanceScore, type PerformanceInsights } from "@/lib/brand/performance";

export const runtime = "nodejs";
export const maxDuration = 90;

const SYSTEM = `Você é um analista de conteúdo de Instagram. Recebe posts REAIS de uma marca com suas métricas e identifica, com objetividade, o que faz o público desta marca engajar.

Analise comparando os campeões (alto desempenho) com os fracos. Procure padrões CONCRETOS e ACIONÁVEIS — não generalidades. Foque em: estilo de gancho, tema/assunto, formato (carrossel/reels/imagem), tamanho da legenda, presença de CTA, tom emocional, uso de números/listas.

Responda SOMENTE com JSON válido, sem markdown:
{
  "bestFormat": "carousel | reel | single | null",
  "bestTopics": ["tema recorrente nos campeões", "..."],
  "topPatterns": ["padrão concreto que funciona — específico desta marca", "..."],
  "avoidPatterns": ["padrão que NÃO engaja com este público", "..."],
  "summary": "1-2 frases resumindo o que funciona com este público específico"
}
Seja específico à marca. Máximo 5 itens por lista. Se não houver dados suficientes para um campo, retorne lista vazia ou null.`;

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { brandId?: string };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!workspace) return NextResponse.json({ error: "Sem workspace" }, { status: 400 });

  // Marca alvo: a informada ou a primeira do workspace
  const { data: brand } = body.brandId
    ? await supabase.from("brands").select("id, identity").eq("id", body.brandId).maybeSingle()
    : await supabase.from("brands").select("id, identity").eq("workspace_id", workspace.id).order("created_at").limit(1).maybeSingle();
  if (!brand) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });

  // Token IG via service role (nunca exposto ao cliente)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: conn } = await admin
    .from("social_connections")
    .select("external_id, access_token")
    .eq("workspace_id", workspace.id)
    .eq("platform", "instagram")
    .maybeSingle();
  if (!conn) return NextResponse.json({ error: "Conecte o Instagram primeiro para o app aprender com seus posts." }, { status: 400 });

  let posts;
  try {
    const insights = await fetchInsights(conn.external_id, conn.access_token);
    posts = insights.posts;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao buscar métricas" }, { status: 502 });
  }

  if (posts.length < 3) {
    return NextResponse.json({ error: "Você precisa de pelo menos 3 posts publicados para o app aprender." }, { status: 400 });
  }

  // Ordena por desempenho e monta o dataset comparativo
  const ranked = [...posts].sort((a, b) => performanceScore(b) - performanceScore(a));
  const top = ranked.slice(0, Math.min(5, Math.ceil(ranked.length / 2)));
  const bottom = ranked.slice(-Math.min(3, Math.floor(ranked.length / 3)));

  const fmt = (p: typeof posts[number], rank: string) =>
    `[${rank}] formato:${p.mediaType} | likes:${p.likes} comentários:${p.comments} alcance:${p.reach} salvos:${p.saved}\nlegenda: "${p.caption || "(sem legenda)"}"`;

  const dataset = [
    "POSTS CAMPEÕES (alto desempenho):",
    ...top.map((p) => fmt(p, "CAMPEÃO")),
    "",
    "POSTS FRACOS (baixo desempenho):",
    ...bottom.map((p) => fmt(p, "FRACO")),
  ].join("\n\n");

  let parsed: Omit<PerformanceInsights, "updatedAt" | "postsAnalyzed">;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: `Analise estes posts e extraia os padrões:\n\n${dataset}` }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Sem JSON");
    parsed = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: "Falha ao analisar os posts" }, { status: 502 });
  }

  const insights: PerformanceInsights = {
    updatedAt: new Date().toISOString(),
    postsAnalyzed: posts.length,
    bestFormat: parsed.bestFormat || null,
    bestTopics: Array.isArray(parsed.bestTopics) ? parsed.bestTopics.slice(0, 5) : [],
    topPatterns: Array.isArray(parsed.topPatterns) ? parsed.topPatterns.slice(0, 5) : [],
    avoidPatterns: Array.isArray(parsed.avoidPatterns) ? parsed.avoidPatterns.slice(0, 5) : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };

  const identity = (brand.identity ?? {}) as Record<string, unknown>;
  await supabase
    .from("brands")
    .update({ identity: { ...identity, performance_insights: insights } })
    .eq("id", brand.id);

  return NextResponse.json({ insights });
}
