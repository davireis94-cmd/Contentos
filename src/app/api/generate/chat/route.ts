import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/anthropic";
import { type BrandExtras } from "@/lib/brand/extras";
import { renderExtrasForPrompt } from "@/lib/brand/extras";
import { renderPerformanceForPrompt, type PerformanceInsights } from "@/lib/brand/performance";

export const runtime = "nodejs";
export const maxDuration = 90;

interface ChatMsg { role: "user" | "assistant"; content: string }
interface Body { brandId: string; messages: ChatMsg[] }

const COLLECTOR_SYSTEM = `Você é um assistente de criação de conteúdo para Instagram. Sua função é, por CHAT, entender o que o usuário quer criar e então GERAR o conteúdo completo.

ROTEIRO DA CONVERSA (máx 3-4 perguntas no total):
1. Pergunta o TEMA/ASSUNTO do post (o que quer falar?)
2. Pergunta o FORMATO se não ficou claro (carrossel, reels, post único, stories)
3. Pergunta o ÂNGULO ou detalhe único que quere destacar (opcional — se já entendeu, pule)
4. GERA o conteúdo completo

REGRAS:
- Uma pergunta por vez, curta e direta
- Se o usuário já deu informação suficiente (tema + formato), GERE imediatamente
- Quando tiver o suficiente, avise "Entendido! Gerando agora…" e retorne ready: true
- Use o contexto da marca para adaptar tom, exemplos e vocabulário

FORMATO DE SAÍDA — JSON válido, sem markdown:
{
  "message": "sua próxima pergunta ou 'Entendido! Gerando agora…'",
  "ready": false,
  "brief": null
}

Quando ready = true, preencha brief com TUDO que coletou:
{
  "message": "Entendido! Gerando agora…",
  "ready": true,
  "brief": {
    "topic": "tema principal do post",
    "format": "carousel | reel | single | story",
    "angle": "ângulo específico, benefício ou ponto de vista único",
    "objective": "educate | engage | sell | inspire",
    "details": "qualquer detalhe extra mencionado pelo usuário"
  }
}`;

