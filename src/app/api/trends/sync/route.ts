import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { syncTrends } from "@/lib/trends/sync";
import { brandNiches, NICHES, type NicheConfig } from "@/lib/trends/sources";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sincroniza tendências do mercado (YouTube + Reddit).
 * - Cron do Vercel (GET com Authorization: Bearer ${CRON_SECRET}) → nichos padrão (global).
 * - Usuário autenticado (POST da página de Tendências) → nichos do Brand Brain dele.
 */

function userClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
}

/** Monta nichos de busca a partir dos temas da marca do usuário. */
async function nichesForUser(request: NextRequest): Promise<NicheConfig[]> {
  try {
    const supabase = userClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NICHES;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!workspace) return NICHES;

    const { data: brand } = await supabase
      .from("brands")
      .select("id, name, description")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!brand) return NICHES;

    const { data: voice } = await supabase
      .from("brand_voice")
      .select("target_audience, content_pillars")
      .eq("brand_id", brand.id)
      .maybeSingle();

    // Cada pilar vira uma busca; complementa com público-alvo / descrição.
    const queries = [
      ...(voice?.content_pillars ?? []),
      voice?.target_audience,
      brand.description,
    ].filter((q): q is string => !!q && q.trim().length > 2);

    const niches = brandNiches(queries);
    return niches.length > 0 ? niches : NICHES;
  } catch {
    return NICHES;
  }
}

export async function GET(request: NextRequest) {
  // Caminho do cron: nichos globais padrão.
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const result = await syncTrends(NICHES);
  const status = result.error && result.total === 0 ? 502 : 200;
  return NextResponse.json(result, { status });
}

export async function POST(request: NextRequest) {
  const supabase = userClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const niches = await nichesForUser(request);
  let result = await syncTrends(niches);

  // Rede de segurança: se a busca por nicho não trouxe nada, usa os nichos gerais.
  if (result.total === 0 && niches !== NICHES) {
    result = await syncTrends(NICHES);
  }

  const status = result.error && result.total === 0 ? 502 : 200;
  return NextResponse.json(result, { status });
}
