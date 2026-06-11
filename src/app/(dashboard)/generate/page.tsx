import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { BriefForm } from "@/components/generate/brief-form";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { brandId } = await searchParams;

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, logo_url")
    .eq("workspace_id", workspace.id)
    .order("name");

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Gerar conteúdo"
        description="Preencha o briefing e a IA cria o post completo no estilo da sua marca."
      />
      <BriefForm brands={brands ?? []} defaultBrandId={brandId} />
    </div>
  );
}
