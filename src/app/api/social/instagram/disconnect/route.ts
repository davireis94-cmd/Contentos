import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

  // RLS permite o membro deletar a conexão do próprio workspace
  await supabase
    .from("social_connections")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("platform", "instagram");

  return NextResponse.json({ ok: true });
}
