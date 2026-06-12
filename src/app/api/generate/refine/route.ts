import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { anthropic } from "@/lib/ai/anthropic";
import { generationOutputSchema } from "@/lib/validations/generation";

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

  const { pieceId, message, history } = await request.json() as {
    pieceId: string;
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  if (!pieceId || !message?.trim()) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { data: piece } = await supabase
    .from("content_pieces")
    .select("brand_id, workspace_id, format, slides, caption, hashtags")
    .eq("id", pieceId)
    .single();

  if (!piece) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });

  const [{ data: brand }, { data: voice }] = await Promise.all([
    supabase.from("brands").select("name, description").eq("id", piece.brand_id).single(),
    supabase
      .from("brand_voice")
      .select("tone, target_audience, content_pillars, characteristic_phrases, forbidden_words")
      .eq("brand_id", piece.brand_id)
      .maybeSingle(),
  ]);

  const currentContent = JSON.stringify(
    { slides: piece.slides, caption: piece.caption, hashtags: piece.hashtags },
    null,
    2
  );

  const pillars = voice?.content_pillars?.join(", ") || "";
  const phrases = voice?.characteristic_phrases?.join(", ") || "";
  const forbidden = voice?.forbidden_words?.join(", ") || "";

  const systemPrompt = `Você é um ghostwriter especialista refinando um conteúdo para redes sociais.

MARCA: ${brand?.name ?? ""}
${brand?.description ? `Descrição: ${brand.description}` : ""}
${voice?.target_audience ? `Público-alvo: ${voice.target_audience}` : ""}
${voice?.tone ? `Tom de voz: ${voice.tone}` : ""}
${pillars ? `Pilares: ${pillars}` : ""}
${phrases ? `Frases características (use quando encaixar): ${phrases}` : ""}
${forbidden ? `Palavras PROIBIDAS (nunca use): ${forbidden}` : ""}

CONTEÚDO ATUAL:
${currentContent}

Aplique as alterações pedidas pelo usuário mantendo a voz da marca.
Retorne APENAS o JSON completo atualizado — mesma estrutura: title, format, slides (array com index, title, subtitle?, body, cta?), caption, hashtags.
Sem markdown, sem explicações fora do JSON.`;

  try {
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...(history ?? []),
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "Resposta inesperada da IA." }, { status: 500 });

    const rawObj = JSON.parse(jsonMatch[0]);
    rawObj.format = piece.format;

    if (Array.isArray(rawObj.hashtags)) {
      rawObj.hashtags = rawObj.hashtags
        .map((h: unknown) => {
          if (typeof h !== "string") return null;
          const clean = h.replace(/\s+/g, "").replace(/[^\p{L}\p{N}_#]/gu, "");
          return clean.startsWith("#") ? clean : `#${clean}`;
        })
        .filter((h: string | null): h is string => !!h && h.length > 2);
    }

    const parsed = generationOutputSchema.parse(rawObj);

    await supabase
      .from("content_pieces")
      .update({
        title: parsed.title,
        slides: parsed.slides,
        caption: parsed.caption,
        hashtags: parsed.hashtags,
        status: "scripted",
      })
      .eq("id", pieceId);

    return NextResponse.json({ output: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
