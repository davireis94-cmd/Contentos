import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/anthropic";
import { extractJson } from "@/lib/ai/json";
import { type BrandExtras } from "@/lib/brand/extras";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}
interface Body {
  brandId: string;
  messages: ChatMsg[];
}

interface Patch {
  description?: string;
  target_audience?: string;
  tone?: string;
  content_pillars?: string[];
  characteristic_phrases?: string[];
  forbidden_words?: string[];
  enemy?: string;
  strong_opinions?: string[];
  stories?: string[];
  audience_pains?: string[];
  audience_desires?: string[];
  offers?: string[];
  style_references?: string[];
  // identidade visual (salvo em brands.identity)
  colors?: string[]; // ex: ["#1A1A2E", "#E94560"]
  font_heading?: string;
  font_body?: string;
}

const SYSTEM = `Você é um estrategista de marca conduzindo, por CHAT, a construção do "Brand Brain" (memória da marca que alimenta a geração de conteúdo). Seu objetivo: extrair, de forma leve e acolhedora, tudo que a IA precisa pra escrever na voz e na estratégia da marca.

REGRAS DA CONVERSA:
- Fale em português, simples e humano. UMA pergunta por vez (no máximo duas curtas).
- Use o que já existe (campos preenchidos e DOCUMENTOS) pra NÃO repetir o que já se sabe.
- Quando faltar algo crítico, em vez de só perguntar, PROPONHA um rascunho baseado no que já sabe ("Pelo que entendi, seu público é X — confere?") e deixe a pessoa confirmar/ajustar.
- Seja específico ao contexto da marca; nada de perguntas genéricas.
- Cubra ao longo da conversa (na ordem): descrição da marca → público-alvo → tom de voz → pilares de conteúdo → frases características → palavras proibidas → inimigo/vilão → opiniões fortes → histórias/provas → dores e desejos do público → ofertas/CTAs → referências de estilo → identidade visual (cores e fontes — apenas se ainda não tiver).
- Para identidade visual: pergunte apenas se colors e fonts estão vazios. Se o usuário não tiver definido ainda, sugira uma paleta simples baseada no posicionamento ("Que tal começar com #1A1A2E (escuro elegante) e #E94560 (destaque vibrante)?") e deixe ele confirmar ou digitar os dele. Para fonte, sugira "Inter" como padrão seguro. O usuário pode refinar depois na aba Identidade.
- A cada resposta do usuário, EXTRAIA o que aprendeu para o "patch".

FORMATO DE SAÍDA — responda SEMPRE só com JSON válido, sem markdown:
{
  "message": "sua próxima fala no chat (acolhedora, 1 pergunta, com 1 exemplo curto entre parênteses se ajudar)",
  "patch": { campos aprendidos AGORA, só os que tiver certeza },
  "suggestions": ["2 a 4 respostas curtas/plausíveis pra pessoa TOCAR e responder rápido (adaptadas à pergunta e à marca)"],
  "done": false
}
Campos válidos do patch: description, target_audience, tone, content_pillars[], characteristic_phrases[], forbidden_words[], enemy, strong_opinions[], stories[], audience_pains[], audience_desires[], offers[], style_references[], colors[], font_heading, font_body.
Use "done": true só quando o cérebro estiver bem completo (voz + estratégia + visual básico), com uma mensagem de encerramento.`;

