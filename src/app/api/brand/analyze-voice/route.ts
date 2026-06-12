import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { anthropic } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
};

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*?)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*?)["'][^>]*(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]?.trim()) return m[1].trim().replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  }
  return null;
}

function cleanInstagramCaption(desc: string): string {
  const m = desc.match(/on Instagram:\s*["']?([\s\S]+?)["']?$/i);
  return m?.[1]?.trim().replace(/["']$/, "").trim() ?? desc;
}

async function fetchPostText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Try Twitter oEmbed
    if (/twitter\.com|x\.com/.test(url)) {
      const oe = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`, {
        signal: AbortSignal.timeout(5000),
      });
      if (oe.ok) {
        const data = await oe.json() as { html?: string };
        const m = (data.html ?? "").match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        if (m) return m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      }
    }

    // TikTok oEmbed
    if (/tiktok\.com/.test(url)) {
      const oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (oe.ok) {
        const data = await oe.json() as { title?: string };
        return data.title ?? null;
      }
    }

    const desc = extractMeta(html, "og:description");
    if (!desc) return null;
    if (/instagram\.com/.test(url)) return cleanInstagramCaption(desc);
    return desc;
  } catch {
    return null;
  }
}

export interface VoiceSuggestions {
  tone: string;
  target_audience: string;
  content_pillars: string[];
  characteristic_phrases: string[];
  forbidden_words: string[];
  analysis_summary: string;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { brandId, posts } = await request.json() as {
    brandId: string;
    posts: { url?: string; text?: string }[];
  };

  if (!brandId || !posts?.length) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Fetch brand name for context
  const { data: brand } = await supabase
    .from("brands")
    .select("name, description")
    .eq("id", brandId)
    .single();

  // Collect post texts (from URLs or pasted text)
  const collectedTexts: string[] = [];
  const failedUrls: string[] = [];

  await Promise.all(
    posts.map(async (post, i) => {
      if (post.text?.trim()) {
        collectedTexts[i] = post.text.trim();
      } else if (post.url?.trim()) {
        const text = await fetchPostText(post.url.trim());
        if (text) {
          collectedTexts[i] = text;
        } else {
          failedUrls.push(post.url.trim());
        }
      }
    })
  );

  const validTexts = collectedTexts.filter(Boolean);
  if (validTexts.length === 0) {
    return NextResponse.json({
      error: "Não foi possível extrair conteúdo dos posts fornecidos. Tente colar os textos diretamente.",
    }, { status: 422 });
  }

  const postsBlock = validTexts
    .map((t, i) => `--- Post ${i + 1} ---\n${t}`)
    .join("\n\n");

  const systemPrompt = `Você é um especialista em brand voice e estratégia de comunicação digital.
Analise os posts abaixo de uma marca${brand?.name ? ` chamada "${brand.name}"` : ""} e extraia o padrão de comunicação para preencher o Brand Brain.

Retorne APENAS JSON válido, sem markdown:
{
  "tone": "conversational" | "authority" | "formal" | "minimalist",
  "target_audience": "descrição precisa do público-alvo baseada em quem os posts parecem falar",
  "content_pillars": ["3 a 5 pilares temáticos recorrentes nos posts"],
  "characteristic_phrases": ["4 a 8 expressões, bordões ou construções de frase típicas desta voz"],
  "forbidden_words": ["palavras ou clichês que contrastam com este estilo e devem ser evitados"],
  "analysis_summary": "2-3 frases resumindo o padrão de comunicação identificado"
}

Critérios:
- tone: "conversational" = amigável/próximo, "authority" = direto/assertivo/dados, "formal" = técnico/profissional, "minimalist" = frases curtas/editorial
- content_pillars: temas reais que aparecem, não genéricos ("Mentalidade" é genérico, "Gestão de equipe remota" é específico)
- characteristic_phrases: expressões REAIS que aparecem ou padrões sintáticos identificados
- forbidden_words: o que vai contra esse estilo (ex: se é minimalista, "incrível" e "inacreditável" são clichês a evitar)`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: `Posts para analisar:\n\n${postsBlock}` }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta inesperada da IA");

    const suggestions = JSON.parse(jsonMatch[0]) as VoiceSuggestions;

    return NextResponse.json({
      suggestions,
      analyzedCount: validTexts.length,
      failedUrls,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro inesperado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
