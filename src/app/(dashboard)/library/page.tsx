import { redirect } from "next/navigation";
import Link from "next/link";
import { Wand2, Eye, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { STATUS_LABELS } from "@/types/app";
import type { ContentStatus, ContentFormat } from "@/types/app";

const FORMAT_LABELS: Record<ContentFormat, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Single",
};

const FORMAT_COLORS: Record<ContentFormat, string> = {
  carousel: "bg-blue-500/10 text-blue-700 border-blue-200",
  reel: "bg-purple-500/10 text-purple-700 border-purple-200",
  story: "bg-orange-500/10 text-orange-700 border-orange-200",
  single: "bg-green-500/10 text-green-700 border-green-200",
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  idea: "bg-gray-100 text-gray-600",
  scripted: "bg-blue-100 text-blue-700",
  editing: "bg-amber-100 text-amber-700",
  scheduled: "bg-purple-100 text-purple-700",
  published: "bg-green-100 text-green-700",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; status?: string; format?: string }>;
}) {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const { brand: brandFilter, status: statusFilter, format: formatFilter } =
    await searchParams;

  const [{ data: pieces }, { data: brands }] = await Promise.all([
    supabase
      .from("content_pieces")
      .select(
        "id, title, format, status, scheduled_for, created_at, brand_id, brands(name)"
      )
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("brands")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name"),
  ]);

  // Client-side filtering (small dataset for personal use)
  const filtered = (pieces ?? []).filter((p) => {
    if (brandFilter && p.brand_id !== brandFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (formatFilter && p.format !== formatFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Biblioteca"
        description="Todo o conteúdo gerado e planejado no seu workspace."
      >
        <Button asChild size="sm">
          <Link href="/generate">
            <Wand2 className="mr-1.5 size-3.5" />
            Gerar conteúdo
          </Link>
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterLink label="Todos" href="/library" active={!brandFilter && !statusFilter && !formatFilter} />
        {(brands ?? []).map((b) => (
          <FilterLink
            key={b.id}
            label={b.name}
            href={`/library?brand=${b.id}`}
            active={brandFilter === b.id}
          />
        ))}
        <div className="h-6 w-px bg-border" />
        {(["idea", "scripted", "editing", "scheduled", "published"] as ContentStatus[]).map((s) => (
          <FilterLink
            key={s}
            label={STATUS_LABELS[s]}
            href={`/library?status=${s}`}
            active={statusFilter === s}
          />
        ))}
        <div className="h-6 w-px bg-border" />
        {(["carousel", "reel", "story", "single"] as ContentFormat[]).map((f) => (
          <FilterLink
            key={f}
            label={FORMAT_LABELS[f]}
            href={`/library?format=${f}`}
            active={formatFilter === f}
          />
        ))}
      </div>

      {/* Content grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <Wand2 className="mb-3 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">Nenhum conteúdo ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Gere seu primeiro post na aba Gerar conteúdo.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/generate">Ir para o gerador</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((piece) => {
            const brand = Array.isArray(piece.brands)
              ? piece.brands[0]
              : (piece.brands as { name: string } | null);

            return (
              <Card
                key={piece.id}
                className="group transition-shadow hover:shadow-md"
              >
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] border ${FORMAT_COLORS[piece.format as ContentFormat] ?? ""}`}
                    >
                      {FORMAT_LABELS[piece.format as ContentFormat] ?? piece.format}
                    </Badge>
                    <Badge
                      className={`text-[10px] border-0 ${STATUS_COLORS[piece.status as ContentStatus] ?? ""}`}
                    >
                      {STATUS_LABELS[piece.status as ContentStatus] ?? piece.status}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium leading-snug line-clamp-3">
                    {piece.title}
                  </p>

                  <div className="mt-auto space-y-1">
                    {brand?.name && (
                      <p className="text-[11px] text-muted-foreground">
                        {brand.name}
                      </p>
                    )}
                    {piece.scheduled_for && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="size-3" />
                        {new Date(piece.scheduled_for).toLocaleDateString("pt-BR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/content/${piece.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-md border py-1.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
                  >
                    <Eye className="size-3.5" />
                    Ver conteúdo
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