function arr(x: unknown): string[] {
  return Array.isArray(x) ? x.map((s) => String(s).trim()).filter(Boolean) : [];
}
function union(a: string[] = [], b: string[] = []): string[] {
  return Array.from(new Set([...a, ...b].map((s) => s.trim()).filter(Boolean)));
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  if (!body.brandId) return NextResponse.json({ error: "brandId obrigatório" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [{ data: brand }, { data: voice }, { data: docs }] = await Promise.all([
    supabase.from("brands").select("id, name, description, identity").eq("id", body.brandId).single(),
    supabase
      .from("brand_voice")
      .select("target_audience, tone, content_pillars, characteristic_phrases, forbidden_words")
      .eq("brand_id", body.brandId)
      .maybeSingle(),
    supabase
      .from("brand_documents")
      .select("extracted_content")
      .eq("brand_id", body.brandId)
      .not("extracted_content", "is", null),
  ]);
  if (!brand) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });

  const identity = (brand.identity ?? {}) as {
    brain_extras?: BrandExtras;
    colors?: string[];
    font_heading?: string;
    font_body?: string;
  };
  const extras = identity.brain_extras ?? {};

  const docText = (docs ?? [])
    .map((d) => {
      try { return JSON.parse(d.extracted_content as string); } catch { return null; }
    })
    .filter(Boolean)
    .map((e) => JSON.stringify(e))
    .join("\n")
    .slice(0, 4000);

  const stateContext = `ESTADO ATUAL DO CÉREBRO:
Nome: ${brand.name}
Descrição: ${brand.description || "(vazio)"}
Público: ${voice?.target_audience || "(vazio)"}
Tom de voz: ${voice?.tone || "(vazio)"}
Pilares: ${voice?.content_pillars?.join(", ") || "(vazio)"}
Frases: ${voice?.characteristic_phrases?.join(", ") || "(vazio)"}
Proibidas: ${voice?.forbidden_words?.join(", ") || "(vazio)"}
Cores: ${identity.colors?.join(", ") || "(vazio)"}
Fontes: ${[identity.font_heading, identity.font_body].filter(Boolean).join(", ") || "(vazio)"}
Avançado: ${JSON.stringify(extras)}
${docText ? `\nDOCUMENTOS DA MARCA (use para pré-preencher e sugerir):\n${docText}` : ""}`;

  const messages: ChatMsg[] = body.messages.length
    ? body.messages
    : [{ role: "user", content: "Oi! Vamos construir meu Brand Brain." }];

  let parsed: { message: string; patch?: Patch; suggestions?: string[]; done?: boolean };
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: `${SYSTEM}\n\n${stateContext}`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    try {
      parsed = extractJson(raw);
    } catch {
      parsed = { message: raw || "Pode me contar mais sobre sua marca?" };
    }
  } catch {
    return NextResponse.json({ error: "Falha ao conversar com a IA" }, { status: 502 });
  }

  // Aplica o patch (merge) ao cérebro.
  const p = parsed.patch ?? {};
  const updated: string[] = [];

  if (p.description?.trim() && !brand.description) {
    await supabase.from("brands").update({ description: p.description.trim() }).eq("id", body.brandId);
    updated.push("descrição");
  }

  const voiceUpdate: Record<string, unknown> = {};
  if (p.target_audience?.trim() && !voice?.target_audience) {
    voiceUpdate.target_audience = p.target_audience.trim();
    updated.push("público");
  }
  if (p.tone?.trim() && !voice?.tone) {
    voiceUpdate.tone = p.tone.trim();
    updated.push("tom de voz");
  }
  if (p.content_pillars?.length) {
    const merged = union(voice?.content_pillars ?? [], arr(p.content_pillars));
    if (merged.length > (voice?.content_pillars?.length ?? 0)) { voiceUpdate.content_pillars = merged; updated.push("pilares"); }
  }
  if (p.characteristic_phrases?.length) {
    const merged = union(voice?.characteristic_phrases ?? [], arr(p.characteristic_phrases));
    if (merged.length > (voice?.characteristic_phrases?.length ?? 0)) { voiceUpdate.characteristic_phrases = merged; updated.push("frases"); }
  }
  if (p.forbidden_words?.length) {
    const merged = union(voice?.forbidden_words ?? [], arr(p.forbidden_words));
    if (merged.length > (voice?.forbidden_words?.length ?? 0)) { voiceUpdate.forbidden_words = merged; updated.push("palavras proibidas"); }
  }
  if (Object.keys(voiceUpdate).length) {
    await supabase.from("brand_voice").upsert({ brand_id: body.brandId, ...voiceUpdate }, { onConflict: "brand_id" });
  }

  // Identidade visual
  const visualUpdate: Record<string, unknown> = {};
  if (p.colors?.length && !identity.colors?.length) {
    visualUpdate.colors = arr(p.colors);
    updated.push("cores");
  }
  if (p.font_heading?.trim() && !identity.font_heading) {
    visualUpdate.font_heading = p.font_heading.trim();
  }
  if (p.font_body?.trim() && !identity.font_body) {
    visualUpdate.font_body = p.font_body.trim();
  }

  const newExtras: BrandExtras = {
    enemy: extras.enemy?.trim() || p.enemy?.trim() || undefined,
    strong_opinions: union(extras.strong_opinions, arr(p.strong_opinions)),
    stories: union(extras.stories, arr(p.stories)),
    audience_pains: union(extras.audience_pains, arr(p.audience_pains)),
    audience_desires: union(extras.audience_desires, arr(p.audience_desires)),
    offers: union(extras.offers, arr(p.offers)),
    style_references: union(extras.style_references, arr(p.style_references)),
  };
  const extrasChanged = JSON.stringify(newExtras) !== JSON.stringify({
    enemy: extras.enemy,
    strong_opinions: extras.strong_opinions ?? [],
    stories: extras.stories ?? [],
    audience_pains: extras.audience_pains ?? [],
    audience_desires: extras.audience_desires ?? [],
    offers: extras.offers ?? [],
    style_references: extras.style_references ?? [],
  });

  if (extrasChanged || Object.keys(visualUpdate).length) {
    const newIdentity = { ...(identity as object), ...visualUpdate, brain_extras: newExtras };
    await supabase.from("brands").update({ identity: newIdentity }).eq("id", body.brandId);
    if (p.enemy || p.strong_opinions || p.stories || p.audience_pains || p.audience_desires || p.offers || p.style_references) {
      updated.push("estratégia");
    }
    if (Object.keys(visualUpdate).length) updated.push("identidade visual");
  }

  // Progresso (pós-patch): 6 campos de voz + 7 estratégia + 1 visual = 14.
  const effColors = (visualUpdate.colors as string[] | undefined) ?? identity.colors ?? [];
  const effTone = voiceUpdate.tone as string | undefined ?? voice?.tone;
  const eff = {
    description: brand.description || p.description,
    audience: voice?.target_audience || p.target_audience,
    tone: effTone,
    pillars: (voiceUpdate.content_pillars as string[]) ?? voice?.content_pillars ?? [],
    phrases: (voiceUpdate.characteristic_phrases as string[]) ?? voice?.characteristic_phrases ?? [],
    forbidden: (voiceUpdate.forbidden_words as string[]) ?? voice?.forbidden_words ?? [],
  };
  let filled = 0;
  if (eff.description) filled++;
  if (eff.audience) filled++;
  if (eff.tone) filled++;
  if (eff.pillars.length) filled++;
  if (eff.phrases.length) filled++;
  if (eff.forbidden.length) filled++;
  filled += [
    newExtras.enemy,
    newExtras.strong_opinions?.length,
    newExtras.stories?.length,
    newExtras.audience_pains?.length,
    newExtras.audience_desires?.length,
    newExtras.offers?.length,
    newExtras.style_references?.length,
  ].filter(Boolean).length;
  if (effColors.length) filled++;
  const total = 14;
  const phase = filled <= 3 ? "Fundação" : filled <= 7 ? "Essência" : filled <= 11 ? "Prova & conexão" : "Reta final";

  return NextResponse.json({
    message: parsed.message ?? "Vamos continuar?",
    done: parsed.done ?? false,
    updated,
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s) => typeof s === "string" && s.trim()).slice(0, 4)
      : [],
    progress: { filled, total, phase },
  });
}
