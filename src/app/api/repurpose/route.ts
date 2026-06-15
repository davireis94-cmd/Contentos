import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/anthropic";
import { extractJson } from "@/lib/ai/json";
import {
  buildRepurposeSystem,
  getRepurposeTargets,
  type RepurposeVariant,
} from "@/lib/skills/repurpose";
import { renderPostForCritic } from "@/lib/skills/content-critic";
import { renderExtrasForPrompt, type BrandExtras } from "@/lib/brand/extras";

export const runtime = "nodejs";
export const maxDuration = 90;

interface Body {
  pieceId: string;
  formats?: string[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.pieceId) return NextResponse.json({ error: "pieceId obrigatório" }, { status: 400 });

  const { data: piece } = await supabase
    .from("content_pieces")
    .select("title, format, slides, caption, hashtags, brand_id")
    .eq("id", body.pieceId)
    .maybeSingle();
  if (!piece) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });

  const [{ data: brand }, { data: voice }] = await Promise.all([
    supabase.from("brands").select("name, description, identity").eq("id", piece.brand_id).maybeSingle(),
    supabase
      .from("brand_voice")
      .select("tone, target_audience, content_pillars, characteristic_phrases, forbidden_words")
      .eq("brand_id", piece.brand_id)
      .maybeSingle(),
  ]);

  const extras = ((brand?.identity ?? {}) as { brain_extras?: BrandExtras }).brain_extras ?? {};
  const brandCtx = `\nVOZ DA MARCA:
Marca: ${brand?.name ?? ""}
Tom: ${voice?.tone || "(não definido)"}
Público: ${voice?.target_audience || "(não definido)"}
Pilares: ${voice?.content_pillars?.join(", ") || "(não definidos)"}
Frases características: ${voice?.characteristic_phrases?.join(" | ") || "(nenhuma)"}
Palavras proibidas: ${voice?.forbidden_words?.join(", ") || "(nenhuma)"}
${renderExtrasForPrompt(extras)}`;

  const targets = getRepurposeTargets(body.formats ?? []);
  const sourceText = renderPostForCritic({
    slides: (piece.slides ?? []) as { title?: string; subtitle?: string; body?: string; cta?: string }[],
    caption: piece.caption as string | undefined,
    hashtags: piece.hashtags as string[] | undefined,
    format: piece.format as string | undefined,
  });

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system: buildRepurposeSystem(brandCtx, targets),
      messages: [{ role: "user", content: `PEÇA ORIGINAL:\n\n${sourceText}` }],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const parsed = extractJson<{ variants?: { id: string; content: string }[] }>(raw);

    const labelById = new Map(targets.map((t) => [t.id, t.label]));
    const variants: RepurposeVariant[] = (parsed.variants ?? [])
      .filter((v) => v && typeof v.content === "string")
      .map((v) => ({ id: v.id, label: labelById.get(v.id) ?? v.id, content: v.content }));

    return NextResponse.json({ variants });
  } catch {
    return NextResponse.json({ error: "Falha ao reaproveitar" }, { status: 502 });
  }
}