const GENERATOR_SYSTEM = `Você é um especialista em conteúdo para Instagram com a voz desta marca específica.

Gere um post completo no formato solicitado. Retorne JSON válido:

Para carousel:
{
  "slides": [
    {"title": "Hook poderoso", "subtitle": "opcional", "body": "corpo do slide", "cta": "opcional"},
    ...
  ],
  "caption": "legenda completa com emojis e chamada para ação",
  "hashtags": ["hashtag1", "hashtag2", ...]
}

Para reel/single/story use apenas 1 slide com title=hook, body=roteiro/texto, caption e hashtags.

DIRETRIZES:
- Hook no primeiro slide: provoca, surpreende ou faz uma promessa específica
- Tom e voz 100% da marca (use o contexto abaixo)
- Sem padrões de IA: sem "No mundo atual", "Vamos explorar", "Em conclusão"
- Linguagem direta, específica, com a personalidade da marca
- Caption com gancho, valor e CTA claro
- 5-10 hashtags relevantes misturando alcance e nicho`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json() as Body;
  if (!body.brandId) return NextResponse.json({ error: "brandId obrigatório" }, { status: 400 });

  const [{ data: brand }, { data: voice }] = await Promise.all([
    supabase.from("brands").select("name, description, identity, workspace_id").eq("id", body.brandId).single(),
    supabase.from("brand_voice").select("tone, target_audience, content_pillars, characteristic_phrases, forbidden_words").eq("brand_id", body.brandId).maybeSingle(),
  ]);

  if (!brand) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });
  const workspaceId = (brand as { workspace_id: string }).workspace_id;

  const identity = (brand.identity ?? {}) as { brain_extras?: BrandExtras; performance_insights?: PerformanceInsights };
  const extras = identity.brain_extras ?? {};
  const perf = renderPerformanceForPrompt(identity.performance_insights);

  const brandCtx = `MARCA: ${brand.name}
Descrição: ${brand.description || "(não definida)"}
Público: ${voice?.target_audience || "(não definido)"}
Tom: ${voice?.tone || "(não definido)"}
Pilares: ${voice?.content_pillars?.join(", ") || "(não definidos)"}
Frases características: ${voice?.characteristic_phrases?.join(" | ") || "(nenhuma)"}
Palavras proibidas: ${voice?.forbidden_words?.join(", ") || "(nenhuma)"}
${renderExtrasForPrompt(extras)}${perf ? `\n\nO QUE FUNCIONA COM ESTE PÚBLICO (dados reais — priorize):\n${perf}` : ""}`;

  const messages = body.messages.length
    ? body.messages
    : [{ role: "user" as const, content: "Quero criar um post" }];

  // Phase 1: collect brief via conversation
  const collectorMsg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `${COLLECTOR_SYSTEM}\n\n${brandCtx}`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const raw = collectorMsg.content[0]?.type === "text" ? collectorMsg.content[0].text : "";
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed: { message: string; ready: boolean; brief?: Record<string, string> | null } = {
    message: raw || "O que você quer criar hoje?",
    ready: false,
  };
  try {
    if (match) parsed = JSON.parse(match[0]);
  } catch { /* keep default */ }

  if (!parsed.ready || !parsed.brief) {
    return NextResponse.json({ message: parsed.message, ready: false, output: null });
  }

  // Phase 2: generate content with the collected brief
  const brief = parsed.brief;
  const genPrompt = `Gere um post de Instagram para a marca ${brand.name}.

BRIEFING:
- Tema: ${brief.topic}
- Formato: ${brief.format}
- Ângulo: ${brief.angle || "livre"}
- Objetivo: ${brief.objective || "engajar"}
- Detalhes extras: ${brief.details || "nenhum"}`;

  try {
    const genMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system: `${GENERATOR_SYSTEM}\n\n${brandCtx}`,
      messages: [{ role: "user", content: genPrompt }],
    });

    const genRaw = genMsg.content[0]?.type === "text" ? genMsg.content[0].text : "";
    const genMatch = genRaw.match(/\{[\s\S]*\}/);
    if (!genMatch) throw new Error("IA não retornou JSON");

    const output = JSON.parse(genMatch[0]);
    // Normaliza para o formato esperado pela UI e pela tabela.
    if (!Array.isArray(output.slides) || output.slides.length === 0) {
      output.slides = [{ title: output.title ?? brief.topic, body: output.body ?? "", cta: output.cta }];
    }
    // Garante index sequencial em cada slide (StreamOutput/render esperam).
    output.slides = output.slides.map((s: Record<string, unknown>, i: number) => ({ index: i, ...s }));
    if (!Array.isArray(output.hashtags)) output.hashtags = [];
    if (typeof output.caption !== "string") output.caption = "";
    output.format = brief.format ?? "single";

    // Salva em content_pieces no MESMO formato da geração normal (colunas
    // slides/caption/hashtags, status "scripted") — não existe coluna "output".
    const validObjectives = ["educate", "engage", "sell", "inspire"];
    const objective = validObjectives.includes(brief.objective) ? brief.objective : "engage";
    const { data: piece, error: insertError } = await supabase
      .from("content_pieces")
      .insert({
        workspace_id: workspaceId,
        brand_id: body.brandId,
        created_by: user.id,
        title: brief.topic.slice(0, 120),
        format: output.format,
        objective,
        status: "scripted",
        slides: output.slides,
        caption: output.caption,
        hashtags: output.hashtags,
      })
      .select("id")
      .single();

    if (insertError) console.error("[generate/chat] insert falhou:", insertError.message);

    return NextResponse.json({
      message: parsed.message,
      ready: true,
      output,
      pieceId: piece?.id ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro na geração" }, { status: 502 });
  }
}
