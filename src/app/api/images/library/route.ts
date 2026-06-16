import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BUCKET = "slide-images";

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
    .single();

  if (!workspace) return NextResponse.json({ images: [] });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Lista recursiva do prefixo do workspace (imagens geradas por IA)
  async function listAll(prefix: string): Promise<string[]> {
    const urls: string[] = [];
    const { data: items } = await admin.storage.from(BUCKET).list(prefix, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (!items) return urls;
    for (const item of items) {
      if (item.id === null) {
        // é uma pasta
        const sub = await listAll(`${prefix}/${item.name}`);
        urls.push(...sub);
      } else {
        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(`${prefix}/${item.name}`);
        if (pub?.publicUrl) urls.push(pub.publicUrl);
      }
    }
    return urls;
  }

  const [wsImages, userImages] = await Promise.all([
    listAll(workspace.id),
    listAll(user.id),
  ]);

  // Merge e deduplica
  const all = [...new Set([...wsImages, ...userImages])];

  return NextResponse.json({ images: all });
}
