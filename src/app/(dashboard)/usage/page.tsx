import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/queries/context";
import { PageHeader } from "@/components/layout/page-header";
import { UsageDashboard } from "@/components/billing/usage-dashboard";
import { getUsageSummary } from "@/lib/billing/track";
import { PLANS, USD_TO_BRL } from "@/lib/billing/pricing";

export default async function UsagePage() {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const usage = await getUsageSummary(supabase, workspace.id);
  const plan = PLANS[workspace.plan] ?? PLANS.free;

  const now = new Date();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Créditos & Uso"
        description="Acompanhe seu consumo, custo real e margem em tempo real."
      />
      <UsageDashboard
        usage={usage}
        plan={{
          label: plan.label,
          monthlyCredits: plan.monthlyCredits,
          priceBrl: plan.priceBrl,
        }}
        usdToBrl={USD_TO_BRL}
        monthLabel={monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
      />
    </div>
  );
}
