"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeBrandScore } from "@/lib/brand-score";
import { extractDocumentContent } from "@/lib/ai/extract-document";

async function recomputeScore(brandId: string) {
  const supabase = await createClient();

  const [{ data: brand }, { data: voice }, refs, examples] = await Promise.all([
    supabase
      .from("brands")
      .select("logo_url, description, identity")
      .eq("id", brandId)
      .single(),
    supabase
      .from("brand_voice")
      .select("target_audience, content_pillars, characteristic_phrases, forbidden_words")
      .eq("brand_id", brandId)
      .maybeSingle(),
    supabase
      .from("brand_references")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId),
    supabase
      .from("brand_examples")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId),
  ]);

  if (!brand) return;

  const identity = (brand.identity ?? {}) as {
    colors?: string[];
    font_heading?: string;
    font_body?: string;
  };

  const score = computeBrandScore({
    hasLogo: !!brand.logo_url,
    colorsCount: identity.colors?.length ?? 0,
    hasFonts: !!(identity.font_heading || identity.font_body),
    hasDescription: !!brand.description,
    hasAudience: !!voice?.target_audience,
    pillarsCount: voice?.content_pillars?.length ?? 0,
    phrasesCount: voice?.characteristic_phrases?.length ?? 0,
    forbiddenCount: voice?.forbidden_words?.length ?? 0,
    referencesCount: refs.count ?? 0,
    examplesCount: examples.count ?? 0,
  });

  await supabase.from("brands").update({ brand_score: score }).eq("id", brandId);
}

export async function createBrand(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = formData.get("workspaceId") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = ((formData.get("description") as string) ?? "").trim();

  if (!name) {
    redirect("/brands/new?error=" + encodeURIComponent("Dê um nome à marca."));
  }

  const brandId = crypto.randomUUID();

  const { error } = await supabase.from("brands").insert({
    id: brandId,
    workspace_id: workspaceId,
    name,
    description: description || null,
  });

  if (error) {
    redirect("/brands/new?error=" + encodeURIComponent("Não foi possível criar a marca."));
  }

  await supabase.from("brand_voice").insert({ brand_id: brandId });
  await recomputeScore(brandId);

  revalidatePath("/brands");
  redirect(`/brands/${brandId}`);
}

