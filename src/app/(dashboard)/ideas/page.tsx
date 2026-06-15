import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { IdeasClient } from "@/components/ideas/ideas-client";

export default async function IdeasPage() {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Ideias de pauta"
        description="Um lote de pautas cruzando a voz da sua marca, as tendências do nicho e o que já performou."
      />
      <IdeasClient brands={brands ?? []} />
    </div>
  );
}
