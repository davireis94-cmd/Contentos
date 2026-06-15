import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { buildImagePrompt, type BrandImageContext } from "@/lib/images/prompt";
import { generateImage } from "@/lib/images/generate";
import { getImageModel } from "@/lib/images/models";
import { trackUsage } from "@/lib/billing/track";

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

  const { pieceId, slideIndex, model, topic } = (await request.json()) as {
    pieceId: string;
    slideIndex: number;
    model: string;
    topic?: string;
  };

  if (!pieceId || slideIndex == null || !model) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Busca a peça + marca para condicionar o prompt
  const { data: piece } = await supabase
    .from("content_pieces")
    .select("brand_id, workspace_id, title, slides")
    .eq("id", pieceId)
    .single();
  if (!piece) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });

  const [{ data: brand }, { data: voice }, { data: refs }] = await Promise.all([
    supabase.from("brands").select("description, identity").eq("id", piece.brand_id).single(),
    supabase
      .from("brand_voice")
      .select("tone, target_audience")
      .eq("brand_id", piece.brand_id)
      .maybeSingle(),
    supabase
      .from("brand_references")
      .select("ai_analysis")
      .eq("brand_id", piece.brand_id)
      .not("ai_analysis", "is", null),
  ]);

  // DNA visual: usa o da primeira referência analisada que tiver.
  let referenceStyle: BrandImageContext["referenceStyle"] = null;
  for (const r of refs ?? []) {
    try {
      const a = JSON.parse(r.ai_analysis as string);
      if (a?.visual_dna) {
        referenceStyle = {
          mood: a.visual_dna.mood,
          layout: a.visual_dna.layout,
          uso_de_foto: a.visual_dna.uso_de_foto,
        };
        break;
      }
    } catch { /* ignora análise inválida */ }
  }

  const identity = (brand?.identity ?? {}) as { colors?: { hex: string; role?: string }[] };
  const brandCtx: BrandImageContext = {
    description: brand?.description ?? null,
    colors: identity.colors,
    tone: voice?.tone ?? null,
    audience: voice?.target_audience ?? null,
    referenceStyle,
  };

  const slideTopic = topic?.trim() || (piece.title as string) || "tema do post";
  const prompt = buildImagePrompt(slideTopic, brandCtx);

  // Gera (Replicate ou Gemini direto)
  const result = await generateImage(model, prompt);
  if (result.error || (!result.url && !result.b64)) {
    return NextResponse.json({ error: result.error ?? "Falha na geração" }, { status: 502 });
  }

  // Persiste no Storage (URL do Replicate expira; Gemini vem em base64) via service role
  let publicUrl = result.url ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    try {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
        auth: { persistSession: false },
      });
      const bytes = result.b64
        ? new Uint8Array(Buffer.from(result.b64, "base64"))
        : new Uint8Array(await (await fetch(result.url!)).arrayBuffer());
      const path = `${piece.workspace_id}/${pieceId}/slide-${slideIndex}-${Date.now()}.png`;
      const { error: upErr } = await admin.storage
        .from("slide-images")
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (!upErr) {
        const { data: pub } = admin.storage.from("slide-images").getPublicUrl(path);
        if (pub?.publicUrl) publicUrl = pub.publicUrl;
      }
    } catch (err) {
      console.error("[images/generate] storage upload failed, using provider URL:", err);
    }
  }

  // Fallback: se não subiu pro Storage mas temos base64 (Gemini), usa data URL.
  if (!publicUrl && result.b64) {
    publicUrl = `data:image/png;base64,${result.b64}`;
  }
  if (!publicUrl) {
    return NextResponse.json({ error: "Imagem gerada mas falha ao salvar." }, { status: 502 });
  }

  // Registra custo + créditos
  await trackUsage({
    supabase,
    workspaceId: piece.workspace_id,
    userId: user.id,
    operation: "image_ai",
    model: getImageModel(model).key,
    units: 1,
    unitType: "image",
    metadata: { piece_id: pieceId, slide_index: slideIndex },
  });

  return NextResponse.json({ imageUrl: publicUrl });
}
