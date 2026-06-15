import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { ReferencesTab } from "@/app/(dashboard)/brands/[brandId]/tabs/references-tab";

export default async function ReferencesPage() {
  const { supabase, workspace } = await getSessionContext();
  if (!workspace) return null;

  // Pega a primeira marca do workspace (a principal)
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!brand) redirect("/brands/new");

  const [{ data: references }, { data: voice }] = await Promise.all([
    supabase
      .from("brand_references")
      .select("id, name, handle, platforms, notes, ai_analysis")
      .eq("brand_id", brand.id)
      .order("created_at"),
    supabase
      .from("brand_voice")
      .select("tone, target_audience, content_pillars")
      .eq("brand_id", brand.id)
      .maybeSingle(),
  ]);

  return (
    <>
      <PageHeader
        title="Benchmark"
        description={`Perfis que inspiram o conteúdo de ${brand.name} — a IA usa a estratégia e o estilo deles ao gerar. Veja os melhores posts e gere similar.`}
      />
      <div className="flex-1 p-6">
        <ReferencesTab
          brandId={brand.id}
          references={references ?? []}
          voice={voice ?? null}
        />
      </div>
    </>
  );
}
