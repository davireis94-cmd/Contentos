import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type BrandExtras } from "@/lib/brand/extras";

export const runtime = "nodejs";

function section(title: string, value: string | string[] | undefined | null): string {
  if (!value || (Array.isArray(value) && value.length === 0)) return "";
  const content = Array.isArray(value) ? value.map((v, i) => `  ${i + 1}. ${v}`).join("\n") : `  ${value}`;
  return `\n## ${title}\n${content}\n`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brandId obrigatório" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [{ data: brand }, { data: voice }, { data: examples }] = await Promise.all([
    supabase.from("brands").select("name, description, website, logo_url, identity").eq("id", brandId).single(),
    supabase.from("brand_voice").select("*").eq("brand_id", brandId).maybeSingle(),
    supabase.from("brand_examples").select("content").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(5),
  ]);

  if (!brand) return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });

  const identity = (brand.identity ?? {}) as {
    brain_extras?: BrandExtras;
    colors?: string[];
    font_heading?: string;
    font_body?: string;
  };
  const extras = identity.brain_extras ?? {};
  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  let doc = `# BRAND BRAIN — ${brand.name.toUpperCase()}
Exportado em ${now} via Lumio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  doc += section("DESCRIÇÃO DA MARCA", brand.description);
  if (brand.website) doc += section("SITE", brand.website);

  doc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# VOZ E ESTRATÉGIA DE CONTEÚDO
`;
  doc += section("PÚBLICO-ALVO", voice?.target_audience);
  doc += section("TOM DE VOZ", voice?.tone);
  doc += section("PILARES DE CONTEÚDO", voice?.content_pillars);
  doc += section("FRASES CARACTERÍSTICAS", voice?.characteristic_phrases);
  doc += section("PALAVRAS/TEMAS PROIBIDOS", voice?.forbidden_words);

  doc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ESTRATÉGIA DE MARCA (AVANÇADO)
`;
  doc += section("INIMIGO / VILÃO DA MARCA", extras.enemy);
  doc += section("OPINIÕES FORTES", extras.strong_opinions);
  doc += section("HISTÓRIAS E PROVAS REAIS", extras.stories);
  doc += section("DORES DO PÚBLICO", extras.audience_pains);
  doc += section("DESEJOS DO PÚBLICO", extras.audience_desires);
  doc += section("OFERTAS E CTAs", extras.offers);
  doc += section("REFERÊNCIAS DE ESTILO", extras.style_references);

  doc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# IDENTIDADE VISUAL
`;
  doc += section("PALETA DE CORES", identity.colors);
  if (identity.font_heading || identity.font_body) {
    doc += section("FONTES", [
      identity.font_heading ? `Títulos: ${identity.font_heading}` : null,
      identity.font_body ? `Corpo: ${identity.font_body}` : null,
    ].filter(Boolean) as string[]);
  }
  if (brand.logo_url) doc += section("LOGO URL", brand.logo_url);

  if (examples?.length) {
    doc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EXEMPLOS DE CONTEÚDO (últimos ${examples.length})
`;
    examples.forEach((e, i) => {
      doc += `\n### Exemplo ${i + 1}\n${e.content}\n`;
    });
  }

  doc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gerado por Lumio · lumio.app
`;

  return new NextResponse(doc, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="brand-brain-${brand.name.toLowerCase().replace(/\s+/g, "-")}.txt"`,
    },
  });
}
