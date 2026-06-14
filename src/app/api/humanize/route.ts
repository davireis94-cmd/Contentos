import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

const HUMANIZER_SYSTEM = `Você é um especialista em reescrever textos gerados por IA para soarem genuinamente humanos, preservando o conteúdo e a voz da marca.

PADRÕES DE IA QUE VOCÊ DEVE ELIMINAR:
- Aberturas genéricas: "No mundo atual", "No cenário atual", "Vivemos em um momento", "No universo de"
- Convites vazios: "Vamos explorar", "Vamos descobrir", "Mergulhe comigo", "Vamos entender"
- Conclusões clichê: "Em conclusão", "Para finalizar", "Em resumo", "Recapitulando"
- Marcadores de IA: "É importante destacar", "Vale ressaltar", "É fundamental entender", "Não podemos ignorar"
- Conectivos mecânicos no início: "No entanto,", "Portanto,", "Além disso,", "Outrossim,"
- Adjetivos inflados: "revolucionário", "disruptivo", "transformador", "inovador", "robusto"
- Frases longas e simétricas que soam como template
- Passiva excessiva: "é possível perceber", "pode-se observar", "foi verificado"

O QUE FAZER:
- Comece direto ao ponto — sem rodeios
- Varie a estrutura e o tamanho das frases (não siga padrão)
- Mantenha imperfeições naturais (ênfase, repetição intencional)
- Preserve 100% da informação e a voz da marca informada
- Mantenha notas técnicas entre colchetes [assim] intactas (são instruções de produção/layout)

FORMATO DE SAÍDA — responda SOMENTE com JSON válido, sem markdown, com a MESMA estrutura recebida:
{
  "slides": [{ "index": 0, "title": "...", "subtitle": "...", "body": "...", "cta": "..." }],
  "caption": "...",
  "hashtags": ["#..."]
}
Reescreva apenas title/subtitle/body/cta/caption. NÃO altere hashtags, nem index, nem o número de slides, nem as notas [entre colchetes].`;

interface HumanizeSlide {
  index?: number;
  title?: string;
  subtitle?: string;
  body?: string;
  cta?: string;
  imageUrl?: string;
}
interface HumanizeOutput {
  slides?: HumanizeSlide[];
  caption?: string;
  hashtags?: string[];
  [k: string]: unknown;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json() as {
    output?: HumanizeOutput;
    brandVoice?: { tone?: string; target_audience?: string };
  };

  if (!body.output || !Array.isArray(body.output.slides)) {
    return NextResponse.json({ error: "output inválido" }, { status: 400 });
  }

  const voiceCtx = body.brandVoice
    ? `\nVOZ DA MARCA: Tom: ${body.brandVoice.tone || "não definido"} | Público: ${body.brandVoice.target_audience || "não definido"}`
    : "";

  // Envia só os campos de texto; preserva imageUrl/index do original.
  const payload = {
    slides: body.output.slides.map((s) => ({
      index: s.index,
      title: s.title,
      subtitle: s.subtitle,
      body: s.body,
      cta: s.cta,
    })),
    caption: body.output.caption ?? "",
    hashtags: body.output.hashtags ?? [],
  };

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: HUMANIZER_SYSTEM + voiceCtx,
      messages: [
        { role: "user", content: `Humanize este conteúdo preservando a estrutura JSON:\n\n${JSON.stringify(payload)}` },
      ],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Sem JSON");
    const humanized = JSON.parse(match[0]) as HumanizeOutput;

    // Recompõe preservando imageUrl/index originais e hashtags intactas.
    const slides = (humanized.slides ?? []).map((s, i) => ({
      ...body.output!.slides![i],
      title: s.title ?? body.output!.slides![i]?.title,
      subtitle: s.subtitle ?? body.output!.slides![i]?.subtitle,
      body: s.body ?? body.output!.slides![i]?.body,
      cta: s.cta ?? body.output!.slides![i]?.cta,
    }));

    const result = {
      ...body.output,
      slides,
      caption: humanized.caption ?? body.output.caption,
      hashtags: body.output.hashtags, // nunca mexe nas hashtags
    };

    return NextResponse.json({ output: result });
  } catch {
    return NextResponse.json({ error: "Falha ao humanizar" }, { status: 502 });
  }
}
