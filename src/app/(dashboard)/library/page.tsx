import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Clock, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  carousel: "border-blue-200 text-blue-700 bg-blue-50",
  reel: "border-purple-200 text-purple-700 bg-purple-50",
  story: "border-orange-200 text-orange-700 bg-orange-50",
  single: "border-green-200 text-green-700 bg-green-50",
};

const STATUS_DOT: Record<ContentStatus, string> = {
  idea: "bg-gray-400",
  scripted: "bg-blue-500",
  editing: "bg-amber-500",
  scheduled: "bg-purple-500",
  published: "bg-green-500",
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
        "id, title, format, status, start_date, created_at, brand_id, brands(name), slides"
      )
      .eq("workspace_id", workspace.id)
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("brands")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name"),
  ]);

  const filtered = (pieces ?? []).filter((p) => {
    if (brandFilter && p.brand_id !== brandFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (formatFilter && p.format !== formatFilter) return false;
    return true;
  });

  // Upcoming scheduled posts (next 30 days)
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcoming = (pieces ?? []).filter((p) => {
    if (p.status !== "scheduled" || !p.start_date) return false;
    const d = new Date(p.start_date);
    return d >= now && d <= in30;
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

      {/* Upcoming scheduled strip */}
      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Clock className="size-3" />
            Agendados — próximos 30 dias
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {upcoming.map((p) => {
              const brand = Array.isArray(p.brands)
                ? (p.brands[0] as { name: string } | null)
                : (p.brands as { name: string } | null);
              const hook = getHook(p.slides, p.title);
              return (
                <Link
                  key={p.id}
                  href={`/content/${p.id}`}
                  className="group flex min-w-[200px] max-w-[220px] shrink-0 flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] border ${FORMAT_COLORS[p.format as ContentFormat] ?? ""}`}
                    >
                      {FORMAT_LABELS[p.format as ContentFormat] ?? p.format}
                    </Badge>
                    <span className="flex items-center gap-1 text-[10px] text-purple-600">
                      <Calendar className="size-3" />
                      {new Date(p.start_date!).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                    {hook}
                  </p>
                  {brand?.name && (
                    <p className="text-[10px] text-muted-foreground">{brand.name}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Content list */}
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
        <div className="divide-y rounded-lg border bg-card overflow-hidden">
          {filtered.map((piece) => {
            const brand = Array.isArray(piece.brands)
              ? (piece.brands[0] as { name: string } | null)
              : (piece.brands as { name: string } | null);
            const hook = getHook(piece.slides, piece.title);

            return (
              <Link
                key={piece.id}
                href={`/content/${piece.id}`}
                className="group flex items-start gap-4 px-4 py-3.5 transition-colors hover:bg-accent/30"
              >
                {/* Status dot */}
                <div className="mt-1.5 shrink-0">
                  <div
                    className={`size-2 rounded-full ${STATUS_DOT[piece.status as ContentStatus] ?? "bg-gray-400"}`}
                  />
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                    {hook}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] border ${FORMAT_COLORS[piece.format as ContentFormat] ?? ""}`}
                    >
                      {FORMAT_LABELS[piece.format as ContentFormat] ?? piece.format}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {STATUS_LABELS[piece.status as ContentStatus] ?? piece.status}
                    </span>
                    {brand?.name && (
                      <>
                        <span className="text-[10px] text-muted-foreground/40">·</span>
                        <span className="text-[11px] text-muted-foreground">{brand.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="shrink-0 text-right">
                  {piece.start_date ? (
                    <div className="flex items-center gap-1 text-[11px] text-purple-600">
                      <Calendar className="size-3" />
                      {new Date(piece.start_date).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(piece.created_at).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getHook(slides: unknown, fallback: string): string {
  try {
    const s = slides as { title?: string }[] | null;
    return s?.[0]?.title ?? fallback;
  } catch {
    return fallback;
  }
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
