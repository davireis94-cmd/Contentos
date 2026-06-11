"use client";

import { useState } from "react";
import { LayoutGrid, CalendarDays, GanttChartSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createIdea } from "@/app/(dashboard)/calendar/actions";
import { KanbanView } from "./kanban-view";
import { MonthlyView } from "./monthly-view";
import { GanttView } from "./gantt-view";
import type { ContentStatus } from "@/types/app";

export interface CalendarPiece {
  id: string;
  title: string;
  format: string;
  status: ContentStatus;
  scheduledFor: string | null;
  brandId: string;
  brandName: string;
}

type View = "kanban" | "monthly" | "gantt";

const VIEWS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "kanban", label: "Kanban", icon: LayoutGrid },
  { id: "monthly", label: "Mensal", icon: CalendarDays },
  { id: "gantt", label: "Gantt", icon: GanttChartSquare },
];

interface Brand {
  id: string;
  name: string;
}

interface CalendarShellProps {
  pieces: CalendarPiece[];
  brands: Brand[];
  defaultView?: View;
}

function NewIdeaDialog({ brands }: { brands: Brand[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-3.5" />
          Nova ideia
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar conteúdo</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await createIdea(fd);
            setOpen(false);
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Título / Ideia</Label>
            <Input id="title" name="title" placeholder="Ex: 5 erros de copy mais comuns" required autoFocus />
          </div>

          <div className="space-y-2">
            <Label>Marca</Label>
            <Select name="brandId" defaultValue={brands[0]?.id} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select name="format" defaultValue="carousel" required>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: "carousel", label: "Carrossel" },
                    { value: "reel", label: "Reels" },
                    { value: "story", label: "Stories" },
                    { value: "single", label: "Single" },
                  ].map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledFor">Data (opcional)</Label>
              <Input
                id="scheduledFor"
                name="scheduledFor"
                type="date"
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm">
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarShell({ pieces, brands, defaultView = "kanban" }: CalendarShellProps) {
  const [view, setView] = useState<View>(defaultView);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  view === v.id
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>
        <NewIdeaDialog brands={brands} />
      </div>

      {/* View */}
      {view === "kanban" && <KanbanView pieces={pieces} />}
      {view === "monthly" && <MonthlyView pieces={pieces} />}
      {view === "gantt" && <GanttView pieces={pieces} />}
    </div>
  );
}
