import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { anthropic } from "@/lib/ai/anthropic";
import { extractJson } from "@/lib/ai/json";
import { fetchInstagramProfiles } from "@/lib/trends/instagram-trends";

export const runtime = "nodejs";
export const maxDuration = 90;

type ImgBlock = {
  type: "image";
  source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string };
};

/** Baixa uma imagem (server-side, sem Referer) e devolve bloco base64 p/ visão. */
async function fetchImageBlock(url: string): Promise<ImgBlock | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const media =
      ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_500_000) return null; // limite de segurança
    return { type: "image", source: { type: "base64", media_type: media as ImgBlock["source"]["media_type"], data: buf.toString("base64") } };
  } catch {
    return null;
  }
}

/** Extrai o DNA visual das melhores imagens da referência (Claude com visão). */
async function extractVisualDna(handle: string): Promise<Record<string, unknown> | null> {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  try {
    const posts = await fetchInstagramProfiles([clean], 4);
    const urls = posts.map((p) => p.thumbnailUrl).filter((u): u is string => !!u).slice(0, 3);
    if (urls.length === 0) return null;

    const blocks = (await Promise.all(urls.map(fetchImageBlock))).filter((b): b is ImgBlock => !!b);
    if (blocks.length === 0) return null;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Estas são imagens reais dos melhores posts de @${clean}. Extraia o DNA VISUAL para guiar (não copiar) a criação de conteúdo on-brand. Responda SOMENTE JSON:
{
  "paleta": ["#hex aproximado", "..."],
  "mood": "descrição curta do clima visual (ex: escuro premium, claro e clean)",
  "layout": "como o texto e a imagem se organizam (ex: título grande embaixo sobre foto)",
  "tipografia": "estilo da fonte percebido (ex: serifada display + sans no corpo)",
  "uso_de_foto": "ex: sempre com pessoa / produto / só tipografia",
  "densidade_texto": "pouco / médio / muito"
}`,
            },
            ...blocks,
          ],
        },
      ],
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    return extractJson<Record<string, unknown>>(raw);
  } catch {
    return null;
  }
}

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
    const analysisObj = extractJson<Record<string, unknown>>(text);

    // DNA visual via visão (Instagram): enriquece a análise sem quebrar se falhar.
    const isInstagram = (platforms ?? []).includes("instagram");
    if (isInstagram && handle) {
      const visualDna = await extractVisualDna(handle);
      if (visualDna) analysisObj.visual_dna = visualDna;
    }

    const analysis = JSON.stringify(analysisObj);
    await supabase
      .from("brand_references")
      .update({ ai_analysis: analysis })
      .eq("id", referenceId);

    return NextResponse.json({ analysis: analysisObj });
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Erro ao analisar" }, { status: 500 });
  }
}
