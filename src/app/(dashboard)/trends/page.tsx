import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/queries/context";
import { PageHeader } from "@/components/layout/page-header";
import { TrendsClient } from "@/components/trends/trends-client";
import type { Trend } from "@/components/trends/trends-client";

export default async function TrendsPage() {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  // Fetch workspace trends + global (workspace_id is null) trends
  const { data: trends } = await supabase
    .from("benchmark_content")
    .select("id, title, description, source_url, thumbnail_url, format, platform, topic_tags, notes, transcript, added_by, workspace_id, created_at, source, niche, author, published_at, metrics")
    .or(`workspace_id.eq.${workspace.id},workspace_id.is.null`)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  // Palavras-chave do nicho da marca (Brand Brain) p/ personalizar as tendências.
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, description")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let brandKeywords: string[] = [];
  if (brand?.id) {
    const { data: voice } = await supabase
      .from("brand_voice")
      .select("target_audience, content_pillars")
      .eq("brand_id", brand.id)
      .maybeSingle();
    brandKeywords = buildKeywords([
      brand.name,
      brand.description,
      voice?.target_audience,
      ...(voice?.content_pillars ?? []),
    ]);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Tendências & Referências"
        description="Vídeos e posts virais do mercado. Use como base para gerar conteúdo similar com IA."
      />
      <TrendsClient
        trends={(trends ?? []) as Trend[]}
        currentUserId={user.id}
        brandKeywords={brandKeywords}
      />
    </div>
  );
}

/** Extrai palavras-chave relevantes (>3 letras, sem stopwords) dos textos da marca. */
const STOPWORDS = new Set([
  "para","com","que","dos","das","uma","seu","sua","por","mais","como","sobre",
  "the","and","for","with","você","voce","nas","nos","aos","pra","ser","tem",
]);
function buildKeywords(texts: (string | null | undefined)[]): string[] {
  const words = texts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words)).slice(0, 30);
}
