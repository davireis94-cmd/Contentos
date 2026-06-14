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
- Bullet points paralelos demais (todos com a mesma estrutura gramatical)
- Frases longas e simétricas que soam como template
- Passiva excessiva: "é possível perceber", "pode-se observar", "foi verificado"
- Frases de efeito genéricas: "sucesso não acontece da noite para o dia"

O QUE FAZER:
- Comece direto ao ponto — sem rodeios
- Use frases curtas quando o conteúdo for forte, longas quando quiser ritmo
- Varie a estrutura das frases (não siga padrão)
- Mantenha imperfeições naturais (repetição intencional, ênfase com vírgula)
- Preserve 100% da informação e estrutura do conteúdo original
- Mantenha o tom e voz da marca informada no contexto
- Para slides de carrossel: mantenha o número de slides, títulos e CTAs
- Não mude hashtags

RETORNE o texto humanizado com a MESMA estrutura do input, apenas o conteúdo reescrito.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json() as {
    text: string;
    brandVoice?: { tone?: string; target_audience?: string };
  };

  if (!body.text?.trim()) return NextResponse.json({ error: "text obrigatório" }, { status: 400 });

  const voiceCtx = body.brandVoice
    ? `\nVOZ DA MARCA: Tom: ${body.brandVoice.tone || "não definido"} | Público: ${body.brandVoice.target_audience || "não definido"}`
    : "";

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: HUMANIZER_SYSTEM + voiceCtx,
      messages: [
        {
          role: "user",
          content: `Humanize este texto preservando toda a estrutura e informação:\n\n${body.text}`,
        },
      ],
    });

    const humanized = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : body.text;
    return NextResponse.json({ humanized });
  } catch {
    return NextResponse.json({ error: "Falha ao humanizar" }, { status: 502 });
  }
}
