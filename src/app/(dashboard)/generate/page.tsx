import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { BriefForm } from "@/components/generate/brief-form";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string; ref?: string; topic?: string; ext?: string; trendId?: string }>;
}) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { brandId, ref, topic, ext, trendId } = await searchParams;

  const [{ data: brands }, { data: recentPieces }, trendResult] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name, logo_url")
      .eq("workspace_id", workspace.id)
      .order("name"),
    supabase
      .from("content_pieces")
      .select("id, title, format, brands(name)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(30),
    trendId
      ? supabase
          .from("benchmark_content")
          .select("title, description, notes, transcript, source_url, platform, format")
          .eq("id", trendId)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const trend = trendResult.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Gerar conteúdo"
        description="Preencha o briefing e a IA cria o post completo no estilo da sua marca."
      />
      <BriefForm
        brands={brands ?? []}
        defaultBrandId={brandId}
        recentPieces={(recentPieces ?? []).map((p) => ({
          id: p.id,
          title: p.title,
          format: p.format,
          brandName: Array.isArray(p.brands)
            ? (p.brands[0] as { name: string } | null)?.name ?? null
            : (p.brands as { name: string } | null)?.name ?? null,
        }))}
        defaultRefId={ref}
        defaultTopic={topic ?? trend?.title ?? undefined}
        defaultExt={!!ext}
        trendContext={trend ?? undefined}
      />
    </div>
  );
}
