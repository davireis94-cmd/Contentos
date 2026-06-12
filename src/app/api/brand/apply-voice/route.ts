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

  const {
    brandId,
    tone,
    target_audience,
    content_pillars,
    characteristic_phrases,
    forbidden_words,
  } = await request.json() as {
    brandId: string;
    tone?: string;
    target_audience?: string;
    content_pillars?: string[];
    characteristic_phrases?: string[];
    forbidden_words?: string[];
  };

  if (!brandId) return NextResponse.json({ error: "brandId obrigatório" }, { status: 400 });

  // Build only the fields the user chose to apply
  const patch: Record<string, unknown> = {};
  if (tone !== undefined) patch.tone = tone;
  if (target_audience !== undefined) patch.target_audience = target_audience;
  if (content_pillars !== undefined) patch.content_pillars = content_pillars;
  if (characteristic_phrases !== undefined) patch.characteristic_phrases = characteristic_phrases;
  if (forbidden_words !== undefined) patch.forbidden_words = forbidden_words;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo selecionado" }, { status: 400 });
  }

  // Upsert brand_voice row
  const { error } = await supabase
    .from("brand_voice")
    .upsert({ brand_id: brandId, ...patch }, { onConflict: "brand_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
