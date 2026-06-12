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

  const systemPrompt = `Você é um ghostwriter especialista refinando conteúdo para redes sociais.

REGRA ABSOLUTA: Responda SEMPRE e SOMENTE com o JSON completo atualizado — nunca com texto conversacional, perguntas, explicações ou markdown. Mesmo que o pedido seja ambíguo, faça a melhor interpretação possível e retorne o JSON.

MARCA: ${brand?.name ?? ""}
${brand?.description ? `Descrição: ${brand.description}` : ""}
${voice?.target_audience ? `Público-alvo: ${voice.target_audience}` : ""}
${voice?.tone ? `Tom de voz: ${voice.tone}` : ""}
${pillars ? `Pilares: ${pillars}` : ""}
${phrases ? `Frases características: ${phrases}` : ""}
${forbidden ? `Palavras PROIBIDAS: ${forbidden}` : ""}

CONTEÚDO ATUAL (modifique conforme o pedido do usuário):
${currentContent}

INSTRUÇÕES:
- Aplique exatamente o que o usuário pediu, mantendo a voz da marca
- Se o usuário mencionar "referência", "post de referência" ou algo similar que você não tem acesso, interprete o pedido pelo contexto e faça a modificação mais coerente possível
- Mantenha todos os campos [Layout: tipo] e notas de produção nos slides que não foram modificados
- Retorne o JSON completo — não apenas as partes modificadas

FORMATO DE SAÍDA (retorne EXATAMENTE esta estrutura, sem markdown, sem texto antes ou depois):
{"title":"...","format":"...","platform":"...","productionTool":"","slides":[{"index":0,"title":"...","subtitle":"...","body":"...[Layout: tipo]","cta":"..."}],"caption":"...","hashtags":["#..."]}`;

  // Extract JSON from model response, handling both raw and markdown-wrapped JSON
  function extractJson(text: string): string | null {
    const codeBlock = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlock) return codeBlock[1];
    const raw = text.match(/\{[\s\S]*\}/);
    return raw ? raw[0] : null;
  }

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
    const jsonStr = extractJson(text);
    if (!jsonStr) {
      console.error("[refine] No JSON in response. Raw text:", text.slice(0, 500));
      return NextResponse.json({ error: "A IA não retornou o conteúdo no formato esperado. Tente reformular o pedido." }, { status: 500 });
    }
    const rawObj = JSON.parse(jsonStr);
    rawObj.format = piece.format;
    // Ensure required schema fields that refine might omit
    if (!rawObj.platform) rawObj.platform = "instagram";
    if (rawObj.productionTool === undefined) rawObj.productionTool = "";

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
    console.error("[refine] Error:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    // Zod validation errors are verbose — show a friendlier message
    const isZod = msg.includes("ZodError") || msg.includes("Required") || msg.includes("invalid_type");
    return NextResponse.json({
      error: isZod ? "Formato inválido retornado pela IA. Tente novamente." : msg,
    }, { status: 500 });
  }
}
