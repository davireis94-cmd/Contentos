"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { deletePiece } from "@/app/(dashboard)/calendar/actions";

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Single",
};

const FORMAT_COLORS: Record<string, string> = {
  carousel: "bg-blue-500/10 text-blue-700 border-blue-200",
  reel: "bg-purple-500/10 text-purple-700 border-purple-200",
  story: "bg-orange-500/10 text-orange-700 border-orange-200",
  single: "bg-green-500/10 text-green-700 border-green-200",
};

interface KanbanCardProps {
  id: string;
  title: string;
  format: string;
  brandName: string;
  scheduledFor: string | null;
}

export function KanbanCard({ id, title, format, brandName, scheduledFor }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-sm transition-shadow",
        isDragging ? "shadow-lg opacity-80 z-50" : "hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <GripVertical className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium leading-snug line-clamp-2">{title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("text-[10px] border", FORMAT_COLORS[format])}
            >
              {FORMAT_LABELS[format] ?? format}
            </Badge>
            <span className="text-[10px] text-muted-foreground truncate">{brandName}</span>
          </div>
          {scheduledFor && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="size-3" />
              {new Date(scheduledFor).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "short",
              })}
            </div>
          )}
        </div>
        <form
          action={deletePiece.bind(null, id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            type="submit"
            title="Excluir"
            className="rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
