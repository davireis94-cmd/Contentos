import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/queries/context";
import { PageHeader } from "@/components/layout/page-header";
import { InstagramAnalytics } from "@/components/analytics/instagram-analytics";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { connected, error } = await searchParams;

  // Lê só dados públicos da conexão (NUNCA o token)
  const { data: conn } = await supabase
    .from("social_connections")
    .select("username, meta")
    .eq("workspace_id", workspace.id)
    .eq("platform", "instagram")
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Métricas"
        description="Acompanhe o desempenho dos seus posts direto aqui. O app aprende o que funciona."
      />
      <InstagramAnalytics
        isConnected={!!conn}
        username={conn?.username ?? null}
        justConnected={connected === "1"}
        connectError={error ?? null}
      />
    </div>
  );
}
