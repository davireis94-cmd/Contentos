import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";

export default async function DashboardPage() {
  const { supabase, user, workspace } = await getSessionContext();
  if (!user || !workspace) return null;

  const [brands, pieces] = await Promise.all([
    supabase
      .from("brands")
      .select("id, brand_score", { count: "exact" })
      .eq("workspace_id", workspace.id),
    supabase
      .from("content_pieces")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id),
  ]);

  const brandCount = brands.count ?? 0;
  const avgScore =
    brandCount > 0
      ? Math.round(
          (brands.data ?? []).reduce((sum, b) => sum + (b.brand_score ?? 0), 0) /
            brandCount
        )
      : 0;

  const firstName = (
    (user.user_metadata?.full_name as string) ?? "Você"
  ).split(" ")[0];

  return (
    <>
      <PageHeader title="Dashboard" description={`Bom te ver, ${firstName}.`} />
      <div className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Marcas</p>
              <p className="mt-1 text-2xl font-medium">{brandCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Conteúdos criados</p>
              <p className="mt-1 text-2xl font-medium">{pieces.count ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Brand Score médio</p>
              <p className="mt-1 text-2xl font-medium">{avgScore}%</p>
            </CardContent>
          </Card>
        </div>

        {brandCount === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                <Sparkles className="size-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Configure sua primeira marca
                </p>
                <p className="text-sm text-muted-foreground">
                  O Brand Brain é a memória da IA. Quanto mais completo, melhores
                  as gerações.
                </p>
              </div>
              <Button asChild>
                <Link href="/brands/new">
                  Começar <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
