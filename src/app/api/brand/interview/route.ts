import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuestions, synthesizeExtras } from "@/lib/brand/interview";
import { type BrandExtras } from "@/lib/brand/extras";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  brandId: string;
  mode: "questions" | "synthesize";
  answers?: { q: string; a: string }[];
}

async function loadContext(brandId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, description, identity")
    .eq("id", brandId)
    .single();
  if (!brand) return null;

  const { data: voice } = await supabase
    .from("brand_voice")
    .select("tone, target_audience, content_pillars")
    .eq("brand_id", brandId)
    .maybeSingle();

  const ctx = [
    brand.name && `Nome: ${brand.name}`,
    brand.description && `Descrição: ${brand.description}`,
    voice?.target_audience && `Público: ${voice.target_audience}`,
    voice?.tone && `Tom: ${voice.tone}`,
    voice?.content_pillars?.length && `Pilares: ${voice.content_pillars.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const identity = (brand.identity ?? {}) as { brain_extras?: BrandExtras };
  return { supabase, brand, ctx, current: identity.brain_extras ?? {}, identity };
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  if (!body.brandId) {
    return NextResponse.json({ error: "brandId obrigatório" }, { status: 400 });
  }

  const loaded = await loadContext(body.brandId);
  if (!loaded) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (body.mode === "questions") {
    const questions = await generateQuestions(loaded.ctx);
    return NextResponse.json({ questions });
  }

  // synthesize
  const extras = await synthesizeExtras(loaded.ctx, body.answers ?? [], loaded.current);
  const identity = { ...(loaded.identity as object), brain_extras: extras };
  await loaded.supabase.from("brands").update({ identity }).eq("id", body.brandId);

  return NextResponse.json({ extras });
}
