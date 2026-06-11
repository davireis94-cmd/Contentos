import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { anthropic } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-COLE")) {
    return NextResponse.json({ error: "API key não configurada" }, { status: 503 });
  }

  const { referenceId, name, handle, platforms, notes, brandVoice } = await request.json();

  const platformList = (platforms ?? []).join(", ") || "não informado";
  const notesSection = notes ? `\nNotas adicionadas pelo usuário: ${notes}` : "";
  const voiceSection = brandVoice
    ? `\nA marca do usuário tem tom: ${brandVoice.tone}, público-alvo: ${brandVoice.target_audience || "não definido"}, pilares: ${brandVoice.content_pillars?.join(", ") || "não definidos"}.`
    : "";

  const prompt = `Analise o seguinte criador/marca de referência e gere insights estratégicos.

REFERÊNCIA: ${name}
Handle: ${handle || "não informado"}
Plataformas: ${platformList}${notesSection}${voiceSection}

Com base no que você sabe sobre ${name} (se for uma figura pública conhecida) e nas notas fornecidas, retorne APENAS este JSON:
{
  "estrategia": "como esse criador usa conteúdo para crescer e engajar (2-3 frases)",
  "estilo": "tom de comunicação e estilo visual observados",
  "pontos_fortes": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "formatos_frequentes": ["formato1", "formato2"],
  "licoes": ["lição 1 para aplicar na sua marca", "lição 2", "lição 3"],
  "sugestoes": [
    {"tema": "ideia de conteúdo inspirada nesta referência", "formato": "carousel", "objetivo": "educate"},
    {"tema": "segunda ideia de conteúdo", "formato": "reel", "objetivo": "engage"},
    {"tema": "terceira ideia de conteúdo", "formato": "single", "objetivo": "inspire"}
  ]
}

Formatos válidos: carousel, reel, story, single
Objetivos válidos: educate, engage, sell, inspire
Retorne APENAS o JSON, sem markdown.`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    const analysis = match ? match[0] : text;

    // Save to DB
    await supabase
      .from("brand_references")
      .update({ ai_analysis: analysis })
      .eq("id", referenceId);

    return NextResponse.json({ analysis: JSON.parse(analysis) });
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Erro ao analisar" }, { status: 500 });
  }
}
