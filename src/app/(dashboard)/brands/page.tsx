import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";

export default async function BrandsPage() {
  const { supabase, workspace } = await getSessionContext();
  if (!workspace) return null;

  const { data: brands } = await supabase
    .from("brands")
    .select("id, name, description, logo_url, brand_score")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  return (
    <>
      <PageHeader
        title="Brand Brain"
        description="A memória da IA sobre cada marca."
      >
        <Button asChild size="sm">
          <Link href="/brands/new">
            <Plus className="size-4" /> Nova marca
          </Link>
        </Button>
      </PageHeader>

      <div className="flex-1 p-6">
        {(brands ?? []).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Sparkles className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">Nenhuma marca ainda</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Crie sua primeira marca e ensine a IA a escrever com a sua
                identidade.
              </p>
              <Button asChild className="mt-2">
                <Link href="/brands/new">Criar marca</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(brands ?? []).map((brand) => (
              <Link key={brand.id} href={`/brands/${brand.id}`}>
                <Card className="transition-colors hover:border-foreground/20">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-3">
                      {brand.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brand.logo_url}
                          alt=""
                          className="size-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-sm font-medium">
                          {brand.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {brand.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {brand.description ?? "Sem descrição"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Brand Score
                        </span>
                        <span className="font-medium">
                          {brand.brand_score}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-accent">
                        <div
                          className="h-full rounded-full bg-foreground transition-all"
                          style={{ width: `${brand.brand_score}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
