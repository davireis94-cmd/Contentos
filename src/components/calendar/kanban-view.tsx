"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { updatePieceStatus } from "@/app/(dashboard)/calendar/actions";
import { KanbanCard } from "./kanban-card";
import type { ContentStatus } from "@/types/app";
import type { CalendarPiece } from "./calendar-shell";

const COLUMNS: { id: ContentStatus; label: string; color: string }[] = [
  { id: "idea", label: "Ideia", color: "border-t-gray-400" },
  { id: "scripted", label: "Roteirizado", color: "border-t-blue-400" },
  { id: "editing", label: "Em edição", color: "border-t-amber-400" },
  { id: "scheduled", label: "Agendado", color: "border-t-purple-400" },
  { id: "published", label: "Publicado", color: "border-t-green-400" },
];

function KanbanColumn({
  column,
  pieces,
}: {
  column: (typeof COLUMNS)[number];
  pieces: CalendarPiece[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{column.label}</span>
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] text-muted-foreground">
            {pieces.length}
          </span>
        </div>
        <button className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Plus className="size-3.5" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-32 flex-col gap-2 rounded-lg border-t-2 bg-muted/30 p-2 transition-colors",
          column.color,
          isOver && "bg-muted/60 ring-2 ring-inset ring-muted-foreground/20"
        )}
      >
        {pieces.map((piece) => (
          <KanbanCard
            key={piece.id}
            id={piece.id}
            title={piece.title}
            format={piece.format}
            brandName={piece.brandName}
            scheduledFor={piece.scheduledFor}
          />
        ))}
      </div>
    </div>
  );
}

interface KanbanViewProps {
  pieces: CalendarPiece[];
}

export function KanbanView({ pieces }: KanbanViewProps) {
  const [items, setItems] = useState(pieces);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;
    const newStatus = over.id as ContentStatus;
    const pieceId = active.id as string;

    const piece = items.find((p) => p.id === pieceId);
    if (!piece || piece.status === newStatus) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((p) => (p.id === pieceId ? { ...p, status: newStatus } : p))
    );

    // Server sync (fire-and-forget — revalidatePath will re-sync on next navigation)
    updatePieceStatus(pieceId, newStatus);
  }

  const activePiece = items.find((p) => p.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            pieces={items.filter((p) => p.status === col.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activePiece && (
          <KanbanCard
            id={activePiece.id}
            title={activePiece.title}
            format={activePiece.format}
            brandName={activePiece.brandName}
            scheduledFor={activePiece.scheduledFor}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
