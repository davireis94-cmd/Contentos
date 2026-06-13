import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { publishToAyrshare } from "@/lib/publish/ayrshare";
import { trackUsage } from "@/lib/billing/track";
import type { Slide } from "@/lib/validations/generation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { pieceId, platforms, scheduleDate } = (await request.json()) as {
    pieceId: string;
    platforms: string[];
    scheduleDate?: string;
  };

  if (!pieceId || !platforms?.length) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { data: piece } = await supabase
    .from("content_pieces")
    .select("workspace_id, caption, slides")
    .eq("id", pieceId)
    .single();
  if (!piece) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });

  const slides = (piece.slides ?? []) as Slide[];
  if (slides.length === 0) {
    return NextResponse.json({ error: "Sem slides para publicar" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY ausente" }, { status: 500 });
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Renderiza cada slide (reusa /api/render/slide) e sobe ao Storage → URLs públicas
  const origin = request.nextUrl.origin;
  const mediaUrls: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    try {
      const r = await fetch(`${origin}/api/render/slide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slide: slides[i], idx: i, total: slides.length }),
      });
      if (!r.ok) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      const path = `${piece.workspace_id}/${pieceId}/pub-${i}-${Date.now()}.png`;
      const { error: upErr } = await admin.storage
        .from("slide-images")
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) continue;
      const { data: pub } = admin.storage.from("slide-images").getPublicUrl(path);
      if (pub?.publicUrl) mediaUrls.push(pub.publicUrl);
    } catch (err) {
      console.error(`[publish] render/upload slide ${i} failed:`, err);
    }
  }

  if (mediaUrls.length === 0) {
    return NextResponse.json({ error: "Falha ao renderizar os slides" }, { status: 502 });
  }

  // 2. Publica/agenda via Ayrshare
  const result = await publishToAyrshare({
    caption: piece.caption ?? "",
    platforms,
    mediaUrls,
    scheduleDate,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Falha ao publicar" }, { status: 502 });
  }

  // 3. Registra uso + atualiza status
  await trackUsage({
    supabase,
    workspaceId: piece.workspace_id,
    userId: user.id,
    operation: "publish",
    metadata: { piece_id: pieceId, platforms, scheduled: !!scheduleDate, ayrshare_id: result.id },
  });

  await supabase
    .from("content_pieces")
    .update({ status: scheduleDate ? "scheduled" : "published" })
    .eq("id", pieceId);

  return NextResponse.json({ ok: true, id: result.id, slides: mediaUrls.length });
}
