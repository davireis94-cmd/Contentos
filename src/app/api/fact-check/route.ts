import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/anthropic";
import { extractJson } from "@/lib/ai/json";
import { renderPostForCritic } from "@/lib/skills/content-critic";
import {
  FACTCHECK_SYSTEM,
  WEB_SEARCH_TOOL,
  extractFinalText,
  type FactCheckResult,
} from "@/lib/skills/deep-research";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  output: {
    slides?: { title?: string; subtitle?: string; body?: string; cta?: string }[];
    caption?: string;
    hashtags?: string[];
    format?: string;
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.output?.slides) {
    return NextResponse.json({ error: "output inválido" }, { status: 400 });
  }

  const postText = renderPostForCritic(body.output);

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system: FACTCHECK_SYSTEM,
      tools: [WEB_SEARCH_TOOL],
      messages: [{ role: "user", content: `Cheque os fatos deste post:\n\n${postText}` }],
    });
    const raw = extractFinalText(msg);
    const result = extractJson<FactCheckResult>(raw);

    result.verdict = typeof result.verdict === "string" ? result.verdict : "Sem veredito.";
    result.riskLevel = ["baixo", "médio", "alto"].includes(result.riskLevel) ? result.riskLevel : "baixo";
    result.claims = Array.isArray(result.claims) ? result.claims.slice(0, 6) : [];
    return NextResponse.json({ result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ error: `Falha ao checar fatos: ${detail.slice(0, 200)}` }, { status: 502 });
  }
}
