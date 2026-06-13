import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { fetchInsights } from "@/lib/social/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!workspace) return NextResponse.json({ error: "Sem workspace" }, { status: 400 });

  // Lê o token server-side (service role) — nunca exposto ao cliente
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

  if (!conn) return NextResponse.json({ connected: false }, { status: 200 });

  try {
    const insights = await fetchInsights(conn.external_id, conn.access_token);
    return NextResponse.json({ connected: true, insights });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar métricas";
    return NextResponse.json({ connected: true, error: msg }, { status: 200 });
  }
}
