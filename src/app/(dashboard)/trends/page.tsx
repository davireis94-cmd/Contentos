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

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Tendências & Referências"
        description="Vídeos e posts virais do mercado. Use como base para gerar conteúdo similar com IA."
      />
      <TrendsClient
        trends={(trends ?? []) as Trend[]}
        currentUserId={user.id}
      />
    </div>
  );
}
