import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/queries/context";
import { PageHeader } from "@/components/layout/page-header";
import { InstagramAnalytics } from "@/components/analytics/instagram-analytics";
import { PerformanceLearning } from "@/components/analytics/performance-learning";
import type { PerformanceInsights } from "@/lib/brand/performance";

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

  // Marca principal + aprendizados de desempenho já salvos
  const { data: brand } = await supabase
    .from("brands")
    .select("id, identity")
    .eq("workspace_id", workspace.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const performance = ((brand?.identity ?? {}) as { performance_insights?: PerformanceInsights })
    .performance_insights ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Métricas"
        description="Acompanhe o desempenho dos seus posts direto aqui. O app aprende o que funciona."
      />
      {conn && (
        <PerformanceLearning brandId={brand?.id ?? null} initial={performance} />
      )}
      <InstagramAnalytics
        isConnected={!!conn}
        username={conn?.username ?? null}
        justConnected={connected === "1"}
        connectError={error ?? null}
      />
    </div>
  );
}