export async function updateIdentity(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;

  const colors = JSON.parse((formData.get("colors") as string) || "[]") as string[];

  const { error } = await supabase
    .from("brands")
    .update({
      name: (formData.get("name") as string)?.trim(),
      description: ((formData.get("description") as string) ?? "").trim() || null,
      website: ((formData.get("website") as string) ?? "").trim() || null,
      identity: {
        colors,
        font_heading: ((formData.get("fontHeading") as string) ?? "").trim() || null,
        font_body: ((formData.get("fontBody") as string) ?? "").trim() || null,
      },
    })
    .eq("id", brandId);

  if (!error) await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function updateLogoUrl(brandId: string, logoUrl: string) {
  const supabase = await createClient();
  await supabase.from("brands").update({ logo_url: logoUrl }).eq("id", brandId);
  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function updateVoice(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;

  const parse = (key: string) =>
    JSON.parse((formData.get(key) as string) || "[]") as string[];

  const { error } = await supabase
    .from("brand_voice")
    .update({
      tone: formData.get("tone") as string,
      target_audience:
        ((formData.get("targetAudience") as string) ?? "").trim() || null,
      content_pillars: parse("pillars"),
      characteristic_phrases: parse("phrases"),
      forbidden_words: parse("forbidden"),
    })
    .eq("brand_id", brandId);

  if (!error) await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function addReference(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  await supabase.from("brand_references").insert({
    brand_id: brandId,
    name,
    handle: ((formData.get("handle") as string) ?? "").trim() || null,
    platforms: JSON.parse((formData.get("platforms") as string) || "[]"),
    notes: ((formData.get("notes") as string) ?? "").trim() || null,
  });

  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function deleteReference(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;
  await supabase
    .from("brand_references")
    .delete()
    .eq("id", formData.get("referenceId") as string);
  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function addExample(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;
  const content = (formData.get("content") as string)?.trim();
  if (!content) return;

  // embedding fica null por enquanto — gerado no Sprint 2 junto com o Generator
  await supabase.from("brand_examples").insert({ brand_id: brandId, content });

  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function deleteExample(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;
  await supabase
    .from("brand_examples")
    .delete()
    .eq("id", formData.get("exampleId") as string);
  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function applyDocumentsToBrand(
  brandId: string
): Promise<{ updated: string[]; error?: string }> {
  const supabase = await createClient();

  // Fetch all documents with extracted content
  const { data: docs } = await supabase
    .from("brand_documents")
    .select("extracted_content")
    .eq("brand_id", brandId)
    .not("extracted_content", "is", null);

  if (!docs || docs.length === 0) {
    return { updated: [], error: "Nenhum documento com conteúdo extraído encontrado." };
  }

  type Extracted = {
    resumo?: string;
    publico_alvo?: string;
    pilares?: string[];
    frases_chave?: string[];
    palavras_evitar?: string[];
  };

  const extracted: Extracted[] = docs
    .map((d) => {
      try {
        return d.extracted_content ? JSON.parse(d.extracted_content) : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (extracted.length === 0) {
    return { updated: [], error: "Não foi possível processar os documentos." };
  }

  // Fetch current brand + voice
  const [{ data: brand }, { data: voice }] = await Promise.all([
    supabase.from("brands").select("description").eq("id", brandId).single(),
    supabase.from("brand_voice").select("*").eq("brand_id", brandId).maybeSingle(),
  ]);

  const updated: string[] = [];

  // Build merged arrays (union with existing, deduplicated)
  const mergeArray = (existing: string[], incoming: string[]): string[] =>
    [...new Set([...existing, ...incoming.filter((s) => s?.trim())])];

  const newPillars = mergeArray(
    voice?.content_pillars ?? [],
    extracted.flatMap((e) => e.pilares ?? [])
  );
  const newPhrases = mergeArray(
    voice?.characteristic_phrases ?? [],
    extracted.flatMap((e) => e.frases_chave ?? [])
  );
  const newForbidden = mergeArray(
    voice?.forbidden_words ?? [],
    extracted.flatMap((e) => e.palavras_evitar ?? [])
  );

  const voiceUpdate: Record<string, unknown> = {};

  if (newPillars.length > (voice?.content_pillars?.length ?? 0)) {
    voiceUpdate.content_pillars = newPillars;
    updated.push(`Pilares de conteúdo (+${newPillars.length - (voice?.content_pillars?.length ?? 0)})`);
  }
  if (newPhrases.length > (voice?.characteristic_phrases?.length ?? 0)) {
    voiceUpdate.characteristic_phrases = newPhrases;
    updated.push(`Frases características (+${newPhrases.length - (voice?.characteristic_phrases?.length ?? 0)})`);
  }
  if (newForbidden.length > (voice?.forbidden_words?.length ?? 0)) {
    voiceUpdate.forbidden_words = newForbidden;
    updated.push(`Palavras proibidas (+${newForbidden.length - (voice?.forbidden_words?.length ?? 0)})`);
  }

  // Target audience — only fill if empty
  if (!voice?.target_audience) {
    const audience = extracted.find((e) => e.publico_alvo?.trim())?.publico_alvo;
    if (audience) {
      voiceUpdate.target_audience = audience;
      updated.push("Público-alvo");
    }
  }

  if (Object.keys(voiceUpdate).length > 0) {
    await supabase.from("brand_voice").update(voiceUpdate).eq("brand_id", brandId);
  }

  // Brand description — only fill if empty
  if (!brand?.description) {
    const resumo = extracted.find((e) => e.resumo?.trim())?.resumo;
    if (resumo) {
      await supabase.from("brands").update({ description: resumo }).eq("id", brandId);
      updated.push("Descrição da marca");
    }
  }

  if (updated.length > 0) {
    await recomputeScore(brandId);
    revalidatePath(`/brands/${brandId}`);
  }

  return { updated };
}

export async function reprocessDocuments(
  brandId: string
): Promise<{ processed: number; failed: number; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { processed: 0, failed: 0, error: "ANTHROPIC_API_KEY não configurada." };
  }

  const supabase = await createClient();

  const { data: docs } = await supabase
    .from("brand_documents")
    .select("id, name, file_type, storage_path")
    .eq("brand_id", brandId)
    .is("extracted_content", null);

  if (!docs || docs.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      const { data: fileData, error: dlError } = await supabase.storage
        .from("brand-docs")
        .download(doc.storage_path);

      if (dlError || !fileData) {
        failed++;
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      const extracted = await extractDocumentContent(buffer, doc.file_type, doc.name);

      await supabase
        .from("brand_documents")
        .update({ extracted_content: extracted })
        .eq("id", doc.id);

      processed++;
    } catch {
      failed++;
    }
  }

  if (processed > 0) revalidatePath(`/brands/${brandId}`);

  return { processed, failed };
}

export type Suggestion = {
  topic: string;
  hook: string;
  format: string;
  pillar: string;
  rationale: string;
};

export async function generateBrandSuggestions(
  brandId: string
): Promise<{ suggestions?: Suggestion[]; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      error:
        "ANTHROPIC_API_KEY não configurada. Adicione a chave nas variáveis de ambiente do Vercel para ativar esta funcionalidade.",
    };
  }

  const supabase = await createClient();

  const [{ data: brand }, { data: voice }, { data: references }, { data: examples }] =
    await Promise.all([
      supabase.from("brands").select("name, description").eq("id", brandId).single(),
      supabase
        .from("brand_voice")
        .select("target_audience, tone, content_pillars, characteristic_phrases")
        .eq("brand_id", brandId)
        .maybeSingle(),
      supabase
        .from("brand_references")
        .select("name, handle, platforms, notes, ai_analysis")
        .eq("brand_id", brandId),
      supabase
        .from("brand_examples")
        .select("content")
        .eq("brand_id", brandId)
        .limit(3),
    ]);

  if (!brand) return { error: "Marca não encontrada." };

  if (!references || references.length === 0) {
    return { error: "NO_REFERENCES" };
  }

  const refText = references
    .map(
      (r) =>
        `• ${r.name}${r.handle ? ` (${r.handle})` : ""}${r.platforms?.length ? ` — ${r.platforms.join(", ")}` : ""}\n  ${r.ai_analysis ?? r.notes ?? "Sem análise disponível"}`
    )
    .join("\n\n");

  const brandCtx = [
    `Marca: ${brand.name}`,
    brand.description && `Descrição: ${brand.description}`,
    voice?.target_audience && `Público-alvo: ${voice.target_audience}`,
    voice?.tone && `Tom de voz: ${voice.tone}`,
    voice?.content_pillars?.length && `Pilares: ${voice.content_pillars.join(", ")}`,
    examples?.length &&
      `Exemplos de escrita:\n${examples.map((e) => `"${e.content.slice(0, 120)}..."`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Você é um estrategista de conteúdo digital especializado em análise competitiva para criadores e marcas pessoais no Brasil.

PERFIL DA MARCA:
${brandCtx}

REFERÊNCIAS DE MERCADO (concorrentes / inspirações):
${refText}

TAREFA:
Com base na análise dessas referências e no perfil da marca, gere 5 sugestões de conteúdo de alto potencial para ${brand.name}.

Para cada sugestão:
1. Identifique um ângulo específico que está gerando engajamento nas referências
2. Adapte para a voz e o posicionamento único de ${brand.name}
3. Crie um hook de abertura que para o scroll (máx. 15 palavras, linguagem direta)
4. Escolha o formato mais adequado para esse ângulo

RESPONDA APENAS com um array JSON válido, sem markdown, sem texto adicional:
[
  {
    "topic": "tema/ângulo específico do conteúdo (1 linha concisa)",
    "hook": "frase de abertura que para o scroll",
    "format": "carrossel|reel|story|post",
    "pillar": "pilar de conteúdo que esta sugestão representa",
    "rationale": "por que este ângulo vai funcionar para esta marca (1 linha)"
  }
]`;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { error: "Resposta inesperada da IA. Tente novamente." };

    const suggestions: Suggestion[] = JSON.parse(jsonMatch[0]);
    return { suggestions };
  } catch {
    return { error: "Erro ao gerar sugestões. Tente novamente." };
  }
}
