import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionContext } from "@/lib/queries/context";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import type { CalendarPiece } from "@/components/calendar/calendar-shell";
import type { ContentStatus } from "@/types/app";

export default async function CalendarPage() {
  const { user, workspace, supabase } = await getSessionContext();
  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const [{ data: pieces }, { data: brands }] = await Promise.all([
    supabase
      .from("content_pieces")
      .select(
        "id, title, format, status, start_date, brand_id, brands(id, name)"
      )
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("brands")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .order("name"),
  ]);

  const calendarPieces: CalendarPiece[] = (pieces ?? []).map((p) => {
    const brand = Array.isArray(p.brands)
      ? p.brands[0]
      : (p.brands as { id: string; name: string } | null);
    return {
      id: p.id,
      title: p.title,
      format: p.format,
      status: p.status as ContentStatus,
      scheduledFor: p.start_date,
      brandId: p.brand_id,
      brandName: brand?.name ?? "—",
    };
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Calendário editorial"
        description="Planeje e acompanhe todo o seu conteúdo em três visões: Kanban, Mensal e Gantt."
      />
      <CalendarShell pieces={calendarPieces} brands={brands ?? []} />
    </div>
  );
}
